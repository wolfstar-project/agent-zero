import { timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';

/** An authenticated control-plane caller. Mutations record this identity, never a wire-supplied one. */
export interface Principal {
  name: string;
}

/**
 * Static access policy for the control-plane transport.
 *
 * Mutating procedures fail closed: without configured principals no mutation is accepted, and task
 * creation additionally requires the target repository path to be allow-listed by the operator.
 */
export interface ControlPlaneAccess {
  /** Bearer token to principal name. */
  principals: ReadonlyMap<string, string>;
  /** Repository paths that `tasks.create` may target. */
  repositories: readonly string[];
}

const BEARER_PREFIX = 'Bearer ';

/**
 * Parse the access policy from the environment.
 *
 * `AGENT_ZERO_CONTROL_PLANE_TOKENS` holds comma-separated `name:token` pairs and
 * `AGENT_ZERO_CONTROL_PLANE_REPOSITORIES` holds comma-separated repository paths. Returns
 * `undefined` when no tokens are configured, which keeps every mutation rejected.
 */
export function accessFromEnvironment(
  tokens = process.env.AGENT_ZERO_CONTROL_PLANE_TOKENS,
  repositories = process.env.AGENT_ZERO_CONTROL_PLANE_REPOSITORIES,
): ControlPlaneAccess | undefined {
  if (tokens === undefined || tokens.trim() === '') return undefined;
  const principals = new Map<string, string>();
  for (const entry of tokens.split(',')) {
    const trimmed = entry.trim();
    if (trimmed === '') continue;
    const separator = trimmed.indexOf(':');
    const name = separator > 0 ? trimmed.slice(0, separator).trim() : '';
    const token = separator > 0 ? trimmed.slice(separator + 1).trim() : '';
    if (name === '' || token === '')
      throw new Error('AGENT_ZERO_CONTROL_PLANE_TOKENS entries must be name:token pairs');
    principals.set(token, name);
  }
  if (principals.size === 0) return undefined;
  return {
    principals,
    repositories: (repositories ?? '')
      .split(',')
      .map((path) => path.trim())
      .filter((path) => path !== ''),
  };
}

/** Resolve the principal for an `Authorization` header using constant-time token comparison. */
export function authenticate(
  authorization: string | undefined,
  access: ControlPlaneAccess | undefined,
): Principal | undefined {
  if (!access || authorization === undefined || !authorization.startsWith(BEARER_PREFIX))
    return undefined;
  const presented = Buffer.from(authorization.slice(BEARER_PREFIX.length));
  for (const [token, name] of access.principals) {
    const expected = Buffer.from(token);
    if (presented.length === expected.length && timingSafeEqual(presented, expected))
      return { name };
  }
  return undefined;
}

/** Whether task creation may target this repository path. Fails closed without a policy. */
export function mayTargetRepository(
  repository: string,
  access: ControlPlaneAccess | undefined,
): boolean {
  if (!access) return false;
  const target = resolve(repository);
  return access.repositories.some((allowed) => resolve(allowed) === target);
}
