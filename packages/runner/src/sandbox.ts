import { randomUUID } from 'node:crypto';

import type { NetworkPolicy, RunMode } from '@agent-zero/shared';

import type { Runner } from './boundary.js';

/** Public, credential-free request passed to every hosted sandbox adapter. */
export interface SandboxRequest {
  taskId: string;
  repository: string;
  mode: RunMode;
  writable: boolean;
  network: NetworkPolicy;
  leaseMs: number;
}

/** A provisioned execution boundary. Provider credentials stay captured by the adapter instance. */
export interface ProvisionedSandbox {
  externalId: string;
  runner: Runner;
}

/** Provider-neutral hosted sandbox lifecycle, implemented inside the runner package only. */
export interface SandboxProvider {
  readonly kind: 'vitehub' | 'cloudflare' | 'vercel' | 'custom';
  provision(request: Readonly<SandboxRequest>): Promise<ProvisionedSandbox>;
  stop(externalId: string): Promise<void>;
}

export interface SandboxLease {
  id: string;
  taskId: string;
  repository: string;
  provider: SandboxProvider['kind'];
  externalId: string;
  acquiredAt: string;
  expiresAt: string;
  runner: Runner;
}

export interface RunnerPoolOptions {
  maxActive: number;
  maxActivePerRepository: number;
  maxLeaseMs: number;
  now?: () => number;
}

export interface RunnerPoolSnapshot {
  active: number;
  capacity: number;
  expiring: number;
  leases: Array<Omit<SandboxLease, 'runner'>>;
}

/** Raised before provisioning when a pool quota would be exceeded. */
export class RunnerPoolQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RunnerPoolQuotaError';
  }
}

/**
 * Owns hosted runner leases and their bounded lifecycle.
 *
 * This class deliberately returns the regular `Runner` contract. The agent cannot observe or call
 * a vendor SDK, and the control plane cannot execute a command through a second path.
 */
export class RunnerPool {
  private readonly leases = new Map<string, SandboxLease>();
  private readonly stopping = new Map<string, Promise<void>>();
  private pendingTotal = 0;
  private readonly pendingByRepository = new Map<string, number>();
  private readonly now: () => number;

  constructor(
    private readonly provider: SandboxProvider,
    private readonly options: RunnerPoolOptions,
  ) {
    assertPositiveInteger(options.maxActive, 'maxActive');
    assertPositiveInteger(options.maxActivePerRepository, 'maxActivePerRepository');
    assertPositiveInteger(options.maxLeaseMs, 'maxLeaseMs');
    this.now = options.now ?? Date.now;
  }

  async acquire(request: SandboxRequest): Promise<SandboxLease> {
    if (!Number.isFinite(request.leaseMs) || request.leaseMs <= 0)
      throw new RunnerPoolQuotaError('Requested lease duration must be a positive number');
    if (request.leaseMs > this.options.maxLeaseMs)
      throw new RunnerPoolQuotaError('Requested lease exceeds the configured maximum');
    if (this.leases.size + this.pendingTotal >= this.options.maxActive)
      throw new RunnerPoolQuotaError('Runner pool capacity is exhausted');
    const repositoryActive =
      [...this.leases.values()].filter((lease) => lease.repository === request.repository).length +
      (this.pendingByRepository.get(request.repository) ?? 0);
    if (repositoryActive >= this.options.maxActivePerRepository)
      throw new RunnerPoolQuotaError('Repository runner quota is exhausted');

    // Reserve capacity before awaiting provisioning so overlapping acquires cannot bypass quotas.
    this.pendingTotal += 1;
    this.pendingByRepository.set(
      request.repository,
      (this.pendingByRepository.get(request.repository) ?? 0) + 1,
    );
    try {
      const provisioned = await this.provider.provision(Object.freeze({ ...request }));
      // Start the lease clock only after provisioning succeeds so slow provisioning cannot
      // consume the usable lease interval and hand back an already-expired lease.
      const started = this.now();
      const lease: SandboxLease = {
        id: `lease_${randomUUID()}`,
        taskId: request.taskId,
        repository: request.repository,
        provider: this.provider.kind,
        externalId: provisioned.externalId,
        acquiredAt: new Date(started).toISOString(),
        expiresAt: new Date(started + request.leaseMs).toISOString(),
        runner: provisioned.runner,
      };
      this.leases.set(lease.id, lease);
      return lease;
    } finally {
      this.pendingTotal -= 1;
      const remaining = (this.pendingByRepository.get(request.repository) ?? 1) - 1;
      if (remaining > 0) this.pendingByRepository.set(request.repository, remaining);
      else this.pendingByRepository.delete(request.repository);
    }
  }

  async release(id: string): Promise<boolean> {
    const lease = this.leases.get(id);
    if (!lease) return false;
    // Keep the lease tracked until the provider stop succeeds so a failed stop can be retried,
    // while sharing one in-flight stop between concurrent release and sweep calls.
    let stop = this.stopping.get(id);
    if (!stop) {
      stop = this.provider.stop(lease.externalId);
      this.stopping.set(id, stop);
    }
    try {
      await stop;
    } finally {
      this.stopping.delete(id);
    }
    this.leases.delete(id);
    return true;
  }

  async sweepExpired(): Promise<number> {
    const expired = [...this.leases.values()].filter(
      (lease) => Date.parse(lease.expiresAt) <= this.now(),
    );
    const results = await Promise.allSettled(expired.map((lease) => this.release(lease.id)));
    return results.filter((result) => result.status === 'fulfilled' && result.value).length;
  }

  snapshot(): RunnerPoolSnapshot {
    const expiringBefore = this.now() + Math.min(15 * 60_000, this.options.maxLeaseMs);
    return {
      active: this.leases.size,
      capacity: this.options.maxActive,
      expiring: [...this.leases.values()].filter(
        (lease) => Date.parse(lease.expiresAt) <= expiringBefore,
      ).length,
      leases: Array.from(this.leases.values(), (lease) => ({
        id: lease.id,
        taskId: lease.taskId,
        repository: lease.repository,
        provider: lease.provider,
        externalId: lease.externalId,
        acquiredAt: lease.acquiredAt,
        expiresAt: lease.expiresAt,
      })),
    };
  }
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
}
