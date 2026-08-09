import type { CheckResult, RunnerDescription } from '@agent-zero/shared';

import { RepositoryBoundary, type BoundaryOptions } from './boundary.js';

/** Container engines the isolated runner knows how to drive. */
export type ContainerEngine = 'docker' | 'podman';

export interface ContainerOptions extends BoundaryOptions {
  engine: ContainerEngine;
  image: string;
  /** Mount point of the checkout inside the container. */
  workdir: string;
  cpus?: string;
  memory?: string;
  /** Pre-provisioned network used for the `restricted` egress policy. */
  networkName?: string;
  /** Container user, for example `1000:1000`, so writes keep host ownership. */
  user?: string;
}

/** Network name used for `restricted` egress when the deployment does not name one. */
export const DEFAULT_RESTRICTED_NETWORK = 'agent-zero';

/**
 * Runs repository commands inside an ephemeral container.
 *
 * This is the production boundary. Repository-supplied commands are the untrusted part of a run, so
 * they execute in a container that is removed afterwards, drops all capabilities, cannot gain new
 * privileges, and receives the configured egress policy. No environment variables are forwarded, so
 * host credentials are not reachable from a check command.
 *
 * The checkout is bind-mounted, and file inspection still happens through the validated boundary in
 * the host process. Isolation is applied where arbitrary repository code runs.
 */
export class ContainerRunner extends RepositoryBoundary {
  private readonly container: ContainerOptions;

  constructor(root: string, options: ContainerOptions) {
    super(root, options);
    this.container = options;
  }

  describe(): RunnerDescription {
    return {
      kind: 'container',
      isolated: true,
      writable: this.options.writable,
      network: this.options.network,
    };
  }

  async check(command: string, timeoutMs: number): Promise<CheckResult> {
    const [program, args] = this.toArgv(command);
    const started = Date.now();
    const outcome = await this.process(
      this.container.engine,
      [...this.engineArguments(), this.container.image, program, ...args],
      { cwd: this.root, timeoutMs, maxOutputBytes: this.maxOutputBytes },
    );
    return this.toCheckResult(command, outcome, Date.now() - started);
  }

  /** The engine arguments that make a run ephemeral, bounded, and isolated. */
  engineArguments(): string[] {
    const { workdir } = this.container;
    const args = [
      'run',
      '--rm',
      '--init',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges',
      '--network',
      this.networkArgument(),
      '--workdir',
      workdir,
      '--volume',
      `${this.root}:${workdir}${this.options.writable ? '' : ':ro'}`,
    ];
    if (this.container.user) args.push('--user', this.container.user);
    if (this.container.cpus) args.push('--cpus', this.container.cpus);
    if (this.container.memory) args.push('--memory', this.container.memory);
    return args;
  }

  private networkArgument(): string {
    if (this.options.network === 'none') return 'none';
    if (this.options.network === 'full') return 'bridge';
    return this.container.networkName ?? DEFAULT_RESTRICTED_NETWORK;
  }
}
