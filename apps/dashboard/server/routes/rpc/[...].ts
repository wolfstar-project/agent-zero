import { accessFromEnvironment, requestLoggerStorage, rpcRouter } from '@agent-zero/api';
import { EvlogHandlerPlugin } from '@orpc/evlog';
import { RPCHandler } from '@orpc/server/fetch';

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
      context: { ...buildRpcContext(request, access, taskStore), audit: auditRecorder },
    });
    if (matched) return response;
  } catch (error) {
    throw errors.internal(error);
  }
  // Outside the `catch` above, so an unmatched path stays a 404 instead of being rethrown as 500.
  throw errors.notFound();
});
