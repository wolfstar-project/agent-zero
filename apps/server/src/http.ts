import type { TaskResult } from '@agent-zero/shared';

import { resolveCheckout } from './checkout.js';
import { createTask, getTask, getTaskEvidence, taskInput } from './router.js';

/**
 * Transport shaping for the Nitro route shells in `routes/`.
 *
 * Each function takes primitives and returns either plain data (serialized by Nitro) or a web
 * `Response` carrying an explicit status, so the handlers stay one-line shells and the HTTP
 * contract stays unit-testable without a listener.
 */

export function taskResponse(id: string | undefined): TaskResult | Response {
  const task = id ? getTask(id) : undefined;
  if (!task) return Response.json({ error: `Unknown task: ${id ?? ''}` }, { status: 404 });
  return task;
}

export function evidenceResponse(id: string | undefined): Response {
  const markdown = id ? getTaskEvidence(id) : undefined;
  if (markdown === undefined)
    return Response.json({ error: `Unknown task: ${id ?? ''}` }, { status: 404 });
  return new Response(markdown, {
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
  });
}

export interface CreateTaskOptions {
  /** Supplied by the caller rather than read here, so the authorized root stays explicit. */
  checkoutRoot: string | undefined;
}

/**
 * Validate, authorize, and run one task from an inbound request body.
 *
 * The body is validated with the transport-independent schema before anything executes, and the
 * requested repository is an identifier that must resolve to a canonical directory inside the
 * managed checkout root. Without a configured root the route fails closed, so the HTTP layer never
 * chooses a mode or a checkout on its own.
 */
export async function createTaskResponse(
  request: { json(): Promise<unknown> },
  options: CreateTaskOptions,
): Promise<TaskResult | Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }
  const parsed = taskInput.safeParse(body);
  if (!parsed.success)
    return Response.json(
      { error: 'Invalid task input', issues: parsed.error.issues },
      { status: 400 },
    );
  const checkout = await resolveCheckout(parsed.data.repository, options.checkoutRoot);
  if (!checkout.authorized) return Response.json({ error: checkout.reason }, { status: 403 });
  return await createTask({ ...parsed.data, repository: checkout.path });
}
