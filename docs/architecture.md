# Architecture

Agent Zero is organized as a dependency-directed monorepo. The core decides what should happen; adapters decide how external systems communicate with it; the runner controls what is allowed to happen to a checkout.

```text
GitHub adapter ─┐
CLI adapter ────┼──> agent runtime ──> runner boundary ──> isolated checkout
oRPC server ────┘        │
                         ├──> model abstraction ──> provider
                         └──> shared contracts

Nuxt dashboard ───> frontend-only operational interface
```

## Dependency direction

- `shared` contains stable data contracts and must not import feature packages.
- `config`, `models`, `github`, and `runner` implement focused capabilities around shared contracts.
- `agent` composes policies and state transitions without knowing HTTP or terminal details.
- `cli` is an entry-point adapter. It may depend on the runtime, but the runtime must not depend on it.
- `apps/server` is an entry-point adapter and composition root. Like `cli`, it may depend on the runtime; the runtime must not depend on it.
- `apps/dashboard` is a frontend-only Nuxt interface and does not import runtime packages.

If a change creates a reverse dependency, move the shared contract inward instead of importing an adapter into the runtime.

## Execution boundary

Only `packages/runner` may execute commands or mutate a target repository at runtime. The boundary is responsible for validating working directories, arguments, timeouts, output limits, and execution mode. A transport handler, GitHub adapter, model provider, or state transition must request runner work through typed contracts rather than invoking a shell directly.

`observe` is the default mode. It can inspect and report but cannot write. Enabling `fix` requires both an explicit mode and repository policy permission.

`RepositoryBoundary` holds the filesystem and git behavior shared by every runner; subclasses decide only how a repository command is executed. `LocalRunner` runs it on the host, `ContainerRunner` runs it in an ephemeral sandbox. Both report a `RunnerDescription` that is recorded in evidence, so a claim of isolated verification is auditable rather than assumed.

Git inspection runs in the trusting process because its argv is fixed by the runner package. Repository-supplied commands are the untrusted ones, and those are what isolation moves into a sandbox.

`createRunner` and `runnerOptionsFromPolicy` are the only mapping from policy to a concrete boundary. `runnerOptionsFromPolicy` declares the policy fields it needs structurally, so the runner does not depend on the configuration package. Composition roots call both; nothing else constructs a runner.

Hosted sandboxes follow the same rule. `RunnerPool` lives in `packages/runner`, accepts credential-free `SandboxRequest` values, enforces global/repository quotas and lease ceilings before provisioning, and returns only a `Runner`. Provider credentials are constructor state of a vendor adapter and never enter a request, lease snapshot, agent state, or log. A composition root may schedule and release a lease, but it cannot execute a command itself.

Model transports follow the same adapter rule. `packages/models` owns the AI SDK integrations for OpenAI, Anthropic, Google, AI Gateway, and OpenAI-compatible endpoints behind one `ModelProvider` contract. Composition roots pass the validated provider policy; credentials come only from fixed provider-specific environment variables, and a custom endpoint can only come from the operator-owned `AGENT_ZERO_MODEL_BASE_URL` environment variable. The agent runtime sees neither SDK objects nor credentials, and all adapters share one structured-output, usage-accounting, timeout, and error-redaction path.

## Dashboard boundary

`apps/dashboard` owns presentation only. It has no custom Nitro server routes, RPC contracts, persistence adapters, scheduler, runtime-package dependencies, shell capability, or target-filesystem capability. Any future live data source must be implemented as a separate adapter with an explicit contract rather than composed into the dashboard.

## Control-plane boundary

`apps/server` is that separate adapter: the transport and composition root the dashboard reads from, kept in its own package so presentation never gains runtime capability.

It exposes one typed oRPC router (`health`, `tasks.list`, `tasks.get`, `tasks.create`, `approvals.decide`) over a plain Node HTTP listener, plus a single aggregate `GET /api/dashboard` for the operational view. Procedures validate at the boundary with Zod and then delegate; they never invoke a shell or touch a checkout, because `runTask` is the only place that resolves policy and constructs a runner. A hosted `RunnerPool` lease is optional and still yields nothing but a `Runner`.

Persistence is a narrow `KeyValueStorage` contract so a filesystem store, Redis, KV, or Nitro storage driver stays interchangeable. Records are redacted on the way in and hold no review input and no checkout path, so task history cannot become a credential or filesystem leak. `TaskScheduler` bounds concurrency globally and per repository, and rejects work once the queue is exhausted rather than growing without limit.

Transport concerns stop here: headers, status mapping, and request objects never reach a runtime package.

## State transitions

The lifecycle is:

```text
discover -> understand -> validate -> plan -> execute -> verify -> review
                                      ^                    |
                                      └────── repair ──────┘
```

`LifecycleMachine` in `packages/agent` holds the transition table and refuses any move it does not define, so an implementation mistake becomes a thrown error rather than an unverified result that looks finished. Notably, `executing` cannot reach `completed` without passing through `verifying`, and `planning` cannot skip to `reviewing`. Every non-terminal state can reach `failed`.

Each stage owns one decision:

- **discover** collects the checkout, its working-tree or pull-request base-to-head diff, and its native check commands through the runner.
- **understand** asks the model to interpret untrusted feedback or proactively inspect the complete diff in repository context.
- **validate** decides the verdict from repository evidence, never from the reviewer's or the model's assertion.
- **plan** records the plan and resolves authorization. Each refusal is a distinct reportable outcome rather than a silent downgrade.
- **execute** applies changes restricted to the validated scope, through the runner.
- **verify** runs the repository's own checks and captures their output.
- **review** inspects the resulting diff before a run may call itself complete.

Repair re-enters `plan` with the failing output as context, until `agent.maxAttempts` is spent.

Proactive review is repository opt-in. Its model decision carries severity, confidence, cited evidence, affected files, and a change-risk classification. The runtime validates the evidence independently, then requires confidence and repository policy to allow the risk class. High-impact changes always stop at `needs-human`; proactive or autonomous writes use an isolated runner when policy requires it.

## Verdicts and evidence

Validation lives in `packages/agent/src/validation.ts` and is independent of any provider. It rejects a claim that cites no evidence, names no existing file, or quotes repository content that is not there; it reports a supported but low-confidence claim as inconclusive. Rejection reasons are collected in full rather than short-circuiting on the first, because the report is the product.

`TaskResult.verified` is derived in exactly one place, at the point a run produces its terminal result: it requires a completed state, an applied change, and every executed check passing. No branch can assert verification it did not earn, which is what makes "a failed verification is never presented as success" a property of the code rather than a convention.

`EvidenceBundle` and its Markdown renderer live in `packages/shared` because both the GitHub adapter and the CLI consume them, and because rendering is a pure function over contracts with no I/O. Terminal states map deterministically onto GitHub check conclusions in `packages/github`.

## Adding a capability

1. Put stable input/output types in `shared` only when multiple packages need them.
2. Add the capability to the narrowest package.
3. Keep external SDK types behind the relevant adapter.
4. Add deterministic unit tests, including failure and policy cases.
5. Expose it through the CLI or a dedicated transport adapter only after the runtime contract is stable.
