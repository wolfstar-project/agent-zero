import { os } from '@orpc/server';
import { z } from 'zod';

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
}

const procedure = os.$context<RpcContext>();

export const rpcRouter = {
  health: procedure.handler(() => health()),
  tasks: {
    list: procedure.handler(({ context }) => listTasks(context.store)),
    get: procedure
      .input(z.object({ id: z.string().min(1) }))
      .handler(({ input, context }) => getStoredTask(input.id, context.store)),
    create: procedure
      .input(taskInput)
      .handler(({ input, context }) => createTask(input, context.store)),
  },
  approvals: {
    decide: procedure
      .input(approvalInput)
      .handler(({ input, context }) =>
        decideApproval(input.taskId, input.decision, input.actor, input.comment, context.store),
      ),
  },
};

export type RpcRouter = typeof rpcRouter;
