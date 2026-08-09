---
name: agent-zero-architecture
description: Use when adding features, moving code, or changing dependencies across Agent Zero packages and adapters.
---

# Agent Zero architecture

Keep dependency direction explicit while changing the monorepo.

## Package ownership

- `shared`: stable contracts only, plus pure functions over them (evidence rendering, redaction, path predicates).
- `config`: configuration, repository policy, and check discovery. Pure; the agent supplies what it read through the runner.
- `models`: provider-independent model contracts and provider adapters.
- `github`: GitHub-specific translation, event parsing, and Checks API behavior.
- `runner`: command execution and checkout mutation boundary, plus the policy-to-boundary factory.
- `agent`: orchestration, the lifecycle machine, and the validation policy.
- `cli`: argument parsing and terminal presentation.
- `apps/server`: composition root for webhook ingestion, task execution, and evidence publication.

## Workflow

1. Read `AGENTS.md` and `docs/architecture.md`.
2. Identify the narrowest package that owns the behavior.
3. Check imports before adding a dependency. Core packages must not import CLI, HTTP, or GitHub adapters.
4. Put a contract in `shared` only when at least two packages need a stable common type.
5. Keep SDK-specific types inside their adapter.
6. Add deterministic tests beside the changed source.
7. Run the affected package checks, then the complete root checks.

## Reject these designs

- Shell execution in the server, CLI presentation, GitHub adapter, model adapter, or agent state machine.
- HTTP request/response types inside the runtime.
- GitHub SDK objects passed through shared contracts.
- A generic `utils` package used to bypass ownership decisions.
- Cross-package imports from another package's `src/` directory.
- A capability package importing another capability package. When `runner` needs policy, it declares the fields it needs structurally instead of importing `config`.
- Direct filesystem or `child_process` access outside `packages/runner`, including in the agent's discovery step.
- A second place that decides whether a run may write, or whether a run is verified. Both have exactly one home.
