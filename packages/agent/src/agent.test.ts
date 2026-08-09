import { defaultConfig, type AgentZeroConfig } from '@agent-zero/config';
import type { ModelContext, ModelProvider } from '@agent-zero/models';
import type { Runner } from '@agent-zero/runner';
import type {
  AgentDecision,
  ModelFinding,
  RunMode,
  RunnerDescription,
  TaskEvent,
  TaskResult,
} from '@agent-zero/shared';
import { describe, expect, it } from 'vitest';

import { AgentZero } from './agent.js';

const sourceFile = 'export function load() {\n  return null;\n}\n';

function config(overrides: Partial<AgentZeroConfig> = {}): AgentZeroConfig {
  return {
    ...structuredClone(defaultConfig),
    checks: ['pnpm run test'],
    autofix: { enabled: true, minConfidence: 0.8 },
    agent: { maxAttempts: 2, timeoutMs: 1_000, maxChangedFiles: 5 },
    ...overrides,
  };
}

function finding(overrides: Partial<ModelFinding> = {}): ModelFinding {
  return {
    title: 'Null return is dereferenced',
    explanation: 'load() returns null but callers dereference it.',
    severity: 'high',
    confidence: 0.95,
    valid: true,
    evidence: ['`return null;` in src/user.ts'],
    files: ['src/user.ts'],
    ...overrides,
  };
}

function decision(overrides: Partial<AgentDecision> = {}): AgentDecision {
  return {
    finding: finding(),
    plan: ['Guard the null return'],
    changes: [
      {
        path: 'src/user.ts',
        content: 'export function load() {\n  return {};\n}\n',
        reason: 'guard',
      },
    ],
    ...overrides,
  };
}

interface HarnessOptions {
  /** One decision per model call; the last one repeats. */
  decisions?: AgentDecision[];
  /** Exit codes per repair attempt, one entry per check in that attempt. */
  exitCodes?: number[][];
  /** Number of checks a single attempt runs, used to group `exitCodes`. */
  checksPerAttempt?: number;
  overrides?: Partial<AgentZeroConfig>;
  runner?: Partial<RunnerDescription>;
  files?: Record<string, string>;
  changedFiles?: string[];
  onEvent?: (event: TaskEvent) => void;
  model?: ModelProvider;
}

interface Harness {
  agent: AgentZero;
  writes: { path: string; content: string }[];
  commands: string[];
  modelCalls: ModelContext[];
}

function harness(options: HarnessOptions = {}): Harness {
  const decisions = options.decisions ?? [decision()];
  const files: Record<string, string> = options.files ?? {
    'src/user.ts': sourceFile,
    'package.json': JSON.stringify({ scripts: { test: 'vitest run' } }),
    'pnpm-lock.yaml': '',
  };
  const writes: { path: string; content: string }[] = [];
  const commands: string[] = [];
  const modelCalls: ModelContext[] = [];
  const checksPerAttempt = options.checksPerAttempt ?? 1;
  let checkCall = 0;

  const model: ModelProvider = options.model ?? {
    decide: async (context) => {
      modelCalls.push(context);
      return decisions[Math.min(modelCalls.length - 1, decisions.length - 1)] ?? decision();
    },
  };

  const description: RunnerDescription = {
    kind: 'local',
    isolated: false,
    writable: true,
    network: 'none',
    ...options.runner,
  };

  const runner: Runner = {
    describe: () => description,
    context: async () => 'FILES\nsrc/user.ts\n\nDIFF\n',
    read: async (path) => {
      const content = files[path];
      if (content === undefined) throw new Error(`missing ${path}`);
      return content;
    },
    exists: async (path) => path in files,
    write: async (path, content) => {
      if (!description.writable) throw new Error('read-only runner');
      writes.push({ path, content });
      files[path] = content;
    },
    check: async (command) => {
      commands.push(command);
      const attempt = Math.floor(checkCall / checksPerAttempt);
      const index = checkCall % checksPerAttempt;
      checkCall += 1;
      const exitCode = options.exitCodes?.[attempt]?.[index] ?? 0;
      return {
        command,
        exitCode,
        stdout: '',
        stderr: exitCode === 0 ? '' : 'assertion failed',
        durationMs: 1,
      };
    },
    changedFiles: async () =>
      options.changedFiles ?? [...new Set(writes.map((write) => write.path))],
  };

  return {
    agent: new AgentZero({
      model,
      runner,
      config: config(options.overrides),
      ...(options.onEvent === undefined ? {} : { onEvent: options.onEvent }),
    }),
    writes,
    commands,
    modelCalls,
  };
}

function run(agent: AgentZero, mode: RunMode): Promise<TaskResult> {
  return agent.run({ repository: '/checkout', feedback: 'load() can return null', mode });
}

describe('read-only modes', () => {
  it('never writes in observe mode', async () => {
    const { agent, writes, commands } = harness();
    const result = await run(agent, 'observe');
    expect(result.state).toBe('completed');
    expect(result.verdict).toBe('accepted');
    expect(result.verified).toBe(false);
    expect(writes).toEqual([]);
    expect(commands).toEqual([]);
    expect(result.summary).toContain('without modifying files');
  });

  it('never writes in suggest mode', async () => {
    const { agent, writes } = harness();
    const result = await run(agent, 'suggest');
    expect(result.state).toBe('completed');
    expect(writes).toEqual([]);
  });

  it('reports only when repository policy disables autofix', async () => {
    const { agent, writes } = harness({
      overrides: { autofix: { enabled: false, minConfidence: 0.8 } },
    });
    const result = await run(agent, 'fix');
    expect(result.state).toBe('completed');
    expect(result.verified).toBe(false);
    expect(writes).toEqual([]);
    expect(result.summary).toContain('policy disables automatic fixes');
  });
});

describe('rejecting unsupported feedback', () => {
  it('completes with a rejected verdict and keeps the reasons', async () => {
    const { agent, writes } = harness({
      decisions: [decision({ finding: finding({ valid: false }) })],
    });
    const result = await run(agent, 'fix');
    expect(result.state).toBe('completed');
    expect(result.verdict).toBe('rejected');
    expect(result.verified).toBe(false);
    expect(result.finding?.rejectionReasons.length).toBeGreaterThan(0);
    expect(writes).toEqual([]);
  });

  it('rejects a claim about a file that is not in the checkout', async () => {
    const { agent } = harness({
      decisions: [decision({ finding: finding({ files: ['src/ghost.ts'] }) })],
    });
    const result = await run(agent, 'fix');
    expect(result.verdict).toBe('rejected');
    expect(result.finding?.rejectionReasons[0]).toContain('None of the cited files exist');
  });

  it('asks for a human when the claim is supported but low confidence', async () => {
    const { agent, writes } = harness({
      decisions: [decision({ finding: finding({ confidence: 0.4 }) })],
    });
    const result = await run(agent, 'fix');
    expect(result.state).toBe('needs-human');
    expect(result.verdict).toBe('inconclusive');
    expect(result.summary).toContain('inconclusive');
    expect(writes).toEqual([]);
  });
});

describe('authorization refusals', () => {
  it('stops when confidence is below the autofix threshold', async () => {
    const { agent, writes } = harness({
      decisions: [decision({ finding: finding({ confidence: 0.7 }) })],
      overrides: { autofix: { enabled: true, minConfidence: 0.9 } },
    });
    const result = await run(agent, 'fix');
    expect(result.state).toBe('needs-human');
    expect(result.summary).toContain('below the 0.90 required');
    expect(writes).toEqual([]);
  });

  it('stops when the execution boundary is read-only', async () => {
    const { agent, writes } = harness({ runner: { writable: false } });
    const result = await run(agent, 'fix');
    expect(result.state).toBe('needs-human');
    expect(result.summary).toContain('read-only');
    expect(writes).toEqual([]);
  });

  it('refuses to change files it cannot verify', async () => {
    const { agent, writes } = harness({
      overrides: { checks: [] },
      files: { 'src/user.ts': sourceFile },
    });
    const result = await run(agent, 'fix');
    expect(result.state).toBe('needs-human');
    expect(result.summary).toContain('No repository-native checks were found');
    expect(writes).toEqual([]);
  });
});

describe('narrow scope', () => {
  it('refuses a change outside the validated scope', async () => {
    const { agent, writes } = harness({
      decisions: [
        decision({
          changes: [
            { path: 'src/unrelated.ts', content: 'export const x = 1;\n', reason: 'drive-by' },
          ],
        }),
      ],
    });
    const result = await run(agent, 'fix');
    expect(result.state).toBe('needs-human');
    expect(result.summary).toContain('outside the validated scope');
    expect(writes).toEqual([]);
  });

  it('refuses a change that tries to leave the checkout', async () => {
    const { agent, writes } = harness({
      decisions: [
        decision({ changes: [{ path: '../../etc/passwd', content: 'root', reason: 'escape' }] }),
      ],
    });
    const result = await run(agent, 'fix');
    expect(result.state).toBe('needs-human');
    expect(result.summary).toContain('not inside the checkout');
    expect(writes).toEqual([]);
  });

  it('refuses a change set wider than the narrow-fix budget', async () => {
    const changes = Array.from({ length: 6 }, (_unused, index) => ({
      path: `src/file${String(index)}.ts`,
      content: 'export const x = 1;\n',
      reason: 'wide',
    }));
    const { agent, writes } = harness({ decisions: [decision({ changes })] });
    const result = await run(agent, 'fix');
    expect(result.state).toBe('needs-human');
    expect(result.summary).toContain('above the 5 allowed');
    expect(writes).toEqual([]);
  });

  it('refuses to claim a fix when the plan proposes no change', async () => {
    const { agent } = harness({ decisions: [decision({ changes: [] })] });
    const result = await run(agent, 'fix');
    expect(result.state).toBe('needs-human');
    expect(result.summary).toContain('nothing to verify');
  });

  it('normalizes a scoped path the model wrote differently', async () => {
    const { agent, writes } = harness({
      decisions: [
        decision({
          changes: [
            {
              path: './src/user.ts',
              content: 'export const load = () => ({});\n',
              reason: 'guard',
            },
          ],
        }),
      ],
    });
    const result = await run(agent, 'fix');
    expect(result.state).toBe('completed');
    expect(writes[0]?.path).toBe('src/user.ts');
  });
});

describe('verification', () => {
  it('writes, verifies, and reports proof when checks pass', async () => {
    const { agent, writes, commands } = harness();
    const result = await run(agent, 'fix');
    expect(result.state).toBe('completed');
    expect(result.verified).toBe(true);
    expect(result.verdict).toBe('accepted');
    expect(writes).toHaveLength(1);
    expect(commands).toEqual(['pnpm run test']);
    expect(result.changedFiles).toEqual(['src/user.ts']);
    expect(result.attempts).toBe(1);
  });

  it('discovers the checkout native checks when none are configured', async () => {
    const { agent, commands } = harness({ overrides: { checks: [] } });
    const result = await run(agent, 'fix');
    expect(commands).toEqual(['pnpm run test']);
    expect(result.verified).toBe(true);
  });

  it('repairs once and then verifies', async () => {
    const { agent, modelCalls, commands } = harness({ exitCodes: [[1], [0]] });
    const result = await run(agent, 'fix');
    expect(result.state).toBe('completed');
    expect(result.verified).toBe(true);
    expect(result.attempts).toBe(2);
    expect(commands).toHaveLength(2);
    expect(modelCalls[1]?.previousFailure).toContain('assertion failed');
  });

  it('stops at the repair budget and never reports failure as success', async () => {
    const { agent, commands } = harness({ exitCodes: [[1], [1]] });
    const result = await run(agent, 'fix');
    expect(result.state).toBe('needs-human');
    expect(result.verified).toBe(false);
    expect(result.attempts).toBe(2);
    expect(commands).toHaveLength(2);
    expect(result.events.filter((event) => event.state === 'executing')).toHaveLength(2);
    expect(result.summary).toContain('still fails after 2 attempt(s)');
  });

  it('is unverified when any single check in an attempt fails', async () => {
    const { agent } = harness({
      overrides: { checks: ['pnpm run lint', 'pnpm run test'] },
      checksPerAttempt: 2,
      exitCodes: [
        [0, 1],
        [0, 1],
      ],
    });
    const result = await run(agent, 'fix');
    expect(result.state).toBe('needs-human');
    expect(result.verified).toBe(false);
    expect(result.checks.map((check) => check.exitCode)).toEqual([0, 1]);
  });

  it('refuses to call a passing run verified when nothing actually changed', async () => {
    const { agent } = harness({ changedFiles: [] });
    const result = await run(agent, 'fix');
    expect(result.state).toBe('needs-human');
    expect(result.verified).toBe(false);
    expect(result.summary).toContain('checkout is unchanged');
  });
});

describe('terminal states', () => {
  it('fails deterministically when a dependency throws', async () => {
    const { agent } = harness({
      model: {
        decide: async () => {
          throw new Error('provider unavailable');
        },
      },
    });
    const result = await run(agent, 'observe');
    expect(result.state).toBe('failed');
    expect(result.verified).toBe(false);
    expect(result.finding).toBeNull();
    expect(result.events.at(-1)).toMatchObject({
      state: 'failed',
      message: 'provider unavailable',
    });
  });

  it('records the boundary that produced the result', async () => {
    const { agent } = harness({ runner: { kind: 'container', isolated: true } });
    const result = await run(agent, 'fix');
    expect(result.runner).toMatchObject({ kind: 'container', isolated: true });
  });

  it('walks the documented lifecycle in order', async () => {
    const { agent } = harness();
    const result = await run(agent, 'fix');
    expect(result.events.map((event) => event.state)).toEqual([
      'discovering',
      'understanding',
      'validating',
      'planning',
      'executing',
      'verifying',
      'reviewing',
    ]);
  });

  it('records the repair edge back to planning', async () => {
    const { agent } = harness({ exitCodes: [[1], [0]] });
    const result = await run(agent, 'fix');
    expect(result.events.map((event) => event.state)).toEqual([
      'discovering',
      'understanding',
      'validating',
      'planning',
      'executing',
      'verifying',
      'planning',
      'executing',
      'verifying',
      'reviewing',
    ]);
  });

  it('cannot be diverted by an observer that throws', async () => {
    const seen: string[] = [];
    const { agent } = harness({
      onEvent: (event) => {
        seen.push(event.state);
        throw new Error('observer exploded');
      },
    });
    const result = await run(agent, 'fix');
    expect(result.state).toBe('completed');
    expect(result.verified).toBe(true);
    expect(seen.length).toBeGreaterThan(0);
  });

  it('always reports the source alongside the outcome', async () => {
    const { agent } = harness();
    const result = await agent.run({
      repository: '/checkout',
      feedback: 'load() can return null',
      mode: 'observe',
      source: 'github:acme/app#7',
    });
    expect(result.summary).toContain('(github:acme/app#7)');
  });
});
