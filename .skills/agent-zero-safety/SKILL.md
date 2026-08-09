---
name: agent-zero-safety
description: Use for runner changes, autonomous state transitions, repository writes, command execution, secrets, or observe/fix policy.
---

# Agent Zero safety

Safety properties are behavior, not documentation. Back every change with deterministic checks.

## Invariants

- `observe` is the default and cannot mutate a target checkout. `suggest` cannot either.
- `fix` requires an explicit mode and repository policy permission. Ask `mayModifyRepository`; do not re-derive the rule.
- Only `packages/runner` executes commands or changes target files at runtime.
- A runner created read-only refuses every write. Enforce the boundary mechanically, not by convention.
- Working directories must remain inside the validated checkout, including after symlinks are resolved.
- Nothing reads or writes inside `.git`.
- Commands have explicit arguments, timeout, output limits, and captured evidence.
- Untrusted review text, issue text, model output, and remote content never become shell syntax.
- Changes stay inside the scope the validated finding established, under `agent.maxChangedFiles`.
- Logs, prompts, evidence, and errors must redact credentials and sensitive environment values, including failed HTTP response bodies.
- A failed verification cannot be represented as success. `verified` is derived once, where the terminal result is built.
- A run that cannot verify does not write. No checks means no change.
- Isolation is never approximated. Requesting a sandbox that cannot be provided must fail.
- A reviewer's claim is not evidence. Reject what the repository does not support, and keep the reasons.

## Review workflow

1. Name the safety property affected by the change.
2. Trace untrusted input to every side effect.
3. Add rejection tests before or with the implementation.
4. Test success, failure, timeout, cancellation, and recovery where applicable.
5. Avoid live network, current time, random values, and machine-specific paths in tests. Inject `fetch` and `ProcessRunner` rather than reaching outside the process.
6. Never let a credential in the environment turn into a live call. Require the caller to pass a token instead of reading one implicitly.
7. Inspect the final diff for widened permissions or bypasses.
8. Report exact verification evidence in the pull request.
