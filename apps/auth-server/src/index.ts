import process from 'node:process';

import { authOptionsFromEnvironment, createAuth } from '@agent-zero/auth';
import { redactSecrets, secretValuesFromEnvironment } from '@agent-zero/shared';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

/**
 * Standalone authentication adapter.
 *
 * This process is the only part of Agent Zero that owns a persistence layer. It exists so the
 * dashboard can stay a presentation surface: `apps/dashboard` talks to this origin over HTTP and
 * never gains Nitro routes, a database, or a dependency on a runtime package.
 *
 * It deliberately serves nothing but the Better Auth handler.
 */

const DEFAULT_PORT = 3001;

function resolvePort(value: string | undefined): number {
  if (!value) return DEFAULT_PORT;
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`invalid AUTH_SERVER_PORT: expected a port number, received ${value}`);
  }
  return port;
}

const options = authOptionsFromEnvironment();
const auth = createAuth(options);

const app = new Hono();

app.use(
  '/api/auth/*',
  cors({
    origin: [...options.trustedOrigins],
    credentials: true,
    allowHeaders: ['Content-Type'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
  }),
);

app.on(['GET', 'POST'], '/api/auth/*', (context) => auth.handler(context.req.raw));

app.onError((error, context) => {
  // Stack traces from an auth failure are a prime place for a credential to surface.
  const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(redactSecrets(detail, secretValuesFromEnvironment()));
  return context.json({ error: 'internal server error' }, 500);
});

const port = resolvePort(process.env.AUTH_SERVER_PORT);

serve({ fetch: app.fetch, port }, (info) => {
  console.info(`auth server listening on http://localhost:${info.port}`);
});
