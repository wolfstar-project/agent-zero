import { createHmac, timingSafeEqual } from 'node:crypto';

import type { ReviewInput } from '@agent-zero/shared';

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

export interface ReviewCommentPayload {
  action: string;
  comment: { body: string; path?: string };
  repository: { full_name: string; clone_url: string };
  pull_request: { number: number };
}

export function reviewInputFromWebhook(
  payload: ReviewCommentPayload,
  checkoutPath: string,
): ReviewInput | null {
  if (payload.action !== 'created') return null;
  return {
    repository: checkoutPath,
    feedback: payload.comment.body,
    mode: 'observe',
    source: `github:${payload.repository.full_name}#${payload.pull_request.number}`,
    ...(payload.comment.path ? { files: [payload.comment.path] } : {}),
  };
}
