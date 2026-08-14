import { describe, expect, it } from 'vitest';

import {
  authConfigFromEnvironment,
  defaultAuthConfig,
  githubCredentialsFromEnvironment,
  MINIMUM_PASSWORD_LENGTH,
} from './config.js';

describe('defaultAuthConfig', () => {
  it('starts closed to registration and social login', () => {
    expect(defaultAuthConfig.enableSignup).toBe(false);
    expect(defaultAuthConfig.enableGithubOauth).toBe(false);
    expect(defaultAuthConfig.enablePasswordLogin).toBe(true);
    expect(defaultAuthConfig.minimumPasswordLength).toBe(MINIMUM_PASSWORD_LENGTH);
  });
});

describe('githubCredentialsFromEnvironment', () => {
  it('returns credentials when both halves are present', () => {
    const credentials = githubCredentialsFromEnvironment({
      GITHUB_CLIENT_ID: 'client-id',
      GITHUB_CLIENT_SECRET: 'client-secret',
    });

    expect(credentials).toEqual({ clientId: 'client-id', clientSecret: 'client-secret' });
  });

  it('fails closed when only one half is configured', () => {
    expect(githubCredentialsFromEnvironment({ GITHUB_CLIENT_ID: 'client-id' })).toBeUndefined();
    expect(
      githubCredentialsFromEnvironment({ GITHUB_CLIENT_SECRET: 'client-secret' }),
    ).toBeUndefined();
  });

  it('treats blank values as absent', () => {
    expect(
      githubCredentialsFromEnvironment({ GITHUB_CLIENT_ID: '  ', GITHUB_CLIENT_SECRET: 'secret' }),
    ).toBeUndefined();
  });
});

describe('authConfigFromEnvironment', () => {
  it('keeps registration disabled unless explicitly opted in', () => {
    expect(authConfigFromEnvironment({}).enableSignup).toBe(false);
    expect(authConfigFromEnvironment({ AUTH_ENABLE_SIGNUP: '1' }).enableSignup).toBe(false);
    expect(authConfigFromEnvironment({ AUTH_ENABLE_SIGNUP: 'TRUE' }).enableSignup).toBe(false);
    expect(authConfigFromEnvironment({ AUTH_ENABLE_SIGNUP: 'true' }).enableSignup).toBe(true);
  });

  it('advertises GitHub only when usable credentials exist', () => {
    expect(authConfigFromEnvironment({}).enableGithubOauth).toBe(false);
    expect(authConfigFromEnvironment({ GITHUB_CLIENT_ID: 'id' }).enableGithubOauth).toBe(false);
    expect(
      authConfigFromEnvironment({ GITHUB_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: 'secret' })
        .enableGithubOauth,
    ).toBe(true);
  });

  it('keeps organizations disabled unless explicitly opted in', () => {
    expect(authConfigFromEnvironment({}).enableOrganizations).toBe(false);
    expect(
      authConfigFromEnvironment({ AUTH_ENABLE_ORGANIZATIONS: 'TRUE' }).enableOrganizations,
    ).toBe(false);
    expect(
      authConfigFromEnvironment({ AUTH_ENABLE_ORGANIZATIONS: 'true' }).enableOrganizations,
    ).toBe(true);
  });

  it('keeps invitations disabled unless explicitly opted in', () => {
    expect(authConfigFromEnvironment({}).enableInvitations).toBe(false);
    expect(authConfigFromEnvironment({ AUTH_ENABLE_INVITATIONS: 'TRUE' }).enableInvitations).toBe(
      false,
    );
    expect(authConfigFromEnvironment({ AUTH_ENABLE_INVITATIONS: 'true' }).enableInvitations).toBe(
      true,
    );
  });

  it('keeps invitations independent of whether self-registration is open', () => {
    // With signup off they are the only way in; with it on they stay useful as role grants.
    for (const AUTH_ENABLE_SIGNUP of ['false', 'true']) {
      expect(
        authConfigFromEnvironment({ AUTH_ENABLE_SIGNUP, AUTH_ENABLE_INVITATIONS: 'true' })
          .enableInvitations,
      ).toBe(true);
    }
  });

  it('refuses to advertise organization creation while organizations are off', () => {
    // A stale AUTH_ALLOW_ORGANIZATION_CREATION must not survive turning the feature back off.
    expect(
      authConfigFromEnvironment({ AUTH_ALLOW_ORGANIZATION_CREATION: 'true' })
        .allowUserToCreateOrganization,
    ).toBe(false);
    expect(
      authConfigFromEnvironment({
        AUTH_ENABLE_ORGANIZATIONS: 'true',
        AUTH_ALLOW_ORGANIZATION_CREATION: 'true',
      }).allowUserToCreateOrganization,
    ).toBe(true);
  });
});
