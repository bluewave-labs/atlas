import type { OAuth2Client } from 'google-auth-library';
import { getAuthenticatedClient, forceRefreshClient } from './google-auth';

/**
 * Run a Google API call with automatic 401 recovery: if the first attempt
 * fails with 401 (either `err.code === 401` or `err.response?.status === 401`),
 * force a refresh and retry exactly once. Non-401 errors and the second-try
 * error propagate to the caller.
 *
 * Use this for every Gmail / Calendar API call where the token may expire
 * mid-flight (long syncs, large pages, slow networks).
 *
 * Concurrency note: two simultaneous calls for the same account can both hit
 * a 401 and both call `forceRefreshClient`. The second persisted refresh wins;
 * the first refresh's access_token may be invalidated by Google depending on
 * rotation settings. BullMQ currently serializes sync jobs per channel via
 * concurrency=2 across the worker, so concurrent same-channel refresh is
 * unlikely. If concurrency is ever increased, revisit with a per-account lock.
 */
export async function callGoogleApi<T>(
  accountId: string,
  fn: (auth: OAuth2Client) => Promise<T>,
): Promise<T> {
  // Each call re-loads the account from DB and decrypts tokens. Postgres
  // caches the row so this is cheap, but at high call counts (e.g. Gmail
  // full sync paginating thousands of messages.get) it shows up. If profiling
  // surfaces it, add a short-lived in-memory cache keyed by accountId.
  const auth = await getAuthenticatedClient(accountId);
  try {
    return await fn(auth);
  } catch (err: any) {
    if (err?.code === 401 || err?.response?.status === 401) {
      const refreshed = await forceRefreshClient(accountId);
      return await fn(refreshed);
    }
    throw err;
  }
}
