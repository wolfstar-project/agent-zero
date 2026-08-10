import { defineConfig } from 'nitro';

// Routes, middleware, and utilities live under server/; src/ stays the
// transport-neutral library surface (router, store contracts, schedulers).
export default defineConfig({
  serverDir: './server',
});
