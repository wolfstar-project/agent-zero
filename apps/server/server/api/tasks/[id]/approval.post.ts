import { defineEventHandler, getRouterParam, readBody } from 'h3';
import { useStorage } from 'nitropack/runtime';

import { PersistentTaskStore } from '../../../../src/control-plane.js';
import { approvalInput, decideApproval } from '../../../../src/router.js';

export default defineEventHandler(async (event) => {
  const taskId = getRouterParam(event, 'id');
  const body: unknown = await readBody(event);
  const input = approvalInput.parse({
    ...(typeof body === 'object' && body !== null && !Array.isArray(body) ? body : {}),
    taskId,
  });
  return decideApproval(
    input.taskId,
    input.decision,
    input.actor,
    input.comment,
    new PersistentTaskStore(useStorage('agent-zero')),
  );
});
