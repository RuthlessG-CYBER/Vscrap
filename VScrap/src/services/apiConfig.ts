import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * `__DEV__` is injected by Metro at runtime; it is not part of the React Native types.
 * We access it via a function so it works even when transpiled in different environments.
 */
function isDevMode(): boolean {
  return typeof __DEV__ !== 'undefined' ? (__DEV__ as boolean) : false;
}

/**
 * Resolves the backend base URL the app should connect to, in this order:
 *  1. EXPO_PUBLIC_API_URL (build-time override)
 *  2. expo.extra.apiUrl in app.json
 *  3. Dev mode: the Expo dev-server host (same machine) on port 3000, so a
 *     physical phone on the LAN reaches the backend; falls back to
 *     http://10.0.2.2:3000 (Android emulator) / http://localhost:3000.
 *  4. Production: empty string — the user must set a backend URL in Settings.
 */
export function resolveDefaultApiBaseUrl(): string {
  // 1. Build-time override
  const buildOverride = process.env.EXPO_PUBLIC_API_URL;
  if (buildOverride) return normalizeBaseUrl(buildOverride);

  // 2. expo.extra.apiUrl in app.json
  const extra = Constants.expoConfig?.extra?.apiUrl;
  if (extra) return normalizeBaseUrl(String(extra));

  // 3. Dev mode: try the Expo dev-server host, then emulator fallbacks.
  if (isDevMode()) {
    const host = Constants.expoConfig?.hostUri;
    if (host) {
      // hostUri looks like "192.168.1.20:19000" or "localhost:19000".
      // Strip IPv6 brackets if present, then split on the first colon.
      const raw = String(host).replace(/[\[\]]/g, '');
      const hostname = raw.split(':')[0];
      if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
        // Dev server is running on the machine's LAN IP — physical devices can reach it.
        return `http://${hostname}:3000`;
      }
      // hostUri is localhost — the dev server is bound to loopback only.
      // We cannot auto-detect the computer's LAN IP from the app, so fall back
      // to emulator/simulator URLs. Physical device users must set the URL in Settings.
      if (Platform.OS === 'android') {
        return 'http://10.0.2.2:3000';
      }
      return 'http://localhost:3000';
    }
    // No hostUri available at all.
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:3000';
    }
    return 'http://localhost:3000';
  }

  // 4. Production: empty string — the user must set a backend URL in Settings.
  return '';
}

/**
 * Mutable current base URL. Starts at the resolved default and is updated
 * whenever the user changes it in Settings.
 */
let currentApiUrl = resolveDefaultApiBaseUrl();

export function getApiUrl(): string {
  return currentApiUrl;
}

export function setApiUrl(url: string): void {
  currentApiUrl = normalizeBaseUrl(url);
}

export function resetToDefaultApiUrl(): string {
  currentApiUrl = resolveDefaultApiBaseUrl();
  return currentApiUrl;
}

/**
 * Ensure a base URL has a scheme and no trailing path/slash so it can be
 * safely joined with API paths.
 */
export function normalizeBaseUrl(url: string): string {
  const trimmed = String(url || '').trim();
  if (!trimmed) return '';
  let normalized = trimmed;
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }
  // Strip trailing slash and any path — keep only scheme + host + port.
  try {
    const parsed = new URL(normalized);
    normalized = `${parsed.protocol}//${parsed.host}`;
  } catch {
    // Best effort: strip everything after the first path slash.
    const pathIndex = normalized.indexOf('/', 8); // after scheme://
    if (pathIndex !== -1) normalized = normalized.slice(0, pathIndex);
  }
  return normalized;
}

export function isValidBaseUrl(url: string): boolean {
  try {
    const parsed = new URL(normalizeBaseUrl(url));
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Heuristic: is the URL a private/local address that won't work from a
 * remote device without being on the same network?
 */
export function isLocalAddress(url: string): boolean {
  try {
    const parsed = new URL(normalizeBaseUrl(url));
    const hostname = parsed.hostname.toLowerCase();
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.') ||
      hostname.startsWith('172.17.') ||
      hostname.startsWith('172.18.') ||
      hostname.startsWith('172.19.') ||
      hostname.startsWith('172.20.') ||
      hostname.startsWith('172.21.') ||
      hostname.startsWith('172.22.') ||
      hostname.startsWith('172.23.') ||
      hostname.startsWith('172.24.') ||
      hostname.startsWith('172.25.') ||
      hostname.startsWith('172.26.') ||
      hostname.startsWith('172.27.') ||
      hostname.startsWith('172.28.') ||
      hostname.startsWith('172.29.') ||
      hostname.startsWith('172.30.') ||
      hostname.startsWith('172.31.') ||
      hostname === '10.0.2.2' || // Android emulator
      hostname.endsWith('.local')
    );
  } catch {
    return false;
  }
}
