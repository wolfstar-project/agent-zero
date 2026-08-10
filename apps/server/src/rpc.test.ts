import { createRouterClient } from '@orpc/server';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Principal } from './auth.js';
import { MemoryTaskStore, type StoredTask } from './control-plane.js';
import { rpcRouter } from './rpc.js';

const TIMESTAMP = '2026-08-09T10:00:00.000Z';
const VALIDATION_ERROR = /validation/i;
const APPROVAL_ERROR = /awaiting human review/i;
const UNAUTHORIZED_ERROR = /authentication required/i;
const FORBIDDEN_ERROR = /not allow-listed/i;
const MODE_ERROR = /not granted/i;

let store: MemoryTaskStore;

interface ClientOptions {
  principal?: Principal;
  allowRepository?: boolean;
}

/** A server-side client exercises every procedure without opening a network port. */
function client(options: ClientOptions = {}) {
  return createRouterClient(rpcRouter, {
    context: {
      store,
      ...(options.principal ? { principal: options.principal } : {}),
      mayTargetRepository: () => options.allowRepository ?? false,
    },
  });
}

function operator() {
  return client({
    principal: { name: 'release-manager', modes: ['observe', 'suggest', 'fix', 'autonomous'] },
    allowRepository: true,
  });
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
      operator().tasks.create({ repository: '.', feedback: 'x', mode: 'yolo' }),
    ).rejects.toThrow(VALIDATION_ERROR);
  });

  it('rejects an unauthenticated task submission before any work is created', async () => {
    await expect(
      client().tasks.create({ repository: '.', feedback: 'x', mode: 'autonomous' }),
    ).rejects.toThrow(UNAUTHORIZED_ERROR);
    await expect(store.list()).resolves.toEqual([]);
  });

  it('refuses task creation for a repository outside the allow-list', async () => {
    await expect(
      client({ principal: { name: 'release-manager', modes: ['autonomous'] } }).tasks.create({
        repository: '/etc',
        feedback: 'x',
        mode: 'autonomous',
      }),
    ).rejects.toThrow(FORBIDDEN_ERROR);
    await expect(store.list()).resolves.toEqual([]);
  });

  it('refuses an execution mode outside the principal grant', async () => {
    const readOnly = client({
      principal: { name: 'ci', modes: ['observe', 'suggest'] },
      allowRepository: true,
    });
    await expect(
      readOnly.tasks.create({ repository: '.', feedback: 'x', mode: 'fix' }),
    ).rejects.toThrow(MODE_ERROR);
    await expect(
      readOnly.tasks.create({ repository: '.', feedback: 'x', mode: 'autonomous' }),
    ).rejects.toThrow(MODE_ERROR);
    await expect(store.list()).resolves.toEqual([]);
  });

  it('rejects an unauthenticated approval decision', async () => {
    await store.save(awaiting('az_1'));
    await expect(
      client().approvals.decide({ taskId: 'az_1', decision: 'approved' }),
    ).rejects.toThrow(UNAUTHORIZED_ERROR);
    await expect(store.get('az_1')).resolves.toMatchObject({ status: 'needs-human' });
  });

  it('records an approval attributed to the authenticated principal', async () => {
    await store.save(awaiting('az_1'));
    await expect(
      operator().approvals.decide({ taskId: 'az_1', decision: 'approved' }),
    ).resolves.toMatchObject({ approval: { decision: 'approved', actor: 'release-manager' } });
  });

  it('ignores a wire-supplied actor in favour of the principal identity', async () => {
    await store.save(awaiting('az_1'));
    await expect(
      operator().approvals.decide({
        taskId: 'az_1',
        decision: 'approved',
        // @ts-expect-error the schema no longer accepts an actor from the wire
        actor: 'impostor',
      }),
    ).resolves.toMatchObject({ approval: { actor: 'release-manager' } });
  });

  it('refuses an approval for a task that is not awaiting review', async () => {
    await store.save({ ...awaiting('az_1'), status: 'completed' });
    await expect(
      operator().approvals.decide({ taskId: 'az_1', decision: 'approved' }),
    ).rejects.toThrow(APPROVAL_ERROR);
  });
});
