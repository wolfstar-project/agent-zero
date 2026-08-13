// `openapi(meta)` builds the same metadata plugin `.route()` sugars over (see
// `@orpc/openapi/extensions/route`), but as a real import a bundler can't tree-shake away. The
// prototype-patching `.route()` extension depends on a bare side-effect import surviving whatever
// bundler serves this router — Nitro's production build silently drops it, so procedures would
// build fine but lose all `/api/v1/**` routing at runtime. `.meta(openapi(...))` has no such risk.
import { openapi } from '@orpc/openapi';
import { ORPCError, os } from '@orpc/server';
import { z } from 'zod';

import type { Principal } from '../access.js';
import type { TaskStore } from '../control-plane.js';
import {
  approvalInput,
  createTask,
  decideApproval,
  getStoredTask,
  health,
  listTasks,
  taskInput,
} from '../operations.js';
import { requestLoggerStorage } from './logging.js';

export interface RpcContext {
  store: TaskStore;
  /** Authenticated caller resolved by the transport; absent for anonymous requests. */
  principal?: Principal;
  /** Whether `tasks.create` may target this repository. Fails closed when absent. */
  mayTargetRepository?: (repository: string) => boolean;
}

const procedure = os.$context<RpcContext>();

/** Mutations require an authenticated principal; reads stay open for the dashboard. */
const authenticated = procedure.use(({ context, next }) => {
  const principal = context.principal;
  if (!principal) throw new ORPCError('UNAUTHORIZED', { message: 'Authentication required' });
  // `getStore()` reads the AsyncLocalStorage directly rather than the throwing `useLogger()`
  // helper: it is `undefined` outside an active request, which is exactly the case for tests that
  // call procedures through `createRouterClient` without the transport's `EvlogHandlerPlugin`.
  requestLoggerStorage?.getStore()?.set({ principal: principal.name });
  return next({ context: { principal } });
});

export const rpcRouter = {
  health: procedure
    .meta(
      openapi({
        method: 'GET',
        path: '/health',
        tags: ['System'],
        summary: 'Report control-plane health',
      }),
    )
    .handler(() => health()),
  tasks: {
    list: procedure
      .meta(
        openapi({ method: 'GET', path: '/tasks', tags: ['Tasks'], summary: 'List task history' }),
      )
      .handler(({ context }) => listTasks(context.store)),
    get: procedure
      .meta(
        openapi({
          method: 'GET',
          path: '/tasks/{id}',
          tags: ['Tasks'],
          summary: 'Get a task by id',
        }),
      )
      .input(z.object({ id: z.string().min(1) }))
      .handler(({ input, context }) => getStoredTask(input.id, context.store)),
    create: authenticated
      .meta(
        openapi({ method: 'POST', path: '/tasks', tags: ['Tasks'], summary: 'Queue a task run' }),
      )
      .input(taskInput)
      .handler(({ input, context }) => {
        if (!context.mayTargetRepository?.(input.repository))
          throw new ORPCError('FORBIDDEN', {
            message: 'Repository is not allow-listed for task creation',
          });
        if (!context.principal.modes.includes(input.mode))
          throw new ORPCError('FORBIDDEN', {
            message: `Execution mode '${input.mode}' is not granted to this principal`,
          });
        return createTask(input, context.store);
      }),
  },
  approvals: {
    decide: authenticated
      .meta(
        openapi({
          method: 'PATCH',
          path: '/tasks/{taskId}/approval',
          tags: ['Approvals'],
          summary: 'Record a human approval decision',
        }),
      )
      .input(approvalInput)
      .handler(({ input, context }) =>
        decideApproval(
          input.taskId,
          input.decision,
          context.principal.name,
          input.comment,
          context.store,
        ),
      ),
  },
};

export type RpcRouter = typeof rpcRouter;
