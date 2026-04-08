/**
 * Types for the Marketplace app catalog manifests and installed apps.
 */

export interface MarketplaceServiceDef {
  image: string;
  /** Platform-specific image overrides. Key is `linux/amd64` or `linux/arm64`. */
  platformImages?: Record<string, string>;
  port?: number;
  healthCheck?: string;
  env?: Record<string, string>;
  volumes?: string[];
  dependsOn?: string[];
  command?: string[];
  entrypoint?: string;
}

export interface MarketplaceManifest {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  color: string;
  website: string;
  license: string;
  defaultCredentials?: { username: string; password: string };
  services: Record<string, MarketplaceServiceDef>;
  userEnv: Array<{
    key: string;
    label: string;
    required?: boolean;
    default?: string;
  }>;
  /** Platforms this app supports. If omitted, assumes all platforms. */
  supportedPlatforms?: string[];
  resources: {
    minRam: string;
    estimatedDisk: string;
  };
}

export interface MarketplaceAppRecord {
  id: string;
  tenantId: string;
  appId: string;
  status: string;
  assignedPort: number;
  containerIds: string[] | null;
  imageDigest: string | null;
  latestDigest: string | null;
  generatedSecrets: string | null;
  envOverrides: Record<string, string> | null;
  installedAt: Date;
  updatedAt: Date;
}
