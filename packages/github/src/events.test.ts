import { describe, expect, it } from 'vitest';

import { parseReviewEvent, reviewInputFromEvent } from './events.js';

const repository = { name: 'app', owner: { login: 'acme' } };
const pullRequest = { number: 7, head: { sha: 'a'.repeat(40) } };

function reviewComment(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    action: 'created',
    repository,
    pull_request: pullRequest,
    comment: {
      id: 101,
      body: 'This dereferences a null return.',
      path: 'src/user.ts',
      line: 12,
      user: { login: 'alice', type: 'User' },
      ...overrides,
    },
  };
}

function review(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    action: 'submitted',
    repository,
    pull_request: pullRequest,
    review: {
      id: 202,
      body: 'Please guard the null return.',
      state: 'changes_requested',
      user: { login: 'bob', type: 'User' },
      ...overrides,
    },
  };
}

describe('parseReviewEvent for inline comments', () => {
  it('normalizes a created review comment', () => {
    const event = parseReviewEvent('pull_request_review_comment', reviewComment());
    expect(event).toEqual({
      pullRequest: { owner: 'acme', repo: 'app', number: 7, headSha: 'a'.repeat(40) },
      requestedChanges: false,
      items: [
        {
          id: 'review-comment:101',
          kind: 'review-comment',
          body: 'This dereferences a null return.',
          author: 'alice',
          requestedChanges: false,
          path: 'src/user.ts',
          line: 12,
        },
      ],
    });
  });

  it('ignores actions other than creation', () => {
    expect(
      parseReviewEvent('pull_request_review_comment', {
        ...reviewComment(),
        action: 'deleted',
      }),
    ).toBeNull();
  });

  it('falls back to the original line when the comment has no current line', () => {
    const event = parseReviewEvent(
      'pull_request_review_comment',
      reviewComment({ line: null, original_line: 4 }),
    );
    expect(event?.items[0]?.line).toBe(4);
  });

  it('omits a line that is not a positive integer', () => {
    const event = parseReviewEvent(
      'pull_request_review_comment',
      reviewComment({ line: 0, original_line: -3 }),
    );
    expect(event?.items[0]?.line).toBeUndefined();
  });
});

describe('parseReviewEvent for reviews', () => {
  it('ingests a request for changes and marks it as such', () => {
    const event = parseReviewEvent('pull_request_review', review());
    expect(event?.requestedChanges).toBe(true);
    expect(event?.items[0]).toMatchObject({ kind: 'review-body', author: 'bob' });
  });

  it('ingests a plain comment review without marking changes requested', () => {
    const event = parseReviewEvent('pull_request_review', review({ state: 'commented' }));
    expect(event?.requestedChanges).toBe(false);
  });

  it('produces nothing for an approval or a dismissal', () => {
    expect(parseReviewEvent('pull_request_review', review({ state: 'approved' }))).toBeNull();
    expect(parseReviewEvent('pull_request_review', review({ state: 'dismissed' }))).toBeNull();
  });

  it('produces nothing for a request for changes with no body to act on', () => {
    expect(parseReviewEvent('pull_request_review', review({ body: '   ' }))).toBeNull();
    expect(parseReviewEvent('pull_request_review', review({ body: null }))).toBeNull();
  });
});

describe('parseReviewEvent input validation', () => {
  it('rejects payloads that are not objects', () => {
    for (const payload of [null, 'text', 42, []])
      expect(parseReviewEvent('pull_request_review', payload)).toBeNull();
  });

  it('rejects an unsupported event name', () => {
    expect(parseReviewEvent('issue_comment', reviewComment())).toBeNull();
  });

  it('requires a complete pull-request reference', () => {
    for (const payload of [
      { ...review(), repository: {} },
      { ...review(), pull_request: { number: 7 } },
      { ...review(), pull_request: { number: '7', head: { sha: 'a'.repeat(40) } } },
      { ...review(), pull_request: { number: 7, head: { sha: 'not-a-sha' } } },
    ])
      expect(parseReviewEvent('pull_request_review', payload)).toBeNull();
  });

  it('requires an author', () => {
    expect(parseReviewEvent('pull_request_review', review({ user: {} }))).toBeNull();
  });

  it('ignores its own account so a run cannot answer itself', () => {
    expect(
      parseReviewEvent('pull_request_review', review({ user: { login: 'agent-zero[bot]' } }), {
        ignoreAuthors: ['Agent-Zero[bot]'],
      }),
    ).toBeNull();
  });

  it('ingests AI reviewers by default and can exclude them explicitly', () => {
    const payload = review({ user: { login: 'copilot', type: 'Bot' } });
    expect(parseReviewEvent('pull_request_review', payload)).not.toBeNull();
    expect(parseReviewEvent('pull_request_review', payload, { allowBots: false })).toBeNull();
  });

  it('bounds an oversized comment body', () => {
    const event = parseReviewEvent('pull_request_review', review({ body: 'x'.repeat(20_000) }));
    expect(event?.items[0]?.body.length).toBe(8_000);
  });
});

describe('reviewInputFromEvent', () => {
  it('builds observe-mode input by default so a webhook cannot escalate itself', () => {
    const event = parseReviewEvent('pull_request_review_comment', reviewComment());
    const input = reviewInputFromEvent(event!, { checkoutPath: '/checkout' });
    expect(input.mode).toBe('observe');
    expect(input.source).toBe('github:acme/app#7');
    expect(input.repository).toBe('/checkout');
    expect(input.files).toEqual(['src/user.ts']);
    expect(input.feedback).toContain('[review-comment by alice on src/user.ts:12]');
    expect(input.pullRequest).toMatchObject({ number: 7 });
  });

  it('carries an explicitly requested mode through', () => {
    const event = parseReviewEvent('pull_request_review', review());
    expect(reviewInputFromEvent(event!, { checkoutPath: '/checkout', mode: 'fix' }).mode).toBe(
      'fix',
    );
  });

  it('drops a path that would leave the checkout', () => {
    const event = parseReviewEvent(
      'pull_request_review_comment',
      reviewComment({ path: '../../etc/passwd' }),
    );
    expect(reviewInputFromEvent(event!, { checkoutPath: '/checkout' }).files).toBeUndefined();
  });
});
