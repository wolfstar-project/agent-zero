import { defineClientAuth } from '@onmax/nuxt-better-auth/config';

// Better Auth is mounted in this app's own server (`server/auth.config.ts`), so every request is
// same-origin: no explicit `baseURL` or credentialed CORS is needed.
export default defineClientAuth({});
