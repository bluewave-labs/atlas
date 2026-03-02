import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

dotenvConfig();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1).default('postgresql://postgres:postgres@localhost:5432/atlas'),
  REDIS_URL: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  TOKEN_ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/i, 'TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes for AES-256)'),
  SERVER_PUBLIC_URL: z.string().url().default('http://localhost:3001'),
  GOOGLE_PUBSUB_TOPIC: z.string().optional(), // e.g. projects/my-proj/topics/gmail-push

  // ─── Platform (optional — only needed when marketplace features are enabled) ──
  PLATFORM_RUNTIME: z.enum(['docker', 'k8s']).default('k8s'), // docker for local dev, k8s for production
  ADDON_PG_ADMIN_URL: z.string().optional(),         // PostgreSQL admin URL for provisioning app DBs
  ADDON_REDIS_URL: z.string().optional(),            // Redis URL for addon provisioning
  S3_BACKUP_BUCKET: z.string().optional(),           // S3 bucket for app backups
  OIDC_SIGNING_KEY: z.string().min(100, 'OIDC_SIGNING_KEY must be a PEM-encoded RSA private key').optional(),
  PLATFORM_PUBLIC_URL: z.string().url().optional(),  // e.g. https://atlas.so

  // ─── Email (SMTP) ─────────────────────────────────────────────────────────
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('Atlas <noreply@atlas.so>'),
  CLIENT_PUBLIC_URL: z.string().url().default('http://localhost:5180'),

  // ─── CORS ─────────────────────────────────────────────────────────────────
  CORS_ORIGINS: z.string().default('http://localhost:5180'),  // comma-separated origins

});

export const env = envSchema.parse(process.env);
