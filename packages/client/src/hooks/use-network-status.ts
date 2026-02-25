import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api-client';

type ConnectionState = 'connected' | 'disconnected' | 'reconnecting';

// How often to health-check the API when online (ms)
const HEALTH_CHECK_INTERVAL = 30_000;
// How often to retry when we know the connection is down (ms)
const RECONNECT_INTERVAL = 5_000;
// Timeout for the health-check ping (ms)
const PING_TIMEOUT = 8_000;

/**
 * Tracks whether the app can reach the backend API.
 *
 * Combines browser online/offline events with a lightweight API ping
 * so it catches both network-level and server-level outages.
 *
 * Also listens for 'atlasmail:query-error' custom events — when React Query
 * encounters a failed request, it dispatches this event so we can immediately
 * check the connection instead of waiting for the next 30s interval.
 */
export function useNetworkStatus() {
  const [state, setState] = useState<ConnectionState>('connected');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      await api.get('/health', { timeout: PING_TIMEOUT });
      return true;
    } catch {
      return false;
    }
  }, []);

  const startHealthCheck = useCallback(
    (interval: number) => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(async () => {
        if (!mountedRef.current) return;
        const ok = await checkConnection();
        if (!mountedRef.current) return;
        setState(ok ? 'connected' : 'disconnected');
        // If state changed, adjust the interval accordingly
        if (!ok && interval !== RECONNECT_INTERVAL) {
          startHealthCheck(RECONNECT_INTERVAL);
        } else if (ok && interval !== HEALTH_CHECK_INTERVAL) {
          startHealthCheck(HEALTH_CHECK_INTERVAL);
        }
      }, interval);
    },
    [checkConnection],
  );

  useEffect(() => {
    mountedRef.current = true;

    const handleOnline = async () => {
      if (!mountedRef.current) return;
      setState('reconnecting');
      const ok = await checkConnection();
      if (!mountedRef.current) return;
      setState(ok ? 'connected' : 'disconnected');
      startHealthCheck(ok ? HEALTH_CHECK_INTERVAL : RECONNECT_INTERVAL);
    };

    const handleOffline = () => {
      if (!mountedRef.current) return;
      setState('disconnected');
      startHealthCheck(RECONNECT_INTERVAL);
    };

    // When a React Query request fails, immediately check connection health
    // instead of waiting for the next 30s interval. This bridges the gap
    // between "query failed" and "banner shows up".
    const handleQueryError = async () => {
      if (!mountedRef.current) return;
      const ok = await checkConnection();
      if (!mountedRef.current) return;
      if (!ok) {
        setState('disconnected');
        startHealthCheck(RECONNECT_INTERVAL);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('atlasmail:query-error', handleQueryError);

    // Start periodic health checks
    if (navigator.onLine) {
      startHealthCheck(HEALTH_CHECK_INTERVAL);
    } else {
      setState('disconnected');
      startHealthCheck(RECONNECT_INTERVAL);
    }

    return () => {
      mountedRef.current = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('atlasmail:query-error', handleQueryError);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkConnection, startHealthCheck]);

  return state;
}
