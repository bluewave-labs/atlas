import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

// Load .env from monorepo root (tsx watch may change CWD)
import path from 'path';
const rootEnv = path.resolve(__dirname, '../../../../.env');
dotenvConfig({ path: rootEnv });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1).default('postgresql://postgres:postgres@localhost:5432/atlas'),
  REDIS_URL: z.string().optional(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  TOKEN_ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/i, 'TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes for AES-256)'),
  SERVER_PUBLIC_URL: z.string().url().default('http://localhost:3001'),

  // ─── Platform ──────────────────────────────────────────────────────────────
  PLATFORM_PUBLIC_URL: z.string().url().optional(),

  // ─── Email (SMTP — for password reset emails) ────────────────────────────
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('Atlas <noreply@atlas.so>'),
  CLIENT_PUBLIC_URL: z.string().url().default('http://localhost:3001'),

  // ─── Google OAuth (for CRM email/calendar sync) ───────────────────────
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),

  // ─── CORS ─────────────────────────────────────────────────────────────────
  CORS_ORIGINS: z.string().default('http://localhost:3001,http://localhost:5180'),

  // ─── Self-hosting / SaaS gate ─────────────────────────────────────────────
  // When true (the default), the public POST /auth/register endpoint is
  // disabled. New users can still join via tenant invitations
  // (POST /auth/invitation/:token/accept) and the first-run /auth/setup
  // flow is unaffected. SaaS operators (e.g. app.dodoapps.net) who want
  // to allow open self-signup must set DISABLE_PUBLIC_SIGNUP=false
  // explicitly. Accepts 'false' / '0' / 'no' (case-insensitive) as
  // falsy; any other value (including unset) is true.
  DISABLE_PUBLIC_SIGNUP: z
    .string()
    .optional()
    .transform((v) => v ? !['false', '0', 'no'].includes(v.toLowerCase()) : true),
});

export const env = envSchema.parse(process.env);
