import { kv } from 'vite-hub/kv';

import {
  PersistentDeliveryClaimStore,
  PersistentTaskStore,
  type DeliveryClaimStore,
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
 * One shared storage instance per server process. The KV driver (fs-lite locally;
 * Cloudflare KV, Deno KV, or Upstash when hosted) is selected in `vite.config.ts`,
 * so this module never changes when the deployment target does.
 */
const storage: KeyValueStorage = new KvKeyValueStorage();

export const taskStore: TaskStore = new PersistentTaskStore(storage);

/**
 * The one durable delivery-claim store for this deployment, injected as
 * `WebhookOptions.deliveryClaims` by the webhook route (`routes/webhooks/github.post.ts`):
 * because the claims live in the shared KV backend rather than a process-local map, a
 * redelivered issue event observes the recorded outcome across restarts and across server
 * instances instead of starting a duplicate run. The KV facade has no conditional write, so
 * the claim uses the store's splitter fallback, which grants at most one owner among
 * contenders that all saw the key absent; the router's in-memory registry still serializes
 * concurrent deliveries within one process.
 */
export const deliveryClaimStore: DeliveryClaimStore = new PersistentDeliveryClaimStore(storage);
