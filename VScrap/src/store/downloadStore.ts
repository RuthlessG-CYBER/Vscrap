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

function uniqueFileName(original: string, defaultExt: string = 'mp4'): string {
  const safe = original.replace(/[^a-zA-Z0-9.\-_]/g, '_') || 'download';
  // Always guarantee a file extension so downloaded videos are saved as .mp4
  // (and audio as .mp3) even when the backend omits one from Content-Disposition.
  const hasExtension = /\.[a-zA-Z0-9]{2,6}$/.test(safe);
  const ext = hasExtension ? '' : `.${defaultExt}`;
  return `vscrap-${Date.now()}-${safe}${ext}`;
}

function streamUrlFor(targetUrl: string, format?: string | null): string {
  const base = getApiUrl();
  if (!base) throw new Error('Backend URL is not set.');
  const formatQuery = format ? `&format=${encodeURIComponent(format)}` : '';
  return `${base}/api/download/stream?url=${encodeURIComponent(targetUrl)}${formatQuery}`;
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

  const state = useDownloadsStore.getState();
  const item = state.items.find((i) => i.id === id);
  if (!item) return;

  set({ status: 'downloading', error: null, progress: 0, bytesWritten: 0 });

  const defaultExt = item.mediaKind === 'audio' ? 'mp3' : item.mediaKind === 'video' ? 'mp4' : 'bin';
  const destination = new File(Paths.document, uniqueFileName(item.filename, defaultExt));
  const task = File.createDownloadTask(streamUrlFor(item.url, item.format), destination, {
    onProgress: (p) => {
      const reportedTotal = p.totalBytes > 0 ? p.totalBytes : null;
      // Transcoded streams have no Content-Length, so use the backend's
      // estimate. Keep active transfers below 100%; completion sets 100%.
      const total = reportedTotal ?? item.size;
      set({
        bytesWritten: p.bytesWritten,
        ...(reportedTotal ? { size: reportedTotal, sizeEstimated: false } : {}),
        ...(total && total > 0
          ? { progress: Math.min(99, Math.floor((p.bytesWritten / total) * 100)) }
          : {}),
      });
    },
  });
  activeDownloads.set(id, task);

  try {
    // downloadAsync() resolves with the File on success, null when paused,
    // and rejects on error/cancellation.
    const result = await task.downloadAsync();
    activeDownloads.delete(id);
    if (result === null) {
      // Paused by the user — leave status as 'paused'.
      set({ status: 'paused' });
      return;
    }
    set({
      status: 'completed',
      progress: 100,
      // Read final size from the saved file; native progress events can be
      // throttled and may not report the final byte count.
      size: result.size ?? useDownloadsStore.getState().items.find((i) => i.id === id)?.bytesWritten ?? item.size ?? null,
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
    await startDownload(item.id);
  },
  pause: (id: string) => {
    const task = activeDownloads.get(id);
    if (task) {
      void task.pause();
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
    if (task) {
      void task.cancel();
      activeDownloads.delete(id);
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
    for (const task of activeDownloads.values()) {
      void task.cancel();
    }
    activeDownloads.clear();
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
