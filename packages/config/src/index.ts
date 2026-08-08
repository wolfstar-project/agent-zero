import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { RunMode } from '@agent-zero/shared';
import { parse } from 'yaml';

export interface AgentZeroConfig {
  version: 1;
  mode: RunMode;
  checks: string[];
  autofix: { enabled: boolean; minConfidence: number };
  agent: { maxAttempts: number; timeoutMs: number };
  permissions: { network: 'none' | 'restricted' | 'full' };
  model: { provider: 'openai-compatible'; name: string; baseUrl?: string };
}

export const defaultConfig: AgentZeroConfig = {
  version: 1,
  mode: 'observe',
  checks: ['pnpm lint', 'pnpm typecheck', 'pnpm test'],
  autofix: { enabled: false, minConfidence: 0.85 },
  agent: { maxAttempts: 3, timeoutMs: 1_800_000 },
  permissions: { network: 'restricted' },
  model: { provider: 'openai-compatible', name: process.env.AGENT_ZERO_MODEL ?? 'gpt-5' },
};

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
  const config: AgentZeroConfig = {
    ...defaultConfig,
    ...parsed,
    autofix: { ...defaultConfig.autofix, ...parsed.autofix },
    agent: { ...defaultConfig.agent, ...parsed.agent },
    permissions: { ...defaultConfig.permissions, ...parsed.permissions },
    model: { ...defaultConfig.model, ...parsed.model },
  };
  if (config.version !== 1)
    throw new Error(`Unsupported configuration version: ${String(config.version)}`);
  if (!['observe', 'suggest', 'fix', 'autonomous'].includes(config.mode))
    throw new Error(`Invalid mode: ${config.mode}`);
  if (config.autofix.minConfidence < 0 || config.autofix.minConfidence > 1)
    throw new Error('minConfidence must be between 0 and 1');
  if (!Number.isInteger(config.agent.maxAttempts) || config.agent.maxAttempts < 1)
    throw new Error('maxAttempts must be a positive integer');
  return config;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
