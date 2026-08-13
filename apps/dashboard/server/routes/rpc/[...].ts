import {
  accessFromEnvironment,
  authenticate,
  mayTargetRepository,
  requestLoggerStorage,
  rpcRouter,
  type RpcContext,
} from '@agent-zero/api';
import { redactSecrets } from '@agent-zero/shared';
import { EvlogHandlerPlugin } from '@orpc/evlog';
import { RPCHandler } from '@orpc/server/fetch';
import { defineEventHandler, toWebRequest } from 'h3';

import { json, messageOf } from '../../utils/respond.js';
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
 * {@link rpcRouter}, which run behind the runner boundary.
 */
const route = defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  try {
    const principal = authenticate(request.headers.get('authorization') ?? undefined, access);
    const context: RpcContext = {
      store: taskStore,
      ...(principal ? { principal } : {}),
      mayTargetRepository: (repository) => mayTargetRepository(repository, access),
    };
    const { matched, response } = await handler.handle(request, {
      prefix: '/rpc',
      context,
    });
    if (matched) return response;
    return json(404, { error: 'Not found' });
  } catch (error) {
    return json(500, { error: redactSecrets(messageOf(error)) });
  }
});

export default route;
