import { createAuth, type AuthInstanceOptions } from '@agent-zero/auth';
import { redactSecrets, secretValuesFromEnvironment } from '@agent-zero/shared';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

/**
 * Mount the Better Auth handler as a fetch-compatible Hono app.
 *
 * Construction happens on demand from explicit options rather than at module import time, so the
 * database connection pool and signing secret are created only when a caller actually wants an
 * auth-serving instance, not merely by importing this package.
 */
export function createAuthApp(options: AuthInstanceOptions): Hono {
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

  return app;
}
