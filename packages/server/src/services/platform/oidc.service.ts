import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { eq, and } from 'drizzle-orm';
import { db } from '../../config/database';
import { appInstallations } from '../../db/schema';
import { getTenantBySlug, getTenantMembership } from './tenant.service';
import { decrypt } from '../../utils/crypto';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

// In-memory authorization code store (replace with Redis in production)
const authCodes = new Map<string, {
  clientId: string;
  userId: string;
  email: string;
  tenantSlug: string;
  tenantId: string;
  redirectUri: string;
  appRole: string;
  expiresAt: number;
}>();

// Clean up expired codes periodically
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of authCodes) {
    if (data.expiresAt < now) authCodes.delete(code);
  }
}, 60_000);

function getSigningKey(): string {
  if (!env.OIDC_SIGNING_KEY) {
    throw new Error('OIDC_SIGNING_KEY not configured');
  }
  return env.OIDC_SIGNING_KEY;
}

/**
 * Get OIDC discovery document for a tenant.
 */
export function getDiscoveryDocument(tenantSlug: string, requestBaseUrl?: string) {
  const baseUrl = requestBaseUrl || env.PLATFORM_PUBLIC_URL || env.SERVER_PUBLIC_URL;
  const issuer = `${baseUrl}/oidc/tenants/${tenantSlug}`;

  return {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    userinfo_endpoint: `${issuer}/userinfo`,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    scopes_supported: ['openid', 'profile', 'email'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    claims_supported: ['sub', 'email', 'name', 'atlas_tenant_id', 'atlas_roles', 'atlas_app_role'],
  };
}

/**
 * Validate an OIDC client (app installation) belongs to the tenant.
 */
export async function validateClient(tenantSlug: string, clientId: string): Promise<{ installationId: string; redirectUri: string } | null> {
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return null;


  const [inst] = await db
    .select()
    .from(appInstallations)
    .where(and(eq(appInstallations.tenantId, tenant.id), eq(appInstallations.oidcClientId, clientId)))
    .limit(1);

  if (!inst) return null;

  // Build redirect URI from subdomain
  const isDocker = env.PLATFORM_RUNTIME === 'docker';
  const protocol = isDocker ? 'http' : 'https';
  const domain = isDocker ? 'localhost' : 'atlas.so';
  const redirectUri = `${protocol}://${inst.subdomain}.${tenantSlug}.${domain}${
    (inst.customEnv as any)?.OIDC_CALLBACK_PATH || '/auth/oidc/callback'
  }`;

  return { installationId: inst.id, redirectUri };
}

/**
 * Create an authorization code for the user.
 */
export function createAuthorizationCode(opts: {
  clientId: string;
  userId: string;
  email: string;
  tenantSlug: string;
  tenantId: string;
  redirectUri: string;
  appRole: string;
}): string {
  const code = crypto.randomBytes(32).toString('base64url');
  authCodes.set(code, {
    ...opts,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
  });
  return code;
}

/**
 * Exchange an authorization code for tokens.
 */
export async function exchangeCode(
  tenantSlug: string,
  code: string,
  clientId: string,
  clientSecret: string,
): Promise<{ id_token: string; access_token: string; token_type: string; expires_in: number } | null> {
  const codeData = authCodes.get(code);
  if (!codeData || codeData.clientId !== clientId) return null;

  // Verify the code was issued for this tenant (prevents cross-tenant token theft)
  if (codeData.tenantSlug !== tenantSlug) return null;

  // Verify code hasn't expired
  if (codeData.expiresAt < Date.now()) {
    authCodes.delete(code);
    return null;
  }

  // Verify client secret
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return null;


  const [inst] = await db
    .select()
    .from(appInstallations)
    .where(and(eq(appInstallations.tenantId, tenant.id), eq(appInstallations.oidcClientId, clientId)))
    .limit(1);

  if (!inst || !inst.oidcClientSecret) return null;

  const storedSecret = decrypt(inst.oidcClientSecret);
  if (storedSecret !== clientSecret) return null;

  // Consume code (one-time use)
  authCodes.delete(code);

  // Get user's role
  const membership = await getTenantMembership(codeData.tenantId, codeData.userId);
  const roles = membership ? [membership.role] : ['member'];

  const baseUrl = env.PLATFORM_PUBLIC_URL || env.SERVER_PUBLIC_URL;
  const issuer = `${baseUrl}/oidc/tenants/${tenantSlug}`;
  const signingKey = getSigningKey();

  // Issue id_token
  const idToken = jwt.sign(
    {
      sub: codeData.userId,
      email: codeData.email,
      name: codeData.email.split('@')[0], // simplified — real impl should look up user name
      atlas_tenant_id: codeData.tenantId,
      atlas_roles: roles,
      atlas_app_role: codeData.appRole,
      aud: clientId,
      iss: issuer,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    signingKey,
    { algorithm: 'RS256', keyid: 'atlas-oidc-1' },
  );

  // Issue access_token (for userinfo endpoint) — must include all claims
  // that the userinfo endpoint returns, since it reads them from this token.
  const accessToken = jwt.sign(
    {
      sub: codeData.userId,
      email: codeData.email,
      name: codeData.email.split('@')[0],
      atlas_tenant_id: codeData.tenantId,
      atlas_roles: roles,
      atlas_app_role: codeData.appRole,
      client_id: clientId,
      scope: 'openid profile email',
    },
    signingKey,
    { algorithm: 'RS256', expiresIn: '1h' },
  );

  logger.info({ clientId, userId: codeData.userId }, 'OIDC tokens issued');

  return {
    id_token: idToken,
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
  };
}
