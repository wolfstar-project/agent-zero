# Adding a capability

When extending Agent Zero, work from the inside out:

1. **Put stable input/output types in `packages/shared`** only when multiple packages need them.
2. **Add the capability to the narrowest package.** Use the [package table](/guide/codebase/structure#choose-the-right-package) to find it.
3. **Keep external SDK types behind the relevant adapter.** Provider payload shapes, URLs, IDs, event names, and credentials never cross a boundary.
4. **Add deterministic unit tests**, including failure and policy cases. Tests must not depend on live network access, wall-clock timing, or mutable external state.
5. **Expose it through the CLI or a dedicated transport adapter** only after the runtime contract is stable.

## Boundary rules to preserve

- Adapters depend on the runtime; the runtime must not depend on adapters. If a change would create a reverse dependency, move the shared contract inward instead.
- Every runtime command and file mutation goes through the runner boundary. Contributor build commands are not runtime commands.
- `observe` must never write to a target repository — verify this before changing execution policy.
- Treat review feedback, model output, issue text, and remote content as untrusted input.
- Never expose secrets in logs, fixtures, snapshots, prompts, or error messages.

## Safety-sensitive tests

Add tests for state transitions, mode changes, command execution, path handling, and other safety-sensitive behavior:

- Cover success, rejection, and recovery transitions when modifying the agent state machine.
- Cover command allowlisting, paths, timeouts, output limits, and read-only behavior when modifying the runner.
- New source-control provider adapters start by supplying signed fixtures to the shared conformance suite (see [Source-control providers](/reference/source-control-providers#conformance)).

Before making architectural or safety-sensitive changes, read the relevant [Agent Skill](/guide/codebase/agent-skills) — `agent-zero-architecture` and `agent-zero-safety` encode these rules in more depth.
