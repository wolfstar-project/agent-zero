import {
  authenticate,
  mayTargetRepository,
  type ControlPlaneAccess,
  type RpcContext,
  type TaskStore,
} from '@agent-zero/api';

/**
 * Builds the oRPC context shared by the `/rpc/**` and `/api/v1/**` transports.
 *
 * Both transports authenticate, authorize, and delegate through the same {@link rpcRouter}
 * procedures, so they resolve context identically; only the wire protocol differs between them.
 * Takes `store` rather than importing `taskStore` itself, so this stays testable without pulling
 * in the ViteHub KV binding `../utils/store.js` resolves at runtime.
 */
export function buildRpcContext(
  request: Request,
  access: ControlPlaneAccess | undefined,
  store: TaskStore,
): RpcContext {
  const principal = authenticate(request.headers.get('authorization') ?? undefined, access);
  return {
    store,
    ...(principal ? { principal } : {}),
    mayTargetRepository: (repository) => mayTargetRepository(repository, access),
  };
}
