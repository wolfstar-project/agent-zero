import {
  evidenceTitle,
  redactSecrets,
  renderEvidenceMarkdown,
  secretValuesFromEnvironment,
  type EvidenceBundle,
  type PullRequestRef,
} from '@agent-zero/shared';

/** Conclusions a check run may report. */
export type CheckConclusion = 'success' | 'failure' | 'neutral' | 'action_required';

/** GitHub caps check output fields; staying under the limit keeps a report from being rejected. */
const MAX_OUTPUT = 60_000;
const MAX_TITLE = 255;
const MAX_SUMMARY = 4_000;

export interface GitHubChecksOptions {
  token: string;
  baseUrl?: string;
  /** Check run name, so several Agent Zero configurations can report side by side. */
  name?: string;
  fetch?: typeof globalThis.fetch;
}

/**
 * Decide what a run means for a pull request.
 *
 * Verification is the only thing that produces `success`. A failing check, an unreached terminal
 * state, or an unverified change can never be reported as a passing check, which is what keeps the
 * GitHub status honest. Rejecting incorrect feedback is a legitimate, neutral outcome rather than a
 * failure: nothing is wrong with the pull request.
 */
export function checkConclusion(bundle: EvidenceBundle): CheckConclusion {
  if (bundle.state === 'failed') return 'failure';
  if (bundle.checks.some((check) => check.exitCode !== 0)) return 'failure';
  if (bundle.state === 'needs-human') return 'action_required';
  if (bundle.verified) return 'success';
  return 'neutral';
}

/**
 * Publishes run evidence to the GitHub Checks API.
 *
 * The token is only ever sent as an Authorization header, and any error body is redacted before it
 * is raised, so a failed publish cannot leak a credential into logs.
 */
export class GitHubChecks {
  private readonly baseUrl: string;
  private readonly name: string;
  private readonly request: typeof globalThis.fetch;

  constructor(private readonly options: GitHubChecksOptions) {
    this.baseUrl = options.baseUrl ?? 'https://api.github.com';
    this.name = options.name ?? 'Agent Zero';
    this.request = options.fetch ?? globalThis.fetch;
  }

  /** Open an in-progress check run so a long verification is visible while it happens. */
  async start(target: PullRequestRef): Promise<number> {
    const body = await this.send('POST', `/repos/${target.owner}/${target.repo}/check-runs`, {
      name: this.name,
      head_sha: target.headSha,
      status: 'in_progress',
    });
    return readCheckRunId(body);
  }

  /** Complete an existing check run with the run's evidence. */
  async complete(
    target: PullRequestRef,
    checkRunId: number,
    bundle: EvidenceBundle,
  ): Promise<void> {
    await this.send(
      'PATCH',
      `/repos/${target.owner}/${target.repo}/check-runs/${String(checkRunId)}`,
      this.completionPayload(bundle),
    );
  }

  /** Create an already-completed check run, for a verification that finished quickly. */
  async publish(target: PullRequestRef, bundle: EvidenceBundle): Promise<number> {
    const body = await this.send('POST', `/repos/${target.owner}/${target.repo}/check-runs`, {
      name: this.name,
      head_sha: target.headSha,
      ...this.completionPayload(bundle),
    });
    return readCheckRunId(body);
  }

  /** The request body for a finished check run, including the rendered evidence report. */
  completionPayload(bundle: EvidenceBundle): Record<string, unknown> {
    const secrets = secretValuesFromEnvironment();
    return {
      status: 'completed',
      conclusion: checkConclusion(bundle),
      output: {
        title: redactSecrets(evidenceTitle(bundle), secrets).slice(0, MAX_TITLE),
        summary: redactSecrets(bundle.summary, secrets).slice(0, MAX_SUMMARY),
        text: renderEvidenceMarkdown(bundle, { maxLength: MAX_OUTPUT, secrets }),
      },
    };
  }

  private async send(
    method: 'POST' | 'PATCH',
    path: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    const response = await this.request(`${this.baseUrl}${path}`, {
      method,
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${this.options.token}`,
        'content-type': 'application/json',
        'x-github-api-version': '2022-11-28',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const detail = redactSecrets(await response.text(), [
        this.options.token,
        ...secretValuesFromEnvironment(),
      ]);
      throw new Error(
        `GitHub check run request failed (${String(response.status)}): ${detail.slice(0, 1_000)}`,
      );
    }
    return response.json();
  }
}

function readCheckRunId(body: unknown): number {
  if (typeof body === 'object' && body !== null && 'id' in body && typeof body.id === 'number')
    return body.id;
  throw new Error('GitHub did not return a check run id');
}
