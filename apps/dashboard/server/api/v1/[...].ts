import {
  accessFromEnvironment,
  controlPlaneOriginsFromEnvironment,
  requestLoggerStorage,
  rpcRouter,
} from '@agent-zero/api';
import { EvlogHandlerPlugin } from '@orpc/evlog';
import { OpenAPIGenerator } from '@orpc/openapi';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { OpenAPIReferenceHandlerPlugin } from '@orpc/openapi/plugins';
import { CORSPlugin } from '@orpc/server/plugins';
import { ZodToJsonSchemaConverter } from '@orpc/zod';
import { defineEventHandler, toWebRequest } from 'h3';

import { buildRpcContext } from '../../utils/context.js';
import { errorResponse, json } from '../../utils/respond.js';
import { taskStore } from '../../utils/store.js';

const generator = new OpenAPIGenerator({ converters: [new ZodToJsonSchemaConverter()] });
// `rpcRouter` is static, so the spec is generated once at module load rather than per request to
// `/api/v1/docs` or `/api/v1/openapi.json`.
const openApiSpec = generator.generate(rpcRouter, {
  base: { info: { title: 'Agent Zero control plane', version: '0.3.0' } },
});

/**
 * REST/OpenAPI surface for `rpcRouter`, mounted under `/api/v1/**`.
 *
 * Same router, same authorization rules as the `/rpc/**` RPC transport; only the wire protocol
 * differs, for callers that want plain HTTP instead of the typed oRPC client. Unlike `/rpc/**`,
 * this transport is meant for cross-origin callers, so it carries a CORS plugin — restricted to
 * `AGENT_ZERO_CONTROL_PLANE_ORIGINS`'s allow-list (default: none) rather than reflecting any
 * request origin, since `tasks.list`/`tasks.get`/`health` are unauthenticated and would otherwise
 * be readable by any website's browser-side JavaScript.
 */
const handler = new OpenAPIHandler(rpcRouter, {
  plugins: [
    new CORSPlugin({ origin: controlPlaneOriginsFromEnvironment() }),
    new EvlogHandlerPlugin({ storage: requestLoggerStorage }),
    new OpenAPIReferenceHandlerPlugin({
      docsPath: '/docs',
      specPath: '/openapi.json',
      spec: () => openApiSpec,
    }),
  ],
});
// Fails closed: without configured tokens every mutation is rejected while reads stay open.
const access = accessFromEnvironment();

const route = defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  try {
    const { matched, response } = await handler.handle(request, {
      prefix: '/api/v1',
      context: buildRpcContext(request, access, taskStore),
    });
    if (matched) return response;
    return json(404, { error: 'Not found' });
  } catch (error) {
    return errorResponse(error);
  }
});

export default route;
