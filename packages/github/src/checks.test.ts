import type { CheckResult, EvidenceBundle } from '@agent-zero/shared';
import { describe, expect, it } from 'vitest';

import { checkConclusion, GitHubChecks } from './checks.js';

const target = { owner: 'acme', repo: 'app', number: 7, headSha: 'a'.repeat(40) };

const passing: CheckResult = {
  command: 'pnpm run test',
  exitCode: 0,
  stdout: '',
  stderr: '',
  durationMs: 5,
};
const failing: CheckResult = { ...passing, exitCode: 1, stderr: 'assertion failed' };

function bundle(overrides: Partial<EvidenceBundle> = {}): EvidenceBundle {
  return {
    taskId: 'az_test',
    state: 'completed',
    verdict: 'accepted',
    verified: true,
    mode: 'fix',
    source: 'github:acme/app#7',
    runner: { kind: 'container', isolated: true, writable: true, network: 'none' },
    finding: null,
    plan: [],
    changedFiles: ['src/user.ts'],
    checks: [passing],
    attempts: 1,
    transitions: [],
    summary: 'Fixed and verified',
    ...overrides,
  };
}

describe('checkConclusion', () => {
  it('reports success only for a verified run', () => {
    expect(checkConclusion(bundle())).toBe('success');
  });

  it('never reports success when a check failed', () => {
    expect(checkConclusion(bundle({ checks: [passing, failing], verified: true }))).toBe('failure');
  });

  it('reports a crashed run as a failure', () => {
    expect(checkConclusion(bundle({ state: 'failed', verified: false, checks: [] }))).toBe(
      'failure',
    );
  });

  it('asks for action when a run needs a human', () => {
    expect(checkConclusion(bundle({ state: 'needs-human', verified: false, checks: [] }))).toBe(
      'action_required',
    );
  });

  it('reports rejected feedback as neutral rather than a pull-request failure', () => {
    expect(
      checkConclusion(
        bundle({ verdict: 'rejected', verified: false, checks: [], changedFiles: [] }),
      ),
    ).toBe('neutral');
  });

  it('reports an observe-only run as neutral', () => {
    expect(
      checkConclusion(bundle({ mode: 'observe', verified: false, checks: [], changedFiles: [] })),
    ).toBe('neutral');
  });
});

/** One recorded request, already decoded so tests never stringify an unknown body. */
interface RecordedCall {
  url: string;
  headers: Headers;
  body: Record<string, unknown>;
}

type FetchArguments = Parameters<typeof globalThis.fetch>;

const token = 'ghs_token_value_1234567890';

function requestUrl(url: FetchArguments[0]): string {
  if (typeof url === 'string') return url;
  return url instanceof URL ? url.href : url.url;
}

function readBody(body: NonNullable<FetchArguments[1]>['body']): Record<string, unknown> {
  if (typeof body !== 'string') return {};
  const parsed: unknown = JSON.parse(body);
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? { ...parsed }
    : {};
}

function created(): Response {
  return new Response(JSON.stringify({ id: 42 }), {
    status: 201,
    headers: { 'content-type': 'application/json' },
  });
}

function client(handler: () => Response = created): {
  checks: GitHubChecks;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const checks = new GitHubChecks({
    token,
    fetch: async (url, init) => {
      calls.push({
        url: requestUrl(url),
        headers: new Headers(init?.headers),
        body: readBody(init?.body),
      });
      return handler();
    },
  });
  return { checks, calls };
}

/** The check output object a completion request carries. */
function readOutput(call: RecordedCall | undefined): { title: string; text: string } {
  const output = call?.body.output;
  if (typeof output !== 'object' || output === null) throw new Error('no check output recorded');
  const record: Record<string, unknown> = { ...output };
  return {
    title: typeof record.title === 'string' ? record.title : '',
    text: typeof record.text === 'string' ? record.text : '',
  };
}

describe('GitHubChecks', () => {
  it('opens an in-progress run against the head commit', async () => {
    const { checks, calls } = client(created);
    await expect(checks.start(target)).resolves.toBe(42);
    expect(calls[0]?.url).toBe('https://api.github.com/repos/acme/app/check-runs');
    expect(calls[0]?.body).toMatchObject({
      head_sha: target.headSha,
      status: 'in_progress',
      name: 'Agent Zero',
    });
  });

  it('sends the token only as an authorization header', async () => {
    const { checks, calls } = client(created);
    await checks.publish(target, bundle());
    expect(calls[0]?.headers.get('authorization')).toBe(`Bearer ${token}`);
    expect(JSON.stringify(calls[0]?.body)).not.toContain('ghs_token_value');
    expect(calls[0]?.url).not.toContain('ghs_token_value');
  });

  it('completes a run with the evidence report and a matching conclusion', async () => {
    const { checks, calls } = client(created);
    await checks.complete(target, 42, bundle({ verified: false, checks: [failing] }));
    expect(calls[0]?.url).toBe('https://api.github.com/repos/acme/app/check-runs/42');
    expect(calls[0]?.body.conclusion).toBe('failure');
    const output = readOutput(calls[0]);
    expect(output.title).toContain('Feedback accepted');
    expect(output.title).toContain('failed');
    expect(output.text).toContain('assertion failed');
  });

  it('keeps the report inside the GitHub output limit', async () => {
    const { checks, calls } = client(created);
    await checks.publish(
      target,
      bundle({ verified: false, checks: [{ ...failing, stderr: 'x'.repeat(200_000) }] }),
    );
    expect(readOutput(calls[0]).text.length).toBeLessThanOrEqual(60_000);
  });

  it('redacts the token from a failed request instead of leaking it', async () => {
    const { checks } = client(() => new Response(`bad credentials for ${token}`, { status: 401 }));
    await expect(checks.publish(target, bundle())).rejects.toThrow(/\[redacted]/);
    await expect(checks.publish(target, bundle())).rejects.not.toThrow(/ghs_token_value/);
  });

  it('fails loudly when GitHub does not return a check run id', async () => {
    const { checks } = client(
      () =>
        new Response(JSON.stringify({ message: 'ok' }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }),
    );
    await expect(checks.start(target)).rejects.toThrow('did not return a check run id');
  });
});
