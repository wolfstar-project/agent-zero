import { describe, expect, it } from 'vitest';

import {
  authBetterAuthOptions,
  authDatabaseOptionsFromEnvironment,
  authOptionsFromEnvironment,
} from './auth.js';
import { defaultAuthConfig } from './config.js';

const completeEnvironment = {
  BETTER_AUTH_SECRET: 'a-very-secret-value',
  BETTER_AUTH_URL: 'http://localhost:3001',
  AUTH_DASHBOARD_ORIGIN: 'http://localhost:3000',
  AUTH_DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/agent_zero_auth',
};

const MISSING_URL_MESSAGE = /missing required environment variable: BETTER_AUTH_URL/;

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
});

describe('authDatabaseOptionsFromEnvironment', () => {
  it('reads the database connection string without requiring signing or origin variables', () => {
    const options = authDatabaseOptionsFromEnvironment({
      AUTH_DATABASE_URL: completeEnvironment.AUTH_DATABASE_URL,
    });

    expect(options.databaseUrl).toBe(completeEnvironment.AUTH_DATABASE_URL);
    expect(options.github).toBeUndefined();
  });

  it('refuses to start without AUTH_DATABASE_URL', () => {
    expect(() => authDatabaseOptionsFromEnvironment({})).toThrow('AUTH_DATABASE_URL');
  });
});

describe('authBetterAuthOptions', () => {
  it('omits secret, baseURL, and trustedOrigins for a host that resolves them itself', () => {
    const options = authBetterAuthOptions({
      databaseUrl: completeEnvironment.AUTH_DATABASE_URL,
      config: defaultAuthConfig,
    });

    expect(options).not.toHaveProperty('secret');
    expect(options).not.toHaveProperty('baseURL');
    expect(options).not.toHaveProperty('trustedOrigins');
    expect(options.emailAndPassword).toMatchObject({ enabled: true, disableSignUp: true });
  });

  it('enables a GitHub social provider only when credentials are supplied', () => {
    const withoutGithub = authBetterAuthOptions({
      databaseUrl: completeEnvironment.AUTH_DATABASE_URL,
      config: defaultAuthConfig,
    });
    expect(withoutGithub.socialProviders).toBeUndefined();

    const withGithub = authBetterAuthOptions({
      databaseUrl: completeEnvironment.AUTH_DATABASE_URL,
      config: defaultAuthConfig,
      github: { clientId: 'id', clientSecret: 'secret' },
    });
    expect(withGithub.socialProviders).toMatchObject({
      github: { clientId: 'id', clientSecret: 'secret' },
    });
  });
});
