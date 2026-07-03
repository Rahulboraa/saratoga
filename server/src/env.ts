import { z } from 'zod'

try { process.loadEnvFile(new URL('../../.env', import.meta.url).pathname) } catch { /* no .env */ }

const schema = z.object({
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/saratoga'),
  JWT_SECRET: z.string().default('dev-secret'),
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.string().default('development'),
  LEGACY_SHEET_URL: z.string().optional(),
})

export const env = schema.parse(process.env)

if (env.NODE_ENV === 'production' && env.JWT_SECRET === 'dev-secret') {
  throw new Error('JWT_SECRET must be set in production')
}
