import { describe, expect, it } from 'vitest';

import { GitHubIssueComments } from './comments.js';

interface RecordedRequest {
  method: string;
  path: string;
  body: unknown;
}

function fakeGitHub(response: { status: number; body: string }): {
  fetch: typeof globalThis.fetch;
  requests: RecordedRequest[];
} {
  const requests: RecordedRequest[] = [];
  const handler: typeof globalThis.fetch = async (input, init) => {
    const path = new URL(
      typeof input === 'string' ? input : 'url' in input ? input.url : input.href,
    ).pathname;
    requests.push({
      method: init?.method ?? 'GET',
      path,
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
    });
    return new Response(response.body, { status: response.status });
  };
  return { fetch: handler, requests };
}

const issue = { owner: 'acme', repo: 'app', number: 12 };

describe('GitHubIssueComments', () => {
  it('posts the comment to the issue and returns its id', async () => {
    const github = fakeGitHub({ status: 201, body: '{"id": 7001}' });
    const comments = new GitHubIssueComments({ token: 'secret-token-value', fetch: github.fetch });
    await expect(comments.create(issue, 'Validated with evidence')).resolves.toBe(7001);
    expect(github.requests).toEqual([
      {
        method: 'POST',
        path: '/repos/acme/app/issues/12/comments',
        body: { body: 'Validated with evidence' },
      },
    ]);
  });

  it('sends the token only as an authorization header', async () => {
    const seen: (string | null)[] = [];
    const handler: typeof globalThis.fetch = async (_input, init) => {
      seen.push(new Headers(init?.headers).get('authorization'));
      return new Response('{"id": 1}', { status: 201 });
    };
    const comments = new GitHubIssueComments({ token: 'secret-token-value', fetch: handler });
    await comments.create(issue, 'body');
    expect(seen).toEqual(['Bearer secret-token-value']);
  });

  it('redacts the token from a failed response before raising it', async () => {
    const github = fakeGitHub({ status: 500, body: 'boom secret-token-value boom' });
    const comments = new GitHubIssueComments({ token: 'secret-token-value', fetch: github.fetch });
    await expect(comments.create(issue, 'body')).rejects.toThrow(REDACTED_FAILURE);
  });

  it('fails loudly when GitHub returns no comment id', async () => {
    const github = fakeGitHub({ status: 201, body: '{}' });
    const comments = new GitHubIssueComments({ token: 'secret-token-value', fetch: github.fetch });
    await expect(comments.create(issue, 'body')).rejects.toThrow('did not return a comment id');
  });
});

const REDACTED_FAILURE = /^(?!.*secret-token-value).*500/s;
