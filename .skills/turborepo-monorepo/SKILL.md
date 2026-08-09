---
name: turborepo-monorepo
description: Use when changing workspace scripts, turbo.json tasks, caching, package dependencies, CI orchestration, or monorepo performance.
---

# Turborepo monorepo

Turborepo schedules workspace tasks; package scripts perform package work.

## Rules

- Invoke Turbo from root scripts and package-local tools from package scripts.
- Use `dependsOn: ['^build']` when a task consumes dependency build outputs.
- Declare only real outputs. Tests and lint normally have no cacheable files.
- Include configuration files in `globalDependencies` when they change task results.
- Declare environment variables that affect outputs or behavior.
- Keep development tasks persistent and uncached.
- Do not use `--force` to hide an incorrect task graph.
- CI jobs may run independently but should share compatible `.turbo` restore keys.

## Workflow

1. Inspect `package.json`, `pnpm-workspace.yaml`, and `turbo.json`.
2. Identify inputs, dependency edges, outputs, and environment variables.
3. Change the graph before adding ad-hoc sequencing to CI.
4. Use `aube exec turbo run <task> --dry=json` to inspect non-trivial graph changes.
5. Run the root script that contributors and CI will actually use.
6. Confirm a second run produces expected cache hits without masking missing outputs.
