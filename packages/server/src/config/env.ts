import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

dotenvConfig();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1).default('./data/atlasmail.db'),
  REDIS_URL: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  TOKEN_ENCRYPTION_KEY: z.string().min(32),
  SERVER_PUBLIC_URL: z.string().url().default('http://localhost:3001'),
  GOOGLE_PUBSUB_TOPIC: z.string().optional(), // e.g. projects/my-proj/topics/gmail-push
  FULLCONTACT_API_KEY: z.string().optional(),
  PDL_API_KEY: z.string().optional(), // People Data Labs
});

export const env = envSchema.parse(process.env);
