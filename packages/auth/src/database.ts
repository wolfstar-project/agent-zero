import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { schema } from './schema.js';

/**
 * Open the session store.
 *
 * A small connection cap keeps the adapter from monopolizing the database's connection limit
 * alongside whatever else shares it; the `server/auth.config.ts` route is the only place in
 * `apps/dashboard` that opens this pool.
 */
export function createAuthDatabase(connectionString: string) {
  const connection = postgres(connectionString, { max: 10 });

  return drizzle(connection, { schema });
}
