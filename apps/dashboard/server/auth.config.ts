import { authBetterAuthOptions, authDatabaseOptionsFromEnvironment } from '@agent-zero/auth';
import { createMailer, mailProviderNameFromEnvironment } from '@agent-zero/mail';
import { defineServerAuth } from '@onmax/nuxt-better-auth/config';
import { memoryAdapter } from 'better-auth/adapters/memory';

// This module is the composition root for authentication, so it is where the mail transport is
// bound and injected. `packages/auth` declares the delivery contract structurally and never
// imports `@agent-zero/mail`, which keeps one capability package from depending on another.
//
// The transport is only injected when the configured provider actually delivers: the console
// default logs an envelope instead of sending, so wiring it in would satisfy
// `authBetterAuthOptions`'s startup guard while every invitation silently reached nobody.
// Withholding the callback lets that guard fail startup when organizations are enabled without a
// real transport.
const sendMail = createMailer();
const deliversMail = mailProviderNameFromEnvironment() !== 'console';

/**
 * Better Auth's database, policy, and provider configuration.
 *
 * `secret` and `baseURL` are deliberately absent from `authBetterAuthOptions`: the module injects
 * them itself (from `NUXT_BETTER_AUTH_SECRET`/`BETTER_AUTH_SECRET` and the resolved site URL), so
 * this file cannot become a second, divergent source for either. `dashboardUrl` resolves from
 * `NUXT_PUBLIC_SITE_URL` for the same reason `secret`/`baseURL` are omitted above: this app is
 * same-origin with itself, so the dashboard origin an invitation link should point at is this
 * deployment's own public origin. It has to be set explicitly (rather than derived from an
 * incoming request) because Better Auth's plugin list, and therefore the invitation callback
 * closure, is built once at module load.
 */
const dashboardUrl = process.env.NUXT_PUBLIC_SITE_URL?.trim();

const options = authBetterAuthOptions({
  ...authDatabaseOptionsFromEnvironment(),
  ...(dashboardUrl ? { dashboardUrl } : {}),
  ...(deliversMail
    ? {
        sendInvitationEmail: ({ to, organizationName, inviterName, acceptUrl }) =>
          sendMail({
            to,
            templateId: 'organizationInvitation',
            context: { organizationName, inviterName, acceptUrl },
          }),
        // The enrollment plugin deliberately never returns a private invitation's link to whoever
        // created it, so this callback is the only path the token travels. The template renders
        // the optional halves away rather than printing "null": an invitation with no invitee name
        // or no organization is the ordinary app-wide case, not a missing value.
        sendPrivateInvitationEmail: ({ to, name, inviterName, organizationName, acceptUrl }) =>
          sendMail({
            to,
            templateId: 'privateInvitation',
            context: {
              name: name ?? '',
              inviterName,
              organizationName: organizationName ?? '',
              acceptUrl,
            },
          }),
        sendPublicInvitationEmail: ({
          to,
          inviterName,
          organizationName,
          shareUrl,
          maxUses,
          expiresAt,
        }) =>
          sendMail({
            to,
            templateId: 'publicInvitation',
            context: {
              inviterName,
              organizationName: organizationName ?? '',
              shareUrl,
              maxUses: maxUses === null ? 'Unlimited' : String(maxUses),
              expiresAt: expiresAt?.toISOString() ?? 'Never',
            },
          }),
      }
    : {}),
});

/**
 * `AUTH_E2E_MEMORY` swaps the Postgres adapter for an in-memory one. Set only by the Playwright
 * preview server (`start:playwright:webserver`, see `playwright.config.ts`), so the e2e suite in
 * `test/e2e/test-utils.ts` can sign up and sign in its own throwaway account through the real
 * `/api/auth/**` endpoints without a live database, staying off the network and off mutable
 * external state. `AUTH_DATABASE_URL` still has to resolve to build `options` above, but nothing
 * ever queries it once `database` is overridden here.
 *
 * Deliberately not guarded by `NODE_ENV`: `nuxt preview` — the command this app's own e2e suite
 * runs, per `start:playwright:webserver` above — sets `NODE_ENV=production` whenever it isn't
 * already set (`@nuxt/cli`'s `preview` command), identically to a real deployment's built output.
 * A `NODE_ENV === 'production'` check would therefore reject every e2e run, not just a leaked
 * flag. Keep this variable out of any shared `.env`/CI template that a real deployment also reads.
 */
export default defineServerAuth(
  process.env.AUTH_E2E_MEMORY === 'true'
    ? {
        ...options,
        // Better Auth's memory adapter needs each model's collection to exist up front, even
        // empty — an absent key throws "Model <name> not found" on the first query rather than
        // being treated as an empty table.
        database: memoryAdapter({
          user: [],
          session: [],
          account: [],
          verification: [],
          invite: [],
          inviteUse: [],
        }),
        // The default rate limiter can't determine a per-client IP in this sandboxed preview
        // server, so it falls back to one shared bucket across every request. A parallel
        // Playwright run's repeated sign-up/sign-in calls exhaust that bucket in a few tests;
        // rate limiting isn't what this suite exercises, so it's off for this adapter only.
        rateLimit: { enabled: false },
      }
    : options,
);
