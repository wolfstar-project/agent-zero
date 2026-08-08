import { describe, expect, it } from 'vitest';

import { LocalRunner, splitCommand } from './index.js';

describe('LocalRunner', () => {
  it('splits quoted arguments without invoking a shell', () =>
    expect(splitCommand('pnpm test --filter "agent core"')).toEqual([
      'pnpm',
      'test',
      '--filter',
      'agent core',
    ]));
  it('rejects paths outside the repository', () => {
    const runner = new LocalRunner(process.cwd());
    expect(() => runner.read('../secret')).toThrow('Path escapes repository');
  });
});
