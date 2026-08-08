import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { promisify } from 'node:util';

import type { CheckResult } from '@agent-zero/shared';

const execFileAsync = promisify(execFile);
export interface Runner {
  context(): Promise<string>;
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  check(command: string, timeoutMs: number): Promise<CheckResult>;
  changedFiles(): Promise<string[]>;
}

export class LocalRunner implements Runner {
  constructor(private readonly root: string) {}
  private safe(path: string): string {
    const target = resolve(this.root, path);
    const rel = relative(resolve(this.root), target);
    if (isAbsolute(rel) || rel.startsWith('..'))
      throw new Error(`Path escapes repository: ${path}`);
    return target;
  }
  async context(): Promise<string> {
    const result = await this.run('git', ['diff', '--no-ext-diff', '--', '.'], 30_000);
    const names = await this.run('git', ['ls-files'], 30_000);
    return `FILES\n${names.stdout.slice(0, 30_000)}\n\nDIFF\n${result.stdout.slice(0, 100_000)}`;
  }
  read(path: string): Promise<string> {
    return readFile(this.safe(path), 'utf8');
  }
  write(path: string, content: string): Promise<void> {
    return writeFile(this.safe(path), content, 'utf8');
  }
  async changedFiles(): Promise<string[]> {
    const result = await this.run('git', ['status', '--porcelain'], 30_000);
    return result.stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => line.slice(3));
  }
  async check(command: string, timeoutMs: number): Promise<CheckResult> {
    const [program, ...args] = splitCommand(command);
    if (!program) throw new Error('Empty check command');
    return this.run(program, args, timeoutMs);
  }
  private async run(program: string, args: string[], timeoutMs: number): Promise<CheckResult> {
    const started = Date.now();
    try {
      const { stdout, stderr } = await execFileAsync(program, args, {
        cwd: this.root,
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
      });
      return {
        command: [program, ...args].join(' '),
        exitCode: 0,
        stdout,
        stderr,
        durationMs: Date.now() - started,
      };
    } catch (error) {
      const failure = isRecord(error) ? error : {};
      return {
        command: [program, ...args].join(' '),
        exitCode: typeof failure.code === 'number' ? failure.code : 1,
        stdout: typeof failure.stdout === 'string' ? failure.stdout : '',
        stderr:
          typeof failure.stderr === 'string'
            ? failure.stderr
            : error instanceof Error
              ? error.message
              : String(error),
        durationMs: Date.now() - started,
      };
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function splitCommand(command: string): string[] {
  const parts = command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
  return parts.map((part) => part.replace(/^(['"])(.*)\1$/, '$2'));
}
