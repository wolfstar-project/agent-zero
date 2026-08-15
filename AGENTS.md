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
- Use tsdown through each tsdown-built package's `tsdown.config.ts` and the shared `scripts/tsdown.config.ts`. `apps/dashboard` uses the Nuxt build pipeline, with a local Nuxt module (`apps/dashboard/modules/vitehub.ts`) composing ViteHub into Nuxt's own Nitro build.
- Use Oxlint with type-aware checks and Oxfmt. Do not add ESLint or Prettier.
- Do not edit `dist/`, `.turbo/`, or generated declaration files.

## Architecture boundaries

- `packages/agent`: orchestration and state transitions only.
- `packages/runner`: the only boundary allowed to execute repository commands or mutate a checkout.
- `packages/models`: model-provider abstractions.
- `packages/source-control`: provider-neutral source-control contracts, with GitHub, GitLab, Bitbucket, and Gitea adapters underneath.
- `packages/config`: configuration parsing and policy.
- `packages/shared`: stable cross-package contracts.
- `packages/cli`: argument parsing and terminal presentation.
- `packages/database`: the schema, the Drizzle client, and the checked-in migrations. The only package that talks to Postgres. No policy, no HTTP, no runtime imports.
- `packages/auth`: authentication policy and the Better Auth options factory. Reads the store through `packages/database`. No HTTP server, no runtime imports.
- `packages/api`: the oRPC router and control-plane operations. The only package that composes the runtime, source-control, models, and config adapters into one API surface. Holds no HTTP host of its own.
- `apps/docs`: the VitePress documentation site. Not deployed with the dashboard. The canonical architecture and provider references remain in `docs/*.md` (the site includes them verbatim); edit those files, not copies.
- `apps/mail-preview`: dev-only Maizzle preview server for `packages/mail` templates. Not deployed; nothing may import it.
- `apps/dashboard`: the single deployable app and composition root. A Nuxt app whose `server/` directory hosts `packages/api`'s router over `/rpc/**` (typed RPC) and `/api/v1/**` (OpenAPI/REST, with docs at `/api/v1/docs`), plus `GET /api/dashboard`, and mounts Better Auth in-process at `/api/auth/**` via `server/auth.config.ts`. The only process that opens the database, and it does so through `packages/database`.
- `apps/marketing`: frontend-only Nuxt public marketing site. No persistence, no credentials, no session, no runtime-package imports; nothing imports it. Server-rendered and prerendered because it must be crawlable, so the only Nitro routes are the ones `@nuxtjs/seo` generates. Copy lives in `packages/i18n` (`locales/<locale>/marketing.json`), never in the app.

The runtime must remain independent from HTTP, source-control platforms, terminal UI, and specific model providers. Adapters depend on the runtime; the runtime must not depend on adapters. Authentication is an adapter concern: neither `packages/database` nor `packages/auth` may import a runtime package or execute repository work; `apps/dashboard`'s `server/auth.config.ts` composes `packages/auth`'s policy into the Better Auth options the Nuxt module builds an instance from, and is the only place in the repository that reaches the database.

Persistence and policy are separate boundaries. `packages/database` owns tables, connections, and migrations and knows nothing about authentication; `packages/auth` decides what is allowed and reads the store through it. The dependency runs one way — a schema change never needs to know who signs in, and `packages/database` must not import `packages/auth`.

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
