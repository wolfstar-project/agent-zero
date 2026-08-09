import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import {
  anyOf,
  carriageReturn,
  charIn,
  charNotIn,
  createRegExp,
  exactly,
  global,
  linefeed,
  oneOrMore,
} from 'magic-regexp';

const execFileAsync = promisify(execFile);

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
  // A killed process reports a signal instead of a code; report a non-zero code either way so a
  // timeout or an out-of-memory kill can never be mistaken for success.
  const exitCode = typeof failure.code === 'number' ? failure.code : 1;
  return { exitCode: exitCode === 0 ? 1 : exitCode, stdout, stderr };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const commandPart = anyOf(
  oneOrMore(charNotIn(" \t\n\r\f\v\"'")),
  exactly('"').and(charNotIn('"').times.any()).and('"'),
  exactly("'").and(charNotIn("'").times.any()).and("'"),
);
const COMMAND_PARTS = createRegExp(commandPart, [global]);
const SHELL_OPERATORS = createRegExp(anyOf(charIn(';&|<>`$(){}'), linefeed, carriageReturn));

/** True when a configured command would require shell parsing to preserve its meaning. */
export function containsShellOperators(command: string): boolean {
  return SHELL_OPERATORS.test(command);
}

/**
 * Split a configured command into an argv array.
 *
 * Quoted segments are preserved as single arguments. This is deliberately not shell parsing: the
 * result is handed to `execFile`, never to a shell.
 */
export function splitCommand(command: string): string[] {
  const parts = command.match(COMMAND_PARTS) ?? [];
  return parts.map(unquote);
}

function unquote(part: string): string {
  const quote = part[0];
  return (quote === '"' || quote === "'") && part.at(-1) === quote ? part.slice(1, -1) : part;
}
