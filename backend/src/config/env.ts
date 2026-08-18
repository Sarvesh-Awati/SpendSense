import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environmental variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  PORT: z.coerce.number().default(5001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url({ message: 'DATABASE_URL must be a valid PostgreSQL connection string' }),
  // Signs access tokens. There is no refresh-token secret: refresh tokens are
  // opaque random values looked up by SHA-256 hash, not signed JWTs, so there
  // is nothing for a second secret to protect. Requiring one implied a
  // safeguard that did not exist — rotating it would have revoked nothing.
  // To invalidate every refresh token, delete the rows in `refresh_tokens`.
  JWT_SECRET: z.string().min(8, { message: 'JWT_SECRET must be at least 8 characters' }),
  GEMINI_API_KEY: z.string().min(1, { message: 'GEMINI_API_KEY is required' }),
  // Public base URL of the frontend, used to build links in transactional
  // email. Must be set per environment — never hardcode it in the sender.
  APP_URL: z
    .string()
    .url({ message: 'APP_URL must be a valid URL (e.g. https://app.example.com)' })
    .default('http://localhost:3000'),
  // Exchange-rate provider. Optional: without a key, foreign-currency
  // transactions fail closed (503). Same-currency entry never needs it.
  EXCHANGE_RATE_API_KEY: z.string().optional(),
  EXCHANGE_RATE_BASE_URL: z.string().url().default('https://api.exchangerate.host'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z.coerce.boolean().optional(),
  EMAIL_FROM: z.string().optional(),
  /**
   * Comma-separated list of browser origins allowed to call this API.
   *
   * SECURITY: the API authenticates with a bearer token rather than a cookie,
   * so a permissive CORS policy is not itself an authentication bypass — but
   * it does let any page on the internet read responses on behalf of a user
   * who has pasted a token, and it removes a cheap layer of defence. There is
   * no wildcard: an origin not on this list is refused.
   *
   * Development defaults to the Vite dev server; production has no default and
   * must be set explicitly (enforced below).
   */
  CORS_ORIGINS: z.string().optional(),
});

type EnvConfig = z.infer<typeof envSchema>;

let env: EnvConfig;

try {
  env = envSchema.parse(process.env);

  // ------------------------------------------------------------------
  // Production-only hardening.
  //
  // These are deliberately NOT part of the schema: local development and the
  // test suite must keep working with short throwaway secrets and localhost
  // URLs. Refusing to boot is the right failure mode — a production API that
  // starts with a development secret is worse than one that does not start.
  // ------------------------------------------------------------------
  if (env.NODE_ENV === 'production') {
    const problems: string[] = [];

    if (env.JWT_SECRET.length < 32) {
      problems.push('JWT_SECRET must be at least 32 characters in production');
    }
    if (!env.CORS_ORIGINS || env.CORS_ORIGINS.trim() === '') {
      problems.push('CORS_ORIGINS must list the allowed frontend origin(s) in production');
    }
    if (env.APP_URL.startsWith('http://localhost')) {
      problems.push('APP_URL still points at localhost; password reset links would be unusable');
    }

    if (problems.length > 0) {
      console.error('❌ Production environment is not safely configured:');
      problems.forEach((p) => console.error(`   - ${p}`));
      process.exit(1);
    }
  }
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Invalid or missing Environment Variables:');
    error.errors.forEach((err) => {
      console.error(`   - ${err.path.join('.')}: ${err.message}`);
    });
  } else {
    console.error('❌ Failed to parse environment variables:', error);
  }
  process.exit(1);
}

/**
 * Origins allowed to call the API from a browser.
 *
 * Development and test fall back to the Vite dev server so `npm run dev` and
 * the integration suite work with no extra configuration. Production has no
 * fallback — env validation above refuses to boot without an explicit list.
 */
export const allowedOrigins: string[] = (() => {
  const configured = (env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (configured.length > 0) return configured;

  return env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];
})();

export default env;
export { EnvConfig };
