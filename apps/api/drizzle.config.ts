import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/shared/database/schema/*.ts',
  out: './drizzle/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/barbearia',
  },
  verbose: true,
  strict: true,
});
