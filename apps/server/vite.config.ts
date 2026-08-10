import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';
import { vitehub } from 'vite-hub';

import { portFromEnvironment } from './src/port.js';

// ViteHub registers before Nitro so its integrations generate the KV runtime
// bindings that the Nitro host serves (client/framework plugins → vitehub → nitro).
export default defineConfig({
  plugins: [vitehub({ preset: 'node' }), nitro()],
  // 3000 belongs to the Nuxt dashboard; keep the validated PORT contract for dev.
  server: { port: portFromEnvironment() },
  // Local single-node default. Cloudflare KV, Deno KV, or Upstash drop in as
  // drivers here without touching application code.
  kv: { driver: 'fs-lite', base: '.data/agent-zero' },
});
