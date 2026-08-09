import { createHmac, timingSafeEqual } from 'node:crypto';

export {
  checkConclusion,
  GitHubChecks,
  type CheckConclusion,
  type GitHubChecksOptions,
} from './checks.js';
export {
  parseReviewEvent,
  renderFeedback,
  reviewInputFromEvent,
  supportedEvents,
  type ParseOptions,
  type ReviewEvent,
  type SupportedEvent,
} from './events.js';

/**
 * Verify a webhook signature in constant time.
 *
 * The comparison length is checked first because `timingSafeEqual` throws on a length mismatch, and
 * a thrown error would be a slower path than a rejection.
 */
export function verifyWebhook(
  body: string,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature?.startsWith('sha256=')) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  return (
    signature.length === expected.length &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  );
}
