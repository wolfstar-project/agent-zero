/**
 * Authentication policy, kept separate from the Better Auth instance so that callers, tests, and
 * the dashboard can reason about which capabilities are enabled without constructing a database
 * connection.
 */

/** Shortest password the dashboard will accept when registering or changing credentials. */
export const MINIMUM_PASSWORD_LENGTH = 8;

/** How long a session stays valid without re-authentication. */
export const SESSION_MAXIMUM_AGE_SECONDS = 60 * 60 * 24 * 7;

/** Capabilities the deployment exposes on its sign-in surface. */
export interface AuthConfig {
  /** Whether new accounts may be created through the sign-in page. */
  readonly enableSignup: boolean;
  /** Whether email and password credentials are accepted. */
  readonly enablePasswordLogin: boolean;
  /** Whether the GitHub OAuth button is offered. */
  readonly enableGithubOauth: boolean;
  readonly minimumPasswordLength: number;
  readonly sessionMaximumAgeSeconds: number;
}

/**
 * Conservative defaults: a self-hosted operations console starts closed to public registration,
 * and social login stays off until credentials are actually configured.
 */
export const defaultAuthConfig: AuthConfig = {
  enableSignup: false,
  enablePasswordLogin: true,
  enableGithubOauth: false,
  minimumPasswordLength: MINIMUM_PASSWORD_LENGTH,
  sessionMaximumAgeSeconds: SESSION_MAXIMUM_AGE_SECONDS,
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
  return {
    ...defaultAuthConfig,
    enableSignup: environment.AUTH_ENABLE_SIGNUP === 'true',
    enableGithubOauth: githubCredentialsFromEnvironment(environment) !== undefined,
  };
}
