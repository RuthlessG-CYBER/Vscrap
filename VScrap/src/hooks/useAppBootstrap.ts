import { useEffect } from 'react';
import { useConnectionStore } from '@/store/connectionStore';
import { resolveDefaultApiBaseUrl, setApiUrl } from '@/services/apiConfig';

/**
 * Run once at app root: seed the default backend URL (if none is set) and
 * kick off the first health check so the connection pill reflects reality
 * immediately.
 */
export function useAppBootstrap(): void {
  const check = useConnectionStore((state) => state.check);

  useEffect(() => {
    const defaultUrl = resolveDefaultApiBaseUrl();
    if (defaultUrl) setApiUrl(defaultUrl);
    void check({ force: true });
  }, [check]);
}
