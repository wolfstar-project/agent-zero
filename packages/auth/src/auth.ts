import { betterAuth } from 'better-auth';
import type { BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization } from 'better-auth/plugins';

import { authConfigFromEnvironment, githubCredentialsFromEnvironment } from './config.js';
import type { AuthConfig, GithubOauthCredentials } from './config.js';
import { createAuthDatabase } from './database.js';
import { schema } from './schema.js';

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

/** Everything the Better Auth instance needs that is not policy. */
export interface AuthInstanceOptions {
  /** Postgres connection string holding users and sessions. */
  readonly databaseUrl: string;
  /** Signing secret. Must be supplied by the caller; there is deliberately no default. */
  readonly secret: string;
  /** Public origin the auth server is reachable at. */
  readonly baseUrl: string;
  /** Origins allowed to complete a credentialed round trip, typically the dashboard. */
  readonly trustedOrigins: readonly string[];
  /** Dashboard origin invitation links point at, so a recipient lands on the UI, not the API. */
  readonly dashboardUrl: string;
  readonly config: AuthConfig;
  readonly github?: GithubOauthCredentials;
  /**
   * How invitations are delivered. Required when organizations are enabled: without it an
   * invitation would be created that nobody is ever told about.
   */
  readonly sendInvitationEmail?: SendInvitationEmail;
}

/**
 * Build a Better Auth instance from explicit options.
 *
 * A factory rather than a module-level singleton, so that tests and alternative composition roots
 * can construct an isolated instance without reaching into the environment.
 */
export function createAuth(options: AuthInstanceOptions) {
  const { config } = options;

  // Fail at construction rather than at the first invitation: a deployment that enables
  // organizations without a transport would accept invitations and silently never deliver them.
  if (config.enableOrganizations && !options.sendInvitationEmail)
    throw new Error('organizations are enabled but no sendInvitationEmail was provided');

  // Widened to the option type Better Auth declares. Left as the concrete adapter type, the
  // inferred return type embeds types TypeScript cannot name in the emitted declarations.
  const database: BetterAuthOptions['database'] = drizzleAdapter(
    createAuthDatabase(options.databaseUrl),
    { provider: 'pg', schema },
  );

  return betterAuth({
    database,
    secret: options.secret,
    baseURL: options.baseUrl,
    trustedOrigins: [...options.trustedOrigins],
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
    plugins: config.enableOrganizations
      ? [
          organization({
            allowUserToCreateOrganization: config.allowUserToCreateOrganization,
            membershipLimit: config.organizationMembershipLimit,
            invitationExpiresIn: config.invitationExpiresInSeconds,
            sendInvitationEmail: async (data) => {
              // Checked in the guard above; narrowing here keeps the callback total.
              const send = options.sendInvitationEmail;
              if (!send) return;
              await send({
                to: data.email,
                organizationName: data.organization.name,
                // Better Auth exposes the inviter as a member record wrapping the user.
                inviterName: data.inviter.user.name,
                acceptUrl: invitationAcceptUrl(options.dashboardUrl, data.id),
              });
            },
          }),
        ]
      : [],
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
 * Resolve `createAuth` options from the environment.
 *
 * The error messages name the variable but never echo its value, so a misconfigured deployment
 * cannot leak a secret or a connection string into a crash log.
 */
export function authOptionsFromEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): AuthInstanceOptions {
  const dashboardOrigin = requireEnvironmentValue(environment, 'AUTH_DASHBOARD_ORIGIN');
  const github = githubCredentialsFromEnvironment(environment);

  return {
    databaseUrl: requireEnvironmentValue(environment, 'AUTH_DATABASE_URL'),
    secret: requireEnvironmentValue(environment, 'BETTER_AUTH_SECRET'),
    baseUrl: requireEnvironmentValue(environment, 'BETTER_AUTH_URL'),
    trustedOrigins: [dashboardOrigin],
    // The same origin the dashboard is served from, so invitation links resolve to the UI.
    dashboardUrl: dashboardOrigin,
    config: authConfigFromEnvironment(environment),
    ...(github ? { github } : {}),
  };
}

/** The constructed Better Auth instance. */
export type AuthInstance = ReturnType<typeof createAuth>;

/** Session record as the dashboard receives it. */
export type Session = AuthInstance['$Infer']['Session'];

/** Authenticated user as the dashboard receives it. */
export type User = Session['user'];
