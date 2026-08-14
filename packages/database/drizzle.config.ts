import process from 'node:process';

import { defineConfig } from 'drizzle-kit';

/**
 * Migrations are generated into `drizzle/` and checked in, so the store's shape is reviewable in a
 * diff instead of being produced on the fly at deploy time.
 *
 * The local default exists because `db:generate` only reads the schema files and never connects;
 * `db:migrate` is what needs a real `DATABASE_URL`. `AUTH_DATABASE_URL` is still honored for
 * deployments configured before the store moved out of `packages/auth`.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      process.env.AUTH_DATABASE_URL ??
      'postgres://postgres:postgres@localhost:5432/agent_zero_auth',
  },
});
