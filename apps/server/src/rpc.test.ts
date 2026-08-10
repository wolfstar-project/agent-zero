import { createRouterClient } from '@orpc/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryTaskStore, type StoredTask } from './control-plane.js';
import { rpcRouter } from './rpc.js';

const TIMESTAMP = '2026-08-09T10:00:00.000Z';
const VALIDATION_ERROR = /validation/i;
const APPROVAL_ERROR = /awaiting human review/i;

let store: MemoryTaskStore;

/** A server-side client exercises every procedure without opening a network port. */
function client() {
  return createRouterClient(rpcRouter, { context: { store } });
}

function awaiting(id: string): StoredTask {
  return {
    id,
    repository: 'acme/app',
    status: 'needs-human',
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    events: [],
  };
}

beforeEach(() => {
  store = new MemoryTaskStore();
});

describe('rpc router', () => {
  it('reports health without touching the store', async () => {
    await expect(client().health()).resolves.toMatchObject({
      status: 'ok',
      service: 'agent-zero',
    });
  });

  it('reads task history through the injected store', async () => {
    await store.save(awaiting('az_1'));
    await expect(client().tasks.list()).resolves.toMatchObject({
      tasks: [{ id: 'az_1', status: 'needs-human' }],
    });
    await expect(client().tasks.get({ id: 'az_1' })).resolves.toMatchObject({ id: 'az_1' });
  });

  it('resolves an unknown task as absent rather than fabricating one', async () => {
    await expect(client().tasks.get({ id: 'az_missing' })).resolves.toBeUndefined();
  });

  it('rejects an unknown mode at the procedure boundary', async () => {
    await expect(
      // @ts-expect-error the schema is the contract under test
      client().tasks.create({ repository: '.', feedback: 'x', mode: 'yolo' }),
    ).rejects.toThrow(VALIDATION_ERROR);
  });

  it('records an approval for a task awaiting human review', async () => {
    await store.save(awaiting('az_1'));
    await expect(
      client().approvals.decide({
        taskId: 'az_1',
        decision: 'approved',
        actor: 'release-manager',
      }),
    ).resolves.toMatchObject({ approval: { decision: 'approved', actor: 'release-manager' } });
  });

  it('refuses an approval for a task that is not awaiting review', async () => {
    await store.save({ ...awaiting('az_1'), status: 'completed' });
    await expect(
      client().approvals.decide({ taskId: 'az_1', decision: 'approved', actor: 'operator' }),
    ).rejects.toThrow(APPROVAL_ERROR);
  });
});
