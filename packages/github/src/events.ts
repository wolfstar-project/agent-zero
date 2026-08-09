import {
  isRepositoryRelativePath,
  type FeedbackItem,
  type PullRequestRef,
  type ReviewInput,
  type ReviewTrigger,
  type RunMode,
} from '@agent-zero/shared';

/** Webhook event names this adapter understands. */
export const supportedEvents = [
  'pull_request',
  'pull_request_review',
  'pull_request_review_comment',
] as const;
export type SupportedEvent = (typeof supportedEvents)[number];

/** A review event normalized away from GitHub's payload shape. */
export interface ReviewEvent {
  trigger: ReviewTrigger;
  pullRequest: PullRequestRef;
  items: FeedbackItem[];
  /** True when at least one item came from a formal request for changes. */
  requestedChanges: boolean;
}

export interface ParseOptions {
  /**
   * Logins whose feedback is ignored, normally including the account Agent Zero posts as.
   *
   * Without this a run reacts to its own comments and loops.
   */
  ignoreAuthors?: readonly string[];
  /** Whether feedback from bot accounts is ingested. AI reviewers are a first-class source. */
  allowBots?: boolean;
}

/** Untrusted comment bodies are bounded before they reach a prompt or an evidence report. */
const MAX_BODY = 8_000;
const COMMIT_SHA = /^[0-9a-f]{7,64}$/i;

/**
 * Turn a GitHub webhook payload into a review event, or null when there is nothing to act on.
 *
 * The payload is untrusted, so every field is checked rather than asserted. Approvals and
 * dismissals produce nothing: there is no claim to validate.
 */
export function parseReviewEvent(
  event: string,
  payload: unknown,
  options: ParseOptions = {},
): ReviewEvent | null {
  if (!isRecord(payload)) return null;
  const pullRequest = readPullRequest(payload);
  if (!pullRequest) return null;

  if (event === 'pull_request') {
    if (!isProactiveAction(payload.action)) return null;
    return { trigger: 'proactive', pullRequest, items: [], requestedChanges: false };
  }

  const items =
    event === 'pull_request_review_comment'
      ? readReviewComment(payload, options)
      : event === 'pull_request_review'
        ? readReview(payload, options)
        : null;
  if (!items || items.length === 0) return null;

  return {
    trigger: 'feedback',
    pullRequest,
    items,
    requestedChanges: items.some((item) => item.requestedChanges),
  };
}

/**
 * Build runtime input for a review event.
 *
 * The mode is supplied by the caller and defaults to `observe`, so an inbound webhook can never
 * escalate a run into writing to a repository on its own.
 */
export function reviewInputFromEvent(
  event: ReviewEvent,
  options: { checkoutPath: string; mode?: RunMode },
): ReviewInput {
  const { owner, repo, number } = event.pullRequest;
  const files = [
    ...new Set(
      event.items
        .map((item) => item.path)
        .filter((path): path is string => path !== undefined && isRepositoryRelativePath(path)),
    ),
  ];
  return {
    repository: options.checkoutPath,
    mode: options.mode ?? 'observe',
    trigger: event.trigger,
    source: `github:${owner}/${repo}#${String(number)}`,
    pullRequest: event.pullRequest,
    ...(event.trigger === 'feedback'
      ? { feedback: renderFeedback(event.items), items: event.items }
      : {}),
    ...(files.length > 0 ? { files } : {}),
  };
}

/** A single human-readable transcript of the review, used when no structured items are consumed. */
export function renderFeedback(items: readonly FeedbackItem[]): string {
  return items
    .map((item) => {
      const location = item.path
        ? ` on ${item.path}${item.line === undefined ? '' : `:${String(item.line)}`}`
        : '';
      const kind = item.requestedChanges ? `${item.kind} (changes requested)` : item.kind;
      return `[${kind} by ${item.author}${location}]\n${item.body}`;
    })
    .join('\n\n---\n\n');
}

function readReviewComment(
  payload: Record<string, unknown>,
  options: ParseOptions,
): FeedbackItem[] | null {
  if (payload.action !== 'created') return null;
  if (!isRecord(payload.comment)) return null;
  const comment = payload.comment;
  const author = readAuthor(comment.user, options);
  const body = readBody(comment.body);
  if (author === null || body === null) return null;
  const path = typeof comment.path === 'string' ? comment.path : undefined;
  const line = readLine(comment.line ?? comment.original_line);
  return [
    {
      id: readId(comment.id, 'review-comment'),
      kind: 'review-comment',
      body,
      author,
      // A single inline comment is a remark; the review that carries it decides on changes.
      requestedChanges: false,
      ...(path === undefined ? {} : { path }),
      ...(line === undefined ? {} : { line }),
    },
  ];
}

function readReview(
  payload: Record<string, unknown>,
  options: ParseOptions,
): FeedbackItem[] | null {
  if (payload.action !== 'submitted') return null;
  if (!isRecord(payload.review)) return null;
  const review = payload.review;
  const state = typeof review.state === 'string' ? review.state.toLowerCase() : '';
  // An approval or a dismissal carries no claim to validate.
  if (state !== 'changes_requested' && state !== 'commented') return null;
  const author = readAuthor(review.user, options);
  const body = readBody(review.body);
  if (author === null || body === null) return null;
  return [
    {
      id: readId(review.id, 'review'),
      kind: 'review-body',
      body,
      author,
      requestedChanges: state === 'changes_requested',
    },
  ];
}

function readPullRequest(payload: Record<string, unknown>): PullRequestRef | null {
  const pullRequest = isRecord(payload.pull_request) ? payload.pull_request : undefined;
  const repository = isRecord(payload.repository) ? payload.repository : undefined;
  if (!pullRequest || !repository) return null;

  const number = typeof pullRequest.number === 'number' ? pullRequest.number : undefined;
  const head = isRecord(pullRequest.head) ? pullRequest.head : undefined;
  const base = isRecord(pullRequest.base) ? pullRequest.base : undefined;
  const headSha = typeof head?.sha === 'string' ? head.sha : undefined;
  const baseSha = typeof base?.sha === 'string' ? base.sha : undefined;
  const repo = typeof repository.name === 'string' ? repository.name : undefined;
  const ownerRecord = isRecord(repository.owner) ? repository.owner : undefined;
  const owner = typeof ownerRecord?.login === 'string' ? ownerRecord.login : undefined;

  if (number === undefined || !baseSha || !headSha || !repo || !owner) return null;
  if (!COMMIT_SHA.test(baseSha) || !COMMIT_SHA.test(headSha)) return null;
  return { owner, repo, number, baseSha, headSha };
}

function isProactiveAction(action: unknown): boolean {
  return (
    action === 'opened' ||
    action === 'reopened' ||
    action === 'synchronize' ||
    action === 'ready_for_review'
  );
}

function readAuthor(user: unknown, options: ParseOptions): string | null {
  if (!isRecord(user)) return null;
  const login = typeof user.login === 'string' ? user.login : '';
  if (login.length === 0) return null;
  const ignored = options.ignoreAuthors ?? [];
  if (ignored.some((ignore) => ignore.toLowerCase() === login.toLowerCase())) return null;
  if (options.allowBots === false && user.type === 'Bot') return null;
  return login;
}

function readBody(body: unknown): string | null {
  if (typeof body !== 'string') return null;
  const trimmed = body.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, MAX_BODY);
}

function readLine(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

function readId(value: unknown, prefix: string): string {
  if (typeof value === 'number' || typeof value === 'string') return `${prefix}:${String(value)}`;
  return prefix;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
