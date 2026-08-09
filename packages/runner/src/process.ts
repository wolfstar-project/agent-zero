import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { analyzeShellCommand } from '@vite-hub/shell';
import { anyOf, charNotIn, createRegExp, exactly, global, oneOrMore } from 'magic-regexp';

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
 * The only place Agent Zero spawns a process.
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

const commandPart = anyOf(
  oneOrMore(charNotIn(' \t\n\r\f\v"\'')),
  exactly('"').and(charNotIn('"').times.any()).and('"'),
  exactly("'").and(charNotIn("'").times.any()).and("'"),
);
const COMMAND_PARTS = createRegExp(commandPart, [global]);

/**
 * Analyze a configured command with ViteHub Shell before Agent Zero tokenizes or executes it.
 *
 * ViteHub owns shell syntax analysis. Agent Zero deliberately keeps execution argv-based and
 * shell-free, so only syntax ViteHub can parse is accepted here. The repository boundary separately
 * enforces the narrower Agent Zero invariant that verification commands cannot contain shell
 * operators before the argv is executed with `shell: false`.
 */
export async function assertSimpleCommand(command: string): Promise<void> {
  const analysis = await analyzeShellCommand(command, { maxInputBytes: 16_384, timeoutMs: 1_000 });
  if (!analysis.ok)
    throw new CommandRejectedError(command, 'ViteHub Shell could not analyze the command');
}

/**
 * Split an already-analyzed simple command into an argv array.
 *
 * `magic-regexp` is used only for lightweight token extraction after ViteHub Shell has accepted the
 * command syntax; it is not a second shell parser or policy engine.
 */
export function splitCommand(command: string): string[] {
  const parts = command.match(COMMAND_PARTS) ?? [];
  return parts.map(unquote);
}

function unquote(part: string): string {
  const quote = part[0];
  return (quote === '"' || quote === "'") && part.at(-1) === quote ? part.slice(1, -1) : part;
}
