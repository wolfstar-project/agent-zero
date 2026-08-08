import type { AgentZeroConfig } from '@agent-zero/config';
import type { ModelProvider } from '@agent-zero/models';
import type { Runner } from '@agent-zero/runner';
import { describe, expect, it } from 'vitest';

import { AgentZero } from './index.js';

const config: AgentZeroConfig = {
  version: 1,
  mode: 'fix',
  checks: ['test'],
  autofix: { enabled: true, minConfidence: 0.8 },
  agent: { maxAttempts: 2, timeoutMs: 1_000 },
  permissions: { network: 'none' },
  model: { provider: 'openai-compatible', name: 'test' },
};

const decision = {
  finding: {
    title: 'Bug',
    explanation: 'Confirmed',
    severity: 'high' as const,
    confidence: 0.95,
    valid: true,
    evidence: ['test'],
    files: ['a.ts'],
  },
  plan: ['fix'],
  changes: [{ path: 'a.ts', content: 'fixed', reason: 'bug' }],
};

function setup(exitCodes = [0]) {
  const writes: string[] = [];
  let call = 0;
  const model: ModelProvider = { decide: async () => decision };
  const runner: Runner = {
    context: async () => 'context',
    read: async () => '',
    write: async (path) => {
      writes.push(path);
    },
    check: async (command) => ({
      command,
      exitCode: exitCodes[call++] ?? 0,
      stdout: '',
      stderr: '',
      durationMs: 1,
    }),
    changedFiles: async () => writes,
  };
  return { agent: new AgentZero({ model, runner, config }), writes };
}

describe('AgentZero', () => {
  it('does not write in observe mode', async () => {
    const { agent, writes } = setup();
    const result = await agent.run({ repository: '.', feedback: 'bug', mode: 'observe' });
    expect(result.state).toBe('completed');
    expect(writes).toEqual([]);
    expect(result.checks).toEqual([]);
  });
  it('writes and reports proof when checks pass', async () => {
    const { agent, writes } = setup();
    const result = await agent.run({ repository: '.', feedback: 'bug', mode: 'fix' });
    expect(result.state).toBe('completed');
    expect(writes).toEqual(['a.ts']);
    expect(result.checks[0]?.exitCode).toBe(0);
  });
  it('stops after the repair budget', async () => {
    const { agent } = setup([1, 1]);
    const result = await agent.run({ repository: '.', feedback: 'bug', mode: 'fix' });
    expect(result.state).toBe('needs-human');
    expect(result.events.filter((event) => event.state === 'executing')).toHaveLength(2);
  });
});
