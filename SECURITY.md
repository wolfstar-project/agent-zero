# Security policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability, leaked credential, sandbox escape, command-injection path, or authorization bypass.

Use GitHub's private vulnerability reporting for this repository when available. Otherwise contact the WolfStar maintainers through the private channels listed at [join.wolfstar.rocks](https://join.wolfstar.rocks). Include affected versions, impact, reproduction steps, and any suggested mitigation. Do not include real credentials or third-party personal data.

Maintainers will acknowledge the report, validate its scope, coordinate a fix, and publish disclosure information when it is safe to do so. Please allow time for remediation before public discussion.

## Scope

Security-sensitive areas include:

- runner command and filesystem isolation;
- `observe` versus `fix` authorization;
- webhook and GitHub event validation;
- model-output and prompt-injection handling;
- secret redaction and logs;
- dependency and release integrity.

The included `LocalRunner` is for trusted development. Production execution must use an isolated, ephemeral environment with explicit filesystem, network, CPU, memory, and time limits.
