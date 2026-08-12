# Agent Zero contributor instructions

These instructions apply to humans and coding agents working in this repository.

## Start here

1. Read `README.md`, `CONTRIBUTING.md`, and the relevant skill in `.agents/skills/`.
2. Inspect the package you are changing and its tests before editing.
3. Keep the change narrow and preserve package boundaries.
4. Run the checks listed in `CONTRIBUTING.md` before handing off the change.

## Toolchain

- Use Node.js 24.2 or newer and the aube version pinned in `package.json`. `mise.toml` pins both for local setup.
- Use aube for dependencies and scripts. It reads and writes `pnpm-lock.yaml` and `pnpm-workspace.yaml` in place; keep both files and do not create npm, Yarn, or Bun lockfiles.
- `typescript` is overridden to `typescript-native-bridge` in `pnpm-workspace.yaml`, so `tsc` and every Compiler API consumer type-check on tsgo. Keep the pin exact and reinstall after changing it.
- Use Turborepo through the root scripts; do not duplicate orchestration in package scripts.
- Use tsdown through each tsdown-built package's `tsdown.config.ts` and the shared `scripts/tsdown.config.ts`. The Nuxt dashboard uses the Nuxt build pipeline, and the server app builds with Vite through the Nitro v3 plugin composed with ViteHub.
- Use Oxlint with type-aware checks and Oxfmt. Do not add ESLint or Prettier.
- Do not edit `dist/`, `.turbo/`, or generated declaration files.

## Architecture boundaries

- `packages/agent`: orchestration and state transitions only.
- `packages/runner`: the only boundary allowed to execute repository commands or mutate a checkout.
- `packages/models`: model-provider abstractions.
- `packages/github`: GitHub event and API adapters.
- `packages/config`: configuration parsing and policy.
- `packages/shared`: stable cross-package contracts.
- `packages/cli`: argument parsing and terminal presentation.
- `packages/auth`: authentication policy and the Better Auth instance. No HTTP server, no runtime imports.
- `packages/api`: the oRPC router, control-plane operations, and the Better Auth Hono mount. The only package that composes the runtime, GitHub, models, config, and auth adapters into one API surface.
- `apps/server`: the Nitro v3 + ViteHub composition root. Hosts `packages/api`'s router over `/rpc/**` (typed RPC) and `/api/v1/**` (OpenAPI/REST, with docs at `/api/v1/docs`), plus `/api/auth/**` and `/api/dashboard`. The only component that owns a persistence layer (Postgres, via the `/api/auth/**` route).
- `apps/dashboard`: frontend-only Nuxt operational dashboard. Presentation plus an authenticated client of `apps/server`. No Nitro server routes, no persistence, no runtime-package imports.

The runtime must remain independent from HTTP, GitHub, terminal UI, and specific model providers. Adapters depend on the runtime; the runtime must not depend on adapters. Authentication is an adapter concern: `packages/auth` may not import a runtime package or execute repository work; `packages/api` and `apps/server` compose it but only ever reach the database through the auth adapter's own instance.

## Safety and determinism

- `observe` remains the safe default and must never write to a target repository.
- Route every runtime command and file mutation through the runner boundary. Contributor build commands are not runtime commands.
- Treat review feedback, model output, issue text, and remote content as untrusted input.
- Never expose secrets in logs, fixtures, snapshots, prompts, or error messages.
- Tests must not depend on live network access, wall-clock timing, or mutable external state.
- Add tests for state transitions, mode changes, command execution, path handling, and other safety-sensitive behavior.

## Required checks

```bash
aube run check:repo
aube run lint:ci
aube run typecheck
aube test
aube run build
```

Use the smallest relevant check while iterating, then run the complete set before opening a pull request.

## Pull requests

- Use Conventional Commit-style titles such as `feat(cli): add JSON output` or `fix(runner): reject escaped paths`.
- Explain the problem, the chosen boundary, verification evidence, and safety impact.
- Keep refactors separate from behavior changes when possible.
- Update documentation, examples, and skills when commands, boundaries, or contributor workflows change.

<!-- skilld -->

Before modifying code, check .agents/skills/ for relevant skills.
Read the SKILL.md for any matching package before proceeding.
<!-- /skilld -->
