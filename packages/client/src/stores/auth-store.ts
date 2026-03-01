import { create } from 'zustand';
import type { Account } from '@atlasmail/shared';

// Token storage helpers
// Active account tokens always live in the legacy keys for api-client compatibility.
// All per-account tokens live in `atlasmail_tokens` as a JSON map.

interface TokenMap {
  [accountId: string]: { access: string; refresh: string };
}

function readTokenMap(): TokenMap {
  try {
    const raw = localStorage.getItem('atlasmail_tokens');
    return raw ? (JSON.parse(raw) as TokenMap) : {};
  } catch {
    return {};
  }
}

function writeTokenMap(map: TokenMap) {
  localStorage.setItem('atlasmail_tokens', JSON.stringify(map));
}

function readAccounts(): Account[] {
  try {
    const raw = localStorage.getItem('atlasmail_accounts');
    return raw ? (JSON.parse(raw) as Account[]) : [];
  } catch {
    return [];
  }
}

function writeAccounts(accounts: Account[]) {
  localStorage.setItem('atlasmail_accounts', JSON.stringify(accounts));
}

function readActiveAccountId(): string | null {
  return localStorage.getItem('atlasmail_active_account_id');
}

function writeActiveTokens(accountId: string, access: string, refresh: string) {
  // Atomic: write the token map entry + active keys + active account ID together
  const tokenMap = readTokenMap();
  tokenMap[accountId] = { access, refresh };
  writeTokenMap(tokenMap);
  localStorage.setItem('atlasmail_active_account_id', accountId);
  localStorage.setItem('atlasmail_token', access);
  localStorage.setItem('atlasmail_refresh_token', refresh);
}

function clearActiveTokens() {
  localStorage.removeItem('atlasmail_active_account_id');
  localStorage.removeItem('atlasmail_token');
  localStorage.removeItem('atlasmail_refresh_token');
}

// ─── State shape ────────────────────────────────────────────────────────────

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

interface AuthState {
  account: Account | null;
  accounts: Account[];
  tenantId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setAccount: (account: Account | null) => void;
  setLoading: (loading: boolean) => void;

  addAccount: (account: Account, accessToken: string, refreshToken: string) => void;
  switchAccount: (accountId: string) => void;
  removeAccount: (accountId: string) => void;
  updateAccount: (account: Account) => void;

  logout: () => void;
}

// ─── Store ───────────────────────────────────────────────────────────────────

// Restore persisted accounts and figure out the active account on startup.
// The active account is whichever account's tokens are in `atlasmail_token`.
// We match by looking for the active token in the token map.
function deriveInitialState(): { account: Account | null; accounts: Account[]; tenantId: string | null } {
  const accounts = readAccounts();
  if (accounts.length === 0) return { account: null, accounts: [], tenantId: null };

  const tokenMap = readTokenMap();

  // 1. Try the stored active account ID (reliable — not affected by token refresh races)
  const storedActiveId = readActiveAccountId();
  if (storedActiveId) {
    const active = accounts.find((a) => a.id === storedActiveId);
    const tokens = tokenMap[storedActiveId];
    if (active && tokens) {
      // Re-sync the active token keys in case they drifted
      localStorage.setItem('atlasmail_token', tokens.access);
      localStorage.setItem('atlasmail_refresh_token', tokens.refresh);
      const payload = decodeJwtPayload(tokens.access);
      return { account: active, accounts, tenantId: (payload?.tenantId as string) ?? null };
    }
  }

  // 2. Fallback: try to restore the first account that has tokens
  for (const acct of accounts) {
    const tokens = tokenMap[acct.id];
    if (tokens) {
      writeActiveTokens(acct.id, tokens.access, tokens.refresh);
      const payload = decodeJwtPayload(tokens.access);
      return { account: acct, accounts, tenantId: (payload?.tenantId as string) ?? null };
    }
  }

  // 3. No tokens at all — clear stale accounts and go to login
  clearActiveTokens();
  localStorage.removeItem('atlasmail_accounts');
  localStorage.removeItem('atlasmail_tokens');
  return { account: null, accounts: [], tenantId: null };
}

const initial = deriveInitialState();

export const useAuthStore = create<AuthState>((set, get) => ({
  account: initial.account,
  accounts: initial.accounts,
  tenantId: initial.tenantId,
  isAuthenticated: !!initial.account,
  // deriveInitialState() always resolves to a definite state — no async step needed.
  isLoading: false,

  setAccount: (account) => {
    set({ account, isAuthenticated: !!account, isLoading: false });
  },

  setLoading: (isLoading) => set({ isLoading }),

  // ── addAccount ──────────────────────────────────────────────────────────
  // Adds a new account to the list (or updates an existing one), stores its
  // tokens in the map, and makes it the active account.
  addAccount: (account, accessToken, refreshToken) => {
    const { accounts } = get();
    const exists = accounts.some((a) => a.id === account.id);
    const updated = exists
      ? accounts.map((a) => (a.id === account.id ? account : a))
      : [...accounts, account];

    writeAccounts(updated);
    writeActiveTokens(account.id, accessToken, refreshToken);

    const payload = decodeJwtPayload(accessToken);
    set({ accounts: updated, account, tenantId: (payload?.tenantId as string) ?? null, isAuthenticated: true, isLoading: false });
  },

  // ── switchAccount ────────────────────────────────────────────────────────
  // Swaps the active tokens in localStorage and updates the active account.
  // Fires a custom event so query caches can be cleared.
  switchAccount: (accountId) => {
    const { accounts } = get();
    const target = accounts.find((a) => a.id === accountId);
    if (!target) return;

    const tokenMap = readTokenMap();
    const tokens = tokenMap[accountId];
    if (!tokens) return;

    writeActiveTokens(accountId, tokens.access, tokens.refresh);
    set({ account: target, isAuthenticated: true });

    window.dispatchEvent(new CustomEvent('atlasmail:account-switch', { detail: { accountId } }));
  },

  // ── removeAccount ────────────────────────────────────────────────────────
  removeAccount: (accountId) => {
    const { accounts, account } = get();
    const updated = accounts.filter((a) => a.id !== accountId);

    const tokenMap = readTokenMap();
    delete tokenMap[accountId];

    writeAccounts(updated);
    writeTokenMap(tokenMap);

    // If we're removing the active account, switch to the next one or clear
    if (account?.id === accountId) {
      if (updated.length > 0) {
        const next = updated[0];
        const nextTokens = tokenMap[next.id];
        if (nextTokens) {
          writeActiveTokens(next.id, nextTokens.access, nextTokens.refresh);
        } else {
          clearActiveTokens();
        }
        set({ accounts: updated, account: next });
        window.dispatchEvent(new CustomEvent('atlasmail:account-switch', { detail: { accountId: next.id } }));
      } else {
        clearActiveTokens();
        localStorage.removeItem('atlasmail_accounts');
        localStorage.removeItem('atlasmail_tokens');
        set({ accounts: [], account: null, isAuthenticated: false });
      }
    } else {
      set({ accounts: updated });
    }
  },

  // ── updateAccount ────────────────────────────────────────────────────────
  // Syncs an updated account object (e.g. after a server-side sync status change)
  updateAccount: (account) => {
    const { accounts } = get();
    const alreadyIn = accounts.some((a) => a.id === account.id);
    const base = alreadyIn ? accounts : [...accounts, account];
    const updated = base.map((a) => (a.id === account.id ? account : a));
    writeAccounts(updated);
    set({
      accounts: updated,
      account: get().account?.id === account.id ? account : get().account,
    });
  },

  // ── logout ───────────────────────────────────────────────────────────────
  // Removes just the active account, or all if it's the last one.
  logout: () => {
    const { account } = get();
    if (!account) return;
    // Capture count BEFORE removeAccount mutates the list
    const accountCount = get().accounts.length;
    get().removeAccount(account.id);
    // If this was the last account, guarantee a clean auth state
    if (accountCount <= 1) {
      clearActiveTokens();
      localStorage.removeItem('atlasmail_accounts');
      localStorage.removeItem('atlasmail_tokens');
      set({ account: null, accounts: [], isAuthenticated: false });
    }
  },
}));
