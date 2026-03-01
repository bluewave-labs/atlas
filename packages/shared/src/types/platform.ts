// ─── Atlas Platform Types ────────────────────────────────────────────

export type TenantPlan = 'starter' | 'pro' | 'enterprise';
export type TenantStatus = 'active' | 'suspended' | 'deleted';
export type TenantMemberRole = 'owner' | 'admin' | 'member';
export type InstallationStatus = 'installing' | 'running' | 'stopped' | 'error' | 'uninstalling';
export type AppRole = 'admin' | 'member' | 'viewer';
export type AddonType = 'postgresql' | 'redis' | 'smtp' | 's3';
export type BackupTrigger = 'scheduled' | 'manual' | 'pre-update';
export type BackupStatus = 'pending' | 'running' | 'completed' | 'failed';

// ─── Tenant ──────────────────────────────────────────────────────────

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  plan: TenantPlan;
  status: TenantStatus;
  ownerId: string;
  k8sNamespace: string;
  quotaCpu: number;
  quotaMemoryMb: number;
  quotaStorageMb: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantInput {
  slug: string;
  name: string;
  plan?: TenantPlan;
}

export interface TenantMember {
  tenantId: string;
  userId: string;
  role: TenantMemberRole;
  createdAt: string;
}

// ─── Registration & Auth ─────────────────────────────────────────────

export interface RegisterTenantInput {
  companyName: string;
  companySlug: string;
  userName: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface CreateTenantUserInput {
  email: string;
  name: string;
  password: string;
  role?: TenantMemberRole;
}

export interface TenantInvitation {
  id: string;
  tenantId: string;
  email: string;
  role: TenantMemberRole;
  invitedBy: string;
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

export interface TenantUser {
  userId: string;
  email: string;
  name: string | null;
  role: TenantMemberRole;
  createdAt: string;
}

// ─── App Catalog ─────────────────────────────────────────────────────

export interface AtlasManifest {
  manifestVersion: number;
  id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  tags: string[];
  ui: {
    icon: string;
    color: string;
    screenshots: string[];
  };
  runtime: {
    image: string;
    httpPort: number;
    healthCheckPath: string;
    healthCheckTimeoutSeconds: number;
  };
  resources: {
    memoryMb: number;
    cpuMillicores: number;
    storageMb: number;
  };
  addons: {
    postgresql: boolean;
    redis: boolean;
    smtp: boolean;
    s3: boolean;
  };
  persistentDirs: string[];
  sso: {
    method: 'oidc';
    oidcCallbackPath: string;
  };
  lifecycle: {
    backupCommand: string;
    restoreCommand: string;
  };
  minPlan: TenantPlan;
}

export interface CatalogApp {
  id: string;
  manifestId: string;
  name: string;
  category: string;
  tags: string[];
  iconUrl: string;
  color: string;
  description: string;
  currentVersion: string;
  manifest: AtlasManifest;
  minPlan: TenantPlan;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── App Installation ────────────────────────────────────────────────

export interface AppInstallation {
  id: string;
  tenantId: string;
  catalogAppId: string;
  installedVersion: string;
  status: InstallationStatus;
  subdomain: string;
  k8sDeploymentName: string;
  oidcClientId: string;
  addonRefs: Record<string, string>;
  lastHealthStatus: string | null;
  customEnv: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  // Joined fields (from catalog)
  name?: string;
  iconUrl?: string;
  color?: string;
}

export interface InstallAppInput {
  catalogAppId: string;
  subdomain: string;
  customEnv?: Record<string, string>;
}

// ─── Addons ──────────────────────────────────────────────────────────

export interface AppAddon {
  id: string;
  installationId: string;
  addonType: AddonType;
  host: string;
  port: number;
  database: string;
  username: string;
  createdAt: string;
}

// ─── App User Assignments ───────────────────────────────────────────

export interface AppUserAssignment {
  id: string;
  installationId: string;
  userId: string;
  appRole: AppRole;
  assignedBy: string;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  email?: string;
  name?: string;
}

// ─── Backups ─────────────────────────────────────────────────────────

export interface AppBackup {
  id: string;
  installationId: string;
  triggeredBy: BackupTrigger;
  status: BackupStatus;
  storageKey: string | null;
  sizeBytes: number | null;
  createdAt: string;
  completedAt: string | null;
}
