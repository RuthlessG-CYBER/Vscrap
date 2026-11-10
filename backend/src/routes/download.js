const express = require('express');
const path = require('path');
const axios = require('axios');
const { assertSafeUrl } = require('../middleware/ssrfGuard');
const config = require('../config');
const {
  isShareUrl,
  extractMediaInfo,
  listFormats,
  prepareShareStream,
  spawnMuxStream,
} = require('../services/mediaExtractor');

const router = express.Router();

const ALLOWED_CONTENT_TYPE_PREFIXES = ['image/', 'video/', 'audio/'];
const USER_AGENT = 'VScrap/1.0 (+https://vscrap.app)';

function isAllowedContentType(contentType) {
  if (!contentType) return false;
  return ALLOWED_CONTENT_TYPE_PREFIXES.some((prefix) => contentType.toLowerCase().startsWith(prefix));
}

function mediaTypeFromContentType(contentType = '') {
  const value = contentType.toLowerCase();
  if (value.startsWith('image/')) return 'image';
  if (value.startsWith('video/')) return 'video';
  if (value.startsWith('audio/')) return 'audio';
  return 'file';
}

function sanitizeFilename(name) {
  const cleaned = String(name || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return cleaned || '';
}

function extensionForContentType(contentType = '') {
  const value = contentType.toLowerCase();
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
  };
  return map[value.split(';')[0].trim()] || 'bin';
}

function filenameFromContentDisposition(header) {
  if (!header || typeof header !== 'string') return '';

  // RFC 5987: filename*=UTF-8''my%20file.mp4
  const encoded = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (encoded) {
    try {
      return sanitizeFilename(decodeURIComponent(encoded[1].trim()));
    } catch {
      // Fall through to the ASCII filename below.
    }
  }

  const plain = header.match(/filename="?([^";]+)"?/i);
  return plain ? sanitizeFilename(plain[1].trim()) : '';
}

function filenameFromUrl(targetUrl) {
  try {
    const base = path.basename(new URL(targetUrl).pathname);
    return sanitizeFilename(decodeURIComponent(base));
  } catch {
    return '';
  }
}

function resolveFilename({ contentDisposition, targetUrl, contentType }) {
  const suggested = filenameFromContentDisposition(contentDisposition);
  if (suggested) return suggested;

  const fromUrl = filenameFromUrl(targetUrl);
  if (fromUrl && fromUrl.includes('.')) return fromUrl;

  const extension = extensionForContentType(contentType);
  return `vscrap-${Date.now()}.${extension}`;
}

/**
 * Build a Content-Disposition value Node will accept. Header values must be
 * Latin-1, so titles containing curly quotes, emoji, or non-Latin scripts get
 * an ASCII fallback plus an RFC 5987 UTF-8 name.
 */
function contentDispositionValue(filename) {
  const original = String(filename || 'vscrap-download');
  const ascii =
    original
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7e]/g, '')
      .replace(/["\\]/g, '')
      .replace(/\s+/g, ' ')
      .trim() || 'vscrap-download';
  const encoded = encodeURIComponent(original).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

function attachmentHeaders(media) {
  return {
    'Content-Type': media.contentType,
    'Content-Disposition': contentDispositionValue(media.filename),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  };
}

/**
 * Stream a resolved share link back to the client. Video/audio is muxed on the
 * fly into a fragmented MP4 (so the phone starts receiving bytes before the
 * whole file is ready); images are proxied directly from the CDN.
 */
async function pipeShareMedia(req, res, next, media) {
  if (media.mode === 'proxy') {
    let upstream;
    try {
      upstream = await axios.get(media.inputs[0], {
        responseType: 'stream',
        timeout: 15000,
        maxRedirects: 3,
        headers: { 'User-Agent': USER_AGENT, Accept: 'image/*, */*;q=0.5' },
        validateStatus: (status) => status < 500,
      });
    } catch (error) {
      throw describeUpstreamError(error);
    }

    if (upstream.status >= 400) {
      if (upstream.data && typeof upstream.data.destroy === 'function') upstream.data.destroy();
      throw describeUpstreamError(upstream);
    }

    const contentType = upstream.headers['content-type'];
    if (!isAllowedContentType(contentType)) {
      if (upstream.data && typeof upstream.data.destroy === 'function') upstream.data.destroy();
      const err = new Error('That post does not contain a downloadable file');
      err.status = 422;
      throw err;
    }

    const contentLength = parseInt(upstream.headers['content-length'] || '0', 10);
    res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', String(contentLength));
    res.setHeader('Content-Disposition', contentDispositionValue(media.filename));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.on('close', () => {
      if (upstream.data && typeof upstream.data.destroy === 'function') upstream.data.destroy();
    });
    upstream.data.pipe(res);
    return;
  }

  // Set headers before spawning so a bad header value can never orphan ffmpeg.
  for (const [name, value] of Object.entries(attachmentHeaders(media))) {
    res.setHeader(name, value);
  }

  // Audio is streamed straight to the client as MP3 (universally playable).
  if (media.audioBitrate) {
    const child = spawnMuxStream(media, 'pipe:1');
    const timer = setTimeout(() => child.kill('SIGKILL'), config.shareDownloadTimeoutMs);
    const stop = () => {
      clearTimeout(timer);
      child.kill('SIGKILL');
    };

    child.on('error', (error) => {
      stop();
      if (!res.headersSent) {
        next(upstreamFailure('The download could not be prepared'));
      } else {
        res.destroy(error);
      }
    });
    child.stdout.on('error', (error) => {
      stop();
      res.destroy(error);
    });

    res.on('close', stop);

    // HLS does not declare a size, so enforce the byte cap as bytes flow.
    let streamedBytes = 0;
    child.stdout.on('data', (chunk) => {
      streamedBytes += chunk.length;
      if (streamedBytes > config.maxDownloadBytes) {
        stop();
        res.destroy();
      }
    });

    // Send headers right away so the app does not time out while ffmpeg fills
    // its first buffers. The body is chunked because its final size is unknown.
    res.flushHeaders();
    child.stdout.pipe(res);
    return;
  }

  // Stream a fragmented MP4 as ffmpeg produces it. Buffering the complete
  // encode to disk before sending the body leaves native clients waiting on a
  // silent response; Expo's downloader can time out while a long video muxes.
  const child = spawnMuxStream(media, 'pipe:1');
  const timer = setTimeout(() => child.kill('SIGKILL'), config.shareDownloadTimeoutMs);
  const stop = () => {
    clearTimeout(timer);
    child.kill('SIGKILL');
  };

  child.on('error', (error) => {
    stop();
    if (!res.headersSent) {
      next(upstreamFailure('The download could not be prepared'));
    } else {
      res.destroy(error);
    }
  });

  let streamedBytes = 0;
  child.stdout.on('data', (chunk) => {
    if (res.destroyed) return;
    streamedBytes += chunk.length;
    if (streamedBytes > config.maxDownloadBytes) {
      stop();
      res.destroy();
      return;
    }
    if (!res.write(chunk)) {
      child.stdout.pause();
      res.once('drain', () => child.stdout.resume());
    }
  });

  child.stdout.on('error', (error) => {
    stop();
    if (!res.destroyed) res.destroy(error);
  });

  res.on('close', stop);
  child.on('close', (code) => {
    clearTimeout(timer);
    if (code === 0) {
      if (!res.destroyed) res.end();
      return;
    }
    if (!res.destroyed) res.destroy(new Error('Video encoding failed'));
  });

  res.flushHeaders();
}

function upstreamFailure(message, status = 502) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function failureForStatus(status) {
  if (status === 404) return upstreamFailure('The media file could not be found at that URL', 404);
  if (status === 401 || status === 403) {
    return upstreamFailure('The source refused access to that file', 502);
  }
  if (status === 413) return upstreamFailure('The media file is too large', 413);
  if (status && status < 500) return upstreamFailure('The source rejected the request', 422);
  return upstreamFailure('Could not reach the media source');
}

function describeUpstreamError(error) {
  return failureForStatus(error.response && error.response.status);
}

/**
 * Fetch enough metadata to describe a file before the user commits to a
 * download. HEAD is preferred because it avoids buffering the body. Some
 * servers reject HEAD, so fall back to a one-byte ranged GET.
 */
async function fetchMediaMetadata(targetUrl) {
  const requestConfig = {
    timeout: 8000,
    maxRedirects: 3,
    headers: { 'User-Agent': USER_AGENT, Accept: 'image/*, video/*, audio/*;q=0.9, */*;q=0.5' },
    validateStatus: (status) => status < 500,
  };

  let response;
  let needsFallback = false;

  try {
    response = await axios.head(targetUrl, requestConfig);
    // HEAD is often disallowed or stripped of metadata. Retry with a ranged
    // GET rather than treating those responses as a hard failure.
    needsFallback = response.status === 403 || response.status === 405;
    if (response.status >= 400 && !needsFallback) {
      throw failureForStatus(response.status);
    }
  } catch (error) {
    if (error.status) throw error;
    needsFallback = true;
  }

  if (needsFallback || !response) {
    const rangeResponse = await axios.get(targetUrl, {
      ...requestConfig,
      responseType: 'stream',
      headers: { ...requestConfig.headers, Range: 'bytes=0-0' },
      validateStatus: (status) => status < 500,
    });
    if (rangeResponse.data && typeof rangeResponse.data.destroy === 'function') {
      rangeResponse.data.destroy();
    }
    if (rangeResponse.status >= 400) {
      throw failureForStatus(rangeResponse.status);
    }
    response = rangeResponse;
  }

  const contentType = response.headers['content-type'];
  if (!isAllowedContentType(contentType)) {
    const err = new Error('URL does not point to an image, video, or audio file');
    err.status = 422;
    throw err;
  }

  let contentLength = parseInt(response.headers['content-length'] || '0', 10);

  // A ranged GET reports the full size in Content-Range: bytes 0-0/12345.
  const contentRange = response.headers['content-range'];
  if (contentRange) {
    const total = contentRange.match(/\/(\d+)$/);
    if (total) contentLength = parseInt(total[1], 10);
  }

  if (contentLength && contentLength > config.maxDownloadBytes) {
    const err = new Error('File exceeds the maximum allowed download size');
    err.status = 413;
    throw err;
  }

  return {
    contentType,
    contentLength: contentLength || null,
    mediaType: mediaTypeFromContentType(contentType),
    filename: resolveFilename({
      contentDisposition: response.headers['content-disposition'],
      targetUrl,
      contentType,
    }),
  };
}

/**
 * POST /api/download/formats
 * Body: { url: string }
 * Lists selectable video qualities and MP3 audio options for a share link.
 */
router.post('/formats', async (req, res, next) => {
  try {
    const { url } = req.body || {};
    if (typeof url !== 'string' || !url.trim()) {
      const err = new Error('A "url" string is required');
      err.status = 400;
      throw err;
    }

    const parsed = await assertSafeUrl(url);
    if (!isShareUrl(parsed.toString())) {
      res.json({ url: parsed.toString(), formats: [] });
      return;
    }

    const result = await listFormats(parsed.toString());
    res.json({ url: parsed.toString(), ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/download/info
 * Body: { url: string, format?: string }
 * Validates the URL and returns metadata the client can show before
 * committing to a full download. The client never talks to the target host.
 */
router.post('/info', async (req, res, next) => {
  try {
    const { url, format } = req.body || {};
    if (typeof url !== 'string' || !url.trim()) {
      const err = new Error('A "url" string is required');
      err.status = 400;
      throw err;
    }

    const parsed = await assertSafeUrl(url);

    // Supported social share links are pages, not files. Resolve them through
    // the extractor instead of the direct-fetch content-type check.
    if (isShareUrl(parsed.toString())) {
      const metadata = await extractMediaInfo(parsed.toString(), format);
      res.json({
        url: parsed.toString(),
        ...metadata,
      });
      return;
    }

    const metadata = await fetchMediaMetadata(parsed.toString());

    res.json({
      url: parsed.toString(),
      ...metadata,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/download/stream?url=...
 * Re-validates the URL (never trust a prior check alone) and streams the
 * remote file through this server to the client, enforcing a byte cap.
 */
router.get('/stream', async (req, res, next) => {
  try {
    const { url, format } = req.query;
    if (typeof url !== 'string' || !url.trim()) {
      const err = new Error('A "url" query parameter is required');
      err.status = 400;
      throw err;
    }

    const parsed = await assertSafeUrl(url);

    // Share links are resolved to direct stream URLs, then muxed on the fly so
    // the phone starts receiving bytes right away.
    if (isShareUrl(parsed.toString())) {
      const media = await prepareShareStream(parsed.toString(), format);
      await pipeShareMedia(req, res, next, media);
      return;
    }

    let upstream;
    try {
      upstream = await axios.get(parsed.toString(), {
        responseType: 'stream',
        timeout: 15000,
        maxRedirects: 3,
        headers: { 'User-Agent': USER_AGENT, Accept: 'image/*, video/*, audio/*;q=0.9, */*;q=0.5' },
        validateStatus: (status) => status < 500,
      });
    } catch (error) {
      throw describeUpstreamError(error);
    }

    if (upstream.status >= 400) {
      if (upstream.data && typeof upstream.data.destroy === 'function') upstream.data.destroy();
      throw describeUpstreamError(upstream);
    }

    const contentType = upstream.headers['content-type'];
    const contentLength = parseInt(upstream.headers['content-length'] || '0', 10);

    if (!isAllowedContentType(contentType)) {
      if (upstream.data && typeof upstream.data.destroy === 'function') upstream.data.destroy();
      const err = new Error('URL does not point to an image, video, or audio file');
      err.status = 422;
      throw err;
    }
    if (contentLength && contentLength > config.maxDownloadBytes) {
      if (upstream.data && typeof upstream.data.destroy === 'function') upstream.data.destroy();
      const err = new Error('File exceeds the maximum allowed download size');
      err.status = 413;
      throw err;
    }

    const filename = resolveFilename({
      contentDisposition: upstream.headers['content-disposition'],
      targetUrl: parsed.toString(),
      contentType,
    });

    res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', String(contentLength));
    res.setHeader('Content-Disposition', contentDispositionValue(filename));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');

    let bytesStreamed = 0;
    upstream.data.on('data', (chunk) => {
      bytesStreamed += chunk.length;
      if (bytesStreamed > config.maxDownloadBytes) {
        upstream.data.destroy();
        res.destroy();
      }
    });

    // Stop pulling from the source if the client goes away.
    res.on('close', () => {
      if (!res.writableEnded && upstream.data && typeof upstream.data.destroy === 'function') {
        upstream.data.destroy();
      }
    });

    upstream.data.on('error', (error) => {
      if (!res.headersSent) {
        next(upstreamFailure('The download was interrupted'));
      } else {
        res.destroy(error);
      }
    });

    upstream.data.pipe(res);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
