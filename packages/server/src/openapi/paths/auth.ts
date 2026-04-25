import { z } from 'zod';
import { register, envelope, User } from '../_helpers';

register({
  method: 'get',
  path: '/auth/setup-status',
  tags: ['Authentication'],
  summary: 'Check if first-run setup is required',
  public: true,
  response: envelope(z.object({
    needsSetup: z.boolean(),
    publicSignupEnabled: z.boolean(),
  })),
});

register({
  method: 'post',
  path: '/auth/setup',
  tags: ['Authentication'],
  summary: 'Complete first-run setup (create initial admin + tenant)',
  public: true,
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(1),
    organizationName: z.string().min(1),
  }),
  response: envelope(z.object({ token: z.string(), refreshToken: z.string(), user: User })),
});

register({
  method: 'post',
  path: '/auth/login',
  tags: ['Authentication'],
  summary: 'Log in with email + password',
  public: true,
  body: z.object({
    email: z.string().email().openapi({ example: 'gorkem@example.com' }),
    password: z.string().min(1),
  }),
  response: envelope(z.object({ token: z.string(), refreshToken: z.string(), user: User })),
});

register({
  method: 'post',
  path: '/auth/register',
  tags: ['Authentication'],
  summary: 'Register a new user account (if enabled)',
  public: true,
  body: z.object({ email: z.string().email(), password: z.string().min(8), name: z.string() }),
  response: envelope(z.object({ token: z.string(), refreshToken: z.string(), user: User })),
});

register({
  method: 'post',
  path: '/auth/refresh',
  tags: ['Authentication'],
  summary: 'Exchange a refresh token for a new access token',
  public: true,
  body: z.object({ refreshToken: z.string() }),
  response: envelope(z.object({ token: z.string(), refreshToken: z.string() })),
});

register({
  method: 'post',
  path: '/auth/forgot-password',
  tags: ['Authentication'],
  summary: 'Request a password reset email',
  public: true,
  body: z.object({ email: z.string().email() }),
});

register({
  method: 'post',
  path: '/auth/reset-password',
  tags: ['Authentication'],
  summary: 'Reset password using token from email',
  public: true,
  body: z.object({ token: z.string(), password: z.string().min(8) }),
});

register({
  method: 'get',
  path: '/auth/me',
  tags: ['Authentication'],
  summary: 'Get the currently authenticated account',
  response: envelope(z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string().nullable(),
    pictureUrl: z.string().url().nullable(),
    provider: z.enum(['local', 'google', 'microsoft']),
  })),
});

register({
  method: 'get',
  path: '/auth/accounts',
  tags: ['Authentication'],
  summary: 'List accounts the current user has access to',
  response: envelope(z.array(z.object({ id: z.string().uuid(), name: z.string().nullable() }))),
});

register({
  method: 'get',
  path: '/auth/invitation/:token',
  tags: ['Authentication'],
  summary: 'Get details about a pending tenant invitation',
  public: true,
  params: z.object({ token: z.string() }),
  response: envelope(z.object({
    tenantName: z.string(),
    email: z.string().email(),
    role: z.enum(['admin', 'member']),
    expiresAt: z.string().datetime(),
  })),
});

register({
  method: 'post',
  path: '/auth/invitation/:token/accept',
  tags: ['Authentication'],
  summary: 'Accept a tenant invitation',
  public: true,
  params: z.object({ token: z.string() }),
  body: z.object({ password: z.string().min(8).optional(), name: z.string().optional() }),
  response: envelope(z.object({ token: z.string(), refreshToken: z.string(), user: User })),
});

register({
  method: 'get',
  path: '/auth/google/connect',
  tags: ['Authentication'],
  summary: 'Start Google OAuth flow to connect a Google account',
  response: envelope(z.object({ authUrl: z.string().url() })),
});

register({
  method: 'get',
  path: '/auth/google/callback',
  tags: ['Authentication'],
  summary: 'Google OAuth callback (Google redirects here after consent)',
  public: true,
  query: z.object({ code: z.string(), state: z.string() }),
  extraResponses: {
    302: { description: 'Redirect back to the app with the connection complete' },
  },
});

register({
  method: 'post',
  path: '/auth/google/disconnect',
  tags: ['Authentication'],
  summary: 'Disconnect a linked Google account',
});
