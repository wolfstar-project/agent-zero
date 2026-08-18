import { json } from './respond.js';

/**
 * The transport-level failures the routes in this app return.
 *
 * A route names the failure instead of spelling out a status and a body at the call site, so the
 * same disposition cannot drift into two different shapes across transports, and adding a case
 * here is the only way a new status reaches a client.
 */
export const errors = {
  /** No transport matched the request path; the router itself is healthy. */
  notFound: (): Response => json(404, { error: 'Not found' }),

  /**
   * A required environment variable is absent, so the route fails closed rather than running with
   * a partial configuration. The variable is named because it is deployment configuration, never
   * a secret's value.
   */
  misconfigured: (variable: string): Response =>
    json(503, { error: `${variable} is not configured` }),
};
