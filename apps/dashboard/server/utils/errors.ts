import { redactSecrets } from '@agent-zero/shared';
import { createError } from 'h3';

/**
 * The transport-level failures the routes in this app raise.
 *
 * A route names the failure instead of spelling out a status inline, so the same disposition
 * cannot drift between the RPC and OpenAPI transports. Each entry builds an `H3Error`, which
 * Nitro serialises and which the app's own `resolveErrorStatus` already understands — routes
 * throw these rather than hand-building a `Response`.
 *
 * `createError` is imported rather than taken from Nitro's auto-imports — unlike a route, this
 * module is exercised directly from the plain-Node unit suite, where no Nitro globals exist.
 */
export const errors = {
  /** No transport matched the request path; the router itself is healthy. */
  notFound: () =>
    createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Not found' }),

  /**
   * A required environment variable is absent, so the route fails closed rather than running with
   * a partial configuration. The variable is named because it is deployment configuration, never
   * a secret's value.
   */
  misconfigured: (variable: string) =>
    createError({
      statusCode: 503,
      statusMessage: 'Service Unavailable',
      message: `${variable} is not configured`,
    }),

  /**
   * An unexpected failure, redacted before it reaches either the client or Nitro's error log.
   *
   * The original error is deliberately not attached as `cause`: it is the value most likely to
   * carry a token or a checkout path in its message, and anything attached here is logged
   * verbatim. Throwing an `H3Error` also keeps the failure "handled", so Nitro reports this
   * redacted message instead of replacing it with a generic one.
   */
  internal: (error: unknown) =>
    createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: redactSecrets(error instanceof Error ? error.message : String(error)),
    }),
};
