import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { NetworkPolicy, RunMode } from '@agent-zero/shared';
import { parse } from 'yaml';

import { assertExecutableCommand } from './checks.js';

export {
  assertExecutableCommand,
  checkKinds,
  discoverChecks,
  knownLockfiles,
  packageManagerFromLockfiles,
  resolveChecks,
  type CheckKind,
  type PackageManager,
  type RepositoryProbe,
} from './checks.js';

/** Where repository commands are executed. */
export type RunnerIsolation = 'local' | 'container';

/** Container engines the isolated runner knows how to drive. */
export type ContainerEngine = 'docker' | 'podman';

/** How the runtime decides whether a reviewer's claim is supported. */
export interface ValidationPolicy {
  /** Below this model confidence a supported claim is reported as inconclusive, never fixed. */
  minConfidence: number;
  /** Require at least one piece of cited evidence. */
  requireEvidence: boolean;
  /** Require at least one cited file to exist in the checkout. */
  requireKnownFiles: boolean;
  /** Require backtick-quoted evidence to appear in a cited file. */
  verifyQuotedEvidence: boolean;
}

/** Execution boundary settings. */
export interface RunnerPolicy {
  isolation: RunnerIsolation;
  engine: ContainerEngine;
  /** Container image used when `isolation` is `container`. Required in that mode. */
  image?: string;
  /** Mount point for the checkout inside the container. */
  workdir: string;
  /** Container CPU limit, passed through verbatim (for example `2`). */
  cpus?: string;
  /** Container memory limit, passed through verbatim (for example `4g`). */
  memory?: string;
  /** Pre-provisioned network used for the `restricted` egress policy. */
  network?: string;
  /** Ceiling on captured output per command, in bytes. */
  maxOutputBytes: number;
}

export interface AgentZeroConfig {
  version: 1;
  mode: RunMode;
  /** Explicit check commands. When empty the checkout's own scripts are discovered. */
  checks: string[];
  autofix: { enabled: boolean; minConfidence: number };
  validation: ValidationPolicy;
  agent: { maxAttempts: number; timeoutMs: number; maxChangedFiles: number };
  permissions: { network: NetworkPolicy };
  runner: RunnerPolicy;
  model: { provider: 'openai-compatible'; name: string; baseUrl?: string };
}

export const defaultConfig: AgentZeroConfig = {
  version: 1,
  mode: 'observe',
  checks: [],
  autofix: { enabled: false, minConfidence: 0.85 },
  validation: {
    minConfidence: 0.6,
    requireEvidence: true,
    requireKnownFiles: true,
    verifyQuotedEvidence: true,
  },
  agent: { maxAttempts: 3, timeoutMs: 1_800_000, maxChangedFiles: 10 },
  permissions: { network: 'restricted' },
  runner: {
    isolation: 'local',
    engine: 'docker',
    workdir: '/workspace',
    maxOutputBytes: 200_000,
  },
  model: { provider: 'openai-compatible', name: process.env.AGENT_ZERO_MODEL ?? 'gpt-5' },
};

const runModes = new Set<string>(['observe', 'suggest', 'fix', 'autonomous']);
const networkPolicies = new Set<string>(['none', 'restricted', 'full']);

function assertConfig(value: unknown): asserts value is Partial<AgentZeroConfig> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Configuration must be a YAML object');
}

export async function loadConfig(cwd: string): Promise<AgentZeroConfig> {
  let raw: string;
  try {
    raw = await readFile(join(cwd, '.agent-zero.yml'), 'utf8');
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') return structuredClone(defaultConfig);
    throw error;
  }
  const parsed: unknown = parse(raw);
  assertConfig(parsed);
  return validateConfig({
    ...defaultConfig,
    ...parsed,
    autofix: { ...defaultConfig.autofix, ...parsed.autofix },
    validation: { ...defaultConfig.validation, ...parsed.validation },
    agent: { ...defaultConfig.agent, ...parsed.agent },
    permissions: { ...defaultConfig.permissions, ...parsed.permissions },
    runner: { ...defaultConfig.runner, ...parsed.runner },
    model: { ...defaultConfig.model, ...parsed.model },
  });
}

/**
 * Reject a configuration that cannot be honored.
 *
 * Every failure here is preferable to a run that silently widens permissions, skips verification,
 * or promises isolation the runner cannot deliver.
 */
export function validateConfig(config: AgentZeroConfig): AgentZeroConfig {
  if (config.version !== 1)
    throw new Error(`Unsupported configuration version: ${String(config.version)}`);
  if (!runModes.has(config.mode)) throw new Error(`Invalid mode: ${config.mode}`);
  if (!networkPolicies.has(config.permissions.network))
    throw new Error(`Invalid network policy: ${config.permissions.network}`);

  if (!Array.isArray(config.checks)) throw new Error('checks must be a list of commands');
  for (const command of config.checks) {
    if (typeof command !== 'string') throw new Error('checks must contain only strings');
    assertExecutableCommand(command);
  }

  assertRatio(config.autofix.minConfidence, 'autofix.minConfidence');
  assertRatio(config.validation.minConfidence, 'validation.minConfidence');
  assertPositiveInteger(config.agent.maxAttempts, 'agent.maxAttempts');
  assertPositiveInteger(config.agent.timeoutMs, 'agent.timeoutMs');
  assertPositiveInteger(config.agent.maxChangedFiles, 'agent.maxChangedFiles');
  assertPositiveInteger(config.runner.maxOutputBytes, 'runner.maxOutputBytes');

  if (config.runner.isolation !== 'local' && config.runner.isolation !== 'container')
    throw new Error(`Invalid runner isolation: ${String(config.runner.isolation)}`);
  if (config.runner.engine !== 'docker' && config.runner.engine !== 'podman')
    throw new Error(`Invalid container engine: ${String(config.runner.engine)}`);
  if (config.runner.isolation === 'container' && !config.runner.image)
    throw new Error('runner.image is required when runner.isolation is container');
  if (!config.runner.workdir.startsWith('/'))
    throw new Error('runner.workdir must be an absolute container path');

  return config;
}

/**
 * Whether policy permits this run to modify the checkout.
 *
 * Writing requires an explicit write mode and repository permission. `observe` and `suggest` can
 * never write, regardless of configuration.
 */
export function mayModifyRepository(config: AgentZeroConfig, mode: RunMode): boolean {
  return (mode === 'fix' || mode === 'autonomous') && config.autofix.enabled;
}

function assertRatio(value: number, name: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1)
    throw new Error(`${name} must be between 0 and 1`);
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
