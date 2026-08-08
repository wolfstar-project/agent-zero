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

## State transitions

The intended lifecycle is:

```text
discover -> understand -> validate -> plan -> execute -> verify -> review
                                      ^                    |
                                      └────── repair ──────┘
```

Transitions must be explicit and testable. Failures should preserve evidence and move to a defined recovery or terminal state; they must not silently skip verification.

## Adding a capability

1. Put stable input/output types in `shared` only when multiple packages need them.
2. Add the capability to the narrowest package.
3. Keep external SDK types behind the relevant adapter.
4. Add deterministic unit tests, including failure and policy cases.
5. Expose it through CLI or oRPC only after the runtime contract is stable.
