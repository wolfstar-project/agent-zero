import { mkdir, mkdtemp, realpath, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { resolveCheckout } from './checkout.js';

let root: string;

beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'agent-zero-server-checkout-')));
  await mkdir(join(root, 'repo'));
});

describe('resolveCheckout', () => {
  it('fails closed when no checkout root is configured', async () => {
    const outcome = await resolveCheckout('repo', undefined);
    expect(outcome.authorized).toBe(false);
  });

  it('resolves an identifier to its canonical checkout inside the root', async () => {
    const outcome = await resolveCheckout('repo', root);
    expect(outcome).toEqual({ authorized: true, path: join(root, 'repo') });
  });

  it('rejects absolute paths', async () => {
    const outcome = await resolveCheckout(join(root, 'repo'), root);
    expect(outcome.authorized).toBe(false);
  });

  it('rejects traversal outside the root', async () => {
    const outcome = await resolveCheckout(join('..', 'escape'), root);
    expect(outcome.authorized).toBe(false);
  });

  it('rejects the root itself', async () => {
    const outcome = await resolveCheckout('.', root);
    expect(outcome.authorized).toBe(false);
  });

  it('rejects an identifier that does not exist under the root', async () => {
    const outcome = await resolveCheckout('missing', root);
    expect(outcome.authorized).toBe(false);
  });

  it('rejects a symlink that escapes the root', async () => {
    await symlink(tmpdir(), join(root, 'sneaky'));
    const outcome = await resolveCheckout('sneaky', root);
    expect(outcome.authorized).toBe(false);
  });

  it('fails closed when the configured root does not exist', async () => {
    const outcome = await resolveCheckout('repo', join(root, 'missing-root'));
    expect(outcome.authorized).toBe(false);
  });

  it('resolves nested identifiers that stay inside the root', async () => {
    await mkdir(join(root, 'repo', 'nested'));
    const outcome = await resolveCheckout(join('repo', 'nested'), root);
    expect(outcome).toEqual({ authorized: true, path: join(root, 'repo', 'nested') });
  });
});
