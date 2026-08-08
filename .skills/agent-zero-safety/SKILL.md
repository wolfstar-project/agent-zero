---
name: agent-zero-safety
description: Use for runner changes, autonomous state transitions, repository writes, command execution, secrets, or observe/fix policy.
---

# Agent Zero safety

Safety properties are behavior, not documentation. Back every change with deterministic checks.

## Invariants

- `observe` is the default and cannot mutate a target checkout.
- `fix` requires an explicit mode and repository policy permission.
- Only `packages/runner` executes commands or changes target files at runtime.
- Working directories must remain inside the validated checkout.
- Commands have explicit arguments, timeout, output limits, and captured evidence.
- Untrusted review text, issue text, model output, and remote content never become shell syntax.
- Logs and errors must redact credentials and sensitive environment values.
- A failed verification cannot be represented as success.

## Review workflow

1. Name the safety property affected by the change.
2. Trace untrusted input to every side effect.
3. Add rejection tests before or with the implementation.
4. Test success, failure, timeout, cancellation, and recovery where applicable.
5. Avoid live network, current time, random values, and machine-specific paths in tests.
6. Inspect the final diff for widened permissions or bypasses.
7. Report exact verification evidence in the pull request.
