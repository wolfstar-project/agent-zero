// `openapi(meta)` builds the same metadata plugin `.route()` sugars over (see
// `@orpc/openapi/extensions/route`), but as a real import a bundler can't tree-shake away. The
// prototype-patching `.route()` extension depends on a bare side-effect import surviving whatever
// bundler serves this router — Nitro's production build silently drops it, so procedures would
// build fine but lose all `/api/v1/**` routing at runtime. `.meta(openapi(...))` has no such risk.
import { openapi } from '@orpc/openapi';
import { ORPCError, os } from '@orpc/server';
import { z } from 'zod';

import type { Principal } from '../access.js';
import type { AuditActor, AuditRecorder } from '../audit.js';
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
  /**
   * Durable audit trail supplied by the composition root. Optional like the predicate above, but
   * for the opposite reason: an embedded caller that keeps no audit log should still be able to
   * drive the router, so procedures record through `?.` rather than requiring a recorder.
   */
  audit?: AuditRecorder;
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
      .handler(async ({ input, context }) => {
        // Refusals are audited as deliberately as grants: a token repeatedly reaching for a
        // repository or a mode it was never given is the signal a trail exists to preserve.
        const actor = principalActor(context.principal);
        if (!context.mayTargetRepository?.(input.repository)) {
          await context.audit?.record({
            actor,
            action: 'task.create',
            outcome: 'denied',
            metadata: { repository: input.repository, reason: 'repository-not-allow-listed' },
          });
          throw new ORPCError('FORBIDDEN', {
            message: 'Repository is not allow-listed for task creation',
          });
        }
        if (!context.principal.modes.includes(input.mode)) {
          await context.audit?.record({
            actor,
            action: 'task.create',
            outcome: 'denied',
            metadata: {
              repository: input.repository,
              mode: input.mode,
              reason: 'mode-not-granted',
            },
          });
          throw new ORPCError('FORBIDDEN', {
            message: `Execution mode '${input.mode}' is not granted to this principal`,
          });
        }
        const task = await createTask(input, context.store);
        await context.audit?.record({
          actor,
          action: 'task.created',
          outcome: 'success',
          subject: { type: 'task', id: task.id },
          metadata: { repository: input.repository, mode: input.mode },
        });
        return task;
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
      .handler(async ({ input, context }) => {
        // No denial branch to audit here: `decideApproval` refuses an unknown task or one that is
        // not awaiting review by throwing before it touches the record, so nothing happened that
        // a trail would have to explain.
        const task = await decideApproval(
          input.taskId,
          input.decision,
          context.principal.name,
          input.comment,
          context.store,
        );
        await context.audit?.record({
          actor: principalActor(context.principal),
          action: 'approval.decided',
          outcome: 'success',
          subject: { type: 'task', id: input.taskId },
          metadata: { decision: input.decision, repository: task.repository },
        });
        return task;
      }),
  },
};

/** The audited identity of an authenticated caller; never the name the request asked to use. */
function principalActor(principal: Principal): AuditActor {
  return { kind: 'principal', name: principal.name };
}

export type RpcRouter = typeof rpcRouter;
