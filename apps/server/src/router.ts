import { AgentZero } from '@agent-zero/agent';
import { loadConfig, mayModifyRepository } from '@agent-zero/config';
import {
  GitHubChecks,
  parseReviewEvent,
  reviewInputFromEvent,
  verifyWebhook,
} from '@agent-zero/github';
import { modelFromEnvironment } from '@agent-zero/models';
import { createRunner, runnerOptionsFromPolicy } from '@agent-zero/runner';
import {
  evidenceFromResult,
  renderEvidenceMarkdown,
  type EvidenceBundle,
  type PullRequestRef,
  type ReviewInput,
  type TaskResult,
} from '@agent-zero/shared';
import { z } from 'zod';

/** A finished run together with the evidence bundle derived from it. */
export interface StoredTask {
  result: TaskResult;
  evidence: EvidenceBundle;
}

export const tasks = new Map<string, StoredTask>();

export const taskInput = z.object({
  repository: z.string().min(1),
  feedback: z.string().min(1),
  mode: z.enum(['observe', 'suggest', 'fix', 'autonomous']),
  source: z.string().optional(),
  files: z.array(z.string()).optional(),
});

export function health() {
  return { status: 'ok' as const, service: 'agent-zero', version: '0.1.0' };
}

export function listTasks() {
  return { tasks: Array.from(tasks.values(), (task) => task.result) };
}

export function getTask(id: string): TaskResult | undefined {
  return tasks.get(id)?.result;
}

/** The rendered evidence report for a finished run. */
export function getTaskEvidence(id: string): string | undefined {
  const task = tasks.get(id);
  return task ? renderEvidenceMarkdown(task.evidence) : undefined;
}

export async function createTask(input: z.infer<typeof taskInput>): Promise<TaskResult> {
  return runTask({
    repository: input.repository,
    feedback: input.feedback,
    mode: input.mode,
    ...(input.source ? { source: input.source } : {}),
    ...(input.files ? { files: input.files } : {}),
  });
}

/**
 * Run one unit of work and store its evidence.
 *
 * This is the composition root: it resolves policy, builds an execution boundary that is read-only
 * unless the mode and the repository both authorize writing, and never lets the transport layer
 * choose those things for itself.
 */
export async function runTask(input: ReviewInput): Promise<TaskResult> {
  const config = await loadConfig(input.repository);
  const agent = new AgentZero({
    model: modelFromEnvironment(config.model.name, config.model.baseUrl),
    runner: createRunner(
      input.repository,
      runnerOptionsFromPolicy(config, mayModifyRepository(config, input.mode)),
    ),
    config,
  });
  const result = await agent.run(input);
  tasks.set(result.id, {
    result,
    evidence: evidenceFromResult(result, input),
  });
  return result;
}

export interface WebhookRequest {
  event: string;
  body: string;
  signature: string | undefined;
}

export interface WebhookOptions {
  secret: string;
  /** Where the pull request is already checked out. */
  checkoutPath: string;
  /** Logins to ignore, so the agent never reacts to its own comments. */
  ignoreAuthors?: readonly string[];
}

export type WebhookOutcome =
  | { status: 'rejected'; reason: string }
  | { status: 'ignored'; reason: string }
  | { status: 'accepted'; result: TaskResult; pullRequest: PullRequestRef };

/**
 * Handle an inbound GitHub webhook.
 *
 * The signature is verified before the payload is parsed, and the resulting run always uses
 * `observe`. An unauthenticated request can therefore never cause a repository write, and neither
 * can an authenticated one without an explicit follow-up.
 */
export async function ingestWebhook(
  request: WebhookRequest,
  options: WebhookOptions,
): Promise<WebhookOutcome> {
  if (!verifyWebhook(request.body, request.signature, options.secret))
    return { status: 'rejected', reason: 'Invalid webhook signature' };

  let payload: unknown;
  try {
    payload = JSON.parse(request.body);
  } catch {
    return { status: 'rejected', reason: 'Webhook body is not valid JSON' };
  }

  const event = parseReviewEvent(
    request.event,
    payload,
    options.ignoreAuthors ? { ignoreAuthors: options.ignoreAuthors } : {},
  );
  if (!event) return { status: 'ignored', reason: 'No actionable review feedback in this event' };

  const result = await runTask(reviewInputFromEvent(event, { checkoutPath: options.checkoutPath }));
  return { status: 'accepted', result, pullRequest: event.pullRequest };
}

export interface PublishOptions {
  /** Supplied by the caller rather than read here, so no code path reaches GitHub implicitly. */
  token: string | undefined;
  fetch?: typeof globalThis.fetch;
}

/** The credential a deployment configures for check reporting. */
export function githubTokenFromEnvironment(): string | undefined {
  return process.env.GITHUB_TOKEN;
}

/**
 * Publish a finished run to GitHub Checks.
 *
 * Reporting is skipped rather than faked when no token is configured, so a missing credential never
 * turns into a green check.
 */
export async function publishEvidence(
  target: PullRequestRef,
  taskIdentifier: string,
  options: PublishOptions,
): Promise<{ published: boolean; reason?: string }> {
  if (!options.token) return { published: false, reason: 'GITHUB_TOKEN is not configured' };
  const task = tasks.get(taskIdentifier);
  if (!task) return { published: false, reason: `Unknown task: ${taskIdentifier}` };
  await new GitHubChecks({
    token: options.token,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  }).publish(target, task.evidence);
  return { published: true };
}
