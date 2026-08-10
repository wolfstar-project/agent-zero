import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { KeyValueStorage } from './control-plane.js';

/** Keys are namespaced with `:`; anything outside this set cannot address a file. */
const SAFE_KEY = /^[A-Za-z0-9:_-]+$/u;
const SUFFIX = '.json';

/**
 * Filesystem-backed storage for the default single-node deployment.
 *
 * Keys are validated rather than escaped: a rejected key is a bug in the caller, and silently
 * rewriting one would let two distinct records collide on a single file. Redis, KV, and Nitro
 * storage drivers satisfy the same {@link KeyValueStorage} contract without touching this class.
 */
export class FileKeyValueStorage implements KeyValueStorage {
  constructor(private readonly directory: string) {}

  async getItem(key: string): Promise<unknown> {
    const path = this.pathFor(key);
    try {
      return JSON.parse(await readFile(path, 'utf8'));
    } catch {
      // A missing or unreadable record is absence, not a transport failure.
      return null;
    }
  }

  async setItem(key: string, value: unknown): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    await writeFile(this.pathFor(key), JSON.stringify(value), 'utf8');
  }

  async getKeys(base = ''): Promise<string[]> {
    let entries: string[];
    try {
      entries = await readdir(this.directory);
    } catch {
      return [];
    }
    return entries
      .filter((entry) => entry.endsWith(SUFFIX))
      .map((entry) => decodeKey(entry.slice(0, -SUFFIX.length)))
      .filter((key) => key.startsWith(base));
  }

  async removeItem(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  private pathFor(key: string): string {
    if (!SAFE_KEY.test(key)) throw new Error(`Refusing to address storage with an unsafe key`);
    return join(this.directory, `${encodeKey(key)}${SUFFIX}`);
  }
}

// `:` is not a portable filename character on Windows, so it is the one byte we transliterate.
function encodeKey(key: string): string {
  return key.replaceAll(':', '__');
}

function decodeKey(name: string): string {
  return name.replaceAll('__', ':');
}
