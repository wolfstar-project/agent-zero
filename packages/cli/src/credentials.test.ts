import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  credentialsPath,
  forgetCredential,
  normalizeOrigin,
  readCredentials,
  saveCredential,
} from './credentials.js';

const INVALID_URL_ERROR = /not a valid deployment url/i;
const PROTOCOL_ERROR = /must be http or https/i;
const MISSING_FILE_ERROR = /ENOENT/;

const CLOUD = 'https://cloud.example.test';
const SELF_HOSTED = 'https://zero.internal.test';

let directory: string;
let path: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'agent-zero-credentials-'));
  path = join(directory, 'credentials.json');
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('credentialsPath', () => {
  it('follows XDG_CONFIG_HOME when the operator set one', () => {
    expect(credentialsPath({ XDG_CONFIG_HOME: '/xdg' }, '/home/op')).toBe(
      '/xdg/agent-zero/credentials.json',
    );
  });

  it('falls back to ~/.config, never to the working directory', () => {
    expect(credentialsPath({}, '/home/op')).toBe('/home/op/.config/agent-zero/credentials.json');
    expect(credentialsPath({ XDG_CONFIG_HOME: '  ' }, '/home/op')).toBe(
      '/home/op/.config/agent-zero/credentials.json',
    );
  });
});

describe('normalizeOrigin', () => {
  it('reduces a deployment URL to its origin so one host cannot occupy two entries', () => {
    expect(normalizeOrigin('https://cloud.example.test/')).toBe(CLOUD);
    expect(normalizeOrigin('https://cloud.example.test/device?user_code=x')).toBe(CLOUD);
    expect(normalizeOrigin('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('refuses anything that is not an absolute http(s) URL', () => {
    expect(() => normalizeOrigin('cloud.example.test')).toThrow(INVALID_URL_ERROR);
    expect(() => normalizeOrigin('file:///etc/passwd')).toThrow(PROTOCOL_ERROR);
  });
});

describe('readCredentials', () => {
  it('treats an absent file as no stored sessions', async () => {
    await expect(readCredentials(path)).resolves.toEqual({});
  });

  it('treats a malformed or wrongly shaped file as empty rather than failing the command', async () => {
    await writeFile(path, 'not json', 'utf8');
    await expect(readCredentials(path)).resolves.toEqual({});

    await writeFile(path, '["array"]', 'utf8');
    await expect(readCredentials(path)).resolves.toEqual({});
  });

  it('drops entries missing a token or an expiry instead of returning half a credential', async () => {
    await writeFile(
      path,
      JSON.stringify({
        [CLOUD]: { accessToken: 'tok', expiresAt: '2026-01-01T00:00:00.000Z' },
        [SELF_HOSTED]: { accessToken: 'tok' },
      }),
      'utf8',
    );

    await expect(readCredentials(path)).resolves.toEqual({
      [CLOUD]: { accessToken: 'tok', expiresAt: '2026-01-01T00:00:00.000Z' },
    });
  });
});

describe('saveCredential', () => {
  it('keeps a cloud-managed and a self-hosted session side by side', async () => {
    await saveCredential(CLOUD, { accessToken: 'cloud', expiresAt: 'later' }, path);
    await saveCredential(SELF_HOSTED, { accessToken: 'self', expiresAt: 'later' }, path);

    await expect(readCredentials(path)).resolves.toEqual({
      [CLOUD]: { accessToken: 'cloud', expiresAt: 'later' },
      [SELF_HOSTED]: { accessToken: 'self', expiresAt: 'later' },
    });
  });

  it('writes the token file readable by its owner alone', async () => {
    await saveCredential(CLOUD, { accessToken: 'cloud', expiresAt: 'later' }, path);

    // Masking to the permission bits: the file type bits are irrelevant and platform-specific.
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });

  it('tightens a file an earlier laxer umask created', async () => {
    await writeFile(path, '{}', { encoding: 'utf8', mode: 0o644 });
    await saveCredential(CLOUD, { accessToken: 'cloud', expiresAt: 'later' }, path);

    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });
});

describe('forgetCredential', () => {
  it('forgets one deployment and leaves the others signed in', async () => {
    await saveCredential(CLOUD, { accessToken: 'cloud', expiresAt: 'later' }, path);
    await saveCredential(SELF_HOSTED, { accessToken: 'self', expiresAt: 'later' }, path);

    await expect(forgetCredential(CLOUD, path)).resolves.toBe(true);
    await expect(readCredentials(path)).resolves.toEqual({
      [SELF_HOSTED]: { accessToken: 'self', expiresAt: 'later' },
    });
  });

  it('removes the file once the last session is gone, leaving no empty husk behind', async () => {
    await saveCredential(CLOUD, { accessToken: 'cloud', expiresAt: 'later' }, path);

    await expect(forgetCredential(undefined, path)).resolves.toBe(true);
    await expect(readFile(path, 'utf8')).rejects.toThrow(MISSING_FILE_ERROR);
  });

  it('reports that nothing was forgotten rather than claiming a sign-out that did not happen', async () => {
    await expect(forgetCredential(CLOUD, path)).resolves.toBe(false);

    await saveCredential(SELF_HOSTED, { accessToken: 'self', expiresAt: 'later' }, path);
    await expect(forgetCredential(CLOUD, path)).resolves.toBe(false);
  });
});
