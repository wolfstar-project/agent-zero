import { realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

/**
 * Authorization of inbound task checkouts.
 *
 * `POST /tasks` is reachable by anything that can reach the listener, so the requested repository
 * is untrusted input. The route never accepts a raw filesystem path: it accepts an identifier that
 * must resolve, after canonicalization, to a directory strictly inside the managed checkout root
 * the operator configured. Without a configured root the route fails closed and runs nothing.
 */

/** The managed checkout root a deployment authorizes for inbound task requests. */
export function checkoutRootFromEnvironment(): string | undefined {
  const root = process.env.AGENT_ZERO_CHECKOUT_ROOT?.trim();
  return root ? root : undefined;
}

export type CheckoutResolution =
  | { authorized: true; path: string }
  | { authorized: false; reason: string };

/**
 * Resolve an inbound repository identifier against the managed checkout root.
 *
 * Both the root and the candidate are canonicalized with `realpath`, so symlinks cannot smuggle a
 * checkout out of the root, and containment is checked on the canonical paths. The root itself is
 * not a checkout and is rejected.
 */
export async function resolveCheckout(
  repository: string,
  root: string | undefined,
): Promise<CheckoutResolution> {
  if (!root)
    return {
      authorized: false,
      reason: 'Task execution is disabled: AGENT_ZERO_CHECKOUT_ROOT is not configured',
    };
  if (isAbsolute(repository))
    return {
      authorized: false,
      reason: 'Repository must be an identifier relative to the managed checkout root',
    };

  let canonicalRoot: string;
  try {
    canonicalRoot = await realpath(resolve(root));
  } catch {
    return { authorized: false, reason: 'The managed checkout root does not exist' };
  }

  let canonical: string;
  try {
    canonical = await realpath(resolve(canonicalRoot, repository));
  } catch {
    return { authorized: false, reason: `Unknown repository: ${repository}` };
  }

  const contained = relative(canonicalRoot, canonical);
  if (contained === '' || contained.startsWith('..') || isAbsolute(contained))
    return { authorized: false, reason: 'Repository is outside the managed checkout root' };

  return { authorized: true, path: canonical };
}
