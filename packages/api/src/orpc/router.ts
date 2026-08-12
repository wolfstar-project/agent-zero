// Runtime side effect: patches `.route()` onto the oRPC builder so procedures below can declare
// the HTTP method, path, and OpenAPI metadata that `OpenAPIHandler` reads at serve time. The
// RPC transport at `/rpc/**` ignores this metadata entirely and keeps working unchanged.
// oxlint-disable-next-line import/no-unassigned-import -- registers `.route()` via prototype patch
import '@orpc/openapi/extensions/route';
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
  return next({ context: { principal } });
});

export const rpcRouter = {
  health: procedure
    .route({
      method: 'GET',
      path: '/health',
      tags: ['System'],
      summary: 'Report control-plane health',
    })
    .handler(() => health()),
  tasks: {
    list: procedure
      .route({ method: 'GET', path: '/tasks', tags: ['Tasks'], summary: 'List task history' })
      .handler(({ context }) => listTasks(context.store)),
    get: procedure
      .route({ method: 'GET', path: '/tasks/{id}', tags: ['Tasks'], summary: 'Get a task by id' })
      .input(z.object({ id: z.string().min(1) }))
      .handler(({ input, context }) => getStoredTask(input.id, context.store)),
    create: authenticated
      .route({ method: 'POST', path: '/tasks', tags: ['Tasks'], summary: 'Queue a task run' })
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
      .route({
        method: 'PATCH',
        path: '/tasks/{taskId}/approval',
        tags: ['Approvals'],
        summary: 'Record a human approval decision',
      })
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
