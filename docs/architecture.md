<!--
The #region markers below let the VitePress site (apps/docs) include individual
sections of this file, so the site and this canonical document never diverge.
Keep them wrapping their sections when editing.
-->

<!-- #region intro -->

# Architecture

Agent Zero is organized as a dependency-directed monorepo. The core decides what should happen; adapters decide how external systems communicate with it; the runner controls what is allowed to happen to a checkout.

```text
Source-control adapters ─┐
CLI adapter ─────────────┼──> agent runtime ──> runner boundary ──> isolated checkout
packages/api ────────────┘        │
                         ├──> model abstraction ──> provider
                         └──> shared contracts

apps/dashboard: UI + packages/api's router (oRPC + OpenAPI) + Better Auth ──> session store
```

<!-- #endregion intro -->

<!-- #region dependency-direction -->

## Dependency direction

- `shared` contains stable data contracts and must not import feature packages.
- `config`, `models`, `source-control`, and `runner` implement focused capabilities around shared contracts.
- `agent` composes policies and state transitions without knowing HTTP or terminal details.
- `cli` is an entry-point adapter. It may depend on the runtime, but the runtime must not depend on it.
- `auth` holds authentication policy and a Better Auth options factory and does not depend on the runtime.
- `packages/api` composes the runtime, source-control, models, and config adapters into one router. It may depend on all of them; none of them may depend on it. It does not depend on `auth`.
- `apps/dashboard` is the entry-point adapter and composition root: a Nuxt app whose `server/` directory serves `packages/api`'s router and, through its own `server/auth.config.ts` composing `packages/auth`'s options, holds the only database credential in the repository.

If a change creates a reverse dependency, move the shared contract inward instead of importing an adapter into the runtime.

<!-- #endregion dependency-direction -->

<!-- #region execution-boundary -->

## Execution boundary

Only `packages/runner` may execute commands or mutate a target repository at runtime. The boundary is responsible for validating working directories, arguments, timeouts, output limits, and execution mode. A transport handler, source-control adapter, model provider, or state transition must request runner work through typed contracts rather than invoking a shell directly.

`observe` is the default mode. It can inspect and report but cannot write. Enabling `fix` requires both an explicit mode and repository policy permission.

`RepositoryBoundary` holds the filesystem and git behavior shared by every runner; subclasses decide only how a repository command is executed. `LocalRunner` runs it on the host, `ContainerRunner` runs it in an ephemeral sandbox. Both report a `RunnerDescription` that is recorded in evidence, so a claim of isolated verification is auditable rather than assumed.

Git inspection runs in the trusting process because its argv is fixed by the runner package. Repository-supplied commands are the untrusted ones, and those are what isolation moves into a sandbox.

`createRunner` and `runnerOptionsFromPolicy` are the only mapping from policy to a concrete boundary. `runnerOptionsFromPolicy` declares the policy fields it needs structurally, so the runner does not depend on the configuration package. Composition roots call both; nothing else constructs a runner.

Hosted sandboxes follow the same rule. `RunnerPool` lives in `packages/runner`, accepts credential-free `SandboxRequest` values, enforces global/repository quotas and lease ceilings before provisioning, and returns only a `Runner`. Provider credentials are constructor state of a vendor adapter and never enter a request, lease snapshot, agent state, or log. A composition root may schedule and release a lease, but it cannot execute a command itself.

Model transports follow the same adapter rule. `packages/models` owns the AI SDK integrations for OpenAI, Anthropic, Google, AI Gateway, and OpenAI-compatible endpoints behind one `ModelProvider` contract. Composition roots pass the validated provider policy; credentials come only from fixed provider-specific environment variables, and a custom endpoint can only come from the operator-owned `AGENT_ZERO_MODEL_BASE_URL` environment variable. The agent runtime sees neither SDK objects nor credentials, and all adapters share one structured-output, usage-accounting, timeout, and error-redaction path.

<!-- #endregion execution-boundary -->

<!-- #region api-package -->

## API package

`packages/api` is the library `apps/dashboard`'s server reads from: it composes the agent runtime, source-control adapter, model abstraction, and config into one typed oRPC router (`health`, `tasks.list`, `tasks.get`, `tasks.create`, `approvals.decide`) and a control-plane operations layer (`runTask`, `TaskScheduler`, `TaskStore`). It holds no HTTP host of its own and does not depend on `packages/auth` — `apps/dashboard/server/` is the only place that constructs a transport handler from it, which keeps the router and its authorization rules identical regardless of which wire protocol serves a given request.

Procedures validate at the boundary with Zod and then delegate; they never invoke a shell or touch a checkout, because `runTask` is the only place that resolves policy and constructs a runner. A hosted `RunnerPool` lease is optional and still yields nothing but a `Runner`. `EvlogHandlerPlugin`, shared by every transport through one `AsyncLocalStorage`-backed logger (`packages/api/src/orpc/logging.ts`), attaches structured request logs; procedures read it defensively (`requestLoggerStorage?.getStore()?.set(...)`) so router tests that call procedures directly through `createRouterClient`, without a transport's plugin attached, still pass.

<!-- #endregion api-package -->

<!-- #region dashboard-boundary -->

## Dashboard and control-plane boundary

`apps/dashboard` is the composition root and the only entry-point adapter with HTTP capability: a Nuxt app whose `server/` directory hosts

| Route                | Purpose                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| `/rpc/**`            | `packages/api`'s router over the typed oRPC RPC transport                                                    |
| `/api/v1/**`         | The same router over OpenAPI/REST (`OpenAPIHandler`); docs at `/api/v1/docs`, spec at `/api/v1/openapi.json` |
| `/api/auth/**`       | The Better Auth handler, mounted by `@onmax/nuxt-better-auth` from `server/auth.config.ts`                   |
| `GET /api/dashboard` | One aggregate view: task history plus queue, approval, and usage counters                                    |

`/rpc/**` and `/api/v1/**` serve the exact same `rpcRouter` and therefore the exact same authorization rules; only the wire protocol differs. `.meta(openapi(...))` metadata on each procedure (method, path, tags) exists purely for the OpenAPI transport and has no effect on the RPC transport — it is attached through a real, regularly-imported function rather than the `@orpc/openapi` package's alternative bare side-effect import, because Nitro's production bundler tree-shakes an unused side-effect import away even though the package's own `sideEffects` field marks it as one to keep.

Mutations fail closed behind operator-issued bearer credentials (`AGENT_ZERO_CONTROL_PLANE_TOKENS`, comma-separated `name:token` pairs). `tasks.create` additionally requires the target repository path to appear in `AGENT_ZERO_CONTROL_PLANE_REPOSITORIES`, so an HTTP caller cannot point a run at an arbitrary server-local path, and the requested execution mode to be granted to the principal via `AGENT_ZERO_CONTROL_PLANE_MODES` (comma-separated `name:mode|mode` grants; without one a principal is limited to the non-writable `observe` and `suggest` modes). Approval decisions record the authenticated principal's name rather than a wire-supplied actor. Reads stay open for the dashboard. This bearer-token scheme is independent of the Better Auth session that protects the dashboard UI itself.

Task persistence is a narrow `KeyValueStorage` contract adapted over the ViteHub KV Runtime Helper (registered by the local `apps/dashboard/modules/vitehub.ts` Nuxt module, composing `vite-hub/nuxt` into Nuxt's own Nitro build), so the filesystem driver, Cloudflare KV, Deno KV, or Upstash stays interchangeable. Records are redacted on the way in and hold no review input and no checkout path, so task history cannot become a credential or filesystem leak. `TaskScheduler` bounds concurrency globally and per repository, and rejects work once the queue is exhausted rather than growing without limit.

Transport concerns stop at the route handlers: headers, status mapping, and request objects never reach a runtime package.

<!-- #endregion dashboard-boundary -->

<!-- #region issue-to-pr -->

## Issue-to-PR workflow

A scoped GitHub issue can become a verified, review-ready pull request without ever widening the runtime's authority. The entry point is the same authenticated webhook path: an `issues` event is parsed in `packages/source-control` and produces a task only when repository policy has opted in (`issues.enabled`) and the issue carries the `issues.requireLabel` label, so arbitrary issue text can never start a run. The issue's title and body travel to the runtime as bounded, untrusted feedback with trigger `issue` — data to validate, never instructions — and the run mode comes only from repository policy, never from the wire.

The run itself is the ordinary lifecycle. During planning the model records verifiable acceptance criteria for the issue alongside its plan; the runtime bounds them and carries them into the task result and evidence bundle. Writes still require an explicit write mode, `autofix.enabled`, confidence, an allowed change-risk class, and — by default, like proactive work — an isolated runner. High-impact changes stop at `needs-human` exactly as before.

The validation verdict is reported back where the work was requested. Unless `issues.validationComment` is disabled, a finished run posts one comment on the issue, composed by `prepareIssueValidationComment` from the persisted evidence alone: **confirmed** when repository evidence supports the report, **not confirmed** with every rejection reason when it does not, **inconclusive** when a human should decide. A run that failed before reaching a verdict posts nothing rather than something misleading, and the `GitHubIssueComments` adapter can only add a comment — it has no path to label, edit, or close an issue. The comment claims a fix exists only when the run was actually verified.

Publication has a single home: `prepareIssuePullRequest` in `packages/source-control` decides whether a finished run has earned a pull request, and composes it when it has. It refuses any run that is not `completed`, not `accepted`, not verified by the repository's own checks, changed no files, or proposes a high-impact change, so a pull request can never claim success its evidence does not support — the body _is_ the rendered evidence, including the acceptance criteria. The composition root in `apps/dashboard` then reads the verified file contents through a read-only runner and hands them to the `GitHubPullRequests` adapter, which publishes them as a commit on a fresh `issues.branchPrefix` branch through the Git data API and opens the pull request against the default branch. The branch name is assembled only from operator policy, the issue number, and the task identifier; an existing ref is never force-updated; and the default branch is never committed to. A failed publication never fails the run — the evidence is already persisted — it is reported as the reason no pull request exists.

<!-- #endregion issue-to-pr -->

<!-- #region authentication-boundary -->

## Authentication boundary

Authentication follows the same adapter rule at the package level, but not at the process level: Better Auth is mounted in-process by `apps/dashboard`'s `/api/auth/**` route (`server/auth.config.ts`), the only route in the app that resolves `AUTH_DATABASE_URL` and the signing secret (`NUXT_BETTER_AUTH_SECRET`, required in production; `BETTER_AUTH_SECRET` only works as a development fallback) and therefore the only part of the app that opens a connection to Postgres, the only database in the repository. Every other route reaches storage exclusively through the `KeyValueStorage` contract. `packages/auth` holds the policy: `authBetterAuthOptions` builds the database, policy, and provider options Better Auth needs, deliberately omitting `secret`, `baseURL`, and `trustedOrigins` so the `@onmax/nuxt-better-auth` module — which resolves those itself and constructs the actual instance — cannot diverge from it. `createAuth`, which does build a full standalone instance, remains for callers that own their own secret and origin, such as the Better Auth CLI's schema-generation entry point; nothing in `apps/dashboard`'s request path uses it. `packages/auth`'s `./config` subpath stays free of database dependencies so the login page can read feature flags without bundling one.

The session store's schema is declared in Drizzle (`packages/auth/src/schema.ts`) rather than generated by Better Auth's own migration CLI, so `user`, `session`, `account`, and `verification` are reviewable, checked-in SQL under `packages/auth/drizzle/` like any other schema change. `drizzleAdapter` binds the Better Auth model layer to that schema; nothing outside `packages/auth` queries the tables directly.

The dashboard renders with SSR. The session cookie is scoped to the app's own origin, so the server resolves it directly from the incoming request before the first paint, rather than rendering a signed-out shell that a client-side check then corrects.

<!-- #endregion authentication-boundary -->

<!-- #region state-transitions -->

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
- **understand** asks the model to interpret untrusted feedback, proactively inspect the complete diff, or interpret an issue task in repository context.
- **validate** decides the verdict from repository evidence, never from the reviewer's or the model's assertion.
- **plan** records the plan and resolves authorization. Each refusal is a distinct reportable outcome rather than a silent downgrade.
- **execute** applies changes restricted to the validated scope, through the runner.
- **verify** runs the repository's own checks and captures their output.
- **review** inspects the resulting diff before a run may call itself complete.

Repair re-enters `plan` with the failing output as context, until `agent.maxAttempts` is spent.

Proactive review is repository opt-in. Its model decision carries severity, confidence, cited evidence, affected files, and a change-risk classification. The runtime validates the evidence independently, then requires confidence and repository policy to allow the risk class. High-impact changes always stop at `needs-human`; proactive or autonomous writes use an isolated runner when policy requires it.

<!-- #endregion state-transitions -->

<!-- #region verdicts-and-evidence -->

## Verdicts and evidence

Validation lives in `packages/agent/src/validation.ts` and is independent of any provider. It rejects a claim that cites no evidence, names no existing file, or quotes repository content that is not there; it reports a supported but low-confidence claim as inconclusive. Rejection reasons are collected in full rather than short-circuiting on the first, because the report is the product.

`TaskResult.verified` is derived in exactly one place, at the point a run produces its terminal result: it requires a completed state, an applied change, and every executed check passing. No branch can assert verification it did not earn, which is what makes "a failed verification is never presented as success" a property of the code rather than a convention.

`EvidenceBundle` and its Markdown renderer live in `packages/shared` because both the source-control adapters and the CLI consume them, and because rendering is a pure function over contracts with no I/O. Terminal states map deterministically onto a provider-neutral run outcome in `packages/source-control`, which each provider adapter translates into its own status vocabulary — explicitly noting any conclusion the platform cannot express (see `docs/source-control-providers.md`).

<!-- #endregion verdicts-and-evidence -->

<!-- #region adding-a-capability -->

## Adding a capability

1. Put stable input/output types in `shared` only when multiple packages need them.
2. Add the capability to the narrowest package.
3. Keep external SDK types behind the relevant adapter.
4. Add deterministic unit tests, including failure and policy cases.
5. Expose it through the CLI or a dedicated transport adapter only after the runtime contract is stable.

<!-- #endregion adding-a-capability -->
