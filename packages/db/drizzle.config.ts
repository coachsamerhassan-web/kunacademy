import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  out: './src/schema',
  schema: './src/schema/*.ts',
});
