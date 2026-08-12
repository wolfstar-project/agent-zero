import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Compare two strings in constant time.
 *
 * The comparison length is checked first because `timingSafeEqual` throws on a length mismatch,
 * and a thrown error would be a slower path than a rejection.
 */
export function timingSafeStringEqual(actual: string | undefined, expected: string): boolean {
  if (actual === undefined || expected.length === 0) return false;
  return (
    actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  );
}

/**
 * Verify an HMAC-SHA256 hex signature over the raw request body in constant time.
 *
 * `prefix` covers the `sha256=` convention GitHub and Bitbucket use; Gitea and Forgejo send the
 * bare hex digest.
 */
export function verifyHmacSha256(
  body: string,
  signature: string | undefined,
  secret: string,
  prefix = '',
): boolean {
  if (signature === undefined || secret.length === 0) return false;
  if (prefix.length > 0 && !signature.startsWith(prefix)) return false;
  const expected = `${prefix}${createHmac('sha256', secret).update(body).digest('hex')}`;
  return timingSafeStringEqual(signature, expected);
}
