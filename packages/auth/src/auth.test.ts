import { describe, expect, it } from 'vitest';

import {
  authBetterAuthOptions,
  authDatabaseOptionsFromEnvironment,
  authOptionsFromEnvironment,
  createAuth,
} from './auth.js';
import { defaultAuthConfig } from './config.js';

const completeEnvironment = {
  BETTER_AUTH_SECRET: 'a-very-secret-value',
  BETTER_AUTH_URL: 'http://localhost:3001',
  AUTH_DASHBOARD_ORIGIN: 'http://localhost:3000',
  DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/agent_zero_auth',
};

const MISSING_URL_MESSAGE = /missing required environment variable: BETTER_AUTH_URL/;
const MISSING_SEND_INVITATION_EMAIL_PATTERN = /sendInvitationEmail/;
const MISSING_SEND_PRIVATE_INVITATION_PATTERN = /sendPrivateInvitationEmail/;
const MISSING_DASHBOARD_URL_PATTERN = /dashboardUrl/;

/** A transport that satisfies the startup guards without asserting anything about delivery. */
const sendPrivateInvitationEmail = async () => {};

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
      completeEnvironment.DATABASE_URL,
    );
  });

  it('still accepts AUTH_DATABASE_URL from a deployment configured before the split', () => {
    const { DATABASE_URL, ...environment } = completeEnvironment;

    expect(
      authOptionsFromEnvironment({ ...environment, AUTH_DATABASE_URL: DATABASE_URL }).databaseUrl,
    ).toBe(DATABASE_URL);
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

  it.each(['BETTER_AUTH_SECRET', 'BETTER_AUTH_URL', 'AUTH_DASHBOARD_ORIGIN', 'DATABASE_URL'])(
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
    databaseUrl: completeEnvironment.DATABASE_URL,
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

describe('createAuth with invitations', () => {
  const instanceOptions = {
    databaseUrl: completeEnvironment.DATABASE_URL,
    secret: completeEnvironment.BETTER_AUTH_SECRET,
    baseUrl: completeEnvironment.BETTER_AUTH_URL,
    trustedOrigins: [completeEnvironment.AUTH_DASHBOARD_ORIGIN],
    dashboardUrl: completeEnvironment.AUTH_DASHBOARD_ORIGIN,
  };
  const invitationsEnabled = { ...defaultAuthConfig, enableInvitations: true };

  it('refuses to construct when invitations are enabled without a delivery transport', () => {
    // A private invitation's link is never returned to its creator, so without a transport the
    // token would exist only in the database and reach nobody at all.
    expect(() => createAuth({ ...instanceOptions, config: invitationsEnabled })).toThrow(
      MISSING_SEND_PRIVATE_INVITATION_PATTERN,
    );
  });

  it('refuses to construct when invitations are enabled without a dashboard origin', () => {
    // Otherwise the redemption link has no origin to resolve against.
    const { dashboardUrl: _dashboardUrl, ...withoutDashboardUrl } = instanceOptions;

    expect(() =>
      createAuth({
        ...withoutDashboardUrl,
        config: invitationsEnabled,
        sendPrivateInvitationEmail,
      }),
    ).toThrow(MISSING_DASHBOARD_URL_PATTERN);
  });

  it('constructs without a transport while invitations are off', () => {
    expect(() => createAuth({ ...instanceOptions, config: defaultAuthConfig })).not.toThrow();
  });

  it('resolves a mode from either sign-up policy without being told one', () => {
    // The plugin auto-detects invite-only versus open from the sign-up routes, and refuses to
    // start on a configuration where some are open and some are closed. Both policies this
    // package can produce have to land on one side or the other, including when GitHub adds a
    // second sign-up path.
    for (const enableSignup of [false, true]) {
      expect(() =>
        createAuth({
          ...instanceOptions,
          config: { ...invitationsEnabled, enableSignup },
          github: { clientId: 'id', clientSecret: 'secret' },
          sendPrivateInvitationEmail,
        }),
      ).not.toThrow();
    }
  });

  it('registers the enrollment plugin only when invitations are enabled', () => {
    const off = authBetterAuthOptions({
      databaseUrl: completeEnvironment.DATABASE_URL,
      config: defaultAuthConfig,
      dashboardUrl: instanceOptions.dashboardUrl,
    });
    expect(off.plugins.map((plugin) => plugin.id)).not.toContain('better-enrollment');

    const on = authBetterAuthOptions({
      databaseUrl: completeEnvironment.DATABASE_URL,
      config: invitationsEnabled,
      dashboardUrl: instanceOptions.dashboardUrl,
      sendPrivateInvitationEmail,
    });
    expect(on.plugins.map((plugin) => plugin.id)).toContain('better-enrollment');
  });

  it('declares the invite tables so the adapter can resolve them', () => {
    // The plugin only reaches storage through models the adapter knows by name, so a missing
    // table group is a runtime failure on the first invitation rather than a build error.
    const options = authBetterAuthOptions({
      databaseUrl: completeEnvironment.DATABASE_URL,
      config: invitationsEnabled,
      dashboardUrl: instanceOptions.dashboardUrl,
      sendPrivateInvitationEmail,
    });
    const enrollment = options.plugins.find((plugin) => plugin.id === 'better-enrollment');

    expect(Object.keys(enrollment?.schema ?? {})).toEqual(
      expect.arrayContaining(['invite', 'inviteUse']),
    );
  });

  it('exposes the app-wide role column whether or not invitations are enabled', () => {
    // The column exists in every deployment's store, and a field the adapter does not know about
    // is one it silently drops on write.
    for (const config of [defaultAuthConfig, invitationsEnabled]) {
      const options = authBetterAuthOptions({
        databaseUrl: completeEnvironment.DATABASE_URL,
        config,
        dashboardUrl: instanceOptions.dashboardUrl,
        sendPrivateInvitationEmail,
      });

      expect(options.user?.additionalFields).toMatchObject({ role: { type: 'string' } });
    }
  });
});

describe('authDatabaseOptionsFromEnvironment', () => {
  it('reads the database connection string without requiring signing or origin variables', () => {
    const options = authDatabaseOptionsFromEnvironment({
      DATABASE_URL: completeEnvironment.DATABASE_URL,
    });

    expect(options.databaseUrl).toBe(completeEnvironment.DATABASE_URL);
    expect(options.github).toBeUndefined();
  });

  it('still accepts AUTH_DATABASE_URL from a deployment configured before the split', () => {
    const options = authDatabaseOptionsFromEnvironment({
      AUTH_DATABASE_URL: completeEnvironment.DATABASE_URL,
    });

    expect(options.databaseUrl).toBe(completeEnvironment.DATABASE_URL);
  });

  it('refuses to start without DATABASE_URL', () => {
    expect(() => authDatabaseOptionsFromEnvironment({})).toThrow('DATABASE_URL');
  });
});

describe('authBetterAuthOptions', () => {
  it('omits secret, baseURL, and trustedOrigins for a host that resolves them itself', () => {
    const options = authBetterAuthOptions({
      databaseUrl: completeEnvironment.DATABASE_URL,
      config: defaultAuthConfig,
    });

    expect(options).not.toHaveProperty('secret');
    expect(options).not.toHaveProperty('baseURL');
    expect(options).not.toHaveProperty('trustedOrigins');
    expect(options.emailAndPassword).toMatchObject({ enabled: true, disableSignUp: true });
  });

  it('enables a GitHub social provider only when credentials are supplied', () => {
    const withoutGithub = authBetterAuthOptions({
      databaseUrl: completeEnvironment.DATABASE_URL,
      config: defaultAuthConfig,
    });
    expect(withoutGithub.socialProviders).toBeUndefined();

    const withGithub = authBetterAuthOptions({
      databaseUrl: completeEnvironment.DATABASE_URL,
      config: defaultAuthConfig,
      github: { clientId: 'id', clientSecret: 'secret' },
    });
    expect(withGithub.socialProviders).toMatchObject({
      github: { clientId: 'id', clientSecret: 'secret' },
    });
  });
});
