const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

/**
 * Format a byte count into a human-readable string.
 * `null`/`undefined` renders as '—'.
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes) || bytes < 0) return '—';
  if (bytes === 0) return '0 B';
  const exponent = Math.floor(Math.log(bytes) / Math.log(1024));
  const unitIndex = Math.min(exponent, UNITS.length - 1);
  const value = bytes / Math.pow(1024, unitIndex);
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${UNITS[unitIndex]}`;
}

/**
 * Format a Unix-millisecond timestamp as a relative time (e.g. "2m ago").
 * `null`/`undefined` renders as '—'. Falls back to a short date for older items.
 */
export function formatRelativeTime(timestamp: number | null | undefined): string {
  if (timestamp == null || Number.isNaN(timestamp)) return '—';
  const now = Date.now();
  const delta = now - timestamp;
  const seconds = Math.floor(delta / 1000);

  if (seconds < 45) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 45) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Truncate a string in the middle, keeping the start and end visible.
 */
export function truncateMiddle(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  const half = Math.floor((maxLen - 3) / 2);
  const start = str.slice(0, Math.max(half, 0));
  const end = str.slice(-Math.max(half, 0));
  return `${start}…${end}`;
}

/**
 * Format a duration in seconds as H:MM:SS or M:SS.
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds) || seconds < 0) return '—';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
