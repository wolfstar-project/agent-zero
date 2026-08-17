/**
 * Authentication policy, kept separate from the Better Auth instance so that callers, tests, and
 * the dashboard can reason about which capabilities are enabled without constructing a database
 * connection.
 */

/** Shortest password the dashboard will accept when registering or changing credentials. */
export const MINIMUM_PASSWORD_LENGTH = 8;

/** How long a session stays valid without re-authentication. */
export const SESSION_MAXIMUM_AGE_SECONDS = 60 * 60 * 24 * 7;

/** How long an unaccepted organization invitation stays valid. */
export const INVITATION_EXPIRES_IN_SECONDS = 60 * 60 * 48;

/** Upper bound on members in a single organization. */
export const ORGANIZATION_MEMBERSHIP_LIMIT = 100;

/** How long an unredeemed invitation stays valid. */
export const INVITE_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7;

/**
 * Application-wide role granted to an account that no invitation gave a role to.
 *
 * Distinct from an organization role: this one is app-wide, `member.role` is scoped to one
 * organization.
 */
export const DEFAULT_USER_ROLE = 'user';

/** The app-wide role that may mint, list, and revoke invitations. */
export const ADMIN_USER_ROLE = 'admin';

/**
 * Every app-wide role an invitation may grant.
 *
 * Declared as a closed set so a typo in an admin's invitation payload is rejected at creation
 * rather than silently granting a role nothing ever checks for.
 */
export const USER_ROLES: readonly string[] = [DEFAULT_USER_ROLE, ADMIN_USER_ROLE];

/** Capabilities the deployment exposes on its sign-in surface. */
export interface AuthConfig {
  /** Whether new accounts may be created through the sign-in page. */
  readonly enableSignup: boolean;
  /** Whether email and password credentials are accepted. */
  readonly enablePasswordLogin: boolean;
  /** Whether the GitHub OAuth button is offered. */
  readonly enableGithubOauth: boolean;
  /** Whether organizations, memberships and invitations are exposed at all. */
  readonly enableOrganizations: boolean;
  /**
   * Whether invitations are exposed at all.
   *
   * Independent of {@link enableSignup}: with signup off, invitations are the only way into the
   * deployment; with it on, they stay useful as role and organization grants.
   */
  readonly enableInvitations: boolean;
  /**
   * Whether any signed-in user may create an organization.
   *
   * Separate from {@link enableOrganizations} so an operator can run a deployment where
   * organizations exist but only pre-provisioned ones do.
   */
  readonly allowUserToCreateOrganization: boolean;
  readonly minimumPasswordLength: number;
  readonly sessionMaximumAgeSeconds: number;
  readonly invitationExpiresInSeconds: number;
  readonly organizationMembershipLimit: number;
  readonly inviteExpiresInSeconds: number;
  /** App-wide role an invitation grants when its creator names none. */
  readonly defaultUserRole: string;
  /** The closed set of app-wide roles an invitation may grant. */
  readonly userRoles: readonly string[];
  /** App-wide roles allowed to manage invitations. */
  readonly inviteAdminRoles: readonly string[];
}

/**
 * Conservative defaults: a self-hosted operations console starts closed to public registration,
 * and social login stays off until credentials are actually configured.
 */
export const defaultAuthConfig: AuthConfig = {
  enableSignup: false,
  enablePasswordLogin: true,
  enableGithubOauth: false,
  // Organizations stay off until an operator asks for them: enabling them changes what every
  // authenticated request is scoped to, which is not something a deployment should acquire by
  // upgrading.
  enableOrganizations: false,
  allowUserToCreateOrganization: false,
  // Off until an operator asks for them, for the same reason organizations are: turning
  // invitations on adds routes that mint credentials for new accounts, which is not something a
  // deployment should acquire by upgrading.
  enableInvitations: false,
  minimumPasswordLength: MINIMUM_PASSWORD_LENGTH,
  sessionMaximumAgeSeconds: SESSION_MAXIMUM_AGE_SECONDS,
  invitationExpiresInSeconds: INVITATION_EXPIRES_IN_SECONDS,
  organizationMembershipLimit: ORGANIZATION_MEMBERSHIP_LIMIT,
  inviteExpiresInSeconds: INVITE_EXPIRES_IN_SECONDS,
  defaultUserRole: DEFAULT_USER_ROLE,
  userRoles: USER_ROLES,
  inviteAdminRoles: [ADMIN_USER_ROLE],
};

/** GitHub OAuth credentials, present only when both halves are configured. */
export interface GithubOauthCredentials {
  readonly clientId: string;
  readonly clientSecret: string;
}

/**
 * Read GitHub OAuth credentials from the environment.
 *
 * Returns `undefined` unless both values are present, so a half-configured deployment fails
 * closed rather than advertising a provider that cannot complete a round trip.
 *
 * The environment is passed in so callers stay deterministic in tests.
 */
export function githubCredentialsFromEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): GithubOauthCredentials | undefined {
  const clientId = environment.GITHUB_CLIENT_ID?.trim();
  const clientSecret = environment.GITHUB_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return undefined;
  return { clientId, clientSecret };
}

/**
 * Resolve the effective policy for a deployment.
 *
 * `AUTH_ENABLE_SIGNUP` opts a deployment into self-registration; GitHub OAuth switches itself on
 * only when usable credentials exist.
 */
export function authConfigFromEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): AuthConfig {
  const enableOrganizations = environment.AUTH_ENABLE_ORGANIZATIONS === 'true';
  return {
    ...defaultAuthConfig,
    enableSignup: environment.AUTH_ENABLE_SIGNUP === 'true',
    enableInvitations: environment.AUTH_ENABLE_INVITATIONS === 'true',
    enableGithubOauth: githubCredentialsFromEnvironment(environment) !== undefined,
    enableOrganizations,
    // Gated on the feature itself, so a deployment that never turned organizations on cannot
    // advertise creation through a stale variable.
    allowUserToCreateOrganization:
      enableOrganizations && environment.AUTH_ALLOW_ORGANIZATION_CREATION === 'true',
  };
}
