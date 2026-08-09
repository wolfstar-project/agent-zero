import { describe, expect, it } from 'vitest';

import {
  assertExecutableCommand,
  discoverChecks,
  packageManagerFromLockfiles,
  resolveChecks,
} from './checks.js';

const packageJson = JSON.stringify({
  scripts: {
    build: 'tsdown',
    lint: 'oxlint src',
    test: 'vitest run',
    typecheck: 'tsc --noEmit',
    postinstall: 'node setup.mjs',
  },
});

describe('packageManagerFromLockfiles', () => {
  it('identifies the pinned manager and defaults to npm', () => {
    expect(packageManagerFromLockfiles(['pnpm-lock.yaml'])).toBe('pnpm');
    expect(packageManagerFromLockfiles(['yarn.lock'])).toBe('yarn');
    expect(packageManagerFromLockfiles(['bun.lock'])).toBe('bun');
    expect(packageManagerFromLockfiles([])).toBe('npm');
  });
});

describe('discoverChecks', () => {
  it('returns the four native checks in lifecycle order', () => {
    expect(discoverChecks({ packageJson, lockfiles: ['pnpm-lock.yaml'] })).toEqual([
      'pnpm run lint',
      'pnpm run typecheck',
      'pnpm run test',
      'pnpm run build',
    ]);
  });

  it('only returns checks the repository actually declares', () => {
    const partial = JSON.stringify({ scripts: { test: 'vitest run' } });
    expect(discoverChecks({ packageJson: partial, lockfiles: ['package-lock.json'] })).toEqual([
      'npm run test',
    ]);
  });

  it('accepts an alternative script name for a kind', () => {
    const alternative = JSON.stringify({ scripts: { 'type-check': 'tsc --noEmit' } });
    expect(discoverChecks({ packageJson: alternative, lockfiles: [] })).toEqual([
      'npm run type-check',
    ]);
  });

  it('discovers nothing rather than guessing for a checkout without scripts', () => {
    expect(discoverChecks({ packageJson: null, lockfiles: ['pnpm-lock.yaml'] })).toEqual([]);
    expect(discoverChecks({ packageJson: '{ not json', lockfiles: [] })).toEqual([]);
    expect(discoverChecks({ packageJson: '{"scripts":{"test":"  "}}', lockfiles: [] })).toEqual([]);
  });
});

describe('resolveChecks', () => {
  it('prefers explicit configuration over discovery', () => {
    expect(resolveChecks(['make verify'], { packageJson, lockfiles: ['pnpm-lock.yaml'] })).toEqual([
      'make verify',
    ]);
  });

  it('falls back to discovery when nothing is configured', () => {
    expect(resolveChecks([], { packageJson, lockfiles: ['pnpm-lock.yaml'] })).toHaveLength(4);
  });
});

describe('assertExecutableCommand', () => {
  it('accepts a plain command with arguments and glob patterns', () => {
    expect(() => assertExecutableCommand('oxlint src/**/*.ts --deny-warnings')).not.toThrow();
  });

  it('rejects chaining, redirection, substitution, and empty commands', () => {
    for (const command of [
      'pnpm test && pnpm build',
      'pnpm test; rm -rf .',
      'pnpm test | tee log',
      'pnpm test > out.txt',
      'echo $(whoami)',
      'echo `whoami`',
    ])
      expect(() => assertExecutableCommand(command)).toThrow('must not contain shell operators');
    expect(() => assertExecutableCommand('   ')).toThrow('must not be empty');
  });
});
