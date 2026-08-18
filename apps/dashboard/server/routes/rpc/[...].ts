import { accessFromEnvironment, requestLoggerStorage, rpcRouter } from '@agent-zero/api';
import { EvlogHandlerPlugin } from '@orpc/evlog';
import { RPCHandler } from '@orpc/server/fetch';
import { defineEventHandler, toWebRequest } from 'h3';

import { buildRpcContext } from '../../utils/context.js';
import { errors } from '../../utils/errors.js';
import { errorResponse } from '../../utils/respond.js';
import { taskStore } from '../../utils/store.js';

const handler = new RPCHandler(rpcRouter, {
  plugins: [new EvlogHandlerPlugin({ storage: requestLoggerStorage })],
});
// Fails closed: without configured tokens every mutation is rejected while reads stay open.
const access = accessFromEnvironment();

/**
 * Typed oRPC surface under `/rpc/**`.
 *
 * The transport only validates, authenticates, delegates, and serialises. It holds no runner and
 * no checkout, so an HTTP client cannot reach a repository except through the procedures in
 * {@link rpcRouter}, which run behind the runner boundary. Same-origin only (no CORS plugin): the
 * dashboard's own client is the only intended caller. Cross-origin REST callers use `/api/v1/**`.
 */
export default defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  try {
    const { matched, response } = await handler.handle(request, {
      prefix: '/rpc',
      context: buildRpcContext(request, access, taskStore),
    });
    if (matched) return response;
    return errors.notFound();
  } catch (error) {
    return errorResponse(error);
  }
});
