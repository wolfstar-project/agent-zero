<div align="center">

<img src="https://cdn.wolfstar.rocks/wolfstar-assets/wolfstar.png" alt="WolfStar Logo" width="100px" />

# Agent Zero

**An open-source autonomous engineer that finds, fixes, and verifies problems in pull requests**

[![GitHub License](https://img.shields.io/github/license/wolfstar-project/agent-zero?style=flat-square)](https://github.com/wolfstar-project/agent-zero/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/wolfstar-project/agent-zero/ci.yaml?branch=main&style=flat-square&label=ci)](https://github.com/wolfstar-project/agent-zero/actions/workflows/ci.yaml)
[![Node.js](https://img.shields.io/node/v/typescript?style=flat-square&label=node&color=5FA04E)](https://nodejs.org)
[![Package manager: aube](https://img.shields.io/badge/package%20manager-aube-a1b858?style=flat-square)](https://aube.jdx.dev)

</div>

---

## Overview

Agent Zero runs one trustworthy loop: ingest review feedback, inspect a pull-request diff proactively, or take on a scoped GitHub issue, validate the finding, apply a narrowly scoped policy-approved fix, run the repository's real checks, inspect the resulting diff, and produce evidence.

Feedback is never treated as truth merely because it came from a human or an AI reviewer.

- **Evidence over assertion** &ndash; every fix carries the commands that verified it.
- **Proactive, not speculative** &ndash; diff review reports the highest-priority finding only when checkout evidence supports it.
- **Confidence and impact gates** &ndash; automatic fixes require confidence, an allowed change-risk class, repository permission, and verification.
- **Issues become reviewable pull requests** &ndash; a labeled, repository-scoped issue can be investigated, implemented on an isolated branch, verified, and published as a pull request that carries its acceptance criteria and evidence; never as a direct commit.
- **`observe` by default** &ndash; the safe mode inspects and reports, and never writes to a target repository.
- **One execution boundary** &ndash; `packages/runner` is the only code allowed to run commands or mutate a checkout.
- **Adapters at the edges** &ndash; the runtime stays independent of HTTP, source-control platforms, terminal UI, and model providers.

---

## Architecture

```text
Source-control adapters (GitHub, GitLab, Bitbucket, Gitea) / CLI
        │
        ▼
   Agent state machine
 discover → understand → validate → plan → execute → verify → review
                                      │                    │
                                      └──── repair ◀───────┘
        │
        ▼
 Runner boundary ─── repository commands and file operations

Nuxt dashboard ─── UI, oRPC + OpenAPI routes, and Better Auth, one app ─── database ─── Postgres
```

| Package                                                | Responsibility                                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| [`packages/agent`](./packages/agent)                   | Orchestration and state transitions                                                        |
| [`packages/runner`](./packages/runner)                 | The only boundary that executes commands or mutates a checkout                             |
| [`packages/models`](./packages/models)                 | Model-provider abstractions                                                                |
| [`packages/source-control`](./packages/source-control) | Provider-neutral source-control contracts and adapters (GitHub, GitLab, Bitbucket, Gitea)  |
| [`packages/config`](./packages/config)                 | Configuration parsing and policy                                                           |
| [`packages/shared`](./packages/shared)                 | Stable cross-package contracts                                                             |
| [`packages/cli`](./packages/cli)                       | Argument parsing and terminal presentation                                                 |
| [`packages/database`](./packages/database)             | Schema, Drizzle client, and checked-in migrations; the only package that talks to Postgres |
| [`packages/auth`](./packages/auth)                     | Authentication policy and the Better Auth options factory                                  |
| [`packages/api`](./packages/api)                       | oRPC router and control-plane operations                                                   |
| [`apps/dashboard`](./apps/dashboard)                   | The single deployable app: UI, `/rpc/**` + `/api/v1/**`, and `/api/auth/**`                |

Adapters depend on the runtime; the runtime never depends on adapters. See [docs/architecture.md](./docs/architecture.md) for the full dependency rules.

---

## Quick start

Requirements: Node.js 24.2+ and [aube](https://aube.jdx.dev), the package manager pinned in `package.json`. Both are pinned in `mise.toml`, so [mise](https://mise.jdx.dev) can install them together. Generated Node.js bundles target Node.js 24.2+.

```bash
mise install            # or: npm install -g --ignore-scripts=false @endevco/aube
aube ci
cp .env.example .env
aube test
aube run zero doctor
aube run zero review --feedback "Possible null dereference in src/user.ts"
aube run zero review --proactive
aube run dev
```

`aube run <script>` and `aube test` check install freshness first, so a separate install step is rarely needed. aube reads and writes the existing `pnpm-lock.yaml` and `pnpm-workspace.yaml` in place — the lockfile stays in pnpm's v9 format for anyone who still runs pnpm.

---

## CLI

```text
zero init                   create .agent-zero.yml
zero --version              print the injected CLI version
zero doctor [--json]        inspect the local environment
zero review (--feedback X | --proactive)  inspect without editing
zero fix (--feedback X | --proactive)     validate, edit, and verify (policy permitting)
zero run (--feedback X | --proactive)     run using the configured mode
```

The CLI parses arguments with [`@bomb.sh/args`](https://github.com/bomb-sh/args) and renders with [`@clack/prompts`](https://github.com/bombshell-dev/clack). Use `--proactive` to inspect the working-tree diff without reviewer feedback. When neither trigger is provided in a terminal, it asks for the task interactively; use `--feedback` or `--proactive` with `--json` for scripts and CI.

---

## Dashboard

`aube run dev` starts the single deployable app on `http://localhost:3000` (override with `PORT`). It is the only adapter that composes a runner for hosted work, and the same Nuxt app serves the UI, the control plane, and authentication from one origin:

| Surface              | Purpose                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| `/rpc/**`            | Typed oRPC router: `health`, `tasks.list/get/create`, `approvals.decide`                              |
| `/api/v1/**`         | The same router over OpenAPI/REST; interactive docs at `/api/v1/docs`, spec at `/api/v1/openapi.json` |
| `/api/auth/**`       | The Better Auth handler (mounted by `@onmax/nuxt-better-auth` from `server/auth.config.ts`)           |
| `GET /api/dashboard` | One aggregate view: task history plus queue, approval, and usage counters                             |

`/rpc/**` and `/api/v1/**` are the same `rpcRouter` from [`packages/api`](./packages/api) served over two wire protocols, so authorization behaves identically either way. Reads are open for the dashboard; mutations (`tasks.create`, `approvals.decide`) fail closed. `AGENT_ZERO_CONTROL_PLANE_TOKENS` holds comma-separated `name:token` bearer credentials, and `AGENT_ZERO_CONTROL_PLANE_REPOSITORIES` allow-lists the repository paths `tasks.create` may target; without them every mutation is rejected. `AGENT_ZERO_CONTROL_PLANE_MODES` holds comma-separated `name:mode|mode` grants for the execution modes each principal may request; without a grant a principal may only request the non-writable `observe` and `suggest` modes, so `fix` and `autonomous` require an explicit operator grant. The approval actor is the authenticated principal's name, never a wire-supplied value. This bearer-token scheme authorizes the control-plane API and is independent of the Better Auth session that protects the dashboard UI.

Typed clients infer their shape from the router rather than redeclaring request and response types:

```ts
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { RouterClient } from '@orpc/server';
import type { RpcRouter } from '@agent-zero/api';

const client: RouterClient<RpcRouter> = createORPCClient(
  new RPCLink({
    url: 'http://localhost:3000/rpc',
    headers: { authorization: `Bearer ${process.env.CONTROL_PLANE_TOKEN}` },
  }),
);

const { tasks } = await client.tasks.list();
await client.approvals.decide({ taskId: tasks[0]!.id, decision: 'approved' });
```

Non-TypeScript or external callers can use plain HTTP against `/api/v1/**` instead — for example `curl http://localhost:3000/api/v1/tasks` — with the same bearer-token rules; the interactive reference at `/api/v1/docs` documents every route from the generated OpenAPI spec.

The transport is Nuxt's own Nitro server: routes live in `apps/dashboard/server/`, and `nuxt build` emits a self-contained `.output/` bundle started with `node .output/server/index.mjs`. Task history persists through a `KeyValueStorage` contract backed by the ViteHub KV Runtime Helper (registered by the local `apps/dashboard/modules/vitehub.ts` module): filesystem-backed `fs-lite` by default, with Cloudflare KV, Deno KV, or Upstash dropping in as driver configuration without touching application code. Records are redacted before they are written and never contain review input or checkout paths. `TaskScheduler` bounds work globally and per repository, so a burst queues instead of fanning out unbounded runs.

Authentication is mounted in-process at `/api/auth/**` by `apps/dashboard/server/auth.config.ts`, the one route in the app that resolves `packages/auth`'s environment options — including the connection string, through [`packages/database`](./packages/database) — and therefore the only place in the repository that opens a connection to Postgres. `packages/database` declares the tables with [Drizzle](https://orm.drizzle.team) rather than Better Auth's own migration tool, so the session store's schema lives in this repository as reviewable, checked-in SQL. The dashboard renders with SSR: the session cookie is same-origin, so the server resolves it directly and a signed-out visitor never flashes protected content before redirecting.

Point `DATABASE_URL` at a Postgres database, then apply the schema once before the first run
(`db:generate` only needs to run again after editing `packages/database/src/schema/`):

```bash
aube run db:migrate
```

The app reads auth configuration from the environment. Registration and GitHub OAuth are
off until you turn them on, so a fresh deployment cannot be signed up for by a stranger:

| Variable                                    | Required | Default | Purpose                                                                                                             |
| ------------------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| `NUXT_BETTER_AUTH_SECRET`                   | yes      | –       | Session signing secret. Required under this name in production; `BETTER_AUTH_SECRET` is a development-only fallback |
| `DATABASE_URL`                              | yes      | –       | Postgres connection string                                                                                          |
| `AUTH_ENABLE_SIGNUP`                        | no       | `false` | Set to `true` to allow self-registration                                                                            |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | no       | –       | Enables the GitHub button when both are set                                                                         |
| `NUXT_PUBLIC_SITE_URL`                      | no       | –       | Base URL override for a custom domain or deterministic OAuth callbacks; auto-detected from the request otherwise    |

`AUTH_DATABASE_URL` is still read when `DATABASE_URL` is unset, so a deployment configured before
the store moved into `packages/database` keeps starting; prefer `DATABASE_URL` for new ones.

The sign-in methods the login page offers are derived at build time from the same policy variables
`server/auth.config.ts` reads at runtime (`AUTH_ENABLE_SIGNUP`, `GITHUB_CLIENT_ID` /
`GITHUB_CLIENT_SECRET`), and no runtime override can change them. The flip side of that build-time
capture is a deployment contract: whenever you change those policy variables, rebuild the app, or
the login page will keep advertising the old capabilities (the server still enforces its own policy
either way).

The interface ships English and Italian through `@nuxtjs/i18n`, with dictionaries split by scope in
`apps/dashboard/i18n/locales/<locale>/`. `aube run i18n:status` builds a
[Lunaria](https://lunaria.dev) report showing which translations went stale relative to the English
source; it reads git history, so it needs the dictionaries committed.

`aube run test:e2e` builds the dashboard, starts the production preview on port 5678, and runs the
Playwright suite against `server/auth.config.ts` running with an in-memory Better Auth adapter and
signup enabled (`AUTH_E2E_MEMORY=true`, set only for that preview server), so the suite creates and
signs in its own throwaway account through the real `/api/auth/**` endpoints instead of a live
database. Use `aube --filter @agent-zero/dashboard run test:e2e:ui` for Playwright UI mode.

Hosted execution is available through the provider-neutral `RunnerPool`: every lease has a maximum lifetime, quota checks run before provisioning, expired sandboxes are stopped, and the agent receives only the ordinary `Runner` contract. See [the sandbox provider evaluation](./docs/sandbox-providers.md).

Agent Zero supports native OpenAI, Anthropic, and Google Generative AI adapters, Vercel AI
Gateway, and arbitrary OpenAI-compatible endpoints. Select the transport in repository policy and
provide its credential through the environment:

| `model.provider`    | Credential environment variable                          | Model example                 |
| ------------------- | -------------------------------------------------------- | ----------------------------- |
| `ai-gateway`        | `AI_GATEWAY_API_KEY` or Vercel OIDC                      | `anthropic/claude-sonnet-4.5` |
| `anthropic`         | `ANTHROPIC_API_KEY`                                      | `claude-sonnet-4-5`           |
| `google`            | `GOOGLE_GENERATIVE_AI_API_KEY`                           | `gemini-2.5-pro`              |
| `openai`            | `OPENAI_API_KEY`                                         | `gpt-5`                       |
| `openai-compatible` | `OPENAI_COMPATIBLE_API_KEY` (or legacy `OPENAI_API_KEY`) | provider-specific             |

`AGENT_ZERO_MODEL_BASE_URL` is an optional operator environment variable for custom gateways and
self-hosted endpoints. Endpoint URLs and credentials cannot be named or embedded in
`.agent-zero.yml`, so untrusted repository policy cannot redirect a provider secret. The AI Gateway
accepts `provider/model` identifiers and exposes the broader AI SDK provider catalog without adding
provider-specific logic to the Agent Zero runtime.

To record cost, configure explicit rates; Agent Zero never guesses provider pricing:

```yaml
model:
  provider: openai-compatible
  name: gpt-5
  inputCostPerMillionTokens: 1.25
  outputCostPerMillionTokens: 10
```

`observe` is the safe default and never writes files. Proactive pull-request webhooks are ignored until `proactive.enabled` is true. Automatic changes additionally require `mode: fix` or `autonomous`, `autofix.enabled`, sufficient confidence, an allowed change-risk class, repository-native checks, and (by default for proactive, issue, or autonomous work) an isolated runner. High-impact changes always require human approval.

Issue-to-PR work is opt-in twice: `issues.enabled` must be true and the issue must carry the `issues.requireLabel` label, so arbitrary issue text can never start a run. Issue text is untrusted input for the runtime to validate — never instructions. The run first decides from repository evidence whether the issue actually reports a real problem, and (unless `issues.validationComment` is disabled) posts that verdict back on the issue: confirmed with its evidence, not confirmed with every rejection reason, or inconclusive for a human. A pull request is opened only when the run completed, its changes were applied, and every repository check passed. Verified changes are published to a fresh `issues.branchPrefix` branch (never force-updated, never the default branch), and the pull request body is the run's evidence: acceptance criteria, plan, checks, and lifecycle.

---

## Toolchain

- **[aube](https://aube.jdx.dev)** &ndash; package manager, pinned through `packageManager`, reusing the pnpm lockfile and workspace files.
- **[typescript-native-bridge](https://github.com/johnsoncodehk/typescript-native-bridge)** &ndash; overrides `typescript` repo-wide, so `tsc` keeps the classic package surface while the checker runs on tsgo in-process. The override lives in `pnpm-workspace.yaml` and is pinned exactly; the fork only publishes prerelease versions.
- **[Turborepo](https://turborepo.dev)** &ndash; schedules workspace tasks in dependency order and caches tsdown build outputs.
- **[tsdown](https://tsdown.dev)** &ndash; builds publishable packages as ESM and CommonJS with matching declarations and source maps, through the shared [tsdown configuration](./scripts/tsdown.config.ts). The Nuxt dashboard uses the Nuxt build pipeline instead.
- **[Oxlint](https://oxc.rs) + [Oxfmt](https://oxc.rs)** &ndash; type-aware linting and repository-wide formatting, extended with [`@e18e/eslint-plugin`](https://github.com/e18e/eslint-plugin) for modernization, module-replacement, and performance rules.
- **[Knip](https://knip.dev)** &ndash; detects unused files, exports, and dependencies across the workspace as part of `lint:ci`.
- **[`@arethetypeswrong/cli`](https://github.com/arethetypeswrong/arethetypeswrong.github.io) + [Publint](https://publint.dev)** &ndash; validate every package build.
- **[`@redstardev/unplugin-version-injector`](https://www.npmjs.com/package/@redstardev/unplugin-version-injector)** &ndash; replaces the version marker in `@agent-zero/shared`; the CLI displays that injected version in its header.

GitHub Actions run typecheck, build/export validation, Oxlint, Oxfmt, tests, and an injected-version smoke test. The manual release-readiness workflow validates artifacts without publishing; package publication remains absent until npm trusted publishing and the `@agent-zero` policy are configured.

---

## Security model

The included `LocalRunner` is intended for trusted local development. Production deployments must place it inside Docker, a microVM, or another ephemeral sandbox with CPU, memory, filesystem, and network policies. Only `packages/runner` may invoke shell commands.

Report vulnerabilities privately as described in [SECURITY.md](./SECURITY.md). Do not open a public issue.

---

## Agent Skills

Task-specific Agent Skills live in `.skills/` and are exposed to coding agents through `.agents/skills/`. Skilld manages the versioned tsdown skill, and the same portable layout covers architecture, CLI, Turborepo, and safety work:

```bash
aube run skills:list
aube run skills:install
aube run check:repo
```

[AGENTS.md](./AGENTS.md) and [.github/copilot-instructions.md](./.github/copilot-instructions.md) provide concise entry points for coding agents without replacing the human contributor guide.

---

## Open in your editor

Want to contribute without setting up locally? Click any button below to open this project in a cloud development environment:

[![Open in VS Code](https://img.shields.io/badge/Open%20in-VS%20Code-007ACC?style=flat-square&logo=visualstudiocode)](https://vscode.dev/github/wolfstar-project/agent-zero)
[![Open in GitHub Codespaces](https://img.shields.io/badge/Open%20in-GitHub%20Codespaces-181717?style=flat-square&logo=github)](https://codespaces.new/wolfstar-project/agent-zero)
[![Open in StackBlitz](https://img.shields.io/badge/Open%20in-StackBlitz-1269D3?style=flat-square&logo=stackblitz)](https://stackblitz.com/github/wolfstar-project/agent-zero)
[![Open in Gitpod](https://img.shields.io/badge/Open%20in-Gitpod-FFB45B?style=flat-square&logo=gitpod)](https://gitpod.io/#https://github.com/wolfstar-project/agent-zero)

---

## Contributing

Please read the [Contributing Guide][contributing] before submitting a pull request, and the architecture and safety rules in [AGENTS.md](./AGENTS.md).

Thank you to all the people who have already contributed to Agent Zero!

<a href="https://github.com/wolfstar-project/agent-zero/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=wolfstar-project/agent-zero" alt="Contributors" />
</a>

---

Apache-2.0 © WolfStar Project.

[contributing]: https://github.com/wolfstar-project/agent-zero/blob/main/CONTRIBUTING.md
