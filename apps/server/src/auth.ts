import { timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';

import type { RunMode } from '@agent-zero/shared';

/** An authenticated control-plane caller. Mutations record this identity, never a wire-supplied one. */
export interface Principal {
  name: string;
  /** Execution modes this principal may request from `tasks.create`. */
  modes: readonly RunMode[];
}

/**
 * Static access policy for the control-plane transport.
 *
 * Mutating procedures fail closed: without configured principals no mutation is accepted, and task
 * creation additionally requires the target repository path to be allow-listed by the operator and
 * the requested execution mode to be granted to the authenticated principal.
 */
export interface ControlPlaneAccess {
  /** Bearer token to authenticated principal. */
  principals: ReadonlyMap<string, Principal>;
  /** Repository paths that `tasks.create` may target. */
  repositories: readonly string[];
}

const BEARER_PREFIX = 'Bearer ';

const RUN_MODES: readonly RunMode[] = ['observe', 'suggest', 'fix', 'autonomous'];

/** Granted when a principal has no explicit mode entry; neither mode can produce a writable runner. */
const DEFAULT_MODES: readonly RunMode[] = ['observe', 'suggest'];

/**
 * Parse the access policy from the environment.
 *
 * `AGENT_ZERO_CONTROL_PLANE_TOKENS` holds comma-separated `name:token` pairs,
 * `AGENT_ZERO_CONTROL_PLANE_REPOSITORIES` holds comma-separated repository paths, and
 * `AGENT_ZERO_CONTROL_PLANE_MODES` holds comma-separated `name:mode|mode` grants. Principals
 * without a grant may only request the non-writable `observe` and `suggest` modes. Returns
 * `undefined` when no tokens are configured, which keeps every mutation rejected.
 */
export function accessFromEnvironment(
  tokens = process.env.AGENT_ZERO_CONTROL_PLANE_TOKENS,
  repositories = process.env.AGENT_ZERO_CONTROL_PLANE_REPOSITORIES,
  modes = process.env.AGENT_ZERO_CONTROL_PLANE_MODES,
): ControlPlaneAccess | undefined {
  if (tokens === undefined || tokens.trim() === '') return undefined;
  const grants = parseModeGrants(modes);
  const principals = new Map<string, Principal>();
  const names = new Set<string>();
  for (const entry of tokens.split(',')) {
    const trimmed = entry.trim();
    if (trimmed === '') continue;
    const separator = trimmed.indexOf(':');
    const name = separator > 0 ? trimmed.slice(0, separator).trim() : '';
    const token = separator > 0 ? trimmed.slice(separator + 1).trim() : '';
    if (name === '' || token === '')
      throw new Error('AGENT_ZERO_CONTROL_PLANE_TOKENS entries must be name:token pairs');
    names.add(name);
    principals.set(token, { name, modes: grants.get(name) ?? DEFAULT_MODES });
  }
  if (principals.size === 0) return undefined;
  for (const name of grants.keys())
    if (!names.has(name))
      throw new Error(`AGENT_ZERO_CONTROL_PLANE_MODES grants modes to an unknown principal: ${name}`);
  return {
    principals,
    repositories: (repositories ?? '')
      .split(',')
      .map((path) => path.trim())
      .filter((path) => path !== ''),
  };
}

/** Parse `name:mode|mode` grants, refusing unknown modes rather than silently widening or narrowing. */
function parseModeGrants(modes: string | undefined): Map<string, readonly RunMode[]> {
  const grants = new Map<string, readonly RunMode[]>();
  if (modes === undefined || modes.trim() === '') return grants;
  for (const entry of modes.split(',')) {
    const trimmed = entry.trim();
    if (trimmed === '') continue;
    const separator = trimmed.indexOf(':');
    const name = separator > 0 ? trimmed.slice(0, separator).trim() : '';
    const granted = separator > 0 ? trimmed.slice(separator + 1).trim() : '';
    if (name === '' || granted === '')
      throw new Error('AGENT_ZERO_CONTROL_PLANE_MODES entries must be name:mode|mode pairs');
    const parsed: RunMode[] = [];
    for (const candidate of granted.split('|')) {
      const mode = candidate.trim();
      if (mode === '') continue;
      if (!RUN_MODES.includes(mode as RunMode))
        throw new Error(`AGENT_ZERO_CONTROL_PLANE_MODES grants an unknown mode: ${mode}`);
      parsed.push(mode as RunMode);
    }
    if (parsed.length === 0)
      throw new Error('AGENT_ZERO_CONTROL_PLANE_MODES entries must be name:mode|mode pairs');
    grants.set(name, parsed);
  }
  return grants;
}

/** Resolve the principal for an `Authorization` header using constant-time token comparison. */
export function authenticate(
  authorization: string | undefined,
  access: ControlPlaneAccess | undefined,
): Principal | undefined {
  if (!access || authorization === undefined || !authorization.startsWith(BEARER_PREFIX))
    return undefined;
  const presented = Buffer.from(authorization.slice(BEARER_PREFIX.length));
  for (const [token, principal] of access.principals) {
    const expected = Buffer.from(token);
    if (presented.length === expected.length && timingSafeEqual(presented, expected))
      return principal;
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
