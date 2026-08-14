import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { schema } from './schema/index.js';
import type { Schema } from './schema/index.js';

/**
 * The database client, as every consumer sees it.
 *
 * Named so that callers can hold a connection without naming Drizzle's inferred generic, which
 * TypeScript cannot write out in an emitted declaration file.
 */
export type Database = ReturnType<typeof drizzle<Schema>>;

/** How a client is opened. */
export interface DatabaseOptions {
  /** Postgres connection string. */
  readonly connectionString: string;
  /**
   * Upper bound on pooled connections.
   *
   * A small cap keeps one process from monopolizing the database's connection limit alongside
   * whatever else shares it.
   */
  readonly maximumConnections?: number;
}

/** Matches the default cap Postgres ships with divided across a handful of processes. */
export const DEFAULT_MAXIMUM_CONNECTIONS = 10;

/**
 * Open a connection pool.
 *
 * A factory rather than a module-level singleton, so importing this package never opens a socket
 * and tests can construct an isolated client without reaching into the environment. Composition
 * roots own the lifetime of what they open.
 */
export function createDatabase(options: DatabaseOptions): Database {
  const connection = postgres(options.connectionString, {
    max: options.maximumConnections ?? DEFAULT_MAXIMUM_CONNECTIONS,
  });

  return drizzle(connection, { schema });
}

/**
 * The variable a deployment sets to point at Postgres.
 *
 * `AUTH_DATABASE_URL` is still read as a fallback because the store used to live inside
 * `packages/auth`, and a deployment configured before the split must not fail to start on upgrade.
 */
export const DATABASE_URL_VARIABLE = 'DATABASE_URL';
const LEGACY_DATABASE_URL_VARIABLE = 'AUTH_DATABASE_URL';

/**
 * Read the connection string from the environment, or report that it is not configured.
 *
 * A variable set to an empty or whitespace-only value counts as unset, so a deployment that
 * blanks `DATABASE_URL` still falls back to the legacy name instead of resolving to nothing.
 *
 * The environment is passed in so callers stay deterministic in tests.
 */
export function optionalDatabaseUrlFromEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string | undefined {
  return (
    environment[DATABASE_URL_VARIABLE]?.trim() ||
    environment[LEGACY_DATABASE_URL_VARIABLE]?.trim() ||
    undefined
  );
}

/**
 * Read the connection string from the environment.
 *
 * Throws when neither variable is set: a missing connection string is a deployment error, and a
 * default would point a production process at a local database. The message names the variable
 * but never echoes its value, which would leak the password embedded in a Postgres URL.
 *
 * This is the one place the precedence between the two variable names is decided; `drizzle.config.ts`
 * resolves through the same function so migrations cannot disagree with the running server about
 * which database they mean.
 */
export function databaseUrlFromEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const url = optionalDatabaseUrlFromEnvironment(environment);
  if (!url) throw new Error(`missing required environment variable: ${DATABASE_URL_VARIABLE}`);
  return url;
}
