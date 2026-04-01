/**
 * Shared types for the Atlas Marketplace.
 */

export interface MarketplaceCatalogItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  color: string;
  website: string;
  license: string;
  resources: { minRam: string; estimatedDisk: string };
  defaultCredentials?: { username: string; password: string };
  userEnv: Array<{
    key: string;
    label: string;
    required?: boolean;
    default?: string;
  }>;
  // Install status (populated from DB)
  installed?: boolean;
  status?: string | null;
  assignedPort?: number | null;
  updateAvailable?: boolean;
}

export interface MarketplaceInstalledApp {
  id: string;
  appId: string;
  status: string;
  assignedPort: number;
  installedAt: string;
  updatedAt: string;
  updateAvailable: boolean;
}

export interface MarketplaceContainerStatus {
  id: string;
  name: string;
  state: string;
  health?: string;
  image: string;
  ports: Array<{ hostPort: number; containerPort: number }>;
}

export interface MarketplaceAppStatus {
  appId: string;
  status: string;
  assignedPort: number;
  containers: MarketplaceContainerStatus[];
  health: { ok: boolean; status?: number; error?: string } | null;
  installedAt: string;
  updatedAt: string;
}
