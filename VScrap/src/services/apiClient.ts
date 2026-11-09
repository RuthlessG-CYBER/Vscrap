import { getApiUrl } from '@/services/apiConfig';

const REQUEST_TIMEOUT = 15000;

/**
 * Turn an API error (fetch or backend JSON body) into a user-facing message.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message);
  }
  return 'Something went wrong.';
}

type FetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
};

async function request<T = unknown>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const baseUrl = getApiUrl();
  if (!baseUrl) {
    throw new Error('Backend URL is not set. Open Settings and enter it.');
  }

  const url = `${baseUrl}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? REQUEST_TIMEOUT
  );

  try {
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    let data: unknown;
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const body = data as { error?: string } | string;
      const message =
        typeof body === 'object' && body?.error
          ? body.error
          : typeof body === 'string'
            ? body
            : `HTTP ${response.status}`;
      const err: Error & { status?: number; publicMessage?: string } = new Error(
        message
      );
      err.status = response.status;
      err.publicMessage = message;
      throw err;
    }

    return data as T;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      const timeoutErr = new Error('The backend request timed out.');
      (timeoutErr as Error & { status?: number }).status = 504;
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const apiClient = {
  get: <T = unknown>(path: string, options?: FetchOptions) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T = unknown>(path: string, body?: unknown, options?: FetchOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
};
