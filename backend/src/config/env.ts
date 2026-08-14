import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environmental variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  PORT: z.coerce.number().default(5001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url({ message: 'DATABASE_URL must be a valid PostgreSQL connection string' }),
  JWT_SECRET: z.string().min(8, { message: 'JWT_SECRET must be at least 8 characters' }),
  JWT_REFRESH_SECRET: z.string().min(8, { message: 'JWT_REFRESH_SECRET must be at least 8 characters' }),
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
});

type EnvConfig = z.infer<typeof envSchema>;

let env: EnvConfig;

try {
  env = envSchema.parse(process.env);
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

export default env;
export { EnvConfig };
