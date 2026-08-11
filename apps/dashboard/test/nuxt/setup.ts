/**
 * Stand in for `apps/auth-server`, mirroring `mockAuthSession` in `test/e2e/test-utils.ts`.
 *
 * The auth adapter owns a database and a signing secret, so component tests never boot it. The
 * project config points the Better Auth client at the test environment's own origin, and this
 * fetch stub resolves every `/api/auth/**` request as signed out, keeping the suite fully off
 * the network. Specs that need a session mock `useUserSession` instead.
 */
const realFetch = globalThis.fetch;

// Parameter types are contextually inferred from `globalThis.fetch`: the plain `tsc` pass over
// test/** has no DOM lib, so names like `RequestInfo` cannot be referenced directly.
globalThis.fetch = (input, init) => {
  const url = typeof input === 'string' || input instanceof URL ? String(input) : input.url;

  if (new URL(url, 'http://localhost').pathname.startsWith('/api/auth/')) {
    return Promise.resolve(
      new Response('null', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
  }

  return realFetch(input, init);
};
