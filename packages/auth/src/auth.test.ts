import { describe, expect, it } from 'vitest';

import { authOptionsFromEnvironment, createAuth } from './auth.js';
import { defaultAuthConfig } from './config.js';

const completeEnvironment = {
  BETTER_AUTH_SECRET: 'a-very-secret-value',
  BETTER_AUTH_URL: 'http://localhost:3002',
  AUTH_DASHBOARD_ORIGIN: 'http://localhost:3000',
  AUTH_DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/agent_zero_auth',
};

const MISSING_URL_MESSAGE = /missing required environment variable: BETTER_AUTH_URL/;
const MISSING_SEND_INVITATION_EMAIL_PATTERN = /sendInvitationEmail/;

/** Return the failure message so assertions stay outside the catch block. */
function messageFrom(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return '';
}

describe('authOptionsFromEnvironment', () => {
  it('trusts only the configured dashboard origin', () => {
    const options = authOptionsFromEnvironment(completeEnvironment);

    expect(options.trustedOrigins).toEqual(['http://localhost:3000']);
  });

  it('reads the database connection string from the environment', () => {
    expect(authOptionsFromEnvironment(completeEnvironment).databaseUrl).toBe(
      completeEnvironment.AUTH_DATABASE_URL,
    );
  });

  it('omits GitHub unless both credentials are configured', () => {
    expect(authOptionsFromEnvironment(completeEnvironment).github).toBeUndefined();
    expect(
      authOptionsFromEnvironment({
        ...completeEnvironment,
        GITHUB_CLIENT_ID: 'id',
        GITHUB_CLIENT_SECRET: 'secret',
      }).github,
    ).toEqual({ clientId: 'id', clientSecret: 'secret' });
  });

  it.each(['BETTER_AUTH_SECRET', 'BETTER_AUTH_URL', 'AUTH_DASHBOARD_ORIGIN', 'AUTH_DATABASE_URL'])(
    'refuses to start without %s',
    (name) => {
      const environment = { ...completeEnvironment, [name]: '' };

      expect(() => authOptionsFromEnvironment(environment)).toThrow(name);
    },
  );

  it('names the missing variable without echoing any configured secret', () => {
    const environment = { ...completeEnvironment, BETTER_AUTH_URL: '' };

    const message = messageFrom(() => authOptionsFromEnvironment(environment));

    expect(message).toMatch(MISSING_URL_MESSAGE);
    expect(message).not.toContain(completeEnvironment.BETTER_AUTH_SECRET);
  });

  it('points invitation links at the dashboard, not at the auth server', () => {
    const options = authOptionsFromEnvironment(completeEnvironment);

    // The recipient needs the UI that can accept the invitation; the auth origin only serves the
    // Better Auth handler.
    expect(options.dashboardUrl).toBe(completeEnvironment.AUTH_DASHBOARD_ORIGIN);
    expect(options.dashboardUrl).not.toBe(options.baseUrl);
  });
});

describe('createAuth with organizations', () => {
  const instanceOptions = {
    databaseUrl: completeEnvironment.AUTH_DATABASE_URL,
    secret: completeEnvironment.BETTER_AUTH_SECRET,
    baseUrl: completeEnvironment.BETTER_AUTH_URL,
    trustedOrigins: [completeEnvironment.AUTH_DASHBOARD_ORIGIN],
    dashboardUrl: completeEnvironment.AUTH_DASHBOARD_ORIGIN,
  };

  it('refuses to construct when organizations are enabled without a delivery transport', () => {
    // Otherwise an invitation is recorded and nobody is ever told about it.
    expect(() =>
      createAuth({
        ...instanceOptions,
        config: { ...defaultAuthConfig, enableOrganizations: true },
      }),
    ).toThrow(MISSING_SEND_INVITATION_EMAIL_PATTERN);
  });

  it('constructs without a transport while organizations are off', () => {
    expect(() => createAuth({ ...instanceOptions, config: defaultAuthConfig })).not.toThrow();
  });
});
