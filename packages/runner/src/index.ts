import type { NetworkPolicy } from '@agent-zero/shared';

import type { BoundaryOptions, Runner } from './boundary.js';
import { ContainerRunner, type ContainerEngine, type ContainerOptions } from './container.js';
import { LocalRunner } from './local.js';

export {
  CommandRejectedError,
  PathEscapeError,
  RepositoryBoundary,
  RunnerWriteDeniedError,
  type BoundaryOptions,
  type Runner,
} from './boundary.js';
export {
  ContainerRunner,
  DEFAULT_RESTRICTED_NETWORK,
  type ContainerEngine,
  type ContainerOptions,
} from './container.js';
export { LocalRunner } from './local.js';
export {
  execFileProcessRunner,
  splitCommand,
  type ProcessOptions,
  type ProcessOutcome,
  type ProcessRunner,
} from './process.js';

export interface CreateRunnerOptions extends Omit<BoundaryOptions, 'network'> {
  isolation: 'local' | 'container';
  network: NetworkPolicy;
  container?: {
    engine: ContainerEngine;
    image: string;
    workdir: string;
    cpus?: string;
    memory?: string;
    networkName?: string;
    user?: string;
  };
}

/**
 * The policy fields a boundary needs, declared here so the runner does not depend on the
 * configuration package. `AgentZeroConfig` satisfies this structurally.
 */
export interface RunnerPolicyInput {
  permissions: { network: NetworkPolicy };
  runner: {
    isolation: 'local' | 'container';
    engine: ContainerEngine;
    image?: string;
    workdir: string;
    cpus?: string;
    memory?: string;
    network?: string;
    maxOutputBytes: number;
  };
}

/**
 * Translate repository policy into boundary options.
 *
 * Both the CLI and the server go through here, so there is a single answer to "what is this run
 * allowed to do". Write access is passed in explicitly rather than inferred, because it is the
 * caller that knows whether the run mode and the repository both authorized it.
 */
export function runnerOptionsFromPolicy(
  policy: RunnerPolicyInput,
  writable: boolean,
): CreateRunnerOptions {
  const { runner } = policy;
  return {
    isolation: runner.isolation,
    network: policy.permissions.network,
    writable,
    maxOutputBytes: runner.maxOutputBytes,
    ...(runner.isolation === 'container' && runner.image
      ? {
          container: {
            engine: runner.engine,
            image: runner.image,
            workdir: runner.workdir,
            ...(runner.cpus === undefined ? {} : { cpus: runner.cpus }),
            ...(runner.memory === undefined ? {} : { memory: runner.memory }),
            ...(runner.network === undefined ? {} : { networkName: runner.network }),
          },
        }
      : {}),
  };
}

/**
 * Build the execution boundary for a run.
 *
 * Composition roots call this so that the mapping from policy to a concrete boundary lives in one
 * place. Isolation is never approximated: asking for a container without an image fails rather than
 * silently downgrading to host execution.
 */
export function createRunner(root: string, options: CreateRunnerOptions): Runner {
  const { isolation, container, ...boundary } = options;
  if (isolation === 'local') return new LocalRunner(root, boundary);
  if (!container?.image)
    throw new Error('Container isolation requires an image; refusing to run without a sandbox');
  const containerOptions: ContainerOptions = {
    ...boundary,
    engine: container.engine,
    image: container.image,
    workdir: container.workdir,
    ...(container.cpus === undefined ? {} : { cpus: container.cpus }),
    ...(container.memory === undefined ? {} : { memory: container.memory }),
    ...(container.networkName === undefined ? {} : { networkName: container.networkName }),
    ...(container.user === undefined ? {} : { user: container.user }),
  };
  return new ContainerRunner(root, containerOptions);
}
