import { ORPCError, os } from '@orpc/server';
import { z } from 'zod';

import type { Principal } from './auth.js';
import type { TaskStore } from './control-plane.js';
import {
  approvalInput,
  createTask,
  decideApproval,
  getStoredTask,
  health,
  listTasks,
  taskInput,
} from './router.js';

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
  health: procedure.handler(() => health()),
  tasks: {
    list: procedure.handler(({ context }) => listTasks(context.store)),
    get: procedure
      .input(z.object({ id: z.string().min(1) }))
      .handler(({ input, context }) => getStoredTask(input.id, context.store)),
    create: authenticated.input(taskInput).handler(({ input, context }) => {
      if (!context.mayTargetRepository?.(input.repository))
        throw new ORPCError('FORBIDDEN', {
          message: 'Repository is not allow-listed for task creation',
        });
      return createTask(input, context.store);
    }),
  },
  approvals: {
    decide: authenticated
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
