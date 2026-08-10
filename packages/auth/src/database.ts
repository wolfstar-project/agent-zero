import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { schema } from './schema.js';

/** Drizzle handle over the Postgres session store. */
export type AuthDatabase = ReturnType<typeof createAuthDatabase>;

/**
 * Open the session store.
 *
 * A small connection cap keeps the adapter from monopolizing the database's connection limit
 * alongside whatever else shares it; `apps/auth-server` is the only process that opens this pool.
 */
export function createAuthDatabase(connectionString: string) {
  const connection = postgres(connectionString, { max: 10 });

  return drizzle(connection, { schema });
}
