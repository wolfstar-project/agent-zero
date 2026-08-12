import { authOptionsFromEnvironment, createAuthApp } from '@agent-zero/api';
import { defineHandler } from 'nitro';
import type { EventHandlerWithFetch } from 'nitro/h3';

/**
 * Better Auth, mounted in-process.
 *
 * This is the only route in `apps/server` that holds a database credential: `authOptionsFromEnvironment`
 * resolves `AUTH_DATABASE_URL` and `BETTER_AUTH_SECRET`, and `createAuthApp` opens the connection pool
 * behind them. Every other route in this app reaches the database only through the `KeyValueStorage`
 * contract in `server/utils/store.ts`.
 */
const authApp = createAuthApp(authOptionsFromEnvironment());

const route: EventHandlerWithFetch = defineHandler((event) => authApp.fetch(event.req));

export default route;
