import { describe, expect, it } from 'vitest';

import { parseBitbucketCloudReviewEvent } from './bitbucket-cloud.js';
import { parseBitbucketDataCenterReviewEvent } from './bitbucket-data-center.js';

const cloudPayload = {
  pullrequest: {
    id: 7,
    source: { commit: { hash: 'a'.repeat(12) } },
    destination: { commit: { hash: 'b'.repeat(12) } },
  },
  repository: { full_name: 'acme/app' },
};

describe('parseBitbucketCloudReviewEvent', () => {
  it('starts a proactive review for a created or updated pull request', () => {
    for (const event of ['pullrequest:created', 'pullrequest:updated']) {
      expect(parseBitbucketCloudReviewEvent(event, cloudPayload)).toMatchObject({
        provider: 'bitbucket-cloud',
        trigger: 'proactive',
        changeRequest: {
          owner: 'acme',
          repo: 'app',
          number: 7,
          headSha: 'a'.repeat(12),
          baseSha: 'b'.repeat(12),
        },
      });
    }
  });

  it('normalizes a comment with its inline anchor', () => {
    const event = parseBitbucketCloudReviewEvent('pullrequest:comment_created', {
      ...cloudPayload,
      comment: {
        id: 31,
        content: { raw: 'This dereferences a null return.' },
        user: { nickname: 'alice', display_name: 'Alice' },
        inline: { path: 'src/user.ts', to: 12 },
      },
    });
    expect(event?.items[0]).toMatchObject({
      id: 'comment:31',
      author: 'alice',
      path: 'src/user.ts',
      line: 12,
    });
  });

  it('falls back to the display name when no nickname exists', () => {
    const event = parseBitbucketCloudReviewEvent('pullrequest:comment_created', {
      ...cloudPayload,
      comment: { id: 31, content: { raw: 'claim' }, user: { display_name: 'Alice' } },
    });
    expect(event?.items[0]?.author).toBe('Alice');
  });

  it('produces nothing for the bodyless changes-requested event', () => {
    expect(
      parseBitbucketCloudReviewEvent('pullrequest:changes_request_created', cloudPayload),
    ).toBeNull();
  });
});

const dataCenterPayload = {
  pullRequest: {
    id: 7,
    fromRef: { latestCommit: 'a'.repeat(40) },
    toRef: {
      latestCommit: 'b'.repeat(40),
      repository: { slug: 'app', project: { key: 'ACME' } },
    },
  },
};

describe('parseBitbucketDataCenterReviewEvent', () => {
  it('starts a proactive review when a pull request opens or gains commits', () => {
    for (const event of ['pr:opened', 'pr:from_ref_updated']) {
      expect(parseBitbucketDataCenterReviewEvent(event, dataCenterPayload)).toMatchObject({
        provider: 'bitbucket-data-center',
        trigger: 'proactive',
        changeRequest: { owner: 'ACME', repo: 'app', number: 7 },
      });
    }
  });

  it('ignores metadata edits that introduce no reviewable diff', () => {
    expect(parseBitbucketDataCenterReviewEvent('pr:modified', dataCenterPayload)).toBeNull();
  });

  it('normalizes a comment and survives a missing inline anchor', () => {
    const event = parseBitbucketDataCenterReviewEvent('pr:comment:added', {
      ...dataCenterPayload,
      comment: { id: 41, text: 'This dereferences a null return.', author: { name: 'alice' } },
    });
    expect(event?.items[0]).toMatchObject({ id: 'comment:41', author: 'alice' });
    expect(event?.items[0]?.path).toBeUndefined();
  });

  it('produces nothing for the bodyless needs-work event', () => {
    expect(
      parseBitbucketDataCenterReviewEvent('pr:reviewer:needs_work', dataCenterPayload),
    ).toBeNull();
  });
});
