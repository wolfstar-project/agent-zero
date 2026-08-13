import { AgentZero } from '@agent-zero/agent';
import { loadConfig, mayModifyRepository } from '@agent-zero/config';
import { modelFromEnvironment } from '@agent-zero/models';
import { createRunner, runnerOptionsFromPolicy, type RunnerPool } from '@agent-zero/runner';
import {
  evidenceFromResult,
  now,
  redactSecrets,
  renderEvidenceMarkdown,
  secretValuesFromEnvironment,
  taskId,
  type ReviewInput,
  type TaskResult,
} from '@agent-zero/shared';
import {
  createProvider,
  providerForDelivery,
  reviewInputFromEvent,
  type ChangeRequestRef,
  type ProviderKind,
  type WebhookHeaders,
} from '@agent-zero/source-control';
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
  return { status: 'ok' as const, service: 'agent-zero', version: '0.3.0' };
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
  /** The raw request body, exactly as received; signatures verify these bytes. */
  body: string;
  headers: WebhookHeaders;
}

/** One source-control provider a deployment accepts webhooks from, with its own secret. */
export interface ProviderWebhookConfig {
  kind: ProviderKind;
  secret: string;
}

export interface WebhookOptions {
  /** Providers this deployment listens to. One deployment may connect several. */
  providers: readonly ProviderWebhookConfig[];
  checkoutPath: string;
  ignoreAuthors?: readonly string[];
  store?: TaskStore;
  scheduler?: TaskScheduler;
}

export type WebhookOutcome =
  | { status: 'rejected'; reason: string }
  | { status: 'ignored'; reason: string }
  | {
      status: 'accepted';
      result: TaskResult;
      provider: ProviderKind;
      changeRequest: ChangeRequestRef;
    };

export async function ingestWebhook(
  request: WebhookRequest,
  options: WebhookOptions,
): Promise<WebhookOutcome> {
  const kinds = options.providers.map((provider) => provider.kind);
  const provider = providerForDelivery(request.headers, kinds);
  if (!provider)
    return { status: 'rejected', reason: 'No configured provider recognizes this delivery' };
  const secret = options.providers.find((entry) => entry.kind === provider.kind)?.secret ?? '';

  if (!provider.verifyWebhook({ body: request.body, headers: request.headers }, secret))
    return { status: 'rejected', reason: 'Invalid webhook signature' };

  const eventName = provider.eventName(request.headers);
  if (eventName === undefined) return { status: 'ignored', reason: 'The delivery names no event' };

  let payload: unknown;
  try {
    payload = JSON.parse(request.body);
  } catch {
    return { status: 'rejected', reason: 'Webhook body is not valid JSON' };
  }

  const event = provider.parseReviewEvent(
    eventName,
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
  return {
    status: 'accepted',
    result,
    provider: provider.kind,
    changeRequest: event.changeRequest,
  };
}

export interface PublishOptions {
  token: string | undefined;
  /** API base URL, required for self-hosted providers. */
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  store?: TaskStore;
}

const statusTokenVariables: Record<ProviderKind, string> = {
  github: 'GITHUB_TOKEN',
  gitlab: 'GITLAB_TOKEN',
  'bitbucket-cloud': 'BITBUCKET_CLOUD_TOKEN',
  'bitbucket-data-center': 'BITBUCKET_DATA_CENTER_TOKEN',
  gitea: 'GITEA_TOKEN',
};

/** The status credential for one provider, from its fixed environment variable. */
export function statusTokenFromEnvironment(kind: ProviderKind): string | undefined {
  return process.env[statusTokenVariables[kind]];
}

export function githubTokenFromEnvironment(): string | undefined {
  return statusTokenFromEnvironment('github');
}

export async function publishEvidence(
  target: ChangeRequestRef,
  taskIdentifier: string,
  options: PublishOptions,
): Promise<{ published: boolean; reason?: string }> {
  if (!options.token)
    return {
      published: false,
      reason: `${statusTokenVariables[target.provider]} is not configured`,
    };
  const task = await (options.store ?? defaultStore).get(taskIdentifier);
  if (!task?.evidence) return { published: false, reason: `Unknown task: ${taskIdentifier}` };
  const publisher = createProvider(target.provider).statusPublisher({
    token: options.token,
    ...(options.baseUrl ? { baseUrl: options.baseUrl } : {}),
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  const publication = await publisher.publish(target, task.evidence);
  return { published: true, ...(publication.degraded ? { reason: publication.degraded } : {}) };
}

function repositoryLabel(input: ReviewInput): string {
  if (input.pullRequest) return `${input.pullRequest.owner}/${input.pullRequest.repo}`;
  const normalized = input.repository.replaceAll('\\', '/').replace(TRAILING_SLASH, '');
  return redactSecrets(normalized.split('/').at(-1) || 'repository');
}
