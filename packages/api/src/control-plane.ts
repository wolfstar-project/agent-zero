import {
  redactSecrets,
  secretValuesFromEnvironment,
  type EvidenceBundle,
} from '@agent-zero/shared';

import type { DashboardTask } from './types.js';

export type { ApprovalDecision, ControlPlaneTaskStatus, TaskApproval } from './types.js';

/** Durable, deliberately narrow task history. Review input and checkout paths are never stored. */
export interface StoredTask extends DashboardTask {
  evidence?: EvidenceBundle;
}

export interface TaskStore {
  get(id: string): Promise<StoredTask | undefined>;
  list(): Promise<StoredTask[]>;
  save(task: StoredTask): Promise<void>;
  clear?(): Promise<void>;
}

/** Minimal surface shared by Nitro storage, Redis/KV drivers, and deterministic test stores. */
export interface KeyValueStorage {
  getItem(key: string): Promise<unknown>;
  setItem(key: string, value: unknown): Promise<void>;
  getKeys(base?: string): Promise<string[]>;
  removeItem?(key: string): Promise<void>;
}

const TASK_PREFIX = 'tasks:';

/** Persists redacted records through Nitro's provider-neutral storage layer. */
export class PersistentTaskStore implements TaskStore {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly secrets: readonly string[] = secretValuesFromEnvironment(),
  ) {}

  async get(id: string): Promise<StoredTask | undefined> {
    const value = await this.storage.getItem(`${TASK_PREFIX}${id}`);
    return isStoredTask(value) ? value : undefined;
  }

  async list(): Promise<StoredTask[]> {
    const keys = await this.storage.getKeys(TASK_PREFIX);
    const records = await Promise.all(keys.map((key) => this.storage.getItem(key)));
    return records
      .filter(isStoredTask)
      .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async save(task: StoredTask): Promise<void> {
    await this.storage.setItem(`${TASK_PREFIX}${task.id}`, sanitizeTask(task, this.secrets));
  }
}

/** In-memory adapter used by embedded callers and tests; production Nitro routes use storage. */
export class MemoryTaskStore implements TaskStore {
  readonly records = new Map<string, StoredTask>();

  async get(id: string): Promise<StoredTask | undefined> {
    const value = this.records.get(id);
    return value ? structuredClone(value) : undefined;
  }

  async list(): Promise<StoredTask[]> {
    return Array.from(this.records.values(), (task) => structuredClone(task)).toSorted(
      (left, right) => right.createdAt.localeCompare(left.createdAt),
    );
  }

  async save(task: StoredTask): Promise<void> {
    this.records.set(task.id, sanitizeTask(task, secretValuesFromEnvironment()));
  }

  async clear(): Promise<void> {
    this.records.clear();
  }
}

export interface SchedulerOptions {
  maxConcurrent: number;
  maxQueued: number;
  maxConcurrentPerRepository: number;
}

export interface SchedulerSnapshot {
  active: number;
  queued: number;
  capacity: number;
}

export class TaskQueueQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskQueueQuotaError';
  }
}

interface QueuedJob {
  repository: string;
  start: () => Promise<void>;
}

/** Bounded FIFO scheduler with a separate per-repository fairness quota. */
export class TaskScheduler {
  private active = 0;
  private readonly activeByRepository = new Map<string, number>();
  private readonly queue: QueuedJob[] = [];

  constructor(private readonly options: SchedulerOptions) {
    assertPositiveInteger(options.maxConcurrent, 'maxConcurrent');
    assertPositiveInteger(options.maxQueued, 'maxQueued');
    assertPositiveInteger(options.maxConcurrentPerRepository, 'maxConcurrentPerRepository');
  }

  schedule<T>(repository: string, run: () => Promise<T>): Promise<T> {
    if (this.queue.length >= this.options.maxQueued && !this.hasImmediateCapacity(repository))
      throw new TaskQueueQuotaError('Task queue capacity is exhausted');
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        repository,
        start: async () => {
          try {
            resolve(await run());
          } catch (error) {
            reject(error);
          }
        },
      });
      this.drain();
    });
  }

  snapshot(): SchedulerSnapshot {
    return {
      active: this.active,
      queued: this.queue.length,
      capacity: this.options.maxConcurrent,
    };
  }

  /**
   * Whether a new job for this repository would start synchronously in {@link drain}.
   *
   * Only jobs without immediate capacity occupy the queue, so `maxQueued` must bound exactly those:
   * a job blocked by its repository quota counts against the queue even while global capacity is
   * free, otherwise per-repository-blocked submissions could grow the queue without limit.
   */
  private hasImmediateCapacity(repository: string): boolean {
    return (
      this.active < this.options.maxConcurrent &&
      (this.activeByRepository.get(repository) ?? 0) < this.options.maxConcurrentPerRepository
    );
  }

  private drain(): void {
    while (this.active < this.options.maxConcurrent) {
      const index = this.queue.findIndex(
        (job) =>
          (this.activeByRepository.get(job.repository) ?? 0) <
          this.options.maxConcurrentPerRepository,
      );
      if (index < 0) return;
      const [job] = this.queue.splice(index, 1);
      if (!job) return;
      this.active += 1;
      this.activeByRepository.set(
        job.repository,
        (this.activeByRepository.get(job.repository) ?? 0) + 1,
      );
      void job.start().finally(() => {
        this.active -= 1;
        const repositoryActive = (this.activeByRepository.get(job.repository) ?? 1) - 1;
        if (repositoryActive === 0) this.activeByRepository.delete(job.repository);
        else this.activeByRepository.set(job.repository, repositoryActive);
        this.drain();
      });
    }
  }
}

function sanitizeTask(task: StoredTask, secrets: readonly string[]): StoredTask {
  const serialized = JSON.stringify(task, (_key, value: unknown) =>
    typeof value === 'string' ? redactSecrets(value, secrets) : value,
  );
  const value: unknown = JSON.parse(serialized);
  if (!isStoredTask(value)) throw new Error('Refusing to persist an invalid task record');
  return value;
}

function isStoredTask(value: unknown): value is StoredTask {
  if (!isRecord(value)) return false;
  const task = value;
  return (
    typeof task.id === 'string' &&
    typeof task.repository === 'string' &&
    typeof task.status === 'string' &&
    typeof task.createdAt === 'string' &&
    typeof task.updatedAt === 'string' &&
    Array.isArray(task.events)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
}
