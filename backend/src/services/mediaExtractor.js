const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');
const config = require('../config');

const BACKEND_ROOT = path.resolve(__dirname, '..', '..');

// yt-dlp + ffmpeg live in backend/.venv (created by `pip install -r requirements.txt`).
// Both can be overridden for deployments that install them globally.
const YTDLP_BIN = process.env.YTDLP_PATH || path.join(BACKEND_ROOT, '.venv', 'bin', 'yt-dlp');
const PYTHON_BIN = process.env.YTDLP_PYTHON || path.join(BACKEND_ROOT, '.venv', 'bin', 'python');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

let runtimeCookiesFile;

/**
 * yt-dlp writes updated cookies back to the supplied jar. Render Secret Files
 * are read-only, so mirror them into a private, writable temp directory first.
 */
function getCookiesFile() {
  const configuredPath = process.env.YTDLP_COOKIES_FILE;
  if (!configuredPath || !fs.existsSync(configuredPath)) return null;

  try {
    const descriptor = fs.openSync(configuredPath, 'r+');
    fs.closeSync(descriptor);
    return configuredPath;
  } catch {
    if (!runtimeCookiesFile) {
      const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'vscrap-ytdlp-'));
      runtimeCookiesFile = path.join(tempDirectory, 'cookies.txt');
      fs.writeFileSync(runtimeCookiesFile, fs.readFileSync(configuredPath), {
        flag: 'wx',
        mode: 0o600,
      });
    }
    return runtimeCookiesFile;
  }
}

const SHARE_HOSTS = [
  { pattern: /^(?:www\.|m\.|music\.)?youtube\.com$/i, source: 'youtube' },
  { pattern: /^youtu\.be$/i, source: 'youtube' },
  { pattern: /^(?:www\.)?instagram\.com$/i, source: 'instagram' },
  { pattern: /^instagr\.am$/i, source: 'instagram' },
  { pattern: /^(?:www\.|m\.|web\.)?facebook\.com$/i, source: 'facebook' },
  { pattern: /^fb\.watch$/i, source: 'facebook' },
];

const INSTAGRAM_HOST = /^(?:www\.)?instagram\.com$/i;

const CONTENT_TYPES = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  mov: 'video/quicktime',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  opus: 'audio/ogg',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function shareSource(rawUrl) {
  try {
    const { hostname } = new URL(rawUrl);
    const match = SHARE_HOSTS.find((entry) => entry.pattern.test(hostname));
    return match ? match.source : null;
  } catch {
    return null;
  }
}

function isShareUrl(rawUrl) {
  return shareSource(rawUrl) !== null;
}

function sanitizeFilename(name) {
  return String(name || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

/**
 * Parse a client-supplied format id. Anything unrecognised falls back to the
 * default "best video up to MAX_VIDEO_HEIGHT".
 */
function parseFormatSelection(format) {
  const value = String(format || '').trim();
  const audio = value.match(/^audio:mp3:(\d{2,3})$/i);
  if (audio) {
    const bitrate = Math.min(320, Math.max(64, parseInt(audio[1], 10)));
    return { kind: 'audio', bitrate };
  }
  const video = value.match(/^video:(\d{3,4}|best)$/i);
  if (video) {
    return {
      kind: 'video',
      height: video[1].toLowerCase() === 'best' ? null : parseInt(video[1], 10),
    };
  }
  return { kind: 'video', height: null };
}

function formatSelector(selection = { kind: 'video', height: null }) {
  if (selection.kind === 'audio') {
    return [
      'ba[protocol^=m3u8]',
      'ba[ext=m4a]',
      'ba',
      'b',
    ].join('/');
  }

  const requested = Number(selection.height);
  const height = Number.isFinite(requested) && requested > 0 ? requested : config.maxVideoHeight;
  // Prefer HLS (YouTube throttles direct DASH URLs) and H.264/AAC for playback
  // compatibility. Single-file sources such as Instagram and Facebook fall through to `b`.
  return [
    `bv*[height<=${height}][vcodec^=avc1][protocol^=m3u8]+ba[protocol^=m3u8]`,
    `bv*[height<=${height}][ext=mp4][vcodec^=avc1]+ba[ext=m4a]`,
    `bv*[height<=${height}][vcodec^=avc1]+ba`,
    `bv*[height<=${height}][ext=mp4]+ba[ext=m4a]`,
    `bv*[height<=${height}]+ba`,
    'b[ext=mp4]',
    'b',
  ].join('/');
}

let cachedFfmpeg;
function resolveFfmpeg() {
  if (cachedFfmpeg !== undefined) return cachedFfmpeg;

  const candidates = [
    process.env.FFMPEG_PATH,
    path.join(BACKEND_ROOT, 'bin', 'ffmpeg'),
    '/usr/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
  ];
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      cachedFfmpeg = candidate;
      return cachedFfmpeg;
    }
  }

  // imageio-ffmpeg ships a static binary with the Python dependencies.
  try {
    const found = execFileSync(
      PYTHON_BIN,
      ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'],
      { timeout: 10000 }
    )
      .toString()
      .trim();
    if (found && fs.existsSync(found)) {
      cachedFfmpeg = found;
      return cachedFfmpeg;
    }
  } catch {
    // Fall through to "not installed".
  }

  cachedFfmpeg = null;
  return cachedFfmpeg;
}

function extractorUnavailableError() {
  const err = new Error(
    'Share-link support is not installed on this backend. Run "pip install -r requirements.txt" in the backend folder.'
  );
  err.status = 503;
  return err;
}

/**
 * Run yt-dlp, buffering stdout and keeping the tail of stderr for diagnostics.
 */
function runYtDlp(args, { timeoutMs = 30000 } = {}) {
  if (!fs.existsSync(YTDLP_BIN)) return Promise.reject(extractorUnavailableError());

  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      const err = new Error('The source took too long to respond.');
      err.status = 504;
      reject(err);
    }, timeoutMs);

    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-8000);
    });

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error.code === 'ENOENT') {
        reject(extractorUnavailableError());
        return;
      }
      const err = new Error('Could not start the media extractor.');
      err.status = 500;
      reject(err);
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const stdout = Buffer.concat(chunks).toString();
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      if (config.nodeEnv !== 'production' && stderr) {
        console.warn('[extractor] yt-dlp failed:', stderr.trim().split('\n').slice(-4).join(' | '));
      }
      reject(extractorFailure(stderr));
    });
  });
}

function extractorFailure(stderr) {
  const text = String(stderr || '').toLowerCase();
  let message = 'Could not read that link. It may be private, region-locked, or no longer available.';

  if (text.includes('private video') || text.includes('private post') || text.includes('is private')) {
    message = 'That post is private, so it cannot be downloaded.';
  } else if (
    text.includes('login required') ||
    text.includes('sign in') ||
    text.includes('cookies') ||
    text.includes('rate-limit') ||
    text.includes('rate limit')
  ) {
    message =
      'This post needs a logged-in session. Try a public post, or configure cookies on the backend.';
  } else if (text.includes('not available in your country') || text.includes('geo')) {
    message = 'That video is not available in this region.';
  } else if (text.includes('unsupported url')) {
    message = 'That link is not supported. Paste a YouTube, Instagram, or Facebook post link.';
  } else if (text.includes('video unavailable') || text.includes('has been removed')) {
    message = 'That video is unavailable or has been removed.';
  } else if (text.includes('age-restricted') || text.includes('age restricted')) {
    message = 'That video is age-restricted and needs a logged-in session.';
  }

  const err = new Error(message);
  err.status = 422;
  return err;
}

/**
 * Instagram's /share/... links are redirects. Resolve them to the canonical
 * post URL before handing them to yt-dlp.
 */
async function resolveInstagramShare(rawUrl) {
  let current = rawUrl;
  for (let hop = 0; hop < 5; hop += 1) {
    let hostname;
    try {
      hostname = new URL(current).hostname;
    } catch {
      return rawUrl;
    }
    if (!INSTAGRAM_HOST.test(hostname)) return rawUrl;

    let response;
    try {
      response = await axios.get(current, {
        maxRedirects: 0,
        timeout: 10000,
        responseType: 'stream',
        validateStatus: (status) => status >= 200 && status < 400,
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      });
    } catch (error) {
      const location = error.response && error.response.headers && error.response.headers.location;
      if (!location) return current;
      const next = new URL(location, current);
      if (!INSTAGRAM_HOST.test(next.hostname)) return rawUrl;
      current = next.toString();
      continue;
    }

    if (response.data && typeof response.data.destroy === 'function') {
      response.data.destroy();
    }

    const location = response.headers && response.headers.location;
    if (response.status >= 300 && location) {
      const next = new URL(location, current);
      if (!INSTAGRAM_HOST.test(next.hostname)) return rawUrl;
      current = next.toString();
      continue;
    }

    return current;
  }
  return current;
}

async function resolveShareUrl(rawUrl) {
  const source = shareSource(rawUrl);
  if (!source) return rawUrl;
  if (source === 'instagram') return resolveInstagramShare(rawUrl);
  return rawUrl;
}

function pickEntry(info) {
  if (!info) return null;
  if (info._type === 'playlist') {
    const entry = Array.isArray(info.entries) ? info.entries.find(Boolean) : null;
    return entry || null;
  }
  return info;
}

/**
 * Only trust explicit sizes. yt-dlp's HLS bitrate metadata is often inflated,
 * so a duration x bitrate estimate would reject valid downloads. HLS streams
 * report no size here; the byte cap is enforced while they are streaming.
 */
function sumKnownSize(entries) {
  let total = 0;
  for (const entry of entries) {
    const size = entry.filesize || entry.filesize_approx;
    if (!size) return null;
    total += size;
  }
  return total || null;
}

function assertWithinSizeLimit(bytes) {
  if (bytes && bytes > config.maxDownloadBytes) {
    const err = new Error('File exceeds the maximum allowed download size');
    err.status = 413;
    throw err;
  }
}

function estimateVideoSizeBytes(durationSeconds, height, format) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;

  const isHls = String(format.protocol || '').startsWith('m3u8');
  const hasAudio = Boolean(format.acodec && format.acodec !== 'none');
  const outputAudioKbps = 128;
  const sourceAudioKbps = Number(format.abr) || 0;
  const knownSize = Number(format.filesize || format.filesize_approx);

  if (knownSize > 0 && !isHls) {
    const audioAdjustmentKbps = hasAudio
      ? outputAudioKbps - sourceAudioKbps
      : outputAudioKbps;
    return Math.max(
      1,
      Math.round(knownSize + (audioAdjustmentKbps * durationSeconds * 1000) / 8)
    );
  }

  // HLS bitrate metadata can be inflated, so use a resolution-based estimate.
  const fallbackKbps =
    height >= 2160 ? 12000 :
    height >= 1440 ? 8000 :
    height >= 1080 ? 4500 :
    height >= 720 ? 2500 :
    height >= 480 ? 1000 :
    height >= 360 ? 700 :
    height >= 240 ? 400 : 200;
  const reportedKbps = Number(format.tbr);
  const totalKbps = !isHls && reportedKbps > 0 ? reportedKbps : fallbackKbps;
  const videoKbps = hasAudio && sourceAudioKbps > 0
    ? Math.max(1, totalKbps - sourceAudioKbps)
    : totalKbps;

  return Math.round(((videoKbps + outputAudioKbps) * durationSeconds * 1000) / 8);
}

/**
 * Read title/size without downloading the media.
 */
async function extractMediaInfo(rawUrl, format) {
  const selection = parseFormatSelection(format);
  const targetUrl = await resolveShareUrl(rawUrl);
  const source = shareSource(rawUrl) || 'share';

  // Social share links need yt-dlp to resolve. Delegate to
  // listFormats for share links so we use the same proven yt-dlp invocation
  // (cookies, no -f flag) that already works for the formats endpoint.
  if (source === 'instagram' || source === 'youtube' || source === 'facebook') {
    const listResult = await listFormats(targetUrl);
    const videoOptions = listResult.formats.filter((f) => f.kind === 'video');
    const audioOptions = listResult.formats.filter((f) => f.kind === 'audio');
    const chosen = selection.kind === 'audio'
      ? audioOptions.find((f) => f.bitrate === selection.bitrate) || audioOptions[0]
      : selection.height
        ? videoOptions.find((f) => f.height === selection.height) ||
          videoOptions.find((f) => f.height < selection.height) ||
          videoOptions[0]
        : videoOptions[0];
    const ext = selection.kind === 'audio' ? 'mp3' : 'mp4';
    const title = sanitizeFilename(listResult.title || 'vscrap-video');
    const durationSeconds = listResult.durationSeconds || null;
    const filename = `${title || 'vscrap-video'}.${ext}`;
    const contentLength = chosen?.filesize ?? null;
    assertWithinSizeLimit(contentLength);

    return {
      source,
      title: listResult.title || null,
      contentType:
        selection.kind === 'audio' ? 'audio/mpeg' : 'video/mp4',
      contentLength,
      sizeEstimated: contentLength !== null,
      mediaType: selection.kind === 'audio' ? 'audio' : 'video',
      filename,
      durationSeconds,
      format: format || null,
    };
  }

  // Direct file URLs: fetch metadata without downloading.
  const args = [
    '-J',
    '--skip-download',
    '--no-playlist',
    '--playlist-items',
    '1',
    '--no-warnings',
    '--socket-timeout',
    '20',
  ];

  // Only pass -f when a specific format is requested.
  if (format) {
    args.push('-f', formatSelector(selection));
  }
  args.push(targetUrl);

  const { stdout } = await runYtDlp(args, { timeoutMs: 45000 });
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    const err = new Error('Could not read information about that link.');
    err.status = 422;
    throw err;
  }

  const info = pickEntry(parsed);
  if (!info) {
    const err = new Error('That link does not contain a downloadable media file.');
    err.status = 422;
    throw err;
  }

  const ext = selection.kind === 'audio' ? 'mp3' : String(info.ext || 'mp4').toLowerCase();
  const title = sanitizeFilename(info.title || info.description || 'vscrap-video');
  const durationExact = Number.isFinite(info.duration) ? info.duration : null;
  const durationSeconds2 = durationExact === null ? null : Math.round(durationExact);
  const filename2 = `${title || 'vscrap-video'}.${ext === 'webm' ? 'webm' : ext}`;
  const contentLength =
    selection.kind === 'audio'
      ? durationExact
        ? Math.round((durationExact * selection.bitrate * 1000) / 8)
        : null
      : sumKnownSize(formatEntries(info));
  assertWithinSizeLimit(contentLength);

  return {
    source,
    title: info.title || null,
    contentType: CONTENT_TYPES[ext] || (selection.kind === 'audio' ? 'audio/mpeg' : 'video/mp4'),
    contentLength,
    mediaType: selection.kind === 'audio' ? 'audio' : 'video',
    filename: filename2,
    durationSeconds: durationSeconds2,
    format: format || null,
  };
}

function scoreFormat(format) {
  let score = 0;
  if (/^avc1/i.test(String(format.vcodec || ''))) score += 40;
  if (format.ext === 'mp4') score += 20;
  if (String(format.protocol || '').startsWith('m3u8')) score += 15;
  if (format.acodec && format.acodec !== 'none') score += 10;
  score += Number(format.fps) || 0;
  return score;
}

/**
 * List the qualities the client can choose from. Video entries are grouped by
 * height; MP3 options are generated because the source audio is re-encoded.
 */
async function listFormats(rawUrl) {
  const targetUrl = await resolveShareUrl(rawUrl);
  const source = shareSource(rawUrl) || 'share';
  const args = [
    '-J',
    '--skip-download',
    '--no-playlist',
    '--playlist-items',
    '1',
    '--no-warnings',
    '--socket-timeout',
    '20',
  ];

  const cookiesFile = getCookiesFile();
  if (cookiesFile) {
    args.push('--cookies', cookiesFile);
  }
  args.push(targetUrl);

  const { stdout } = await runYtDlp(args, { timeoutMs: 45000 });
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    const err = new Error('Could not read information about that link.');
    err.status = 422;
    throw err;
  }

  const info = pickEntry(parsed);
  if (!info) {
    const err = new Error('That link does not contain a downloadable media file.');
    err.status = 422;
    throw err;
  }

  const durationExact = Number.isFinite(info.duration) ? info.duration : null;
  const durationSeconds = durationExact === null ? null : Math.round(durationExact);
  const sourceFormats = Array.isArray(info.formats) ? info.formats : [info];

  const byHeight = new Map();
  for (const format of sourceFormats) {
    const height = Number(format.height);
    if (!Number.isFinite(height) || height <= 0) continue;
    if (!format.vcodec || format.vcodec === 'none') continue;
    if (height > config.maxVideoHeight) continue;

    const current = byHeight.get(height);
    if (!current || scoreFormat(format) > scoreFormat(current)) {
      byHeight.set(height, format);
    }
  }

  const videoFormats = [...byHeight.entries()]
    .sort((a, b) => b[0] - a[0])
    .slice(0, 6)
    .map(([height, format]) => {
      return {
        id: `video:${height}`,
        kind: 'video',
        label: `${height}p`,
        ext: 'mp4',
        height,
        filesize: estimateVideoSizeBytes(durationExact, height, format),
      };
    });

  const hasAudio = sourceFormats.some(
    (format) => format.acodec && format.acodec !== 'none'
  );
  const audioFormats = hasAudio
    ? [320, 192, 128].map((bitrate) => ({
        id: `audio:mp3:${bitrate}`,
        kind: 'audio',
        label: `MP3 · ${bitrate} kbps`,
        ext: 'mp3',
        bitrate,
        filesize: durationExact
          ? Math.round((durationExact * bitrate * 1000) / 8)
          : null,
      }))
    : [];

  return {
    source,
    title: info.title || null,
    durationSeconds,
    thumbnail: info.thumbnail || null,
    formats: [...videoFormats, ...audioFormats],
  };
}

function formatEntries(info) {
  const formats = Array.isArray(info.requested_formats)
    ? info.requested_formats
    : info.requested_downloads && info.requested_downloads.length
      ? info.requested_downloads
      : [info];

  const seen = new Set();
  return formats.filter((format) => {
    if (!format || typeof format.url !== 'string' || !format.url) return false;
    if (seen.has(format.url)) return false;
    seen.add(format.url);
    return true;
  });
}

/**
 * Resolve a share link into direct stream URLs. The response headers can be
 * sent as soon as this returns (2-4s), which keeps the phone's HTTP client from
 * timing out while ffmpeg starts piping bytes.
 */
async function prepareShareStream(rawUrl, format) {
  const selection = parseFormatSelection(format);
  const targetUrl = await resolveShareUrl(rawUrl);
  const source = shareSource(rawUrl) || 'share';
  const args = [
    '-J',
    '--skip-download',
    '--no-playlist',
    '--playlist-items',
    '1',
    '--no-warnings',
    '--socket-timeout',
    '20',
    '-f',
    formatSelector(selection),
  ];

  const cookiesFile = getCookiesFile();
  if (cookiesFile) {
    args.push('--cookies', cookiesFile);
  }
  args.push(targetUrl);

  const { stdout } = await runYtDlp(args, { timeoutMs: 45000 });

  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    const err = new Error('Could not read information about that link.');
    err.status = 422;
    throw err;
  }

  const info = pickEntry(parsed);
  if (!info) {
    const err = new Error('That link does not contain a downloadable media file.');
    err.status = 422;
    throw err;
  }

  const entries = formatEntries(info);
  if (!entries.length) {
    const err = new Error('No downloadable media was found at that link.');
    err.status = 422;
    throw err;
  }

  const isAudio = selection.kind === 'audio';
  const ext = isAudio ? 'mp3' : String(info.ext || 'mp4').toLowerCase();
  const isImage = !isAudio && ['jpg', 'jpeg', 'png', 'webp'].includes(ext);
  const title = sanitizeFilename(info.title || info.description || 'vscrap-video');
  const durationSeconds = Number.isFinite(info.duration) ? Math.round(info.duration) : null;

  if (!isImage) {
    // Reject oversized media before spawning ffmpeg / streaming anything.
    const estimated = isAudio
      ? durationSeconds
        ? Math.round((durationSeconds * selection.bitrate * 1000) / 8)
        : null
      : sumKnownSize(entries);
    assertWithinSizeLimit(estimated);
  }

  // Detect source codecs so we can transcode to universally compatible
  // H.264 video + AAC audio. YouTube/Instagram often serve VP9 video and/or
  // Opus audio, which many Android players cannot decode.
  const videoEntry = entries.find((e) => e.vcodec && e.vcodec !== 'none');
  const audioEntry = entries.find((e) => e.acodec && e.acodec !== 'none');

  // HLS carries AAC in ADTS framing. Not needed now that we transcode audio
  // to native MP4 AAC, but kept for reference.
  const adtsAudio = entries.some((entry) =>
    String(entry.protocol || '').startsWith('m3u8')
  );

  return {
    mode: isImage ? 'proxy' : 'mux',
    source,
    title: info.title || null,
    inputs: entries.map((entry) => entry.url),
    videoCodec: videoEntry?.vcodec || null,
    audioCodec: audioEntry?.acodec || null,
    adtsAudio,
    audioBitrate: isAudio ? selection.bitrate : null,
    contentType: isAudio
      ? 'audio/mpeg'
      : CONTENT_TYPES[ext] || 'video/mp4',
    filename: `${title || 'vscrap-video'}.${isAudio ? 'mp3' : isImage ? ext : 'mp4'}`,
    durationSeconds,
  };
}

/**
 * Mux the direct URLs into a fragmented MP4 on stdout. Copying the codecs means
 * the first bytes arrive quickly and the phone can download while we work.
 */
function spawnMuxStream(media, output = 'pipe:1') {
  const ffmpeg = resolveFfmpeg();
  if (!ffmpeg) {
    const err = new Error(
      'ffmpeg is not installed on the backend, so share links cannot be muxed. Run "pip install -r requirements.txt".'
    );
    err.status = 503;
    throw err;
  }

  const args = ['-hide_banner', '-loglevel', 'error', '-nostdin'];
  for (const input of media.inputs) {
    args.push('-i', input);
  }

  if (media.audioBitrate) {
    args.push(
      '-vn',
      '-c:a',
      config.mp3Encoder,
      '-b:a',
      `${media.audioBitrate}k`,
      '-f',
      config.audioFormat,
      output
    );
  } else {
    // Video: copy if already H.264/avc1 (fast), otherwise transcode for
    // maximum player compatibility. YouTube/Instagram often serve VP9.
    if (media.videoCodec && /^(avc1|h264)/i.test(media.videoCodec)) {
      args.push('-c:v', 'copy');
    } else {
      args.push(
        '-c:v',
        config.videoCodec,
        '-pix_fmt',
        config.videoPixelFormat,
        '-preset',
        config.videoPreset,
        '-crf',
        String(config.videoCrf)
      );
    }

    // Audio: always transcode to AAC. Opus (YouTube) and other codecs are not
    // universally supported on Android. AAC in MP4 plays everywhere.
    args.push('-c:a', config.audioCodec, '-b:a', `${config.audioBitrateKbps}k`);

    // Fragmented MP4 for streaming (first bytes arrive immediately). No
    // aac_adtstoasc needed since we transcode audio to native MP4 AAC.
    if (output === 'pipe:1') {
      args.push(
        '-movflags',
        'frag_keyframe+empty_moov+default_base_moof'
      );
    }
    args.push('-f', config.videoFormat, output);
  }

  const child = spawn(ffmpeg, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr = (stderr + chunk.toString()).slice(-4000);
  });
  child.on('close', (code) => {
    if (code && config.nodeEnv !== 'production') {
      console.warn('[extractor] ffmpeg exited', code, stderr.trim().split('\n').slice(-3).join(' | '));
    }
  });

  return child;
}

module.exports = {
  isShareUrl,
  shareSource,
  extractMediaInfo,
  listFormats,
  prepareShareStream,
  spawnMuxStream,
};
