export {
  authBetterAuthOptions,
  authDatabaseOptionsFromEnvironment,
  authOptionsFromEnvironment,
  createAuth,
  type AuthDatabaseOptions,
  type AuthInstance,
  type AuthInstanceOptions,
  type Session,
  type User,
} from './auth.js';
export {
  authConfigFromEnvironment,
  defaultAuthConfig,
  githubCredentialsFromEnvironment,
  MINIMUM_PASSWORD_LENGTH,
  SESSION_MAXIMUM_AGE_SECONDS,
  type AuthConfig,
  type GithubOauthCredentials,
} from './config.js';
