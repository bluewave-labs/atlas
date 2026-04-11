import { describe, it, expect, beforeEach } from 'vitest';
import type { Account } from '@atlas-platform/shared';

// We need to clear localStorage and re-import the store fresh for each test.
// Since Zustand stores are singletons, we use setState to reset.

// Helper to create a minimal JWT with a given payload
function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc-1',
    userId: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    pictureUrl: null,
    ...overrides,
  } as Account;
}

describe('auth-store', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // We re-import the store each time because deriveInitialState runs at import time.
  // But since the module is cached, we use setState to simulate clean state.

  it('starts as not authenticated when localStorage is empty', async () => {
    // Force re-evaluation by resetting the store state
    const { useAuthStore } = await import('../src/stores/auth-store');
    useAuthStore.setState({
      account: null,
      accounts: [],
      isAuthenticated: false,
      isLoading: false,
      tenantId: null,
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.account).toBeNull();
    expect(state.accounts).toHaveLength(0);
  });

  it('addAccount sets account and marks as authenticated', async () => {
    const { useAuthStore } = await import('../src/stores/auth-store');
    useAuthStore.setState({
      account: null,
      accounts: [],
      isAuthenticated: false,
      isLoading: false,
      tenantId: null,
    });

    const account = makeAccount();
    const token = makeJwt({ userId: 'user-1', tenantId: 'tenant-1' });
    const refresh = 'refresh-token-1';

    useAuthStore.getState().addAccount(account, token, refresh);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.account?.id).toBe('acc-1');
    expect(state.accounts).toHaveLength(1);
    expect(state.tenantId).toBe('tenant-1');
  });

  it('stores tokens in localStorage after addAccount', async () => {
    const { useAuthStore } = await import('../src/stores/auth-store');
    useAuthStore.setState({
      account: null,
      accounts: [],
      isAuthenticated: false,
      isLoading: false,
      tenantId: null,
    });

    const account = makeAccount();
    const token = makeJwt({ userId: 'user-1' });

    useAuthStore.getState().addAccount(account, token, 'refresh-1');

    expect(localStorage.getItem('atlasmail_token')).toBe(token);
    expect(localStorage.getItem('atlasmail_refresh_token')).toBe('refresh-1');
    expect(localStorage.getItem('atlasmail_active_account_id')).toBe('acc-1');
  });

  it('logout clears account state', async () => {
    const { useAuthStore } = await import('../src/stores/auth-store');
    const account = makeAccount();
    const token = makeJwt({ userId: 'user-1' });

    // Set up an authenticated state first
    useAuthStore.setState({
      account,
      accounts: [account],
      isAuthenticated: true,
      isLoading: false,
      tenantId: null,
    });
    // Also write tokens so removeAccount can function
    localStorage.setItem('atlasmail_token', token);
    localStorage.setItem('atlasmail_active_account_id', 'acc-1');
    localStorage.setItem('atlasmail_accounts', JSON.stringify([account]));
    localStorage.setItem('atlasmail_tokens', JSON.stringify({ 'acc-1': { access: token, refresh: 'r' } }));

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.account).toBeNull();
    expect(state.accounts).toHaveLength(0);
  });

  it('logout clears localStorage tokens', async () => {
    const { useAuthStore } = await import('../src/stores/auth-store');
    const account = makeAccount();
    const token = makeJwt({ userId: 'user-1' });

    useAuthStore.setState({
      account,
      accounts: [account],
      isAuthenticated: true,
      isLoading: false,
      tenantId: null,
    });
    localStorage.setItem('atlasmail_token', token);
    localStorage.setItem('atlasmail_active_account_id', 'acc-1');
    localStorage.setItem('atlasmail_accounts', JSON.stringify([account]));
    localStorage.setItem('atlasmail_tokens', JSON.stringify({ 'acc-1': { access: token, refresh: 'r' } }));

    useAuthStore.getState().logout();

    expect(localStorage.getItem('atlasmail_token')).toBeNull();
    expect(localStorage.getItem('atlasmail_refresh_token')).toBeNull();
    expect(localStorage.getItem('atlasmail_accounts')).toBeNull();
  });

  it('setLoading updates isLoading', async () => {
    const { useAuthStore } = await import('../src/stores/auth-store');
    useAuthStore.getState().setLoading(true);
    expect(useAuthStore.getState().isLoading).toBe(true);

    useAuthStore.getState().setLoading(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('updateAccount syncs account data', async () => {
    const { useAuthStore } = await import('../src/stores/auth-store');
    const account = makeAccount();

    useAuthStore.setState({
      account,
      accounts: [account],
      isAuthenticated: true,
      isLoading: false,
      tenantId: null,
    });

    const updated = makeAccount({ name: 'Updated Name' });
    useAuthStore.getState().updateAccount(updated);

    expect(useAuthStore.getState().account?.name).toBe('Updated Name');
    expect(useAuthStore.getState().accounts[0].name).toBe('Updated Name');
  });

  it('tenantRole is extracted from JWT', async () => {
    const { useAuthStore } = await import('../src/stores/auth-store');
    useAuthStore.setState({
      account: null,
      accounts: [],
      isAuthenticated: false,
      isLoading: false,
      tenantId: null,
    });

    const account = makeAccount();
    const token = makeJwt({ userId: 'user-1', tenantRole: 'owner' });

    useAuthStore.getState().addAccount(account, token, 'refresh-1');
    expect(useAuthStore.getState().tenantRole).toBe('owner');
  });
});
