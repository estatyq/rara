import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4100),
  CORS_ORIGINS: z.string().default('http://localhost:5176,http://localhost:5175,capacitor://localhost'),
  DATABASE_URL: z.string().min(10),
  DATABASE_RUNTIME_URL: z.string().optional(),
  REDIS_URL: z.string().default('redis://localhost:6389'),
  JWT_ACCESS_SECRET: z.string().min(24),
  JWT_REFRESH_SECRET: z.string().min(24),
  SECRETS_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, 'Must be 64 hex characters (32 bytes)'),
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  MISSED_AFTER_HOURS: z.coerce.number().int().min(1).max(24).default(3),
  CRITICAL_BP_ESCALATION_MINUTES: z.coerce.number().int().min(1).max(120).default(15),
  DEFAULT_TIMEZONE: z.string().default('Asia/Jakarta'),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('[dosemate-api] Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  corsOrigins: parsed.data.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
