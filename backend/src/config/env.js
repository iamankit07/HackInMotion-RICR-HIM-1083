import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),

  MONGODB_URI: z.string().min(1, 'a MongoDB connection string is required'),

  JWT_SECRET: z.string().min(16, 'must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),

  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),

  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues
    .map((issue) => `  ${issue.path.join('.')} — ${issue.message}`)
    .join('\n');

  console.error(`\nCannot start: the environment is not configured correctly.\n\n${problems}\n`);
  console.error('Copy backend/.env.example to backend/.env and fill in the missing values.\n');
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';

// Both AI providers are optional at boot so the rest of the app can still run
// (and be demoed) without keys. Individual AI routes report their own status.
export const allowedOrigins = env.CLIENT_ORIGIN.split(',').map((origin) => origin.trim());
