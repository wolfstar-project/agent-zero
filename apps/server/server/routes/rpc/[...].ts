import { RPCHandler } from '@orpc/server/fetch';
import { defineEventHandler, toWebRequest } from 'h3';
import { useStorage } from 'nitropack/runtime';

import { PersistentTaskStore } from '../../../src/control-plane.js';
import { rpcRouter } from '../../../src/rpc.js';

const handler = new RPCHandler(rpcRouter);

export default defineEventHandler(async (event): Promise<Response> => {
  const store = new PersistentTaskStore(useStorage('agent-zero'));
  const { response } = await handler.handle(toWebRequest(event), {
    prefix: '/rpc',
    context: { store },
  });
  return response ?? new Response('Not found', { status: 404 });
});
