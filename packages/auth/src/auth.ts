import { betterAuth } from 'better-auth';
import type { BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

import { authConfigFromEnvironment, githubCredentialsFromEnvironment } from './config.js';
import type { AuthConfig, GithubOauthCredentials } from './config.js';
import { createAuthDatabase } from './database.js';
import { schema } from './schema.js';

/** Everything Better Auth's policy shape needs that isn't signing or origin configuration. */
export interface AuthDatabaseOptions {
  /** Postgres connection string holding users and sessions. */
  readonly databaseUrl: string;
  readonly config: AuthConfig;
  readonly github?: GithubOauthCredentials;
}

/** Everything the Better Auth instance needs that is not policy. */
export interface AuthInstanceOptions extends AuthDatabaseOptions {
  /** Signing secret. Must be supplied by the caller; there is deliberately no default. */
  readonly secret: string;
  /** Public origin the auth server is reachable at. */
  readonly baseUrl: string;
  /** Origins allowed to complete a credentialed round trip, typically the dashboard. */
  readonly trustedOrigins: readonly string[];
}

/**
 * Build the database, policy, and provider portion of the Better Auth options.
 *
 * Deliberately excludes `secret`, `baseURL`, and `trustedOrigins`: a same-origin host (a Nuxt
 * module hosting Better Auth in-process, for example) resolves those itself and must not have a
 * second, potentially divergent source for them.
 */
export function authBetterAuthOptions(
  options: AuthDatabaseOptions,
): Pick<BetterAuthOptions, 'database' | 'emailAndPassword' | 'session' | 'socialProviders'> {
  const { config } = options;
  // Widened to the option type Better Auth declares. Left as the concrete adapter type, the
  // inferred return type embeds types TypeScript cannot name in the emitted declarations.
  const database: BetterAuthOptions['database'] = drizzleAdapter(
    createAuthDatabase(options.databaseUrl),
    { provider: 'pg', schema },
  );

  return {
    database,
    emailAndPassword: {
      enabled: config.enablePasswordLogin,
      minPasswordLength: config.minimumPasswordLength,
      disableSignUp: !config.enableSignup,
    },
    session: {
      expiresIn: config.sessionMaximumAgeSeconds,
    },
    ...(options.github
      ? { socialProviders: { github: { ...options.github, disableSignUp: !config.enableSignup } } }
      : {}),
  };
}

/**
 * Build a standalone Better Auth instance from explicit options.
 *
 * A factory rather than a module-level singleton, so that tests and alternative composition roots
 * can construct an isolated instance without reaching into the environment. Kept for callers that
 * own their own signing secret and origin rather than delegating them to a host module.
 */
export function createAuth(options: AuthInstanceOptions) {
  return betterAuth({
    ...authBetterAuthOptions(options),
    secret: options.secret,
    baseURL: options.baseUrl,
    trustedOrigins: [...options.trustedOrigins],
  });
}

/** Missing configuration is a deployment error, not something to paper over with a default. */
function requireEnvironmentValue(
  environment: Readonly<Record<string, string | undefined>>,
  name: string,
): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`missing required environment variable: ${name}`);
  return value;
}

/**
 * Resolve `authBetterAuthOptions` options from the environment.
 *
 * The error messages name the variable but never echo its value, so a misconfigured deployment
 * cannot leak a secret or a connection string into a crash log.
 */
export function authDatabaseOptionsFromEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): AuthDatabaseOptions {
  const github = githubCredentialsFromEnvironment(environment);
  return {
    databaseUrl: requireEnvironmentValue(environment, 'AUTH_DATABASE_URL'),
    config: authConfigFromEnvironment(environment),
    ...(github ? { github } : {}),
  };
}

/**
 * Resolve `createAuth` options from the environment.
 *
 * The error messages name the variable but never echo its value, so a misconfigured deployment
 * cannot leak a secret or a connection string into a crash log.
 */
export function authOptionsFromEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): AuthInstanceOptions {
  const dashboardOrigin = requireEnvironmentValue(environment, 'AUTH_DASHBOARD_ORIGIN');

  return {
    ...authDatabaseOptionsFromEnvironment(environment),
    secret: requireEnvironmentValue(environment, 'BETTER_AUTH_SECRET'),
    baseUrl: requireEnvironmentValue(environment, 'BETTER_AUTH_URL'),
    trustedOrigins: [dashboardOrigin],
  };
}

/** The constructed Better Auth instance. */
export type AuthInstance = ReturnType<typeof createAuth>;

/** Session record as the dashboard receives it. */
export type Session = AuthInstance['$Infer']['Session'];

/** Authenticated user as the dashboard receives it. */
export type User = Session['user'];
