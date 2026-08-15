import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';

import { analyzeShellCommand } from '@vite-hub/shell';
import { anyOf, charIn, charNotIn, createRegExp, exactly, global, oneOrMore } from 'magic-regexp';

const execFileAsync = promisify(execFile);

/** Raised when a command could not be executed faithfully as an argv array. */
export class CommandRejectedError extends Error {
  constructor(command: string, reason: string) {
    super(`Command rejected (${reason}): ${command}`);
    this.name = 'CommandRejectedError';
  }
}

/** Raw result of one child process, before any policy is applied. */
export interface ProcessOutcome {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ProcessOptions {
  cwd: string;
  timeoutMs: number;
  maxOutputBytes: number;
}

/**
 * Starts a child process with explicit arguments.
 *
 * Injected so that every runner can be tested without touching a real process, a container engine,
 * or the network.
 */
export type ProcessRunner = (
  program: string,
  args: readonly string[],
  options: ProcessOptions,
) => Promise<ProcessOutcome>;

/**
 * The bounded-command half of the only place Agent Zero spawns a process; {@link spawnManagedProcess}
 * is the other half, for a caller that needs a live process instead of one buffered result.
 *
 * There is no shell: the program and its arguments are passed as an argv array, so untrusted text
 * can never become shell syntax. Output is bounded and a timeout always applies.
 */
export const execFileProcessRunner: ProcessRunner = async (program, args, options) => {
  try {
    const { stdout, stderr } = await execFileAsync(program, [...args], {
      cwd: options.cwd,
      timeout: options.timeoutMs,
      maxBuffer: options.maxOutputBytes,
      shell: false,
      windowsHide: true,
    });
    return { exitCode: 0, stdout, stderr };
  } catch (error) {
    return outcomeFromFailure(error);
  }
};

export interface ManagedSpawnOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
}

/**
 * The streaming half of the only place Agent Zero spawns a process: a live, long-running child a
 * caller talks to over `stdin`/`stdout` rather than a single buffered result.
 *
 * This exists for adapters that must hand a real process handle to code Agent Zero does not
 * control — a CLI-backed model transport's vendor SDK, for one, which drives the child itself over
 * a duplex stream and cannot be satisfied by a request/response command. `execFileProcessRunner`
 * stays the right primitive for everything that only needs a command's finished output.
 *
 * There is no shell here either: the program and its arguments are passed as an argv array, so
 * untrusted text can never become shell syntax. Unlike `execFileProcessRunner`, this applies no
 * timeout or output limit of its own — a live process has no fixed end, so bounding its lifetime
 * and its output is the caller's responsibility once it holds the handle.
 */
export function spawnManagedProcess(
  program: string,
  args: readonly string[],
  options: ManagedSpawnOptions = {},
): ChildProcess {
  return spawn(program, [...args], {
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    ...(options.env === undefined ? {} : { env: options.env }),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    shell: false,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function outcomeFromFailure(error: unknown): ProcessOutcome {
  const failure = isRecord(error) ? error : {};
  const stdout = typeof failure.stdout === 'string' ? failure.stdout : '';
  const stderr =
    typeof failure.stderr === 'string' && failure.stderr.length > 0
      ? failure.stderr
      : error instanceof Error
        ? error.message
        : String(error);
  const exitCode = typeof failure.code === 'number' ? failure.code : 1;
  return { exitCode: exitCode === 0 ? 1 : exitCode, stdout, stderr };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const SHELL_OPERATORS = createRegExp(charIn(';&|<>`$(){}\n\r'));
const commandPart = anyOf(
  oneOrMore(charNotIn(' \t\n\r\f\v"\'')),
  exactly('"').and(charNotIn('"').times.any()).and('"'),
  exactly("'").and(charNotIn("'").times.any()).and("'"),
);
const COMMAND_PARTS = createRegExp(commandPart, [global]);

/**
 * Convert a repository-provided verification command into the argv that a runner may execute.
 *
 * This is the single command preflight path for every runner. ViteHub Shell parses the command and
 * rejects malformed shell syntax; Agent Zero then applies its deliberately narrower argv-only
 * policy and refuses shell operators because execution always uses `shell: false`.
 */
export async function commandArgv(command: string): Promise<[string, string[]]> {
  if (SHELL_OPERATORS.test(command))
    throw new CommandRejectedError(command, 'commands run without a shell');

  const analysis = await analyzeShellCommand(command, { maxInputBytes: 16_384, timeoutMs: 1_000 });
  if (!analysis.ok)
    throw new CommandRejectedError(command, 'ViteHub Shell could not analyze the command');

  const [program, ...args] = splitCommand(command);
  if (!program) throw new CommandRejectedError(command, 'no program to execute');
  return [program, args];
}

/** Parse command syntax with ViteHub without converting it to argv. */
export async function assertSimpleCommand(command: string): Promise<void> {
  await commandArgv(command);
}

/**
 * Tokenize a command only after ViteHub Shell and Agent Zero policy have accepted its syntax.
 *
 * `magic-regexp` handles the small argv extraction surface; it is not used as a second shell parser.
 */
export function splitCommand(command: string): string[] {
  const parts = command.match(COMMAND_PARTS) ?? [];
  return parts.map(unquote);
}

function unquote(part: string): string {
  const quote = part[0];
  return (quote === '"' || quote === "'") && part.at(-1) === quote ? part.slice(1, -1) : part;
}
