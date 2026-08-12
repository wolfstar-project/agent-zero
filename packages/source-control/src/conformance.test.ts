import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { conformanceCases, type ProviderConformanceFixtures } from './conformance.js';
import type { ProviderKind, WebhookDelivery } from './contracts.js';
import { allProviders } from './registry.js';

const secret = 'webhook-secret';
const token = 'zz-status-credential';

function hmac(body: string, prefix = ''): string {
  return `${prefix}${createHmac('sha256', secret).update(body).digest('hex')}`;
}

function githubDelivery(event: string, payload: unknown): WebhookDelivery {
  const body = JSON.stringify(payload);
  return {
    body,
    headers: { 'x-github-event': event, 'x-hub-signature-256': hmac(body, 'sha256=') },
  };
}

function gitlabDelivery(event: string, payload: unknown): WebhookDelivery {
  return {
    body: JSON.stringify(payload),
    headers: { 'x-gitlab-event': event, 'x-gitlab-token': secret },
  };
}

function bitbucketDelivery(event: string, payload: unknown): WebhookDelivery {
  const body = JSON.stringify(payload);
  return {
    body,
    headers: { 'x-event-key': event, 'x-hub-signature': hmac(body, 'sha256=') },
  };
}

function giteaDelivery(event: string, payload: unknown): WebhookDelivery {
  const body = JSON.stringify(payload);
  return {
    body,
    headers: {
      'x-gitea-event': event,
      'x-gitea-signature': hmac(body),
      // Gitea sends a GitHub compatibility header; routing must still pick the Gitea adapter.
      'x-github-event': event,
    },
  };
}

const githubPullRequest = {
  number: 7,
  base: { sha: 'b'.repeat(40) },
  head: { sha: 'a'.repeat(40) },
};
const githubRepository = { name: 'app', owner: { login: 'acme' } };

const gitlabMergeRequest = {
  iid: 7,
  last_commit: { id: 'a'.repeat(40) },
};

const cloudPullRequest = {
  id: 7,
  source: { commit: { hash: 'a'.repeat(12) } },
  destination: { commit: { hash: 'b'.repeat(12) } },
};

const dataCenterPullRequest = {
  id: 7,
  fromRef: { latestCommit: 'a'.repeat(40) },
  toRef: {
    latestCommit: 'b'.repeat(40),
    repository: { slug: 'app', project: { key: 'ACME' } },
  },
};

const fixtures: Record<ProviderKind, ProviderConformanceFixtures> = {
  github: {
    secret,
    proactive: githubDelivery('pull_request', {
      action: 'opened',
      repository: githubRepository,
      pull_request: githubPullRequest,
    }),
    feedback: githubDelivery('pull_request_review', {
      action: 'submitted',
      repository: githubRepository,
      pull_request: githubPullRequest,
      review: {
        id: 202,
        body: 'Please guard the null return.',
        state: 'changes_requested',
        user: { login: 'alice', type: 'User' },
      },
    }),
    feedbackAuthor: 'alice',
    claimFree: githubDelivery('pull_request_review', {
      action: 'submitted',
      repository: githubRepository,
      pull_request: githubPullRequest,
      review: { id: 203, body: 'Nice.', state: 'approved', user: { login: 'alice' } },
    }),
    statusOptions: (fetch) => ({ token, fetch }),
    statusUrlPrefix: 'https://api.github.com/repos/acme/app/check-runs',
  },
  gitlab: {
    secret,
    proactive: gitlabDelivery('Merge Request Hook', {
      object_kind: 'merge_request',
      project: { path_with_namespace: 'acme/app' },
      object_attributes: { ...gitlabMergeRequest, action: 'open' },
    }),
    feedback: gitlabDelivery('Note Hook', {
      object_kind: 'note',
      user: { username: 'alice' },
      project: { path_with_namespace: 'acme/app' },
      object_attributes: {
        id: 11,
        note: 'This dereferences a null return.',
        noteable_type: 'MergeRequest',
        position: { new_path: 'src/user.ts', new_line: 12 },
      },
      merge_request: gitlabMergeRequest,
    }),
    feedbackAuthor: 'alice',
    claimFree: gitlabDelivery('Merge Request Hook', {
      object_kind: 'merge_request',
      project: { path_with_namespace: 'acme/app' },
      object_attributes: { ...gitlabMergeRequest, action: 'approved' },
    }),
    statusOptions: (fetch) => ({ token, fetch }),
    statusUrlPrefix: 'https://gitlab.com/api/v4/projects/acme%2Fapp/statuses/',
  },
  'bitbucket-cloud': {
    secret,
    proactive: bitbucketDelivery('pullrequest:created', {
      pullrequest: cloudPullRequest,
      repository: { full_name: 'acme/app' },
    }),
    feedback: bitbucketDelivery('pullrequest:comment_created', {
      pullrequest: cloudPullRequest,
      repository: { full_name: 'acme/app' },
      comment: {
        id: 31,
        content: { raw: 'This dereferences a null return.' },
        user: { nickname: 'alice', display_name: 'Alice' },
        inline: { path: 'src/user.ts', to: 12 },
      },
    }),
    feedbackAuthor: 'alice',
    claimFree: bitbucketDelivery('pullrequest:approved', {
      pullrequest: cloudPullRequest,
      repository: { full_name: 'acme/app' },
      approval: { user: { nickname: 'alice' } },
    }),
    statusOptions: (fetch) => ({ token, fetch }),
    statusUrlPrefix: 'https://api.bitbucket.org/2.0/repositories/acme/app/commit/',
  },
  'bitbucket-data-center': {
    secret,
    proactive: bitbucketDelivery('pr:opened', { pullRequest: dataCenterPullRequest }),
    feedback: bitbucketDelivery('pr:comment:added', {
      pullRequest: dataCenterPullRequest,
      comment: {
        id: 41,
        text: 'This dereferences a null return.',
        author: { name: 'alice', displayName: 'Alice' },
      },
    }),
    feedbackAuthor: 'alice',
    claimFree: bitbucketDelivery('pr:reviewer:approved', {
      pullRequest: dataCenterPullRequest,
      participant: { user: { name: 'alice' } },
    }),
    statusOptions: (fetch) => ({ token, fetch, baseUrl: 'https://bitbucket.example.com' }),
    statusUrlPrefix:
      'https://bitbucket.example.com/rest/api/latest/projects/ACME/repos/app/commits/',
  },
  gitea: {
    secret,
    proactive: giteaDelivery('pull_request', {
      action: 'opened',
      repository: githubRepository,
      pull_request: githubPullRequest,
    }),
    feedback: giteaDelivery('pull_request_review_rejected', {
      action: 'reviewed',
      repository: githubRepository,
      pull_request: githubPullRequest,
      sender: { login: 'alice' },
      review: { id: 51, type: 'pull_request_review_rejected', content: 'Guard the null return.' },
    }),
    feedbackAuthor: 'alice',
    claimFree: giteaDelivery('pull_request_review_approved', {
      action: 'reviewed',
      repository: githubRepository,
      pull_request: githubPullRequest,
      sender: { login: 'alice' },
      review: { id: 52, type: 'pull_request_review_approved', content: 'Nice.' },
    }),
    statusOptions: (fetch) => ({ token, fetch, baseUrl: 'https://gitea.example.com' }),
    statusUrlPrefix: 'https://gitea.example.com/api/v1/repos/acme/app/statuses/',
  },
};

for (const provider of allProviders()) {
  describe(`${provider.kind} adapter conformance`, () => {
    for (const conformanceCase of conformanceCases) {
      // oxlint-disable-next-line vitest/valid-title -- case names come from the shared suite
      it(conformanceCase.name, async () => {
        // The cases assert by throwing, so the suite stays framework-free for other runners.
        await expect(
          conformanceCase.run(provider, fixtures[provider.kind]),
        ).resolves.toBeUndefined();
      });
    }
  });
}
