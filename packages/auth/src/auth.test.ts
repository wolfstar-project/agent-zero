import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
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
const MISSING_SEND_PRIVATE_INVITATION_PATTERN = /sendPrivateInvitationEmail/;
const MISSING_DASHBOARD_URL_PATTERN = /dashboardUrl/;
const PUBLIC_INVITE_URL_PATTERN = /^http:\/\/localhost:3000\/invite\?token=[A-Za-z0-9_-]+$/;

/** A transport that satisfies the startup guards without asserting anything about delivery. */
const sendPrivateInvitationEmail = async () => {};

interface PublicInviteApi {
  createSystemInvite(options: {
    body: {
      type: 'public';
      role: string;
      maxUses: number;
      inviter: { name: string; email: string };
    };
  }): Promise<unknown>;
}

/** Narrow the widened Better Auth API at the runtime boundary without asserting it into shape. */
function hasPublicInviteApi(api: object): api is object & PublicInviteApi {
  return 'createSystemInvite' in api && typeof api.createSystemInvite === 'function';
}

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

  it('registers organizations without delivery or a dashboard origin', () => {
    const options = authBetterAuthOptions({
      databaseUrl: completeEnvironment.DATABASE_URL,
      config: { ...defaultAuthConfig, enableOrganizations: true },
    });

    expect(options.plugins.map((plugin) => plugin.id)).toContain('organization');
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

  it('delivers a public invitation to the inviter with its shareable URL', async () => {
    const delivered: Array<{
      to: string;
      inviterName: string;
      role: string;
      organizationName: string | null;
      shareUrl: string;
      maxUses: number | null;
      expiresAt: Date | null;
    }> = [];
    const sendPublicInvitationEmail = async (invitation: (typeof delivered)[number]) => {
      delivered.push(invitation);
    };
    const auth = betterAuth({
      ...authBetterAuthOptions({
        databaseUrl: completeEnvironment.DATABASE_URL,
        config: invitationsEnabled,
        dashboardUrl: instanceOptions.dashboardUrl,
        sendPrivateInvitationEmail,
        sendPublicInvitationEmail,
      }),
      database: memoryAdapter({
        user: [],
        session: [],
        account: [],
        verification: [],
        invite: [],
        inviteUse: [],
      }),
      secret: completeEnvironment.BETTER_AUTH_SECRET,
      baseURL: completeEnvironment.BETTER_AUTH_URL,
    });

    // `authBetterAuthOptions` intentionally widens plugins to Better Auth's host-compatible array
    // type, so plugin-specific API inference ends at that composition boundary. The endpoint is
    // still the real Better Enrollment implementation at runtime.
    if (!hasPublicInviteApi(auth.api)) throw new Error('missing Better Enrollment API');
    await auth.api.createSystemInvite({
      body: {
        type: 'public',
        role: 'admin',
        maxUses: 12,
        inviter: { name: 'Dana', email: 'dana@example.com' },
      },
    });

    expect(delivered).toHaveLength(1);
    expect(delivered[0]).toMatchObject({
      to: 'dana@example.com',
      inviterName: 'Dana',
      role: 'admin',
      organizationName: null,
      shareUrl: expect.stringMatching(PUBLIC_INVITE_URL_PATTERN),
      maxUses: 12,
      expiresAt: expect.any(Date),
    });
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
