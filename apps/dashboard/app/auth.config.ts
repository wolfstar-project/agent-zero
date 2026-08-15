// Imported for their names only, which is a use the linter cannot see. The client plugin's
// phantom server type mentions these, and without a nameable path to them the inferred type of
// this file's default export cannot be written down: the plugin declares them in an internal
// chunk that only the package root re-exports. Widening the plugin instead would remove the need
// for them and also erase the typed `invite.*` client methods.
/* oxlint-disable no-unused-vars -- referenced by the inferred export type, see comment above */
import type {
  InviteAdditionalFieldType,
  InviteKind,
  InviteMode,
  InviteStatus,
  InviteType,
  InviteUse,
} from '@octopi-ai/better-enrollment';
import { betterEnrollmentClient } from '@octopi-ai/better-enrollment/client';
/* oxlint-enable no-unused-vars */
import { defineClientAuth } from '@onmax/nuxt-better-auth/config';
import type { BetterAuthClientPlugin } from 'better-auth/client';
import { organizationClient } from 'better-auth/client/plugins';

/**
 * The enrollment plugin's `$InferServerPlugin` is a phantom field — `{}` at runtime — carrying the
 * server plugin's type so the client's invite methods stay typed. That type declares the table
 * groups it adds conditionally as `?: ... | undefined`, which `exactOptionalPropertyTypes` will
 * not accept for Better Auth's merely-optional entries. Intersecting with the interface satisfies
 * it without widening the plugin away, which would erase the very methods the field exists to
 * infer.
 */
// oxlint-disable-next-line no-unsafe-type-assertion -- verified-safe cast, see comment above
const enrollmentClient = betterEnrollmentClient() as ReturnType<typeof betterEnrollmentClient> &
  BetterAuthClientPlugin;

// Better Auth is mounted in this app's own server (`server/auth.config.ts`), so every request is
// same-origin: no explicit `baseURL` or credentialed CORS is needed.
export default defineClientAuth({
  // Registered unconditionally: the client plugin only adds callable methods, and whether the
  // deployment actually serves them is decided by the auth server's own policy. Gating it on a
  // build-time flag would let a stale dashboard build lose access to an enabled feature.
  plugins: [organizationClient(), enrollmentClient],
});
