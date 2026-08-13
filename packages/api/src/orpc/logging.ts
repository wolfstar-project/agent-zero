import type { AsyncLocalStorage } from 'node:async_hooks';

import { createLoggerStorage } from '@orpc/evlog/node';
import type { RequestLogger } from 'evlog';

/**
 * One AsyncLocalStorage-backed request logger, shared by every transport that wraps `rpcRouter`.
 *
 * Handed to `EvlogHandlerPlugin` by each transport in `apps/dashboard/server/`. Procedures (see
 * the `authenticated` middleware in `./router.ts`) read `requestLoggerStorage.getStore()` rather
 * than the throwing `useLogger()` helper, so they stay `undefined`-safe outside an active
 * request — for example the `createRouterClient` tests in `router.test.ts`, which exercise
 * procedures without the plugin.
 *
 * Explicitly typed: without an annotation, tsdown's declaration bundler cannot portably name the
 * inferred type across the `evlog` package boundary.
 */
export const requestLoggerStorage: AsyncLocalStorage<RequestLogger> | undefined =
  createLoggerStorage().storage;
