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

Agent Zero runs one trustworthy loop: ingest review feedback or inspect a pull-request diff proactively, validate the finding, apply a narrowly scoped policy-approved fix, run the repository's real checks, inspect the resulting diff, and produce evidence.

Feedback is never treated as truth merely because it came from a human or an AI reviewer.

- **Evidence over assertion** &ndash; every fix carries the commands that verified it.
- **Proactive, not speculative** &ndash; diff review reports the highest-priority finding only when checkout evidence supports it.
- **Confidence and impact gates** &ndash; automatic fixes require confidence, an allowed change-risk class, repository permission, and verification.
- **`observe` by default** &ndash; the safe mode inspects and reports, and never writes to a target repository.
- **One execution boundary** &ndash; `packages/runner` is the only code allowed to run commands or mutate a checkout.
- **Adapters at the edges** &ndash; the runtime stays independent of HTTP, GitHub, terminal UI, and model providers.

---

## Architecture

```text
GitHub webhook / CLI
        │
        ▼
     Server API ─── task events
        │
        ▼
   Agent state machine
 discover → understand → validate → plan → execute → verify → review
                                      │                    │
                                      └──── repair ◀───────┘
        │
        ▼
 Runner boundary ─── repository commands and file operations
```

| Package                                | Responsibility                                                 |
| -------------------------------------- | -------------------------------------------------------------- |
| [`packages/agent`](./packages/agent)   | Orchestration and state transitions                            |
| [`packages/runner`](./packages/runner) | The only boundary that executes commands or mutates a checkout |
| [`packages/models`](./packages/models) | Model-provider abstractions                                    |
| [`packages/github`](./packages/github) | GitHub event and API adapters                                  |
| [`packages/config`](./packages/config) | Configuration parsing and policy                               |
| [`packages/shared`](./packages/shared) | Stable cross-package contracts                                 |
| [`packages/cli`](./packages/cli)       | Argument parsing and terminal presentation                     |
| [`apps/server`](./apps/server)         | oRPC transport and control-plane composition                   |

Adapters depend on the runtime; the runtime never depends on adapters. See [docs/architecture.md](./docs/architecture.md) for the full dependency rules.

---

## Quick start

Requirements: Node.js 22.18+ and [aube](https://aube.jdx.dev), the package manager pinned in `package.json`. Both are pinned in `mise.toml`, so [mise](https://mise.jdx.dev) can install them together. Generated Node.js bundles target Node.js 20.11+.

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

## Control plane

The type-safe oRPC API starts on `http://localhost:4040` and exposes `health`, `tasks.list`, `tasks.get`, and `tasks.create`. Call it from a dashboard or another service with `@orpc/client`:

```ts
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { RouterClient } from '@orpc/server';
import type { AppRouter } from '@agent-zero/server/router';

const zero: RouterClient<AppRouter> = createORPCClient(
  new RPCLink({ url: 'http://localhost:4040' }),
);

await zero.tasks.create({ repository: '.', feedback: 'Check error handling', mode: 'observe' });
await zero.tasks.create({ repository: '.', trigger: 'proactive', mode: 'observe' });
```

`observe` is the safe default and never writes files. Proactive pull-request webhooks are ignored until `proactive.enabled` is true. Automatic changes additionally require `mode: fix` or `autonomous`, `autofix.enabled`, sufficient confidence, an allowed change-risk class, repository-native checks, and (by default for proactive/autonomous work) an isolated runner. High-impact changes always require human approval.

---

## Toolchain

- **[aube](https://aube.jdx.dev)** &ndash; package manager, pinned through `packageManager`, reusing the pnpm lockfile and workspace files.
- **[typescript-native-bridge](https://github.com/johnsoncodehk/typescript-native-bridge)** &ndash; overrides `typescript` repo-wide, so `tsc` keeps the classic package surface while the checker runs on tsgo in-process. The override lives in `pnpm-workspace.yaml` and is pinned exactly; the fork only publishes prerelease versions.
- **[Turborepo](https://turborepo.dev)** &ndash; schedules workspace tasks in dependency order and caches tsdown build outputs.
- **[tsdown](https://tsdown.dev)** &ndash; builds publishable packages as ESM and CommonJS with matching declarations and source maps, through the shared [tsdown configuration](./scripts/tsdown.config.ts). Apps stay ESM-only.
- **[Oxlint](https://oxc.rs) + [Oxfmt](https://oxc.rs)** &ndash; type-aware linting and repository-wide formatting, extended with [`@e18e/eslint-plugin`](https://github.com/e18e/eslint-plugin) for modernization, module-replacement, and performance rules.
- **[Knip](https://knip.dev)** &ndash; detects unused files, exports, and dependencies across the workspace as part of `lint:ci`.
- **[`@arethetypeswrong/cli`](https://github.com/arethetypeswrong/arethetypeswrong.github.io) + [Publint](https://publint.dev)** &ndash; validate every package build.
- **[`@redstardev/unplugin-version-injector`](https://www.npmjs.com/package/@redstardev/unplugin-version-injector)** &ndash; replaces the version marker in `@agent-zero/shared`; the CLI displays that injected version in its header.

GitHub Actions run typecheck, build/export validation, Oxlint, Oxfmt, tests, and an injected-version smoke test. The manual release-readiness workflow validates artifacts without publishing; package publication remains absent until npm trusted publishing and the `@agent-zero` policy are configured.

---

## Security model

The included `LocalRunner` is intended for trusted local development. Production deployments must place it inside Docker, a microVM, or another ephemeral sandbox with CPU, memory, filesystem, and network policies. The server never invokes shell commands directly.

Report vulnerabilities privately as described in [SECURITY.md](./SECURITY.md). Do not open a public issue.

---

## Agent Skills

Task-specific Agent Skills live in `.skills/` and are exposed to coding agents through `.agents/skills/`. Skilld manages the versioned tsdown skill, and the same portable layout covers architecture, CLI, oRPC, Turborepo, and safety work:

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
