import { describe, expect, it } from 'vitest';

import type { Runner } from './boundary.js';
import { RunnerPool, RunnerPoolQuotaError, type SandboxProvider } from './sandbox.js';

const runner: Runner = {
  describe: () => ({ kind: 'container', isolated: true, writable: false, network: 'none' }),
  context: async () => '',
  reviewFiles: async () => [],
  read: async () => '',
  exists: async () => false,
  write: async () => undefined,
  check: async (command) => ({
    command,
    exitCode: 0,
    stdout: '',
    stderr: '',
    durationMs: 0,
  }),
  changedFiles: async () => [],
};

function provider(): SandboxProvider & { stopped: string[] } {
  return {
    kind: 'vitehub',
    stopped: [],
    async provision(request) {
      return { externalId: `remote-${request.taskId}`, runner };
    },
    async stop(id) {
      this.stopped.push(id);
    },
  };
}

describe('RunnerPool', () => {
  const request = {
    taskId: 'task-1',
    repository: 'acme/app',
    mode: 'observe' as const,
    writable: false,
    network: 'none' as const,
    leaseMs: 1_000,
  };

  it('returns only the Runner boundary and public lifecycle metadata', async () => {
    const adapter = provider();
    const pool = new RunnerPool(adapter, {
      maxActive: 2,
      maxActivePerRepository: 1,
      maxLeaseMs: 2_000,
      now: () => 10_000,
    });
    const lease = await pool.acquire(request);
    expect(lease.runner).toBe(runner);
    expect(pool.snapshot().leases[0]).not.toHaveProperty('runner');
    expect(pool.snapshot()).toMatchObject({ active: 1, capacity: 2 });
  });

  it('enforces pool, repository, and lease quotas before provisioning', async () => {
    const pool = new RunnerPool(provider(), {
      maxActive: 2,
      maxActivePerRepository: 1,
      maxLeaseMs: 1_000,
    });
    await pool.acquire(request);
    await expect(pool.acquire({ ...request, taskId: 'task-2' })).rejects.toBeInstanceOf(
      RunnerPoolQuotaError,
    );
    await expect(
      pool.acquire({ ...request, taskId: 'task-3', repository: 'acme/other', leaseMs: 2_000 }),
    ).rejects.toThrow('exceeds');
  });

  it('stops expired sandboxes deterministically', async () => {
    let current = 1_000;
    const adapter = provider();
    const pool = new RunnerPool(adapter, {
      maxActive: 1,
      maxActivePerRepository: 1,
      maxLeaseMs: 1_000,
      now: () => current,
    });
    await pool.acquire(request);
    current = 2_000;
    await expect(pool.sweepExpired()).resolves.toBe(1);
    expect(adapter.stopped).toEqual(['remote-task-1']);
    expect(pool.snapshot().active).toBe(0);
  });
});
