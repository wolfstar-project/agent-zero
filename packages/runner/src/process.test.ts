import { describe, expect, it } from 'vitest';

import { spawnManagedProcess } from './process.js';

/** Read a spawned process's stdout to completion, resolving once it has fully exited. */
async function collect(child: ReturnType<typeof spawnManagedProcess>): Promise<{
  stdout: string;
  exitCode: number | null;
}> {
  const chunks: Buffer[] = [];
  child.stdout?.on('data', (chunk: Buffer) => chunks.push(chunk));
  const exitCode = await new Promise<number | null>((resolve) => {
    child.on('exit', (code) => resolve(code));
  });
  return { stdout: Buffer.concat(chunks).toString('utf8'), exitCode };
}

describe('spawnManagedProcess', () => {
  it('runs without a shell, so untrusted text in an argument can never become shell syntax', async () => {
    const child = spawnManagedProcess(process.execPath, [
      '-e',
      'process.stdout.write(process.argv[1])',
      '$(echo pwned)',
    ]);
    const { stdout, exitCode } = await collect(child);
    // A shell would have expanded this; argv-only execution passes it through literally.
    expect(stdout).toBe('$(echo pwned)');
    expect(exitCode).toBe(0);
  });

  it('hands back a live duplex handle a caller can write to and read from', async () => {
    const child = spawnManagedProcess(process.execPath, [
      '-e',
      'process.stdin.pipe(process.stdout)',
    ]);
    child.stdin?.write('echoed\n');
    child.stdin?.end();
    const { stdout, exitCode } = await collect(child);
    expect(stdout).toBe('echoed\n');
    expect(exitCode).toBe(0);
  });

  it('forwards cwd and env to the child, the same as the bounded command runner', async () => {
    const child = spawnManagedProcess(
      process.execPath,
      ['-e', 'process.stdout.write(process.cwd() + "|" + process.env.PROBE_VALUE)'],
      { cwd: process.cwd(), env: { ...process.env, PROBE_VALUE: 'set-by-caller' } },
    );
    const { stdout } = await collect(child);
    expect(stdout).toBe(`${process.cwd()}|set-by-caller`);
  });

  it('lets a caller-owned AbortSignal terminate a process with no timeout of its own', async () => {
    const controller = new AbortController();
    const child = spawnManagedProcess(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      signal: controller.signal,
    });
    // Node emits an AbortError on 'error' alongside 'exit' when a spawn signal fires; consuming it
    // here is the same obligation the vendor SDK's own SpawnedProcess.on('error', ...) slot exists
    // for, which every real caller of this primitive is expected to fill.
    child.on('error', () => undefined);
    const exited = new Promise<void>((resolve) => child.on('exit', () => resolve()));
    controller.abort();
    await exited;
    expect(child.killed).toBe(true);
  });
});
