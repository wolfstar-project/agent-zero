import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import { redactSecrets } from '@agent-zero/shared';
import { RPCHandler } from '@orpc/server/node';

import { PersistentTaskStore, type TaskStore } from './control-plane.js';
import { dashboardOverview } from './dashboard.js';
import { rpcRouter } from './rpc.js';
import { FileKeyValueStorage } from './storage.js';

const RPC_PREFIX = '/rpc';
const DASHBOARD_PATH = '/api/dashboard';
const DEFAULT_DATA_DIRECTORY = './.data/agent-zero';

export interface ControlPlaneOptions {
  /** Defaults to a filesystem store; Redis, KV, or Nitro storage drop in unchanged. */
  store?: TaskStore;
  dataDirectory?: string;
}

/**
 * Build the control-plane HTTP surface.
 *
 * The transport only validates, delegates, and serialises. It holds no runner and no checkout, so
 * an HTTP client cannot reach a repository except through the procedures in {@link rpcRouter},
 * which run behind the runner boundary.
 */
export function createControlPlane(options: ControlPlaneOptions = {}): Server {
  const store =
    options.store ??
    new PersistentTaskStore(
      new FileKeyValueStorage(options.dataDirectory ?? DEFAULT_DATA_DIRECTORY),
    );
  const handler = new RPCHandler(rpcRouter);

  return createServer((request, response) => {
    void route(request, response, handler, store).catch((error: unknown) => {
      respond(response, 500, { error: redactSecrets(messageOf(error)) });
    });
  });
}

/** Start the control plane and resolve once it is accepting connections. */
export async function startControlPlane(
  port: number,
  options: ControlPlaneOptions = {},
): Promise<Server> {
  const server = createControlPlane(options);
  await new Promise<void>((resolve) => server.listen(port, resolve));
  return server;
}

async function route(
  request: IncomingMessage,
  response: ServerResponse,
  handler: RPCHandler<{ store: TaskStore }>,
  store: TaskStore,
): Promise<void> {
  const { matched } = await handler.handle(request, response, {
    prefix: RPC_PREFIX,
    context: { store },
  });
  if (matched) return;

  const path = (request.url ?? '/').split('?')[0];
  if (path === DASHBOARD_PATH && request.method === 'GET') {
    respond(response, 200, dashboardOverview(await store.list()));
    return;
  }
  respond(response, 404, { error: 'Not found' });
}

function respond(response: ServerResponse, status: number, body: unknown): void {
  if (response.writableEnded) return;
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
