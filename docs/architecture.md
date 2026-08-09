# Architecture

Agent Zero is organized as a dependency-directed monorepo. The core decides what should happen; adapters decide how external systems communicate with it; the runner controls what is allowed to happen to a checkout.

```text
GitHub adapter ─┐
CLI adapter ────┼──> agent runtime ──> runner boundary ──> isolated checkout
oRPC server ────┘         │
                          ├──> model abstraction ──> provider
                          └──> shared contracts
```

## Dependency direction

- `shared` contains stable data contracts and must not import feature packages.
- `config`, `models`, `github`, and `runner` implement focused capabilities around shared contracts.
- `agent` composes policies and state transitions without knowing HTTP or terminal details.
- `cli` and `apps/server` are entry-point adapters. They may depend on the runtime, but the runtime must not depend on them.

If a change creates a reverse dependency, move the shared contract inward instead of importing an adapter into the runtime.

## Execution boundary

Only `packages/runner` may execute commands or mutate a target repository at runtime. The boundary is responsible for validating working directories, arguments, timeouts, output limits, and execution mode. A server handler, GitHub adapter, model provider, or state transition must request runner work through typed contracts rather than invoking a shell directly.

`observe` is the default mode. It can inspect and report but cannot write. Enabling `fix` requires both an explicit mode and repository policy permission.

`RepositoryBoundary` holds the filesystem and git behavior shared by every runner; subclasses decide only how a repository command is executed. `LocalRunner` runs it on the host, `ContainerRunner` runs it in an ephemeral sandbox. Both report a `RunnerDescription` that is recorded in evidence, so a claim of isolated verification is auditable rather than assumed.

Git inspection runs in the trusting process because its argv is fixed by the runner package. Repository-supplied commands are the untrusted ones, and those are what isolation moves into a sandbox.

`createRunner` and `runnerOptionsFromPolicy` are the only mapping from policy to a concrete boundary. `runnerOptionsFromPolicy` declares the policy fields it needs structurally, so the runner does not depend on the configuration package. Composition roots call both; nothing else constructs a runner.

## State transitions

The lifecycle is:

```text
discover -> understand -> validate -> plan -> execute -> verify -> review
                                      ^                    |
                                      └────── repair ──────┘
```

`LifecycleMachine` in `packages/agent` holds the transition table and refuses any move it does not define, so an implementation mistake becomes a thrown error rather than an unverified result that looks finished. Notably, `executing` cannot reach `completed` without passing through `verifying`, and `planning` cannot skip to `reviewing`. Every non-terminal state can reach `failed`.

Each stage owns one decision:

- **discover** collects the checkout, its diff, and its native check commands through the runner.
- **understand** asks the model to interpret the untrusted feedback in repository context.
- **validate** decides the verdict from repository evidence, never from the reviewer's or the model's assertion.
- **plan** records the plan and resolves authorization. Each refusal is a distinct reportable outcome rather than a silent downgrade.
- **execute** applies changes restricted to the validated scope, through the runner.
- **verify** runs the repository's own checks and captures their output.
- **review** inspects the resulting diff before a run may call itself complete.

Repair re-enters `plan` with the failing output as context, until `agent.maxAttempts` is spent.

## Verdicts and evidence

Validation lives in `packages/agent/src/validation.ts` and is independent of any provider. It rejects a claim that cites no evidence, names no existing file, or quotes repository content that is not there; it reports a supported but low-confidence claim as inconclusive. Rejection reasons are collected in full rather than short-circuiting on the first, because the report is the product.

`TaskResult.verified` is derived in exactly one place, at the point a run produces its terminal result: it requires a completed state, an applied change, and every executed check passing. No branch can assert verification it did not earn, which is what makes "a failed verification is never presented as success" a property of the code rather than a convention.

`EvidenceBundle` and its Markdown renderer live in `packages/shared` because both the GitHub adapter and the CLI consume them, and because rendering is a pure function over contracts with no I/O. Terminal states map deterministically onto GitHub check conclusions in `packages/github`.

## Adding a capability

1. Put stable input/output types in `shared` only when multiple packages need them.
2. Add the capability to the narrowest package.
3. Keep external SDK types behind the relevant adapter.
4. Add deterministic unit tests, including failure and policy cases.
5. Expose it through CLI or oRPC only after the runtime contract is stable.
