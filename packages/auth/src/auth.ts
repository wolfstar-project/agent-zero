import { createDatabase, databaseUrlFromEnvironment, schema } from '@agent-zero/database';
import { betterAuth } from 'better-auth';
import type { BetterAuthOptions, BetterAuthPlugin } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization } from 'better-auth/plugins';

import { authConfigFromEnvironment, githubCredentialsFromEnvironment } from './config.js';
import type { AuthConfig, GithubOauthCredentials } from './config.js';

/**
 * Delivers an organization invitation.
 *
 * Declared structurally rather than imported from `@agent-zero/mail`: this package owns
 * authentication policy, and taking a dependency on the mail package would make one capability
 * package depend on another. The composition root supplies the implementation.
 */
export type SendInvitationEmail = (invitation: {
  readonly to: string;
  readonly organizationName: string;
  readonly inviterName: string;
  readonly acceptUrl: string;
}) => Promise<void>;

/** Everything Better Auth's policy shape needs that isn't signing or origin configuration. */
export interface AuthDatabaseOptions {
  /**
   * Postgres connection string holding users and sessions.
   *
   * The pool is opened by `@agent-zero/database`, which owns the schema and the migrations for
   * those tables.
   */
  readonly databaseUrl: string;
  readonly config: AuthConfig;
  readonly github?: GithubOauthCredentials;
  /**
   * Dashboard origin invitation links point at, so a recipient lands on the UI, not the API.
   * Required when organizations are enabled.
   */
  readonly dashboardUrl?: string;
  /**
   * How invitations are delivered. Required when organizations are enabled: without it an
   * invitation would be created that nobody is ever told about.
   */
  readonly sendInvitationEmail?: SendInvitationEmail;
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
export function authBetterAuthOptions(options: AuthDatabaseOptions): Pick<
  BetterAuthOptions,
  'database' | 'emailAndPassword' | 'session' | 'socialProviders'
> & {
  // Declared here rather than picked from `BetterAuthOptions`: that interface's own `plugins`
  // field is typed `... | undefined` explicitly, which trips `exactOptionalPropertyTypes` at
  // every consumer that (rightly) declares its own `plugins` as merely optional, including
  // `@onmax/nuxt-better-auth`'s server config type. A required, mutable, always-array field is
  // assignable to both; `readonly` is not, because `BetterAuthOptions['plugins']` itself is not.
  plugins: BetterAuthPlugin[];
} {
  const { config } = options;

  // Fail at construction rather than at the first invitation: a deployment that enables
  // organizations without a transport would accept invitations and silently never deliver them.
  if (config.enableOrganizations && !options.sendInvitationEmail)
    throw new Error('organizations are enabled but no sendInvitationEmail was provided');
  if (config.enableOrganizations && !options.dashboardUrl)
    throw new Error('organizations are enabled but no dashboardUrl was provided');

  const sendInvitationEmail = options.sendInvitationEmail;
  const dashboardUrl = options.dashboardUrl;

  // Widened to the option type Better Auth declares. Left as the concrete adapter type, the
  // inferred return type embeds types TypeScript cannot name in the emitted declarations.
  //
  // The client and the tables both come from `@agent-zero/database`: this package owns
  // authentication policy, not the store, so the shape of `user` and `session` stays reviewable in
  // one place and any other consumer of those tables sees the same declarations.
  const database: BetterAuthOptions['database'] = drizzleAdapter(
    createDatabase({ connectionString: options.databaseUrl }),
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
    plugins:
      config.enableOrganizations && dashboardUrl
        ? [
            organization({
              allowUserToCreateOrganization: config.allowUserToCreateOrganization,
              membershipLimit: config.organizationMembershipLimit,
              invitationExpiresIn: config.invitationExpiresInSeconds,
              sendInvitationEmail: async (data) => {
                // Checked in the guard above; narrowing here keeps the callback total.
                const send = sendInvitationEmail;
                if (!send) return;
                await send({
                  to: data.email,
                  organizationName: data.organization.name,
                  // Better Auth exposes the inviter as a member record wrapping the user.
                  inviterName: data.inviter.user.name,
                  acceptUrl: invitationAcceptUrl(dashboardUrl, data.id),
                });
              },
            }),
          ]
        : [],
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

/**
 * Build the link an invitation email points at.
 *
 * Resolved against the dashboard origin rather than the auth server's: the recipient needs the UI
 * that can accept the invitation, and `URL` keeps a misconfigured origin from silently producing
 * a relative link.
 */
function invitationAcceptUrl(dashboardUrl: string, invitationId: string): string {
  return new URL(
    `/organizations/accept-invitation/${encodeURIComponent(invitationId)}`,
    dashboardUrl,
  ).toString();
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
 * Deliberately does not read `AUTH_DASHBOARD_ORIGIN`: a caller that only needs the database and
 * policy shape (no signing, no origin) should not be made to supply one, and one that needs
 * invitation links resolves `dashboardUrl` through {@link authOptionsFromEnvironment} instead.
 *
 * The connection string is resolved by `@agent-zero/database` so the store has one variable
 * regardless of which process opens it; it accepts the pre-split `AUTH_DATABASE_URL` as well. The
 * error messages name the variable but never echo its value, so a misconfigured deployment cannot
 * leak a secret or a connection string into a crash log.
 */
export function authDatabaseOptionsFromEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): AuthDatabaseOptions {
  const github = githubCredentialsFromEnvironment(environment);
  return {
    databaseUrl: databaseUrlFromEnvironment(environment),
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
    // The same origin the dashboard is served from, so invitation links resolve to the UI.
    dashboardUrl: dashboardOrigin,
  };
}

/** The constructed Better Auth instance. */
export type AuthInstance = ReturnType<typeof createAuth>;

/** Session record as the dashboard receives it. */
export type Session = AuthInstance['$Infer']['Session'];

/** Authenticated user as the dashboard receives it. */
export type User = Session['user'];
