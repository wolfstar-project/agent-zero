import {
  accessFromEnvironment,
  authenticate,
  mayTargetRepository,
  rpcRouter,
  type RpcContext,
} from '@agent-zero/api';
import { redactSecrets } from '@agent-zero/shared';
import { OpenAPIGenerator } from '@orpc/openapi';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { OpenAPIReferenceHandlerPlugin } from '@orpc/openapi/plugins';
import { CORSPlugin } from '@orpc/server/plugins';
import { ZodToJsonSchemaConverter } from '@orpc/zod';
import { defineHandler } from 'nitro';
import type { EventHandlerWithFetch } from 'nitro/h3';

import { json, messageOf } from '../../utils/respond.js';
import { taskStore } from '../../utils/store.js';

const generator = new OpenAPIGenerator({ converters: [new ZodToJsonSchemaConverter()] });

/**
 * REST/OpenAPI surface for `rpcRouter`, mounted under `/api/v1/**`.
 *
 * Same router, same authorization rules as the `/rpc/**` RPC transport; only the wire protocol
 * differs, for callers that want plain HTTP instead of the typed oRPC client.
 */
const handler = new OpenAPIHandler(rpcRouter, {
  plugins: [
    new CORSPlugin(),
    new OpenAPIReferenceHandlerPlugin({
      docsPath: '/docs',
      specPath: '/openapi.json',
      spec: () =>
        generator.generate(rpcRouter, {
          base: { info: { title: 'Agent Zero control plane', version: '0.3.0' } },
        }),
    }),
  ],
});
// Fails closed: without configured tokens every mutation is rejected while reads stay open.
const access = accessFromEnvironment();

const route: EventHandlerWithFetch = defineHandler(async (event) => {
  try {
    const principal = authenticate(event.req.headers.get('authorization') ?? undefined, access);
    const context: RpcContext = {
      store: taskStore,
      ...(principal ? { principal } : {}),
      mayTargetRepository: (repository) => mayTargetRepository(repository, access),
    };
    const { matched, response } = await handler.handle(event.req, {
      prefix: '/api/v1',
      context,
    });
    if (matched) return response;
    return json(404, { error: 'Not found' });
  } catch (error) {
    return json(500, { error: redactSecrets(messageOf(error)) });
  }
});

export default route;
