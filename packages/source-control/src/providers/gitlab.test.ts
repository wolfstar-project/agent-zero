import { describe, expect, it } from 'vitest';

import { reviewInputFromEvent } from '../input.js';
import { parseGitLabReviewEvent } from './gitlab.js';

const mergeRequest = { iid: 7, last_commit: { id: 'a'.repeat(40) } };
const project = { path_with_namespace: 'acme/platform/app' };

function mergeRequestHook(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    object_kind: 'merge_request',
    project,
    object_attributes: { ...mergeRequest, action: 'open', ...overrides },
  };
}

function noteHook(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    object_kind: 'note',
    user: { username: 'alice' },
    project,
    object_attributes: {
      id: 11,
      note: 'This dereferences a null return.',
      noteable_type: 'MergeRequest',
      position: { new_path: 'src/user.ts', new_line: 12 },
      ...overrides,
    },
    merge_request: mergeRequest,
  };
}

describe('parseGitLabReviewEvent for merge requests', () => {
  it('starts a proactive review when a merge request opens', () => {
    const event = parseGitLabReviewEvent('Merge Request Hook', mergeRequestHook());
    expect(event).toMatchObject({
      provider: 'gitlab',
      trigger: 'proactive',
      items: [],
      changeRequest: {
        owner: 'acme/platform',
        repo: 'app',
        number: 7,
        headSha: 'a'.repeat(40),
      },
    });
    // GitLab webhooks never deliver a diff base; the reference must not invent one.
    expect(event?.changeRequest.baseSha).toBeUndefined();
  });

  it('treats an update as proactive only when commits changed', () => {
    expect(
      parseGitLabReviewEvent('Merge Request Hook', mergeRequestHook({ action: 'update' })),
    ).toBeNull();
    expect(
      parseGitLabReviewEvent(
        'Merge Request Hook',
        mergeRequestHook({ action: 'update', oldrev: 'c'.repeat(40) }),
      ),
    ).not.toBeNull();
  });

  it('produces nothing for approvals, merges, and closes', () => {
    for (const action of ['approved', 'unapproved', 'merge', 'close'])
      expect(parseGitLabReviewEvent('Merge Request Hook', mergeRequestHook({ action }))).toBeNull();
  });

  it('accepts the object_kind spelling of the event name', () => {
    expect(parseGitLabReviewEvent('merge_request', mergeRequestHook())).not.toBeNull();
  });

  it('ignores unknown event names and contradictory payload kinds', () => {
    expect(parseGitLabReviewEvent('Webhook', mergeRequestHook())).toBeNull();
    expect(
      parseGitLabReviewEvent('Note Hook', { ...noteHook(), object_kind: 'merge_request' }),
    ).toBeNull();
  });

  it('requires a well-formed namespace path', () => {
    for (const path of ['app', '/app', 'acme/']) {
      expect(
        parseGitLabReviewEvent('Merge Request Hook', {
          ...mergeRequestHook(),
          project: { path_with_namespace: path },
        }),
      ).toBeNull();
    }
  });
});

describe('parseGitLabReviewEvent for notes', () => {
  it('normalizes a merge-request note with its inline position', () => {
    const event = parseGitLabReviewEvent('Note Hook', noteHook());
    expect(event?.items[0]).toMatchObject({
      id: 'note:11',
      kind: 'review-comment',
      author: 'alice',
      path: 'src/user.ts',
      line: 12,
      requestedChanges: false,
    });
  });

  it('ignores notes on anything but a merge request', () => {
    expect(parseGitLabReviewEvent('Note Hook', noteHook({ noteable_type: 'Commit' }))).toBeNull();
  });

  it('ignores its own account so a run cannot answer itself', () => {
    expect(
      parseGitLabReviewEvent('Note Hook', noteHook(), { ignoreAuthors: ['ALICE'] }),
    ).toBeNull();
  });

  it('bounds an oversized note body', () => {
    const event = parseGitLabReviewEvent('Note Hook', noteHook({ note: 'x'.repeat(20_000) }));
    expect(event?.items[0]?.body.length).toBe(8_000);
  });
});

describe('reviewInputFromEvent for GitLab', () => {
  it('labels the source with merge-request notation and omits the partial diff reference', () => {
    const event = parseGitLabReviewEvent('Note Hook', noteHook());
    const input = reviewInputFromEvent(event!, { checkoutPath: '/checkout' });
    expect(input.source).toBe('gitlab:acme/platform/app!7');
    expect(input.pullRequest).toBeUndefined();
    expect(input.files).toEqual(['src/user.ts']);
  });
});
