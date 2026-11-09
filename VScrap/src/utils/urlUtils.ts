export type MediaKind = 'image' | 'video' | 'audio' | 'file';

const IMAGE_EXTS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff', 'heic',
]);
const VIDEO_EXTS = new Set([
  'mp4', 'webm', 'mov', 'mkv', 'avi', 'wmv', 'flv', 'm4v', '3gp',
]);
const AUDIO_EXTS = new Set([
  'mp3', 'm4a', 'aac', 'ogg', 'wav', 'flac', 'wma', 'opus',
]);

export function mediaKindFromExtension(extension: string | undefined | null): MediaKind {
  const ext = String(extension || '').toLowerCase().replace(/^\./, '');
  if (VIDEO_EXTS.has(ext)) return 'video';
  if (AUDIO_EXTS.has(ext)) return 'audio';
  if (IMAGE_EXTS.has(ext)) return 'image';
  return 'file';
}

export function mediaKindLabel(kind: MediaKind): string {
  const labels: Record<MediaKind, string> = {
    image: 'Image',
    video: 'Video',
    audio: 'Audio',
    file: 'File',
  };
  return labels[kind];
}

export function hostnameOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Hosts whose share links the backend can resolve with yt-dlp. These URLs do
 * not end in a file extension, so `validateUrl` must accept them explicitly.
 */
const SHARE_HOSTS = [
  /^(?:www\.|m\.|music\.)?youtube\.com$/i,
  /^youtu\.be$/i,
  /^(?:www\.)?instagram\.com$/i,
  /^instagr\.am$/i,
  /^(?:www\.|m\.|web\.)?facebook\.com$/i,
  /^fb\.watch$/i,
];

export function isShareLink(url: string): boolean {
  try {
    const { hostname } = new URL(url.trim());
    return SHARE_HOSTS.some((pattern) => pattern.test(hostname));
  } catch {
    return false;
  }
}

/**
 * Validate a user-supplied media link before sending it to the backend.
 * Direct HTTPS URLs and supported social share links are accepted.
 * Returns host + extension hints the UI can display without any network request.
 */
export function validateUrl(url: string): {
  valid: boolean;
  host?: string;
  extension?: string;
  share?: boolean;
  message?: string;
} {
  const trimmed = url.trim();
  if (!trimmed) {
    return { valid: false, message: 'Please paste a media link.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, message: 'That is not a valid URL.' };
  }

  if (parsed.protocol !== 'https:') {
    return {
      valid: false,
      message: 'Only HTTPS links are supported.',
    };
  }

  // Supported share links are resolved server-side by yt-dlp.
  if (isShareLink(trimmed)) {
    return {
      valid: true,
      host: parsed.hostname,
      extension: 'mp4',
      share: true,
    };
  }

  const pathname = parsed.pathname;
  const lastSegment = pathname.split('/').pop() || '';
  const extension = lastSegment.includes('.') ? lastSegment.split('.').pop() : undefined;

  if (!extension) {
    return {
      valid: false,
      message: 'Link does not point to a media file (no file extension).',
    };
  }

  return {
    valid: true,
    host: parsed.hostname,
    extension,
  };
}
