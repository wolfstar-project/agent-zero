import { AgentZero } from '@agent-zero/agent';
import { loadConfig, mayModifyRepository } from '@agent-zero/config';
import {
  GitHubChecks,
  GitHubPullRequests,
  issueBranchName,
  issueInputFromTask,
  parseIssueTask,
  parseReviewEvent,
  prepareIssuePullRequest,
  reviewInputFromEvent,
  verifyWebhook,
  type BranchFile,
} from '@agent-zero/github';
import { modelFromEnvironment } from '@agent-zero/models';
import {
  createRunner,
  LocalRunner,
  runnerOptionsFromPolicy,
  type RunnerPool,
} from '@agent-zero/runner';
import {
  evidenceFromResult,
  now,
  redactSecrets,
  renderEvidenceMarkdown,
  secretValuesFromEnvironment,
  taskId,
  type IssueRef,
  type PullRequestRef,
  type ReviewInput,
  type TaskResult,
} from '@agent-zero/shared';
import { z } from 'zod';

import {
  MemoryTaskStore,
  TaskScheduler,
  type ApprovalDecision,
  type StoredTask,
  type TaskStore,
} from './control-plane.js';

const TRAILING_SLASH = /\/$/u;

const defaultStore = new MemoryTaskStore();
const defaultScheduler = new TaskScheduler({
  maxConcurrent: 4,
  maxQueued: 100,
  maxConcurrentPerRepository: 1,
});

/** Backwards-compatible inspection hook for embedded callers and tests. */
export const tasks = defaultStore.records;

export const taskInput = z
  .object({
    repository: z.string().min(1),
    feedback: z.string().min(1).optional(),
    trigger: z.enum(['feedback', 'proactive']).default('feedback'),
    mode: z.enum(['observe', 'suggest', 'fix', 'autonomous']),
    source: z.string().optional(),
    files: z.array(z.string()).optional(),
  })
  .superRefine((input, context) => {
    if (input.trigger !== 'proactive' && input.feedback === undefined)
      context.addIssue({ code: 'custom', path: ['feedback'], message: 'Feedback is required' });
  });

/** The actor is never accepted from the wire; the transport derives it from the authenticated principal. */
export const approvalInput = z.object({
  taskId: z.string().min(1),
  decision: z.enum(['approved', 'rejected']),
  comment: z.string().max(2_000).optional(),
});

export function health() {
  return { status: 'ok' as const, service: 'agent-zero', version: '0.4.0' };
}

export async function listTasks(store: TaskStore = defaultStore) {
  return { tasks: await store.list() };
}

export async function getStoredTask(
  id: string,
  store: TaskStore = defaultStore,
): Promise<StoredTask | undefined> {
  return store.get(id);
}

export async function getTask(
  id: string,
  store: TaskStore = defaultStore,
): Promise<TaskResult | undefined> {
  return (await store.get(id))?.result;
}

/** The rendered evidence report for a finished run. */
export async function getTaskEvidence(
  id: string,
  store: TaskStore = defaultStore,
): Promise<string | undefined> {
  const task = await store.get(id);
  return task?.evidence ? renderEvidenceMarkdown(task.evidence) : undefined;
}

export async function createTask(
  input: z.infer<typeof taskInput>,
  store: TaskStore = defaultStore,
  scheduler: TaskScheduler = defaultScheduler,
): Promise<TaskResult> {
  return runTask(
    {
      repository: input.repository,
      mode: input.mode,
      trigger: input.trigger,
      ...(input.feedback ? { feedback: input.feedback } : {}),
      ...(input.source ? { source: input.source } : {}),
      ...(input.files ? { files: input.files } : {}),
    },
    { store, scheduler },
  );
}

export interface RunTaskOptions {
  store?: TaskStore;
  scheduler?: TaskScheduler;
  /** Optional hosted execution pool; its leases still expose only the Runner boundary. */
  runnerPool?: RunnerPool;
}

/**
 * Queue and run one unit of work, persisting its structured lifecycle and evidence.
 *
 * This composition root resolves policy and constructs the only execution boundary. Neither the
 * transport, persistence adapter, scheduler, nor dashboard can execute repository commands.
 */
export async function runTask(
  input: ReviewInput,
  options: RunTaskOptions = {},
): Promise<TaskResult> {
  const store = options.store ?? defaultStore;
  const scheduler = options.scheduler ?? defaultScheduler;
  const identifier = taskId();
  const timestamp = now();
  const record: StoredTask = {
    id: identifier,
    repository: repositoryLabel(input),
    status: 'queued',
    createdAt: timestamp,
    updatedAt: timestamp,
    events: [],
  };
  await store.save(record);

  try {
    return await scheduler.schedule(input.repository, async () => {
      record.status = 'running';
      record.updatedAt = now();
      await store.save(record);

      const config = await loadConfig(input.repository);
      let eventWrites = Promise.resolve();
      const writable = mayModifyRepository(config, input.mode);
      const lease = options.runnerPool
        ? await options.runnerPool.acquire({
            taskId: identifier,
            repository: input.repository,
            mode: input.mode,
            writable,
            network: config.permissions.network,
            leaseMs: config.agent.timeoutMs,
          })
        : undefined;
      const runner =
        lease?.runner ?? createRunner(input.repository, runnerOptionsFromPolicy(config, writable));
      const agent = new AgentZero({
        model: modelFromEnvironment(config.model),
        runner,
        config,
        taskIdentifier: identifier,
        onEvent: (event) => {
          record.events.push(event);
          record.updatedAt = event.timestamp;
          eventWrites = eventWrites.then(() => store.save(record));
        },
      });
      let result: TaskResult;
      try {
        result = await agent.run(input);
      } finally {
        if (lease) await options.runnerPool?.release(lease.id);
      }
      await eventWrites;
      record.status = result.state;
      record.updatedAt = now();
      record.result = result;
      record.evidence = evidenceFromResult(result, input);
      await store.save(record);
      return result;
    });
  } catch (error) {
    record.status = 'failed';
    record.updatedAt = now();
    record.events.push({
      state: 'failed',
      message: redactSecrets(error instanceof Error ? error.message : String(error)),
      timestamp: record.updatedAt,
    });
    await store.save(record);
    throw error;
  }
}

export async function decideApproval(
  taskIdentifier: string,
  decision: ApprovalDecision,
  actor: string,
  comment: string | undefined,
  store: TaskStore = defaultStore,
): Promise<StoredTask> {
  const record = await store.get(taskIdentifier);
  if (!record) throw new Error(`Unknown task: ${taskIdentifier}`);
  if (record.status !== 'needs-human')
    throw new Error('Only tasks awaiting human review can receive an approval decision');
  const timestamp = now();
  record.approval = {
    decision,
    actor: redactSecrets(actor, secretValuesFromEnvironment()),
    comment: comment ? redactSecrets(comment, secretValuesFromEnvironment()) : null,
    decidedAt: timestamp,
  };
  record.updatedAt = timestamp;
  await store.save(record);
  return record;
}

export interface WebhookRequest {
  event: string;
  body: string;
  signature: string | undefined;
}

export interface WebhookOptions {
  secret: string;
  checkoutPath: string;
  ignoreAuthors?: readonly string[];
  store?: TaskStore;
  scheduler?: TaskScheduler;
  /** Credentials for publishing an issue run's verified changes as a pull request. */
  github?: { token: string | undefined; fetch?: typeof globalThis.fetch };
}

export type WebhookOutcome =
  | { status: 'rejected'; reason: string }
  | { status: 'ignored'; reason: string }
  | { status: 'accepted'; result: TaskResult; pullRequest: PullRequestRef }
  | {
      status: 'accepted';
      result: TaskResult;
      issue: IssueRef;
      /** The pull request the verified changes were published as, when one was earned. */
      openedPullRequest: { number: number; url: string } | null;
      /** Why no pull request was opened. Null when one was. */
      pullRequestReason: string | null;
    };

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

  if (request.event === 'issues') return ingestIssueEvent(payload, options);

  const event = parseReviewEvent(
    request.event,
    payload,
    options.ignoreAuthors ? { ignoreAuthors: options.ignoreAuthors } : {},
  );
  if (!event) return { status: 'ignored', reason: 'No actionable review feedback in this event' };

  let mode: ReviewInput['mode'] = 'observe';
  if (event.trigger === 'proactive') {
    const config = await loadConfig(options.checkoutPath);
    if (!config.proactive.enabled)
      return { status: 'ignored', reason: 'Proactive review is disabled by repository policy' };
    mode = config.mode;
  }

  const runOptions: RunTaskOptions = {
    ...(options.store ? { store: options.store } : {}),
    ...(options.scheduler ? { scheduler: options.scheduler } : {}),
  };
  const result = await runTask(
    reviewInputFromEvent(event, { checkoutPath: options.checkoutPath, mode }),
    runOptions,
  );
  return { status: 'accepted', result, pullRequest: event.pullRequest };
}

/**
 * Run one scoped issue task and, when the run earns it, publish the result as a pull request.
 *
 * The issue text is untrusted input: it becomes feedback for the runtime to validate, the run mode
 * comes only from repository policy, and policy must opt in (`issues.enabled` plus the required
 * label) before any model call happens. A failed publication never fails the run — the evidence is
 * already persisted — it is reported as the reason no pull request exists.
 */
async function ingestIssueEvent(
  payload: unknown,
  options: WebhookOptions,
): Promise<WebhookOutcome> {
  const config = await loadConfig(options.checkoutPath);
  if (!config.issues.enabled)
    return { status: 'ignored', reason: 'Issue tasks are disabled by repository policy' };

  const task = parseIssueTask('issues', payload, {
    requireLabel: config.issues.requireLabel,
    ...(options.ignoreAuthors ? { ignoreAuthors: options.ignoreAuthors } : {}),
  });
  if (!task) return { status: 'ignored', reason: 'No actionable issue task in this event' };

  const runOptions: RunTaskOptions = {
    ...(options.store ? { store: options.store } : {}),
    ...(options.scheduler ? { scheduler: options.scheduler } : {}),
  };
  const result = await runTask(
    issueInputFromTask(task, { checkoutPath: options.checkoutPath, mode: config.mode }),
    runOptions,
  );

  let openedPullRequest: { number: number; url: string } | null = null;
  let pullRequestReason: string | null = null;
  try {
    const publication = await openIssuePullRequest(result.id, {
      token: options.github?.token,
      checkoutPath: options.checkoutPath,
      ...(options.github?.fetch ? { fetch: options.github.fetch } : {}),
      ...(options.store ? { store: options.store } : {}),
    });
    if (publication.opened)
      openedPullRequest = { number: publication.number, url: publication.url };
    else pullRequestReason = publication.reason;
  } catch (error) {
    pullRequestReason = redactSecrets(error instanceof Error ? error.message : String(error));
  }
  return { status: 'accepted', result, issue: task.issue, openedPullRequest, pullRequestReason };
}

export interface OpenIssuePullRequestOptions {
  token: string | undefined;
  checkoutPath: string;
  fetch?: typeof globalThis.fetch;
  store?: TaskStore;
}

export type IssuePullRequestOutcome =
  | { opened: true; number: number; url: string }
  | { opened: false; reason: string };

/**
 * Publish a finished issue run as an isolated branch and review-ready pull request.
 *
 * Whether the run has earned a pull request is decided by `prepareIssuePullRequest` alone; this
 * composition root only supplies the stored evidence, reads the verified change contents through a
 * read-only runner, and hands both to the GitHub adapter. The default branch is never pushed to:
 * changes land on a fresh `issues.branchPrefix` branch whose name contains no issue text.
 */
export async function openIssuePullRequest(
  taskIdentifier: string,
  options: OpenIssuePullRequestOptions,
): Promise<IssuePullRequestOutcome> {
  const task = await (options.store ?? defaultStore).get(taskIdentifier);
  const evidence = task?.evidence;
  if (!evidence) return { opened: false, reason: `Unknown task: ${taskIdentifier}` };

  const readiness = prepareIssuePullRequest(evidence);
  if (!readiness.ready) return { opened: false, reason: readiness.reason };
  const issue = evidence.issue;
  if (!issue)
    return { opened: false, reason: 'The run does not reference the issue it worked on.' };
  if (!options.token) return { opened: false, reason: 'GITHUB_TOKEN is not configured' };

  const config = await loadConfig(options.checkoutPath);
  const reader = new LocalRunner(options.checkoutPath);
  const files: BranchFile[] = [];
  for (const path of evidence.changedFiles)
    files.push(
      (await reader.exists(path))
        ? { path, content: await reader.read(path) }
        : { path, content: null },
    );

  const pulls = new GitHubPullRequests({
    token: options.token,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  const target = { owner: issue.owner, repo: issue.repo };
  const base = await pulls.defaultBranch(target);
  const branch = issueBranchName(config.issues.branchPrefix, issue, taskIdentifier);
  await pulls.publishBranch(target, {
    branch,
    baseSha: base.sha,
    message: `${readiness.title}\n\nCloses #${String(issue.number)}.`,
    files,
  });
  const opened = await pulls.openPullRequest(target, {
    title: readiness.title,
    body: readiness.body,
    head: branch,
    base: base.name,
  });
  return { opened: true, ...opened };
}

export interface PublishOptions {
  token: string | undefined;
  fetch?: typeof globalThis.fetch;
  store?: TaskStore;
}

export function githubTokenFromEnvironment(): string | undefined {
  return process.env.GITHUB_TOKEN;
}

export async function publishEvidence(
  target: PullRequestRef,
  taskIdentifier: string,
  options: PublishOptions,
): Promise<{ published: boolean; reason?: string }> {
  if (!options.token) return { published: false, reason: 'GITHUB_TOKEN is not configured' };
  const task = await (options.store ?? defaultStore).get(taskIdentifier);
  if (!task?.evidence) return { published: false, reason: `Unknown task: ${taskIdentifier}` };
  await new GitHubChecks({
    token: options.token,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  }).publish(target, task.evidence);
  return { published: true };
}

function repositoryLabel(input: ReviewInput): string {
  if (input.pullRequest) return `${input.pullRequest.owner}/${input.pullRequest.repo}`;
  const normalized = input.repository.replaceAll('\\', '/').replace(TRAILING_SLASH, '');
  return redactSecrets(normalized.split('/').at(-1) || 'repository');
}
