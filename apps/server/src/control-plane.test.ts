import { describe, expect, it } from 'vitest';

import {
  MemoryTaskStore,
  PersistentTaskStore,
  TaskQueueQuotaError,
  TaskScheduler,
  type KeyValueStorage,
  type StoredTask,
} from './control-plane.js';

function record(id: string, summary = 'safe'): StoredTask {
  return {
    id,
    repository: 'acme/app',
    status: 'queued',
    createdAt: '2026-08-09T10:00:00.000Z',
    updatedAt: '2026-08-09T10:00:00.000Z',
    events: [],
    ...(summary === 'safe'
      ? {}
      : {
          approval: {
            decision: 'approved' as const,
            actor: 'operator',
            comment: summary,
            decidedAt: '2026-08-09T10:00:00.000Z',
          },
        }),
  };
}

class RecordingStorage implements KeyValueStorage {
  readonly values = new Map<string, unknown>();
  async getItem(key: string): Promise<unknown> {
    return this.values.get(key) ?? null;
  }
  async setItem(key: string, value: unknown): Promise<void> {
    this.values.set(key, value);
  }
  async getKeys(base = ''): Promise<string[]> {
    return [...this.values.keys()].filter((key) => key.startsWith(base));
  }
}

describe('task persistence', () => {
  it('round-trips structured history through a provider-neutral store', async () => {
    const storage = new RecordingStorage();
    const store = new PersistentTaskStore(storage);
    await store.save(record('az_1'));
    await expect(store.get('az_1')).resolves.toMatchObject({ id: 'az_1', status: 'queued' });
    await expect(store.list()).resolves.toHaveLength(1);
  });

  it('redacts credentials before persistence', async () => {
    const storage = new RecordingStorage();
    const store = new PersistentTaskStore(storage, ['provider-secret-value']);
    await store.save(record('az_1', 'token=provider-secret-value'));
    expect(JSON.stringify(storage.values.get('tasks:az_1'))).not.toContain('provider-secret-value');
    await expect(store.get('az_1')).resolves.toMatchObject({
      approval: { comment: 'token=[redacted]' },
    });
  });

  it('keeps in-memory records isolated from caller mutation', async () => {
    const store = new MemoryTaskStore();
    const task = record('az_1');
    await store.save(task);
    task.status = 'failed';
    await expect(store.get('az_1')).resolves.toMatchObject({ status: 'queued' });
  });
});

describe('TaskScheduler', () => {
  it('enforces global and repository concurrency while draining FIFO work', async () => {
    const scheduler = new TaskScheduler({
      maxConcurrent: 2,
      maxQueued: 3,
      maxConcurrentPerRepository: 1,
    });
    const releases: Array<() => void> = [];
    const work = (value: number) =>
      scheduler.schedule(
        'acme/app',
        () => new Promise<number>((resolve) => releases.push(() => resolve(value))),
      );
    const first = work(1);
    const second = work(2);
    expect(scheduler.snapshot()).toEqual({ active: 1, queued: 1, capacity: 2 });
    releases.shift()?.();
    await expect(first).resolves.toBe(1);
    await Promise.resolve();
    expect(scheduler.snapshot()).toMatchObject({ active: 1, queued: 0 });
    releases.shift()?.();
    await expect(second).resolves.toBe(2);
  });

  it('rejects work after the bounded queue is full', () => {
    const scheduler = new TaskScheduler({
      maxConcurrent: 1,
      maxQueued: 1,
      maxConcurrentPerRepository: 1,
    });
    void scheduler.schedule('one', () => new Promise(() => undefined));
    void scheduler.schedule('two', () => new Promise(() => undefined));
    expect(() => scheduler.schedule('three', async () => 3)).toThrow(TaskQueueQuotaError);
  });
});
