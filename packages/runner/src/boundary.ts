import { access, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

import {
  isRepositoryRelativePath,
  redactSecrets,
  secretValuesFromEnvironment,
  truncateTail,
  type CheckResult,
  type NetworkPolicy,
  type RunnerDescription,
} from '@agent-zero/shared';

import {
  execFileProcessRunner,
  splitCommand,
  type ProcessOutcome,
  type ProcessRunner,
} from './process.js';

/** Raised when a path would address something outside the validated checkout. */
export class PathEscapeError extends Error {
  constructor(path: string, reason: string) {
    super(`Path escapes repository (${reason}): ${path}`);
    this.name = 'PathEscapeError';
  }
}

/** Raised when a write is attempted through a runner that policy created read-only. */
export class RunnerWriteDeniedError extends Error {
  constructor(path: string, reason: string) {
    super(`Write denied for ${path}: ${reason}`);
    this.name = 'RunnerWriteDeniedError';
  }
}

/** Raised when a command could not be executed faithfully as an argv array. */
export class CommandRejectedError extends Error {
  constructor(command: string, reason: string) {
    super(`Command rejected (${reason}): ${command}`);
    this.name = 'CommandRejectedError';
  }
}

/**
 * The single boundary between the runtime and a target checkout.
 *
 * Everything that reads a file, writes a file, or executes a command passes through an
 * implementation of this interface. No other package may touch the checkout.
 */
export interface Runner {
  /** What this boundary is actually allowed to do, recorded in run evidence. */
  describe(): RunnerDescription;
  /** A bounded summary of the checkout for model context. */
  context(): Promise<string>;
  read(path: string): Promise<string>;
  exists(path: string): Promise<boolean>;
  write(path: string, content: string): Promise<void>;
  check(command: string, timeoutMs: number): Promise<CheckResult>;
  changedFiles(): Promise<string[]>;
}

export interface BoundaryOptions {
  /** When false, every write is refused. This is how `observe` is enforced mechanically. */
  writable: boolean;
  network: NetworkPolicy;
  maxOutputBytes?: number;
  process?: ProcessRunner;
  /** Extra literal values to redact from captured output. Defaults to the process environment. */
  secrets?: readonly string[];
}

const DEFAULT_MAX_OUTPUT_BYTES = 200_000;
const MAX_FILE_LIST = 30_000;
const MAX_DIFF = 100_000;
const GIT_TIMEOUT_MS = 30_000;
const SHELL_OPERATORS = /[;&|<>`$(){}\n\r]/;

/**
 * Shared filesystem and git behavior for every runner.
 *
 * File access is validated with path arithmetic and then re-validated against resolved symlinks, so
 * a link planted inside the checkout cannot be used to read or write outside it. Subclasses decide
 * only how repository commands are executed.
 */
export abstract class RepositoryBoundary implements Runner {
  protected readonly maxOutputBytes: number;
  protected readonly process: ProcessRunner;
  private readonly secrets: readonly string[];
  private resolvedRoot: string | undefined;

  protected constructor(
    protected readonly root: string,
    protected readonly options: BoundaryOptions,
  ) {
    this.maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
    this.process = options.process ?? execFileProcessRunner;
    this.secrets = options.secrets ?? secretValuesFromEnvironment();
  }

  abstract describe(): RunnerDescription;
  abstract check(command: string, timeoutMs: number): Promise<CheckResult>;

  async read(path: string): Promise<string> {
    return readFile(await this.resolveInside(path), 'utf8');
  }

  async exists(path: string): Promise<boolean> {
    try {
      await access(await this.resolveInside(path));
      return true;
    } catch {
      return false;
    }
  }

  async write(path: string, content: string): Promise<void> {
    if (!this.options.writable)
      throw new RunnerWriteDeniedError(path, 'this runner was created read-only');
    const target = await this.resolveInside(path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
  }

  async context(): Promise<string> {
    const files = await this.git(['ls-files']);
    const diff = await this.git(['diff', '--no-ext-diff', '--']);
    return [
      'FILES',
      truncateTail(files.stdout, MAX_FILE_LIST),
      '',
      'DIFF',
      truncateTail(diff.stdout, MAX_DIFF),
    ].join('\n');
  }

  async changedFiles(): Promise<string[]> {
    const status = await this.git(['status', '--porcelain']);
    return status.stdout
      .split('\n')
      .map((line) => line.slice(3).trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        // Renames are reported as `old -> new`; the new path is the one that exists now.
        const arrow = line.indexOf(' -> ');
        return arrow === -1 ? line : line.slice(arrow + 4);
      });
  }

  /** Turn a raw process outcome into bounded, credential-free evidence. */
  protected toCheckResult(
    command: string,
    outcome: ProcessOutcome,
    durationMs: number,
  ): CheckResult {
    return {
      command,
      exitCode: outcome.exitCode,
      stdout: this.clean(outcome.stdout),
      stderr: this.clean(outcome.stderr),
      durationMs,
    };
  }

  /** Parse a configured command into an argv array, refusing anything a shell would be needed for. */
  protected toArgv(command: string): [string, string[]] {
    if (SHELL_OPERATORS.test(command))
      throw new CommandRejectedError(command, 'commands run without a shell');
    const [program, ...args] = splitCommand(command);
    if (!program) throw new CommandRejectedError(command, 'no program to execute');
    return [program, args];
  }

  protected clean(text: string): string {
    return redactSecrets(truncateTail(text, this.maxOutputBytes), this.secrets);
  }

  /**
   * Git inspection runs in the trusting process because its argv is fixed by this package.
   *
   * Repository-supplied commands are the untrusted ones, and those are what an isolated runner
   * moves into a sandbox.
   */
  private async git(args: readonly string[]): Promise<ProcessOutcome> {
    const outcome = await this.process('git', args, {
      cwd: this.root,
      timeoutMs: GIT_TIMEOUT_MS,
      maxOutputBytes: this.maxOutputBytes,
    });
    // A checkout without git history is still inspectable; report the reason instead of failing the
    // whole run.
    if (outcome.exitCode !== 0)
      return { exitCode: outcome.exitCode, stdout: '', stderr: this.clean(outcome.stderr) };
    return outcome;
  }

  /**
   * Resolve a repository-relative path, refusing anything that leaves the checkout.
   *
   * Three independent gates apply: the shared path predicate, path arithmetic against the resolved
   * root, and a realpath check on the closest existing ancestor so that symlinks cannot be used to
   * step outside.
   */
  protected async resolveInside(path: string): Promise<string> {
    if (!isRepositoryRelativePath(path))
      throw new PathEscapeError(path, 'not a repository-relative path');
    const root = await this.rootRealPath();
    const target = resolve(root, path);
    assertInside(root, target, path);
    assertInside(root, await closestRealPath(target), path);
    return target;
  }

  private async rootRealPath(): Promise<string> {
    this.resolvedRoot ??= await realpath(this.root);
    return this.resolvedRoot;
  }
}

function assertInside(root: string, candidate: string, original: string): void {
  const rel = relative(root, candidate);
  if (rel.length > 0 && (isAbsolute(rel) || rel.split(/[/\\]/).includes('..')))
    throw new PathEscapeError(original, 'resolves outside the checkout');
}

/**
 * Resolve the closest existing ancestor of a target, following symlinks.
 *
 * A file that does not exist yet still has a parent directory, and that parent is what determines
 * where a write would actually land.
 */
async function closestRealPath(target: string): Promise<string> {
  let candidate = target;
  for (;;) {
    try {
      return await realpath(candidate);
    } catch {
      const parent = dirname(candidate);
      if (parent === candidate) return candidate;
      candidate = parent;
    }
  }
}
