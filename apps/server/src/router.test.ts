import { createHmac } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import {
  decideApproval,
  getStoredTask,
  getTask,
  getTaskEvidence,
  health,
  ingestWebhook,
  listTasks,
  publishEvidence,
  runTask,
  taskInput,
  tasks,
} from './router.js';

const secret = 'webhook-secret-value';
const MODE_ERROR = /mode/i;

function sign(body: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

/** A GitHub delivery for the router: raw body plus the headers GitHub would send. */
function githubDelivery(event: string, body: string, signature = sign(body)) {
  return {
    body,
    headers: { 'x-github-event': event, 'x-hub-signature-256': signature },
  };
}

function reviewPayload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    action: 'submitted',
    repository: { name: 'app', owner: { login: 'acme' } },
    pull_request: {
      number: 7,
      base: { sha: 'b'.repeat(40) },
      head: { sha: 'a'.repeat(40) },
    },
    review: {
      id: 1,
      body: 'load() can return null',
      state: 'changes_requested',
      user: { login: 'alice', type: 'User' },
      ...overrides,
    },
  });
}

let checkout: string;

beforeEach(async () => {
  tasks.clear();
  checkout = await mkdtemp(join(tmpdir(), 'agent-zero-server-'));
  await writeFile(join(checkout, 'package.json'), JSON.stringify({ scripts: {} }), 'utf8');
});

describe('server task API', () => {
  it('exposes health metadata for Nitro handlers', () => {
    expect(health()).toMatchObject({ status: 'ok', service: 'agent-zero' });
  });

  it('starts with an empty task collection', async () => {
    await expect(listTasks()).resolves.toEqual({ tasks: [] });
  });

  it('keeps task input validation independent from HTTP transport', () => {
    expect(
      taskInput.parse({ repository: '.', feedback: 'Check error handling', mode: 'observe' }),
    ).toMatchObject({ repository: '.', mode: 'observe' });
  });

  it('rejects an unknown mode at the transport edge', () => {
    expect(() => taskInput.parse({ repository: '.', feedback: 'x', mode: 'yolo' })).toThrow(
      MODE_ERROR,
    );
  });

  it('records a human approval only for a task awaiting review', async () => {
    const timestamp = new Date(0).toISOString();
    tasks.set('az_approval', {
      id: 'az_approval',
      repository: 'acme/app',
      status: 'needs-human',
      createdAt: timestamp,
      updatedAt: timestamp,
      events: [],
    });

    await expect(
      decideApproval('az_approval', 'approved', 'release-manager', 'Reviewed evidence'),
    ).resolves.toMatchObject({
      status: 'needs-human',
      approval: {
        decision: 'approved',
        actor: 'release-manager',
        comment: 'Reviewed evidence',
      },
    });
    await expect(getStoredTask('az_approval')).resolves.toMatchObject({
      approval: { decision: 'approved' },
    });
  });
});

describe('runTask', () => {
  it('stores the result and its evidence together', async () => {
    const result = await runTask({
      repository: checkout,
      feedback: 'load() is wrong',
      mode: 'observe',
    });
    await expect(getTask(result.id)).resolves.toEqual(result);
    await expect(getTaskEvidence(result.id)).resolves.toContain('## Agent Zero');
    await expect(listTasks()).resolves.toMatchObject({ tasks: [expect.any(Object)] });
  });

  it('produces a read-only boundary for an observe run', async () => {
    const result = await runTask({
      repository: checkout,
      feedback: 'load() is wrong',
      mode: 'observe',
    });
    expect(result.runner.writable).toBe(false);
    expect(result.changedFiles).toEqual([]);
  });

  it('keeps the boundary read-only in fix mode while policy disables autofix', async () => {
    const result = await runTask({
      repository: checkout,
      feedback: 'load() is wrong',
      mode: 'fix',
    });
    expect(result.runner.writable).toBe(false);
  });

  it('reports an unverified conclusion when no model is configured', async () => {
    const result = await runTask({
      repository: checkout,
      feedback: 'load() is wrong',
      mode: 'observe',
    });
    expect(result.verified).toBe(false);
    expect(result.verdict).toBe('rejected');
  });
});

describe('ingestWebhook', () => {
  const options = () => ({
    providers: [{ kind: 'github' as const, secret }],
    checkoutPath: checkout,
  });

  it('rejects a delivery no configured provider recognizes', async () => {
    const body = reviewPayload();
    await expect(
      ingestWebhook({ body, headers: { 'x-gitlab-event': 'Note Hook' } }, options()),
    ).resolves.toEqual({
      status: 'rejected',
      reason: 'No configured provider recognizes this delivery',
    });
    expect(tasks.size).toBe(0);
  });

  it('rejects a forged signature before parsing the payload', async () => {
    const body = reviewPayload();
    await expect(
      ingestWebhook(githubDelivery('pull_request_review', body, 'sha256=deadbeef'), options()),
    ).resolves.toEqual({ status: 'rejected', reason: 'Invalid webhook signature' });
    expect(tasks.size).toBe(0);
  });

  it('rejects a body that is not JSON', async () => {
    const outcome = await ingestWebhook(
      githubDelivery('pull_request_review', 'not json'),
      options(),
    );
    expect(outcome).toEqual({ status: 'rejected', reason: 'Webhook body is not valid JSON' });
  });

  it('ignores an event that carries no claim to validate', async () => {
    const outcome = await ingestWebhook(
      githubDelivery('pull_request_review', reviewPayload({ state: 'approved' })),
      options(),
    );
    expect(outcome.status).toBe('ignored');
    expect(tasks.size).toBe(0);
  });

  it('ignores its own account so a run cannot answer itself', async () => {
    const outcome = await ingestWebhook(
      githubDelivery('pull_request_review', reviewPayload({ user: { login: 'agent-zero[bot]' } })),
      { ...options(), ignoreAuthors: ['agent-zero[bot]'] },
    );
    expect(outcome.status).toBe('ignored');
  });

  it('runs an authenticated review in observe mode and never writes', async () => {
    const outcome = await ingestWebhook(
      githubDelivery('pull_request_review', reviewPayload()),
      options(),
    );
    expect(outcome.status).toBe('accepted');
    if (outcome.status !== 'accepted') return;
    expect(outcome.provider).toBe('github');
    expect(outcome.changeRequest).toEqual({
      provider: 'github',
      owner: 'acme',
      repo: 'app',
      number: 7,
      baseSha: 'b'.repeat(40),
      headSha: 'a'.repeat(40),
    });
    expect(outcome.result.runner.writable).toBe(false);
    expect(outcome.result.changedFiles).toEqual([]);
    expect(outcome.result.summary).toContain('github:acme/app#7');
  });

  it('accepts deliveries from a second configured provider in the same deployment', async () => {
    const body = JSON.stringify({
      object_kind: 'note',
      user: { username: 'alice' },
      project: { path_with_namespace: 'acme/app' },
      object_attributes: {
        id: 11,
        note: 'load() can return null',
        noteable_type: 'MergeRequest',
      },
      merge_request: { iid: 7, last_commit: { id: 'a'.repeat(40) } },
    });
    const outcome = await ingestWebhook(
      { body, headers: { 'x-gitlab-event': 'Note Hook', 'x-gitlab-token': secret } },
      { ...options(), providers: [...options().providers, { kind: 'gitlab' as const, secret }] },
    );
    expect(outcome.status).toBe('accepted');
    if (outcome.status !== 'accepted') return;
    expect(outcome.provider).toBe('gitlab');
    expect(outcome.changeRequest.baseSha).toBeUndefined();
    expect(outcome.result.summary).toContain('gitlab:acme/app!7');
  });

  it('ignores proactive pull-request events until repository policy enables them', async () => {
    const body = JSON.stringify({
      action: 'synchronize',
      repository: { name: 'app', owner: { login: 'acme' } },
      pull_request: {
        number: 7,
        base: { sha: 'b'.repeat(40) },
        head: { sha: 'a'.repeat(40) },
      },
    });
    await expect(ingestWebhook(githubDelivery('pull_request', body), options())).resolves.toEqual({
      status: 'ignored',
      reason: 'Proactive review is disabled by repository policy',
    });
  });

  it('runs an enabled proactive pull-request review in repository mode', async () => {
    await writeFile(
      join(checkout, '.agent-zero.yml'),
      'version: 1\nproactive:\n  enabled: true\nmode: observe\n',
      'utf8',
    );
    const body = JSON.stringify({
      action: 'opened',
      repository: { name: 'app', owner: { login: 'acme' } },
      pull_request: {
        number: 7,
        base: { sha: 'b'.repeat(40) },
        head: { sha: 'a'.repeat(40) },
      },
    });
    const outcome = await ingestWebhook(githubDelivery('pull_request', body), options());
    expect(outcome.status).toBe('accepted');
    if (outcome.status !== 'accepted') return;
    expect(outcome.result.runner.writable).toBe(false);
    await expect(getTaskEvidence(outcome.result.id)).resolves.toContain('proactive finding');
  });
});

type FetchArguments = Parameters<typeof globalThis.fetch>;

function readBody(body: NonNullable<FetchArguments[1]>['body']): Record<string, unknown> {
  if (typeof body !== 'string') return {};
  const parsed: unknown = JSON.parse(body);
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? { ...parsed }
    : {};
}

/** Records what would have been sent to GitHub, so no test needs the network. */
function recordingFetch(): {
  fetch: typeof globalThis.fetch;
  bodies: Record<string, unknown>[];
} {
  const bodies: Record<string, unknown>[] = [];
  const fetch: typeof globalThis.fetch = async (_url, init) => {
    bodies.push(readBody(init?.body));
    return new Response(JSON.stringify({ id: 99 }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fetch, bodies };
}

describe('publishEvidence', () => {
  const target = {
    provider: 'github' as const,
    owner: 'acme',
    repo: 'app',
    number: 7,
    baseSha: 'b'.repeat(40),
    headSha: 'a'.repeat(40),
  };

  it('skips publishing rather than faking a check without a token', async () => {
    const result = await runTask({ repository: checkout, feedback: 'x', mode: 'observe' });
    const { fetch, bodies } = recordingFetch();
    await expect(publishEvidence(target, result.id, { token: undefined, fetch })).resolves.toEqual({
      published: false,
      reason: 'GITHUB_TOKEN is not configured',
    });
    expect(bodies).toEqual([]);
  });

  it('reports an unknown task instead of publishing an empty report', async () => {
    const { fetch, bodies } = recordingFetch();
    await expect(
      publishEvidence(target, 'az_missing', { token: 'ghs_token_value', fetch }),
    ).resolves.toMatchObject({ published: false });
    expect(bodies).toEqual([]);
  });

  it('publishes the stored evidence without claiming an unverified run passed', async () => {
    const result = await runTask({ repository: checkout, feedback: 'x', mode: 'observe' });
    const { fetch, bodies } = recordingFetch();
    await expect(
      publishEvidence(target, result.id, { token: 'ghs_token_value', fetch }),
    ).resolves.toEqual({ published: true });
    expect(bodies[0]).toMatchObject({ head_sha: target.headSha, status: 'completed' });
    expect(bodies[0]?.conclusion).not.toBe('success');
  });

  it('surfaces an explicit degradation on a provider without a neutral state', async () => {
    const result = await runTask({ repository: checkout, feedback: 'x', mode: 'observe' });
    const { fetch, bodies } = recordingFetch();
    const outcome = await publishEvidence({ ...target, provider: 'gitlab' as const }, result.id, {
      token: 'glpat_token_value',
      fetch,
    });
    expect(outcome.published).toBe(true);
    expect(outcome.reason).toContain('no neutral state');
    expect(bodies[0]?.state).toBe('success');
  });
});
