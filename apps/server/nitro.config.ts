import { defineConfig } from 'nitro/config';

/**
 * File-based routing is opt-in for this Nitro release (`serverDir` defaults to `false`), so the
 * scan directory is enabled explicitly: every handler under `server/routes/` is a thin transport
 * shell over the transport-independent task API in `src/router.ts`. Without this option the built
 * server registers no routes at all.
 */
export default defineConfig({
  compatibilityDate: '2026-05-22',
  serverDir: true,
});
