require('dotenv').config();

function requireEnv(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

module.exports = {
  port: parseInt(requireEnv('PORT', '3000'), 10),
  nodeEnv: requireEnv('NODE_ENV', 'development'),
  allowedOrigins: requireEnv('ALLOWED_ORIGINS', '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  rateLimit: {
    windowMs: parseInt(requireEnv('RATE_LIMIT_WINDOW_MS', '60000'), 10),
    max: parseInt(requireEnv('RATE_LIMIT_MAX_REQUESTS', '30'), 10),
  },
  maxDownloadBytes: parseInt(requireEnv('MAX_DOWNLOAD_BYTES', String(500 * 1024 * 1024)), 10),
  // Cap for social share links, which can offer 4K streams.
  maxVideoHeight: parseInt(requireEnv('MAX_VIDEO_HEIGHT', '2160'), 10),
  shareDownloadTimeoutMs: parseInt(requireEnv('SHARE_DOWNLOAD_TIMEOUT_MS', '3600000'), 10),
  // FFmpeg encoding defaults for share-link transcoding.
  videoCodec: process.env.VIDEO_CODEC || 'libx264',
  videoPreset: process.env.VIDEO_PRESET || 'fast',
  videoCrf: parseInt(process.env.VIDEO_CRF || '23', 10),
  videoPixelFormat: process.env.VIDEO_PIXEL_FORMAT || 'yuv420p',
  audioCodec: process.env.AUDIO_CODEC || 'aac',
  audioBitrateKbps: parseInt(process.env.AUDIO_BITRATE_KBPS || '128', 10),
  mp3Encoder: process.env.MP3_ENCODER || 'libmp3lame',
  videoFormat: process.env.VIDEO_FORMAT || 'mp4',
  audioFormat: process.env.AUDIO_FORMAT || 'mp3',
};
