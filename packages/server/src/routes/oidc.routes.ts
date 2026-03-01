import { Router } from 'express';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import * as oidcService from '../services/platform/oidc.service';
import { logger } from '../utils/logger';

const router = Router();

// ─── Discovery ───────────────────────────────────────────────────────

router.get('/tenants/:slug/.well-known/openid-configuration', (req, res) => {
  // Use the request's Host header as the base URL so the discovery document
  // returns URLs that work from wherever the caller is (browser or Docker container).
  const proto = req.protocol;
  const host = req.get('host');
  const requestBaseUrl = host ? `${proto}://${host}` : undefined;
  const doc = oidcService.getDiscoveryDocument(String(req.params.slug), requestBaseUrl);
  res.json(doc);
});

// ─── JWKS ────────────────────────────────────────────────────────────

router.get('/tenants/:slug/.well-known/jwks.json', (_req, res) => {
  if (!env.OIDC_SIGNING_KEY) {
    res.status(503).json({ error: 'OIDC not configured' });
    return;
  }

  const publicKey = crypto.createPublicKey(env.OIDC_SIGNING_KEY);
  const jwk = publicKey.export({ format: 'jwk' });

  res.json({
    keys: [{ ...jwk, kid: 'atlas-oidc-1', use: 'sig', alg: 'RS256' }],
  });
});

// ─── Authorization Endpoint ──────────────────────────────────────────

router.get('/tenants/:slug/authorize', async (req, res) => {
  try {
    const { slug } = req.params;
    const { client_id, redirect_uri, response_type, state } = req.query as Record<string, string>;

    if (response_type !== 'code') {
      res.status(400).json({ error: 'unsupported_response_type' });
      return;
    }

    // Validate client
    const client = await oidcService.validateClient(slug, client_id);
    if (!client) {
      res.status(400).json({ error: 'invalid_client' });
      return;
    }

    // Validate redirect_uri against registered value (RFC 6749 requirement)
    if (redirect_uri && redirect_uri !== client.redirectUri) {
      res.status(400).json({ error: 'invalid_request', error_description: 'redirect_uri mismatch' });
      return;
    }
    const effectiveRedirectUri = client.redirectUri;

    // Check for existing Atlas session (JWT from cookie or Authorization header)
    const token = req.cookies?.atlas_token || req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      const returnUrl = encodeURIComponent(req.originalUrl);
      res.redirect(`/login?return=${returnUrl}`);
      return;
    }

    // Verify JWT
    let payload: any;
    try {
      payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
      const returnUrl = encodeURIComponent(req.originalUrl);
      res.redirect(`/login?return=${returnUrl}`);
      return;
    }

    // Look up tenant
    const { getTenantBySlug, getTenantMembership } = await import('../services/platform/tenant.service');
    const tenant = await getTenantBySlug(slug);
    if (!tenant) {
      res.status(404).json({ error: 'tenant_not_found' });
      return;
    }

    // Verify user is a member
    const membership = await getTenantMembership(tenant.id, payload.userId);
    if (!membership) {
      res.status(403).json({ error: 'access_denied', description: 'User is not a member of this tenant' });
      return;
    }

    // Issue authorization code
    const code = oidcService.createAuthorizationCode({
      clientId: client_id,
      userId: payload.userId,
      email: payload.email,
      tenantSlug: slug,
      tenantId: tenant.id,
      redirectUri: effectiveRedirectUri,
    });

    const redirectTo = new URL(effectiveRedirectUri);
    redirectTo.searchParams.set('code', code);
    if (state) redirectTo.searchParams.set('state', state);

    res.redirect(redirectTo.toString());
  } catch (err) {
    logger.error({ err }, 'OIDC authorization error');
    res.status(500).json({ error: 'server_error' });
  }
});

// ─── Token Endpoint ──────────────────────────────────────────────────

router.post('/tenants/:slug/token', async (req, res) => {
  try {
    const { slug } = req.params;
    const { grant_type, code, client_id, client_secret } = req.body;

    if (grant_type !== 'authorization_code') {
      res.status(400).json({ error: 'unsupported_grant_type' });
      return;
    }

    if (!code || !client_id || !client_secret) {
      res.status(400).json({ error: 'invalid_request' });
      return;
    }

    const tokens = await oidcService.exchangeCode(slug, code, client_id, client_secret);
    if (!tokens) {
      res.status(400).json({ error: 'invalid_grant' });
      return;
    }

    res.json(tokens);
  } catch (err) {
    logger.error({ err }, 'OIDC token exchange error');
    res.status(500).json({ error: 'server_error' });
  }
});

// ─── Userinfo Endpoint ───────────────────────────────────────────────

router.get('/tenants/:slug/userinfo', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'invalid_token' });
      return;
    }

    const accessToken = authHeader.slice(7);

    if (!env.OIDC_SIGNING_KEY) {
      res.status(503).json({ error: 'OIDC not configured' });
      return;
    }

    const publicKey = crypto.createPublicKey(env.OIDC_SIGNING_KEY);
    const payload = jwt.verify(accessToken, publicKey, { algorithms: ['RS256'] }) as any;

    res.json({
      sub: payload.sub,
      email: payload.email || `${payload.sub}@atlas.so`,
      name: payload.name,
      atlas_tenant_id: payload.atlas_tenant_id,
      atlas_roles: payload.atlas_roles,
    });
  } catch {
    res.status(401).json({ error: 'invalid_token' });
  }
});

export default router;
