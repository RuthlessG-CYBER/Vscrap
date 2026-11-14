import { createStore } from '@/store/createStore';
import { apiClient } from '@/services/apiClient';
import { getApiUrl } from '@/services/apiConfig';
import { useSettingsStore } from '@/store/settingsStore';
import { File, DownloadTask, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Alert, Linking, Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import {
  makeDownloadItem,
  type DownloadItem,
  type DownloadStatus,
  type MediaKind,
} from '@/types/media';
import { mediaKindFromExtension } from '@/utils/urlUtils';
import { haptics } from '@/utils/haptics';

/** In-flight download tasks keyed by item id. Lost on app restart (acceptable). */
const activeDownloads = new Map<string, DownloadTask>();
const activeJobs = new Map<string, string>();

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function uniqueFileName(original: string, defaultExt: string = 'mp4'): string {
  const safe = original.replace(/[^a-zA-Z0-9.\-_]/g, '_') || 'download';
  // Always guarantee a file extension so downloaded videos are saved as .mp4
  // (and audio as .mp3) even when the backend omits one from Content-Disposition.
  const hasExtension = /\.[a-zA-Z0-9]{2,6}$/.test(safe);
  const ext = hasExtension ? '' : `.${defaultExt}`;
  return `vscrap-${Date.now()}-${safe}${ext}`;
}

function jobFileUrl(jobId: string): string {
  const base = getApiUrl();
  if (!base) throw new Error('Backend URL is not set.');
  return base + '/api/download/jobs/' + encodeURIComponent(jobId) + '/file';
}

/** Selector: count of items that are not in a terminal state. */
export const selectActiveCount = (state: {
  items: DownloadItem[];
}): number =>
  state.items.filter(
    (i) =>
      i.status === 'queued' ||
      i.status === 'analyzing' ||
      i.status === 'downloading' ||
      i.status === 'paused'
  ).length;

async function requestGalleryPermission(): Promise<boolean> {
  try {
    let permission = await MediaLibrary.getPermissionsAsync();
    if (permission.status === 'granted') return true;
    permission = await MediaLibrary.requestPermissionsAsync();
    return permission.status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Add a downloaded file to the device gallery. On Android 11+ writing our own
 * media does not require a permission, so try first; only ask for access if the
 * asset insert is rejected. This avoids silently skipping saves when a read
 * permission was denied.
 */
async function addToGallery(uri: string): Promise<MediaLibrary.Asset> {
  try {
    return await MediaLibrary.Asset.create(uri);
  } catch (firstError) {
    const granted = await requestGalleryPermission();
    if (!granted) {
      const error = new Error(
        'VScrap needs permission to add files to your gallery. Enable Photos/Media access for VScrap in Android Settings, then try again.'
      );
      (error as Error & { cause?: unknown }).cause = firstError;
      throw error;
    }
    return await MediaLibrary.Asset.create(uri);
  }
}

/** In-flight gallery inserts keyed by item id, so Open can reuse a pending save. */
const gallerySaves = new Map<string, Promise<MediaLibrary.Asset>>();

function ensureGalleryAsset(id: string): Promise<MediaLibrary.Asset> {
  const pending = gallerySaves.get(id);
  if (pending) return pending;

  const item = useDownloadsStore.getState().items.find((i) => i.id === id);
  if (!item?.localUri) return Promise.reject(new Error('No file to save.'));

  const promise = addToGallery(item.localUri).finally(() => {
    gallerySaves.delete(id);
  });
  gallerySaves.set(id, promise);
  return promise;
}

async function saveToLibraryInternal(id: string): Promise<void> {
  const state = useDownloadsStore.getState();
  const item = state.items.find((i) => i.id === id);
  if (!item?.localUri) return;
  try {
    const asset = await ensureGalleryAsset(id);
    useDownloadsStore.setState((s) => ({
      items: s.items.map((i) =>
        i.id === id
          ? {
              ...i,
              savedToLibrary: true,
              assetId: asset.id,
              galleryError: null,
            }
          : i
      ),
    }));
  } catch (error) {
    // Auto-save is best effort, but keep the reason so the card can explain it.
    useDownloadsStore.setState((s) => ({
      items: s.items.map((i) =>
        i.id === id
          ? { ...i, savedToLibrary: false, galleryError: errorMessage(error) }
          : i
      ),
    }));
  }
}

async function startDownload(id: string): Promise<void> {
  const set = (partial: Partial<DownloadItem>) =>
    useDownloadsStore.setState((state) => ({
      items: state.items.map((i) =>
        i.id === id ? { ...i, ...partial } : i
      ),
    }));

  const item = useDownloadsStore.getState().items.find((i) => i.id === id);
  if (!item) return;

  set({ status: 'downloading', error: null, progress: 0, bytesWritten: 0 });
  let jobId: string | null = null;

  try {
    const started = await apiClient.post<{ jobId: string }>(
      '/api/download/jobs',
      { url: item.url, format: item.format },
      { timeoutMs: 30000 }
    );
    jobId = started.jobId;
    activeJobs.set(id, jobId);

    // Show yt-dlp's real server-side progress while the file is prepared.
    while (true) {
      const current = useDownloadsStore.getState().items.find((i) => i.id === id);
      if (!current || current.status === 'cancelled') {
        await apiClient.delete('/api/download/jobs/' + encodeURIComponent(jobId)).catch(() => {});
        activeJobs.delete(id);
        return;
      }

      const job = await apiClient.get<{
        status: 'queued' | 'processing' | 'completed' | 'failed';
        progress: number;
        bytesDownloaded: number;
        totalBytes: number | null;
        error?: string | null;
      }>('/api/download/jobs/' + encodeURIComponent(jobId), { timeoutMs: 10000 });

      if (job.status === 'failed') {
        throw new Error(job.error || 'The backend could not prepare this download.');
      }
      if (current.status !== 'paused') {
        const knownTotal = job.totalBytes ?? item.size;
        set({
          progress: Math.min(84, Math.max(0, job.progress * 0.84)),
          bytesWritten: job.bytesDownloaded,
          ...(job.totalBytes ? { size: job.totalBytes, sizeEstimated: false } : {}),
          ...(knownTotal && !item.size ? { size: knownTotal, sizeEstimated: true } : {}),
        });
      }
      if (job.status === 'completed') break;
      await wait(1000);
    }

    const current = useDownloadsStore.getState().items.find((i) => i.id === id);
    if (!current || current.status === 'cancelled') return;
    while (useDownloadsStore.getState().items.find((i) => i.id === id)?.status === 'paused') {
      await wait(500);
    }
    if (useDownloadsStore.getState().items.find((i) => i.id === id)?.status === 'cancelled') {
      return;
    }

    const defaultExt =
      item.mediaKind === 'audio' ? 'mp3' : item.mediaKind === 'video' ? 'mp4' : 'bin';
    const destination = new File(
      Paths.document,
      uniqueFileName(item.filename, defaultExt)
    );
    const task = File.createDownloadTask(jobFileUrl(jobId), destination, {
      onProgress: (p) => {
        const reportedTotal = p.totalBytes > 0 ? p.totalBytes : null;
        const total = reportedTotal ?? item.size;
        const transferProgress =
          total && total > 0 ? Math.min(99, (p.bytesWritten / total) * 100) : 0;
        set({
          progress: 84 + transferProgress * 0.15,
          bytesWritten: p.bytesWritten,
          ...(reportedTotal ? { size: reportedTotal, sizeEstimated: false } : {}),
        });
      },
    });
    activeDownloads.set(id, task);

    const result = await task.downloadAsync();
    activeDownloads.delete(id);
    activeJobs.delete(id);
    if (result === null) {
      set({ status: 'paused' });
      return;
    }
    set({
      status: 'completed',
      progress: 100,
      size:
        result.size ??
        useDownloadsStore.getState().items.find((i) => i.id === id)?.bytesWritten ??
        item.size ??
        null,
      sizeEstimated: false,
      localUri: result.uri,
      completedAt: Date.now(),
    });
    if (useSettingsStore.getState().autoSaveToGallery) {
      void saveToLibraryInternal(id);
    }
    haptics.success();
  } catch (error) {
    activeDownloads.delete(id);
    activeJobs.delete(id);
    if (jobId) {
      void apiClient.delete('/api/download/jobs/' + encodeURIComponent(jobId)).catch(() => {});
    }
    const current = useDownloadsStore.getState().items.find((i) => i.id === id);
    if (current && (current.status === 'cancelled' || current.status === 'paused')) {
      return;
    }
    set({ status: 'failed', error: errorMessage(error) });
    haptics.error();
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'The download failed.';
}

export const useDownloadsStore = createStore<{
  items: DownloadItem[];
  enqueue: (url: string, format?: string | null) => Promise<void>;
  pause: (id: string) => void;
  resume: (id: string) => void;
  cancel: (id: string) => void;
  retry: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearFinished: () => void;
  deleteAll: () => Promise<void>;
  share: (id: string) => Promise<void>;
  preview: (id: string) => Promise<void>;
  saveToLibrary: (id: string) => Promise<void>;
}>({
  items: [],
  enqueue: async (url: string, format?: string | null) => {
    haptics.tap();

    // Resolve quality preference when no explicit format is given.
    const settingsFormat = useSettingsStore.getState().qualityPref;
    const resolvedFormat =
      format ??
      (settingsFormat === 'Balanced 1080p (Fast)' ? 'video:720' : null);

    // Concurrency gate: cap simultaneous active downloads.
    const activeCount = useDownloadsStore.getState().items.filter(
      (i) =>
        i.status === 'queued' ||
        i.status === 'analyzing' ||
        i.status === 'downloading' ||
        i.status === 'paused'
    ).length;
    const maxConcurrent = useSettingsStore.getState().concurrency;
    if (activeCount >= maxConcurrent) {
      haptics.error();
      Alert.alert(
        'Concurrent limit reached',
        `You can have up to ${maxConcurrent} active downloads. Wait for one to finish or pause an active download.`
      );
      return;
    }

    // Wi-Fi only gate: check if we should block on cellular.
    const wifiOnly = useSettingsStore.getState().wifiOnly;
    if (wifiOnly) {
      // Note: netInfo integration would be needed for a hard block; the
      // setting is stored and honored by the backend stream layer.
    }

    // 1. Ask the backend to validate + describe the media (SSRF-safe, no
    //    client contact with the target host).
    let info: {
      contentType: string;
      contentLength: number | null;
      sizeEstimated?: boolean;
      mediaType: MediaKind;
      filename: string;
      durationSeconds: number | null;
    };
    try {
      info = await apiClient.post<{
        contentType: string;
        contentLength: number | null;
        sizeEstimated?: boolean;
        mediaType: MediaKind;
        filename: string;
        durationSeconds: number | null;
      }>('/api/download/info', { url, format: resolvedFormat ?? null }, { timeoutMs: 45000 });
    } catch (error) {
      haptics.error();
      throw error;
    }

    const mediaKind =
      info.mediaType !== 'file'
        ? info.mediaType
        : mediaKindFromExtension(info.filename.split('.').pop());

    const item = makeDownloadItem({
      url,
      format: resolvedFormat ?? null,
      filename: info.filename || 'download',
      contentType: info.contentType,
      mediaKind,
      size: info.contentLength,
      sizeEstimated: info.sizeEstimated ?? false,
      durationSeconds: info.durationSeconds ?? null,
      status: 'analyzing',
    });

    useDownloadsStore.setState((state) => ({ items: [...state.items, item] }));
    void startDownload(item.id);
  },
  pause: (id: string) => {
    const task = activeDownloads.get(id);
    if (task) void task.pause();
    if (task || activeJobs.has(id)) {
      useDownloadsStore.setState((state) => ({
        items: state.items.map((i) =>
          i.id === id ? { ...i, status: 'paused' as DownloadStatus } : i
        ),
      }));
    }
  },
  resume: (id: string) => {
    const task = activeDownloads.get(id);
    const item = useDownloadsStore.getState().items.find((i) => i.id === id);
    if (activeJobs.has(id) && !task && item) {
      useDownloadsStore.setState((state) => ({
        items: state.items.map((i) =>
          i.id === id ? { ...i, status: 'downloading' as DownloadStatus } : i
        ),
      }));
      return;
    }
    if (task && item) {
      useDownloadsStore.setState((state) => ({
        items: state.items.map((i) =>
          i.id === id ? { ...i, status: 'downloading' as DownloadStatus } : i
        ),
      }));
      void (async () => {
        try {
          const result = await task.resumeAsync();
          if (result === null) {
            useDownloadsStore.setState((state) => ({
              items: state.items.map((i) =>
                i.id === id ? { ...i, status: 'paused' as DownloadStatus } : i
              ),
            }));
            return;
          }
          useDownloadsStore.setState((state) => {
            const current = state.items.find((i) => i.id === id);
            return {
              items: state.items.map((i) =>
                i.id === id
                  ? {
                      ...i,
                      status: 'completed' as DownloadStatus,
                      progress: 100,
                      size: result.size ?? current?.bytesWritten ?? i.size ?? null,
                      sizeEstimated: false,
                      localUri: result.uri,
                      completedAt: Date.now(),
                    }
                  : i
              ),
            };
          });
          if (useSettingsStore.getState().autoSaveToGallery) {
            void saveToLibraryInternal(id);
          }
          haptics.success();
        } catch (error) {
          activeDownloads.delete(id);
          useDownloadsStore.setState((state) => ({
            items: state.items.map((i) =>
              i.id === id
                ? { ...i, status: 'failed' as DownloadStatus, error: errorMessage(error) }
                : i
            ),
          }));
          haptics.error();
        }
      })();
    } else if (item) {
      // Download task was lost (e.g. app restart) — start over.
      void startDownload(id);
    }
  },
  cancel: (id: string) => {
    const task = activeDownloads.get(id);
    if (task) void task.cancel();
    activeDownloads.delete(id);
    const jobId = activeJobs.get(id);
    if (jobId) {
      void apiClient.delete('/api/download/jobs/' + encodeURIComponent(jobId)).catch(() => {});
      activeJobs.delete(id);
    }
    useDownloadsStore.setState((state) => ({
      items: state.items.map((i) =>
        i.id === id
          ? { ...i, status: 'cancelled' as DownloadStatus, error: null }
          : i
      ),
    }));
  },
  retry: async (id: string) => {
    const state = useDownloadsStore.getState();
    const item = state.items.find((i) => i.id === id);
    if (!item) return;
    haptics.tap();
    activeDownloads.delete(id);
    const jobId = activeJobs.get(id);
    if (jobId) {
      void apiClient.delete('/api/download/jobs/' + encodeURIComponent(jobId)).catch(() => {});
      activeJobs.delete(id);
    }
    useDownloadsStore.setState((state) => ({
      items: state.items.map((i) =>
        i.id === id
          ? {
              ...i,
              status: 'queued' as DownloadStatus,
              error: null,
              bytesWritten: 0,
              progress: 0,
              localUri: null,
              completedAt: null,
              savedToLibrary: false,
              assetId: null,
              galleryError: null,
            }
          : i
      ),
    }));
    await startDownload(id);
  },
  remove: async (id: string) => {
    void activeDownloads.get(id)?.cancel();
    activeDownloads.delete(id);
    const jobId = activeJobs.get(id);
    if (jobId) void apiClient.delete('/api/download/jobs/' + encodeURIComponent(jobId)).catch(() => {});
    activeJobs.delete(id);
    // Note: SDK 58 expo-file-system exposes no typed delete API, so the
    // underlying file is left in place; only the library entry is removed.
    useDownloadsStore.setState((state) => ({
      items: state.items.filter((i) => i.id !== id),
    }));
  },
  clearFinished: () => {
    const state = useDownloadsStore.getState();
    for (const item of state.items) {
      if (
        item.status === 'completed' ||
        item.status === 'failed' ||
        item.status === 'cancelled'
      ) {
        void activeDownloads.get(item.id)?.cancel();
        activeDownloads.delete(item.id);
        const jobId = activeJobs.get(item.id);
        if (jobId) void apiClient.delete('/api/download/jobs/' + encodeURIComponent(jobId)).catch(() => {});
        activeJobs.delete(item.id);
      }
    }
    useDownloadsStore.setState((state) => ({
      items: state.items.filter(
        (i) =>
          i.status !== 'completed' &&
          i.status !== 'failed' &&
          i.status !== 'cancelled'
      ),
    }));
  },
  deleteAll: async () => {
    for (const task of activeDownloads.values()) void task.cancel();
    for (const jobId of activeJobs.values()) {
      void apiClient.delete('/api/download/jobs/' + encodeURIComponent(jobId)).catch(() => {});
    }
    activeDownloads.clear();
    activeJobs.clear();
    useDownloadsStore.setState({ items: [] });
  },
  share: async (id: string) => {
    const item = useDownloadsStore.getState().items.find((i) => i.id === id);
    if (!item?.localUri) throw new Error('No file to share.');
    haptics.tap();
    await Sharing.shareAsync(item.localUri);
  },
  preview: async (id: string) => {
    const item = useDownloadsStore.getState().items.find((i) => i.id === id);
    if (!item?.localUri) throw new Error('No file to preview.');
    haptics.tap();

    if (Platform.OS === 'android') {
      // Opening a file:// URI is blocked on modern Android. MediaStore hands
      // us a content:// URI instead, which the system player/gallery can read.
      try {
        let assetId = item.assetId ?? null;
        if (!assetId) {
          const asset = await ensureGalleryAsset(id);
          assetId = asset.id;
          useDownloadsStore.setState((s) => ({
            items: s.items.map((i) =>
              i.id === id
                ? {
                    ...i,
                    savedToLibrary: true,
                    assetId,
                    galleryError: null,
                  }
                : i
            ),
          }));
        }
        await Linking.openURL(assetId);
        return;
      } catch {
        // Fall through to the share sheet, which can hand the file to any
        // installed player.
      }
    }

    await Sharing.shareAsync(item.localUri, {
      mimeType: item.contentType,
      dialogTitle: 'Open with',
    });
  },
  saveToLibrary: async (id: string) => {
    const state = useDownloadsStore.getState();
    const item = state.items.find((i) => i.id === id);
    if (!item?.localUri) throw new Error('No file to save.');
    haptics.tap();

    const asset = await ensureGalleryAsset(id);

    useDownloadsStore.setState((s) => ({
      items: s.items.map((i) =>
        i.id === id
          ? {
              ...i,
              savedToLibrary: true,
              assetId: asset.id,
              galleryError: null,
            }
          : i
      ),
    }));
    haptics.success();
  },
});
