import process from 'node:process';

import { authOptionsFromEnvironment, createAuth } from '@agent-zero/auth';
import { createMailer } from '@agent-zero/mail';
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

// 3000 belongs to the Nuxt dashboard and 3001 to the control plane (`apps/server`), so
// `aube run dev` can start all three without a port collision.
const DEFAULT_PORT = 3002;

// Validate the complete value as a decimal port string; `Number.parseInt` would silently
// truncate malformed configuration such as `39001abc` or `39001.5` to a valid port.
const DECIMAL_PORT_PATTERN = /^\d+$/;

function resolvePort(value: string | undefined): number {
  if (!value) return DEFAULT_PORT;
  if (!DECIMAL_PORT_PATTERN.test(value)) {
    throw new Error(`invalid AUTH_SERVER_PORT: expected a port number, received ${value}`);
  }
  const port = Number.parseInt(value, 10);
  if (port < 1 || port > 65_535) {
    throw new Error(`invalid AUTH_SERVER_PORT: expected a port number, received ${value}`);
  }
  return port;
}

const options = authOptionsFromEnvironment();

// This process is the composition root for authentication, so it is where the mail transport is
// bound and injected. `packages/auth` declares the delivery contract structurally and never
// imports `@agent-zero/mail`, which keeps one capability package from depending on another.
const sendMail = createMailer();

const auth = createAuth({
  ...options,
  sendInvitationEmail: ({ to, organizationName, inviterName, acceptUrl }) =>
    sendMail({
      to,
      templateId: 'organizationInvitation',
      context: { organizationName, inviterName, acceptUrl },
    }),
});

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
