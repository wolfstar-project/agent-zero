import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  defaultConfig,
  loadConfig,
  mayAutofixChange,
  mayModifyRepository,
  validateConfig,
  type AgentZeroConfig,
} from './index.js';

async function withConfig(contents: string): Promise<AgentZeroConfig> {
  const directory = await mkdtemp(join(tmpdir(), 'agent-zero-config-'));
  await writeFile(join(directory, '.agent-zero.yml'), contents, 'utf8');
  return loadConfig(directory);
}

function config(overrides: Partial<AgentZeroConfig> = {}): AgentZeroConfig {
  return { ...structuredClone(defaultConfig), ...overrides };
}

/**
 * Build a configuration with a field the type system forbids, to prove the runtime still rejects it.
 * Configuration arrives from YAML, so the compiler cannot be the only gate.
 */
function invalidConfig(overrides: Record<string, unknown>): AgentZeroConfig {
  return Object.assign(structuredClone(defaultConfig), overrides);
}

describe('loadConfig', () => {
  it('falls back to the safe defaults when no configuration exists', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'agent-zero-empty-'));
    const loaded = await loadConfig(directory);
    expect(loaded.mode).toBe('observe');
    expect(loaded.autofix.enabled).toBe(false);
    expect(loaded.runner.isolation).toBe('local');
    expect(loaded.checks).toEqual([]);
  });

  it('merges nested sections instead of replacing them', async () => {
    const loaded = await withConfig('version: 1\nvalidation:\n  minConfidence: 0.9\n');
    expect(loaded.validation.minConfidence).toBe(0.9);
    expect(loaded.validation.requireEvidence).toBe(true);
  });

  it('rejects an empty check command and defers shell syntax to the runner', async () => {
    // The runner boundary rejects shell expressions at execution time via ViteHub Shell analysis;
    // configuration loading only refuses commands that are empty.
    await expect(withConfig('version: 1\nchecks:\n  - "   "\n')).rejects.toThrow(
      'must not be empty',
    );
    const loaded = await withConfig('version: 1\nchecks:\n  - pnpm test && pnpm build\n');
    expect(loaded.checks).toEqual(['pnpm test && pnpm build']);
  });

  it('rejects container isolation without an image', async () => {
    await expect(withConfig('version: 1\nrunner:\n  isolation: container\n')).rejects.toThrow(
      'runner.image is required',
    );
  });
});

describe('validateConfig', () => {
  it('rejects an unsupported version', () => {
    expect(() => validateConfig(invalidConfig({ version: 2 }))).toThrow(
      'Unsupported configuration',
    );
  });

  it('rejects an unknown mode', () => {
    expect(() => validateConfig(invalidConfig({ mode: 'yolo' }))).toThrow('Invalid mode');
  });

  it('rejects confidence thresholds outside zero to one', () => {
    expect(() =>
      validateConfig(
        config({ autofix: { ...defaultConfig.autofix, enabled: true, minConfidence: 1.5 } }),
      ),
    ).toThrow('autofix.minConfidence must be between 0 and 1');
  });

  it('rejects a repair budget that would skip execution', () => {
    expect(() =>
      validateConfig(config({ agent: { maxAttempts: 0, timeoutMs: 1_000, maxChangedFiles: 1 } })),
    ).toThrow('agent.maxAttempts must be a positive integer');
  });

  it('rejects a container workdir that is not absolute', () => {
    expect(() =>
      validateConfig(
        config({
          runner: {
            ...defaultConfig.runner,
            isolation: 'container',
            image: 'node:22',
            workdir: 'workspace',
          },
        }),
      ),
    ).toThrow('runner.workdir must be an absolute container path');
  });
});

describe('mayModifyRepository', () => {
  it('never permits writing in a read-only mode', () => {
    const enabled = config({
      autofix: { ...defaultConfig.autofix, enabled: true, minConfidence: 0.5 },
    });
    expect(mayModifyRepository(enabled, 'observe')).toBe(false);
    expect(mayModifyRepository(enabled, 'suggest')).toBe(false);
  });

  it('requires both a write mode and repository permission', () => {
    expect(mayModifyRepository(config(), 'fix')).toBe(false);
    expect(
      mayModifyRepository(
        config({ autofix: { ...defaultConfig.autofix, enabled: true, minConfidence: 0.5 } }),
        'fix',
      ),
    ).toBe(true);
    expect(
      mayModifyRepository(
        config({ autofix: { ...defaultConfig.autofix, enabled: true, minConfidence: 0.5 } }),
        'autonomous',
      ),
    ).toBe(true);
  });
});

describe('mayAutofixChange', () => {
  it('allows only repository-approved low-impact change classes', () => {
    const policy = config({
      autofix: {
        ...defaultConfig.autofix,
        allowedChangeRisks: ['mechanical', 'behavioral'],
      },
    });
    expect(mayAutofixChange(policy, 'mechanical')).toBe(true);
    expect(mayAutofixChange(policy, 'behavioral')).toBe(true);
    expect(mayAutofixChange(policy, 'high-impact')).toBe(false);
  });
});
