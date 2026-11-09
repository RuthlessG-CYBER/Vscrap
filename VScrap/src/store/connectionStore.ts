import { createStore } from '@/store/createStore';
import { apiClient } from '@/services/apiClient';

type ConnectionStatus = 'online' | 'offline' | 'checking';

export interface ConnectionState {
  status: ConnectionStatus;
  latencyMs: number | null;
  lastCheckedAt: number | null;
  version: string | null;
  maxDownloadBytes: number | null;
  error: string | null;
  /**
   * Ping the backend `/health` endpoint. When `force` is false, skip if a
   * check is already in progress.
   */
  check: (opts?: { force?: boolean }) => Promise<void>;
}

const initialState: ConnectionState = {
  status: 'offline',
  latencyMs: null,
  lastCheckedAt: null,
  version: null,
  maxDownloadBytes: null,
  error: null,
  check: async () => {},
};

let isChecking = false;

export const useConnectionStore = createStore<ConnectionState>({
  ...initialState,
  check: async ({ force } = {}) => {
    if (isChecking && !force) return;
    isChecking = true;

    const start = Date.now();
    const set = (partial: Partial<ConnectionState>) =>
      useConnectionStore.setState(partial);

    try {
      set({ status: 'checking', error: null });
      const data = await apiClient.get<{ status: string; version?: string; maxDownloadBytes?: number }>(
        '/health',
        { timeoutMs: 8000 }
      );
      const latency = Date.now() - start;
      set({
        status: 'online',
        latencyMs: latency,
        lastCheckedAt: Date.now(),
        version: data.version ?? null,
        maxDownloadBytes: data.maxDownloadBytes ?? null,
        error: null,
      });
    } catch (error) {
      set({
        status: 'offline',
        latencyMs: null,
        lastCheckedAt: Date.now(),
        error: errorMessage(error),
      });
    } finally {
      isChecking = false;
    }
  },
});

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Could not reach the backend.';
}
