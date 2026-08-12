import { describe, expect, it } from 'vitest';

import { parseGiteaReviewEvent } from './gitea.js';

const repository = { name: 'app', owner: { login: 'acme' } };
const pullRequest = {
  number: 7,
  base: { sha: 'b'.repeat(40) },
  head: { sha: 'a'.repeat(40) },
};

function review(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    action: 'reviewed',
    repository,
    pull_request: pullRequest,
    sender: { login: 'alice' },
    review: {
      id: 51,
      type: 'pull_request_review_rejected',
      content: 'Guard the null return.',
      ...overrides,
    },
  };
}

describe('parseGiteaReviewEvent', () => {
  it('starts a proactive review for new and synchronized pull requests', () => {
    for (const action of ['opened', 'reopened', 'synchronized', 'synchronize']) {
      expect(
        parseGiteaReviewEvent('pull_request', { action, repository, pull_request: pullRequest }),
      ).toMatchObject({
        provider: 'gitea',
        trigger: 'proactive',
        changeRequest: { owner: 'acme', repo: 'app', baseSha: 'b'.repeat(40) },
      });
    }
  });

  it('marks a rejected review as a request for changes', () => {
    const event = parseGiteaReviewEvent('pull_request_review_rejected', review());
    expect(event?.requestedChanges).toBe(true);
    expect(event?.items[0]).toMatchObject({ kind: 'review-body', author: 'alice' });
  });

  it('ingests a comment review without marking changes requested', () => {
    const event = parseGiteaReviewEvent(
      'pull_request_review_comment',
      review({ type: 'pull_request_review_comment' }),
    );
    expect(event?.requestedChanges).toBe(false);
  });

  it('dispatches on review.type when the event name is the bare review event', () => {
    const event = parseGiteaReviewEvent('pull_request_review', review());
    expect(event?.requestedChanges).toBe(true);
  });

  it('produces nothing for an approval', () => {
    expect(
      parseGiteaReviewEvent(
        'pull_request_review_approved',
        review({ type: 'pull_request_review_approved', content: 'Nice.' }),
      ),
    ).toBeNull();
  });

  it('produces nothing for a rejection with no body to act on', () => {
    expect(
      parseGiteaReviewEvent('pull_request_review_rejected', review({ content: '  ' })),
    ).toBeNull();
  });

  it('accepts a Forgejo-style owner username field', () => {
    const event = parseGiteaReviewEvent('pull_request', {
      action: 'opened',
      repository: { name: 'app', owner: { username: 'acme' } },
      pull_request: pullRequest,
    });
    expect(event?.changeRequest.owner).toBe('acme');
  });
});
