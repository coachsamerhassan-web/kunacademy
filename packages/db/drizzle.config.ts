import { defineConfig } from 'drizzle-kit';
import { config as dotenv } from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load .env.local from apps/web if it exists (on VPS in production)
const envPath = path.resolve(__dirname, '../../apps/web/.env.local');
if (fs.existsSync(envPath)) {
  dotenv({ path: envPath });
}

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error(
    'DATABASE_URL not set. On VPS, ensure apps/web/.env.local exists with DATABASE_URL. ' +
    'Locally, you can run migrations directly via psql if needed.'
  );
}

export default defineConfig({
  dialect: 'postgresql',
  dbCredentials: {
    url: dbUrl,
  },
  out: './drizzle',
  schema: './src/schema/*.ts',
});
