import axios from 'axios';
import { config } from '../config/env';

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

// Keep the atlasmail_tokens map in sync when the active account's token is refreshed
function syncRefreshedToken(newAccessToken: string) {
  try {
    const currentToken = localStorage.getItem('atlasmail_token');
    const raw = localStorage.getItem('atlasmail_tokens');
    if (!raw || !currentToken) return;
    const tokenMap = JSON.parse(raw) as Record<string, { access: string; refresh: string }>;
    const activeAccountId = Object.keys(tokenMap).find(
      (id) => tokenMap[id].access === currentToken,
    );
    if (activeAccountId) {
      tokenMap[activeAccountId].access = newAccessToken;
      localStorage.setItem('atlasmail_tokens', JSON.stringify(tokenMap));
    }
  } catch {
    // Non-critical — the active token is already updated in the caller
  }
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
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const { data } = await axios.post(`${config.apiUrl}/auth/refresh`, { refreshToken });
        const newToken = data.data.accessToken;
        localStorage.setItem('atlasmail_token', newToken);
        syncRefreshedToken(newToken);
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        // Remove the stale entry from the per-account token map BEFORE clearing
        // the active-token keys, so we can still identify which account to evict.
        try {
          const currentAccess = localStorage.getItem('atlasmail_token');
          const raw = localStorage.getItem('atlasmail_tokens');
          if (raw && currentAccess) {
            const tokenMap = JSON.parse(raw) as Record<string, { access: string; refresh: string }>;
            const staleId = Object.keys(tokenMap).find(
              (id) => tokenMap[id].access === currentAccess,
            );
            if (staleId) {
              delete tokenMap[staleId];
              localStorage.setItem('atlasmail_tokens', JSON.stringify(tokenMap));
            }
          }
        } catch {
          // Best-effort cleanup
        }
        localStorage.removeItem('atlasmail_token');
        localStorage.removeItem('atlasmail_refresh_token');
        window.location.href = '/';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);
