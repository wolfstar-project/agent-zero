import process from 'node:process';

import { defineConfig } from 'drizzle-kit';

/**
 * Migrations are generated into `drizzle/` and checked in, so the session store's shape is
 * reviewable in a diff instead of being produced on the fly at deploy time.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url:
      process.env.AUTH_DATABASE_URL ??
      'postgres://postgres:postgres@localhost:5432/agent_zero_auth',
  },
});
