import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OAuth2Client } from 'google-auth-library';

const { getAuthenticatedClientMock, forceRefreshClientMock } = vi.hoisted(() => ({
  getAuthenticatedClientMock: vi.fn(),
  forceRefreshClientMock: vi.fn(),
}));

vi.mock('../src/services/google-auth', () => ({
  getAuthenticatedClient: getAuthenticatedClientMock,
  forceRefreshClient: forceRefreshClientMock,
}));

import { callGoogleApi } from '../src/services/google-api-call';

const fakeClient = { fake: 'first' } as unknown as OAuth2Client;
const refreshedClient = { fake: 'refreshed' } as unknown as OAuth2Client;

describe('callGoogleApi', () => {
  beforeEach(() => {
    getAuthenticatedClientMock.mockReset();
    forceRefreshClientMock.mockReset();
  });

  it('returns the result on first try when no error', async () => {
    getAuthenticatedClientMock.mockResolvedValue(fakeClient);
    const fn = vi.fn(async () => 'ok');
    const result = await callGoogleApi('acc-1', fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(fakeClient);
    expect(forceRefreshClientMock).not.toHaveBeenCalled();
  });

  it('refreshes and retries once on 401 (err.code === 401)', async () => {
    getAuthenticatedClientMock.mockResolvedValue(fakeClient);
    forceRefreshClientMock.mockResolvedValue(refreshedClient);
    const fn = vi.fn()
      .mockImplementationOnce(async () => { const e: any = new Error('unauth'); e.code = 401; throw e; })
      .mockImplementationOnce(async () => 'ok-after-refresh');

    const result = await callGoogleApi('acc-1', fn);
    expect(result).toBe('ok-after-refresh');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, fakeClient);
    expect(fn).toHaveBeenNthCalledWith(2, refreshedClient);
    expect(forceRefreshClientMock).toHaveBeenCalledWith('acc-1');
  });

  it('refreshes and retries once on 401 (err.response.status === 401)', async () => {
    getAuthenticatedClientMock.mockResolvedValue(fakeClient);
    forceRefreshClientMock.mockResolvedValue(refreshedClient);
    const fn = vi.fn()
      .mockImplementationOnce(async () => { const e: any = new Error('unauth'); e.response = { status: 401 }; throw e; })
      .mockImplementationOnce(async () => 'ok-after-refresh');

    const result = await callGoogleApi('acc-1', fn);
    expect(result).toBe('ok-after-refresh');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry on non-401 errors', async () => {
    getAuthenticatedClientMock.mockResolvedValue(fakeClient);
    const fn = vi.fn(async () => { const e: any = new Error('rate'); e.code = 429; throw e; });
    await expect(callGoogleApi('acc-1', fn)).rejects.toMatchObject({ code: 429 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(forceRefreshClientMock).not.toHaveBeenCalled();
  });

  it('propagates the second error if the retry also fails', async () => {
    getAuthenticatedClientMock.mockResolvedValue(fakeClient);
    forceRefreshClientMock.mockResolvedValue(refreshedClient);
    const fn = vi.fn()
      .mockImplementationOnce(async () => { const e: any = new Error('unauth1'); e.code = 401; throw e; })
      .mockImplementationOnce(async () => { const e: any = new Error('still-bad'); e.code = 401; throw e; });

    await expect(callGoogleApi('acc-1', fn)).rejects.toThrow(/still-bad/);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('propagates the refresh error and does not retry fn when forceRefreshClient throws', async () => {
    getAuthenticatedClientMock.mockResolvedValue(fakeClient);
    forceRefreshClientMock.mockRejectedValue(new Error('Token refresh failed'));
    const fn = vi.fn()
      .mockImplementationOnce(async () => { const e: any = new Error('unauth'); e.code = 401; throw e; });

    await expect(callGoogleApi('acc-1', fn)).rejects.toThrow(/Token refresh failed/);
    expect(fn).toHaveBeenCalledTimes(1); // No second call after refresh failure
    expect(forceRefreshClientMock).toHaveBeenCalledTimes(1);
  });
});
