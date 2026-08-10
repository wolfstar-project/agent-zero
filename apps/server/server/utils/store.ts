import { kv } from 'vite-hub/kv';

import {
  PersistentTaskStore,
  type KeyValueStorage,
  type TaskStore,
} from '../../src/control-plane.js';

/** Adapts the ViteHub KV Runtime Helper to the transport-neutral {@link KeyValueStorage} contract. */
class KvKeyValueStorage implements KeyValueStorage {
  async getItem(key: string): Promise<unknown> {
    const [error, value] = await kv.get(key);
    if (error) throw error;
    return value;
  }

  async setItem(key: string, value: unknown): Promise<void> {
    const [error] = await kv.set(key, value);
    if (error) throw error;
  }

  async getKeys(base = ''): Promise<string[]> {
    const [error, keys] = await kv.keys(base);
    if (error) throw error;
    return keys ?? [];
  }

  async removeItem(key: string): Promise<void> {
    const [error] = await kv.del(key);
    if (error) throw error;
  }
}

/**
 * One task store per server process. The KV driver (fs-lite locally; Cloudflare KV,
 * Deno KV, or Upstash when hosted) is selected in `vite.config.ts`, so this module
 * never changes when the deployment target does.
 */
export const taskStore: TaskStore = new PersistentTaskStore(new KvKeyValueStorage());
