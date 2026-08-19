import { describe, expect, it } from 'vitest';

import {
  createAuditRecorder,
  MemoryAuditLogStore,
  PersistentAuditLogStore,
  type AuditEntryInput,
  type AuditEvent,
  type AuditLogStore,
} from './audit.js';
import type { KeyValueStorage } from './control-plane.js';

/** The same shape `control-plane.test.ts` uses; it is a test double, not exported production code. */
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

function event(id: string, occurredAt: string, overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id,
    occurredAt,
    actor: { kind: 'principal', name: 'release-manager' },
    action: 'task.created',
    outcome: 'success',
    ...overrides,
  };
}

/** `exactOptionalPropertyTypes` rejects an explicit `undefined`, so an absent cursor is omitted. */
function cursorOf(cursor: string | null): { cursor?: string } {
  return cursor ? { cursor } : {};
}

/** Fixed instants, never a wall clock: the ordering assertions below are the point of the test. */
const FIRST = '2026-08-09T10:00:00.000Z';
const SECOND = '2026-08-09T10:00:01.000Z';
const THIRD = '2026-08-09T10:00:02.000Z';

describe.each([
  ['PersistentAuditLogStore', () => new PersistentAuditLogStore(new RecordingStorage())],
  ['MemoryAuditLogStore', () => new MemoryAuditLogStore()],
])('%s', (_name, create) => {
  it('lists appended records newest first', async () => {
    const store: AuditLogStore = create();
    // Appended out of order, so the result proves a sort rather than an insertion order.
    await store.append(event('audit_2', SECOND));
    await store.append(event('audit_1', FIRST));
    await store.append(event('audit_3', THIRD));

    const page = await store.list();

    expect(page.events.map((entry) => entry.id)).toEqual(['audit_3', 'audit_2', 'audit_1']);
    expect(page.nextCursor).toBeNull();
  });

  it('walks the whole log through the cursor without repeating or dropping a record', async () => {
    const store: AuditLogStore = create();
    const instants = [FIRST, SECOND, THIRD, '2026-08-09T10:00:03.000Z', '2026-08-09T10:00:04.000Z'];
    for (const [index, occurredAt] of instants.entries())
      await store.append(event(`audit_${index + 1}`, occurredAt));

    const first = await store.list({ limit: 2 });
    const second = await store.list({ limit: 2, ...cursorOf(first.nextCursor) });
    const third = await store.list({ limit: 2, ...cursorOf(second.nextCursor) });

    expect(first.events.map((entry) => entry.id)).toEqual(['audit_5', 'audit_4']);
    expect(second.events.map((entry) => entry.id)).toEqual(['audit_3', 'audit_2']);
    expect(third.events.map((entry) => entry.id)).toEqual(['audit_1']);
    expect(third.nextCursor).toBeNull();
  });

  it('restarts from the newest record when the cursor is unknown', async () => {
    const store: AuditLogStore = create();
    await store.append(event('audit_1', FIRST));

    // A client that fell behind a truncated or rotated log gets the newest page, not an error.
    await expect(store.list({ cursor: 'audit:1999-01-01T00:00:00.000Z:gone' })).resolves.toEqual({
      events: [event('audit_1', FIRST)],
      nextCursor: null,
    });
  });

  it('keeps records minted in the same millisecond distinct', async () => {
    const store: AuditLogStore = create();
    await store.append(event('audit_1', FIRST));
    await store.append(event('audit_2', FIRST));

    const page = await store.list();

    expect(page.events.map((entry) => entry.id).toSorted()).toEqual(['audit_1', 'audit_2']);
  });
});

describe('audit persistence', () => {
  it('redacts secrets carried in metadata before the record reaches storage', async () => {
    const storage = new RecordingStorage();
    const store = new PersistentAuditLogStore(storage, ['ghp_supersecret']);

    await store.append(
      event('audit_1', FIRST, { metadata: { reason: 'token ghp_supersecret rejected' } }),
    );

    const [persisted] = [...storage.values.values()];
    expect(JSON.stringify(persisted)).not.toContain('ghp_supersecret');
    const page = await store.list();
    expect(page.events[0]?.metadata?.reason).toBe('token [redacted] rejected');
  });

  it('refuses to persist a record that is not an audit event', async () => {
    const store = new PersistentAuditLogStore(new RecordingStorage());
    // The guard exists for callers the type system does not reach — a replayed record, a future
    // bridge deserialising one — so the test has to arrive the way they would.
    // oxlint-disable-next-line no-unsafe-type-assertion -- deliberately invalid input under test
    const malformed = { id: 'audit_1' } as AuditEvent;

    await expect(store.append(malformed)).rejects.toThrow(
      'Refusing to persist an invalid audit record',
    );
  });

  it('ignores foreign records sharing the audit prefix', async () => {
    const storage = new RecordingStorage();
    await storage.setItem('audit:2026-08-09T10:00:00.000Z:junk', { unrelated: true });
    const store = new PersistentAuditLogStore(storage);
    await store.append(event('audit_1', FIRST));

    const page = await store.list();

    expect(page.events.map((entry) => entry.id)).toEqual(['audit_1']);
  });
});

describe('audit recorder', () => {
  const entry: AuditEntryInput = {
    actor: { kind: 'principal', name: 'release-manager' },
    action: 'task.created',
    outcome: 'success',
    subject: { type: 'task', id: 'az_1' },
    metadata: { repository: 'acme/app', mode: 'observe' },
  };

  it('mints the identity and the timestamp the call site does not supply', async () => {
    const store = new MemoryAuditLogStore();
    const recorder = createAuditRecorder({ store, now: () => FIRST, id: () => 'audit_1' });

    await recorder.record(entry);

    expect(store.records).toEqual([{ id: 'audit_1', occurredAt: FIRST, ...entry }]);
  });

  it('resolves and reports the loss when the durable write fails', async () => {
    const failures: unknown[] = [];
    const recorder = createAuditRecorder({
      store: {
        async append(): Promise<void> {
          throw new Error('storage unavailable');
        },
        async list() {
          return { events: [], nextCursor: null };
        },
      },
      onError: (error) => failures.push(error),
    });

    // The mutation this records already committed: rejecting here would report a failure for
    // work that actually happened.
    await expect(recorder.record(entry)).resolves.toBeUndefined();
    expect(String(failures[0])).toContain('storage unavailable');
  });
});
