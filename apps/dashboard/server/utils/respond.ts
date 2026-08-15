import { redactSecrets } from '@agent-zero/shared';

/** Serialise an explicit-status JSON response without leaking transport internals. */
export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The redacted 500 response every route in this app returns from its catch block. */
export function errorResponse(error: unknown): Response {
  return json(500, { error: redactSecrets(messageOf(error)) });
}
