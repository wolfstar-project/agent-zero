import { createServer } from 'node:http';

import { onError } from '@orpc/server';
import { RPCHandler } from '@orpc/server/node';

import { router } from './router.js';

export const handler = new RPCHandler(router, {
  interceptors: [onError((error) => console.error(error))],
});

export const server = createServer((request, response) => {
  void handler
    .handle(request, response, { context: {} })
    .then(({ matched }) => {
      if (!matched) {
        response.statusCode = 404;
        response.end('Not found');
      }
      return undefined;
    })
    .catch((error) => {
      console.error(error);
      response.statusCode = 500;
      response.end('Internal server error');
      return undefined;
    });
});

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.AGENT_ZERO_PORT ?? 4040);
  server.listen(port, () =>
    console.log(`Agent Zero oRPC API listening on http://localhost:${port}`),
  );
}
