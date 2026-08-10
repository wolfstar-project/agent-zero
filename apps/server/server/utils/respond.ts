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
