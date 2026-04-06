import axios from 'axios';
import { config } from '../config/env';
import { useAuthStore } from '../stores/auth-store';

export const api = axios.create({
  baseURL: config.apiUrl,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((req) => {
  const token = localStorage.getItem('atlasmail_token');
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((promise) => {
    if (error) promise.reject(error);
    else promise.resolve(token!);
  });
  failedQueue = [];
}

/**
 * Atomically refresh tokens in localStorage.
 * Uses the stored active account ID instead of matching by old token value,
 * which avoids desync when multiple requests refresh concurrently.
 */
function persistRefreshedTokens(newAccessToken: string, newRefreshToken?: string) {
  const activeAccountId = localStorage.getItem('atlasmail_active_account_id');
  if (!activeAccountId) {
    // Fallback: just set the active token keys
    localStorage.setItem('atlasmail_token', newAccessToken);
    if (newRefreshToken) localStorage.setItem('atlasmail_refresh_token', newRefreshToken);
    return;
  }

  try {
    const raw = localStorage.getItem('atlasmail_tokens');
    const tokenMap = raw ? (JSON.parse(raw) as Record<string, { access: string; refresh: string }>) : {};
    const existing = tokenMap[activeAccountId];
    tokenMap[activeAccountId] = {
      access: newAccessToken,
      refresh: newRefreshToken || existing?.refresh || '',
    };
    // Write token map and active keys together (atomic)
    localStorage.setItem('atlasmail_tokens', JSON.stringify(tokenMap));
    localStorage.setItem('atlasmail_token', newAccessToken);
    if (newRefreshToken) localStorage.setItem('atlasmail_refresh_token', newRefreshToken);
  } catch {
    // Fallback: at minimum update the active token
    localStorage.setItem('atlasmail_token', newAccessToken);
    if (newRefreshToken) localStorage.setItem('atlasmail_refresh_token', newRefreshToken);
  }
}

/**
 * Perform a proper logout via the auth store instead of a hard redirect.
 * This correctly cleans up state and lets the app route to the login screen.
 */
function handleAuthFailure() {
  useAuthStore.getState().logout();
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    // Never retry or redirect for the local identity endpoint — it's unauthenticated
    if (originalRequest?.url?.includes('/auth/local')) {
      return Promise.reject(error);
    }
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }
      // If there's no refresh token at all, skip the refresh attempt and just
      // propagate the 401. This avoids a hard redirect when the page loads
      // before authentication is fully initialised (e.g. DEV_MODE race).
      const refreshToken = localStorage.getItem('atlasmail_refresh_token');
      if (!refreshToken) {
        // No refresh token — can't recover. Clear stale auth state.
        handleAuthFailure();
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const { data } = await axios.post(`${config.apiUrl}/auth/refresh`, { refreshToken });
        const newAccessToken = data.data.accessToken;
        const newRefreshToken = data.data.refreshToken;
        persistRefreshedTokens(newAccessToken, newRefreshToken);
        // Reset the preemptive refresh timer with the new token
        schedulePreemptiveRefresh();
        processQueue(null, newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        handleAuthFailure();
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

// ─── Preemptive token refresh ────────────────────────────────────────────────
// Refresh the access token before it expires to avoid 401 storms.
// Access tokens expire in 1h; we refresh at 55 minutes.

const PREEMPTIVE_REFRESH_MS = 55 * 60 * 1000; // 55 minutes
let preemptiveTimer: ReturnType<typeof setTimeout> | null = null;

async function doPreemptiveRefresh() {
  const refreshToken = localStorage.getItem('atlasmail_refresh_token');
  if (!refreshToken) return;
  // Don't preemptively refresh if a 401-triggered refresh is already in progress
  if (isRefreshing) return;

  try {
    const { data } = await axios.post(`${config.apiUrl}/auth/refresh`, { refreshToken });
    const newAccessToken = data.data.accessToken;
    const newRefreshToken = data.data.refreshToken;
    persistRefreshedTokens(newAccessToken, newRefreshToken);
    schedulePreemptiveRefresh();
  } catch {
    // Preemptive refresh failed — the 401 interceptor will handle it when
    // the next API call fails. No need to logout here.
  }
}

export function schedulePreemptiveRefresh() {
  if (preemptiveTimer) clearTimeout(preemptiveTimer);
  const refreshToken = localStorage.getItem('atlasmail_refresh_token');
  if (!refreshToken) return;
  preemptiveTimer = setTimeout(doPreemptiveRefresh, PREEMPTIVE_REFRESH_MS);
}

// Start the timer on module load if already authenticated
schedulePreemptiveRefresh();

// Re-schedule whenever the active account changes (login, switch, etc.)
useAuthStore.subscribe((state, prevState) => {
  if (state.isAuthenticated && state.account?.id !== prevState.account?.id) {
    schedulePreemptiveRefresh();
  }
  // Clear the timer on logout
  if (!state.isAuthenticated && prevState.isAuthenticated) {
    if (preemptiveTimer) {
      clearTimeout(preemptiveTimer);
      preemptiveTimer = null;
    }
  }
});
