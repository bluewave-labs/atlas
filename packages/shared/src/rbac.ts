// Shared RBAC role matrix.
//
// Single source of truth for `role → allowed operations`. Both the server
// (packages/server/src/services/app-permissions.service.ts) and the client
// (packages/client/src/hooks/use-app-permissions.ts) import from here so the
// two sides can never drift on op names or role capabilities.
//
// The server remains the enforcement boundary; the client matrix is purely
// for gating UI affordances (hiding buttons the user can't use).

export type AppRole = 'admin' | 'editor' | 'viewer';
export type AppOperation = 'view' | 'create' | 'update' | 'delete' | 'delete_own';
export type AppRecordAccess = 'all' | 'own';

export const ROLE_MATRIX: Record<AppRole, readonly AppOperation[]> = {
  admin: ['view', 'create', 'update', 'delete', 'delete_own'],
  editor: ['view', 'create', 'update', 'delete_own'],
  viewer: ['view'],
};

export function canAccess(role: AppRole, op: AppOperation): boolean {
  return ROLE_MATRIX[role]?.includes(op) ?? false;
}
