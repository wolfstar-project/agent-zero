---
name: agent-zero-cli
description: Use when adding or changing Agent Zero CLI commands, flags, prompts, output, exit codes, or version display.
---

# Agent Zero CLI

The CLI uses `@bomb.sh/args` for typed parsing and `@clack/prompts` for human-friendly interaction.

## Rules

- Keep parsing pure and testable in `packages/cli/src/args.ts`.
- Keep prompts and terminal effects in the entry point or a presentation adapter.
- Every interactive input must have a non-interactive flag equivalent.
- Never prompt when stdin is not a TTY; fail with a clear message or use a documented safe default.
- `--json` output must contain machine-readable data only on stdout. Diagnostics go to stderr.
- Use stable exit codes and avoid parsing human-formatted output in scripts.
- Obtain the displayed version through the injected shared version marker.
- CLI commands request runtime behavior through typed APIs; they do not execute repository commands directly.

## Adding a command

1. Define arguments, defaults, and validation with `@bomb.sh/args`.
2. Add parser tests for success, missing values, conflicts, and unknown flags.
3. Add Clack presentation only after parsing succeeds.
4. Document the command in `README.md` and `CONTRIBUTING.md` when contributor-facing.
5. Verify interactive and non-interactive behavior.
6. Run `aube run test --filter @agent-zero/cli` and the root checks.
