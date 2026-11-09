export type DownloadStatus =
  | 'queued'
  | 'analyzing'
  | 'downloading'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type MediaKind = 'image' | 'video' | 'audio' | 'file';

export interface DownloadItem {
  id: string;
  url: string;
  /** Selected quality id, e.g. "video:720" or "audio:mp3:192". */
  format?: string | null;
  filename: string;
  contentType: string;
  mediaKind: MediaKind;
  size: number | null;
  /** Duration in seconds, reported by the backend for share links. */
  durationSeconds: number | null;
  bytesWritten: number;
  progress: number;
  status: DownloadStatus;
  error: string | null;
  localUri: string | null;
  createdAt: number;
  completedAt: number | null;
  savedToLibrary: boolean;
  /** MediaStore asset id (content:// URI on Android) after saving to the gallery. */
  assetId?: string | null;
  /** Why the last gallery save failed, if it did. */
  galleryError?: string | null;
}

/** One selectable quality returned by POST /api/download/formats. */
export interface MediaFormatOption {
  id: string;
  kind: 'video' | 'audio';
  label: string;
  ext: string;
  height?: number | null;
  bitrate?: number | null;
  filesize?: number | null;
}

export function makeDownloadItem(overrides: {
  url: string;
  filename: string;
  contentType: string;
  mediaKind: MediaKind;
  size: number | null;
  durationSeconds?: number | null;
} & Partial<Omit<DownloadItem, 'url' | 'filename' | 'contentType' | 'mediaKind' | 'size'>>): DownloadItem {
  const now = Date.now();
  return {
    id: `${now}-${Math.random().toString(36).slice(2, 10)}`,
    ...overrides,
    bytesWritten: 0,
    progress: 0,
    status: 'queued',
    error: null,
    localUri: null,
    createdAt: now,
    completedAt: null,
    savedToLibrary: false,
    durationSeconds: overrides.durationSeconds ?? null,
  };
}
