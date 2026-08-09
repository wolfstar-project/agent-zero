# Agent Zero

Agent Zero is an open-source autonomous engineer that finds, fixes, and verifies problems in pull requests.

The first release focuses on one trustworthy loop: ingest review feedback, validate the claim, apply a narrowly scoped fix, run the repository's real checks, inspect the resulting diff, and produce evidence. Feedback is never treated as truth merely because it came from a human or an AI reviewer.

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

Packages are deliberately separated: `agent` contains orchestration only, `runner` owns process execution, `models` owns LLM providers, `github` translates GitHub events, `config` validates repository policy, and `shared` contains stable contracts. `apps/server` is the control-plane API.

## Quick start

Requirements: Node.js 22.18+ and pnpm. The generated Node.js bundles target Node.js 20.11+. Turborepo schedules workspace tasks in dependency order and caches tsdown build outputs. Oxlint performs type-aware linting and TypeScript diagnostics; Oxfmt enforces repository-wide formatting.

```bash
pnpm install
cp .env.example .env
pnpm test
pnpm zero doctor
pnpm zero review --feedback "Possible null dereference in src/user.ts"
pnpm dev
```

The type-safe oRPC API starts on `http://localhost:4040` and exposes `health`, `tasks.list`, `tasks.get`, and `tasks.create` procedures. Use `@orpc/client` from a dashboard or another service:

```ts
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { RouterClient } from '@orpc/server';
import type { AppRouter } from '@agent-zero/server/router';

const zero: RouterClient<AppRouter> = createORPCClient(
  new RPCLink({ url: 'http://localhost:4040' }),
);
await zero.tasks.create({ repository: '.', feedback: 'Check error handling', mode: 'observe' });
```

`observe` is the safe default and never writes files. Set `mode: fix` and `autofix.enabled: true` in `.agent-zero.yml` only after configuring a model provider and an isolated runner.

## CLI

```text
zero init                   create .agent-zero.yml
zero --version              print the injected CLI version
zero doctor [--json]        inspect the local environment
zero review [--feedback X]  validate feedback without editing
zero fix [--feedback X]     validate, edit, and verify (policy permitting)
zero run [--feedback X]     run using the configured mode
```

The CLI uses `@bomb.sh/args` for typed argument parsing and `@clack/prompts` for interactive output.
When `--feedback` is omitted in a terminal, it asks for the task interactively. Use `--feedback`
and `--json` for scripts and CI.

## Build and CI

The shared [tsdown configuration](./scripts/tsdown.config.ts) builds publishable packages as ESM
and CommonJS, with matching declarations and source maps. Every package build is validated by
`@arethetypeswrong/cli` and Publint. Apps remain ESM-only.

`@redstardev/unplugin-version-injector` replaces the version marker in `@agent-zero/shared` from
its `package.json`; the CLI displays that injected version in its header.

GitHub Actions run typecheck, build/export validation, Oxlint, Oxfmt, tests, and an injected-version
smoke test. The manual release-readiness workflow validates artifacts without publishing; package
publication remains absent until npm trusted publishing and the `@agent-zero` policy are configured.

## Security model

The included `LocalRunner` is intended for trusted local development. Production deployments must place it inside Docker, a microVM, or another ephemeral sandbox with CPU, memory, filesystem, and network policies. The server never invokes shell commands directly.

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](./CONTRIBUTING.md), read the architecture and safety rules in [AGENTS.md](./AGENTS.md), and use the pull request template. Security reports must follow [SECURITY.md](./SECURITY.md) and must not be posted publicly.

The repository includes task-specific Agent Skills under `.agents/skills/`. Skilld manages the versioned tsdown skill and the same portable layout exposes repository-specific skills for architecture, CLI, oRPC, Turborepo, and safety work:

```bash
pnpm skills:list
pnpm skills:install
pnpm check:repo
```

`llms.txt`, `.github/copilot-instructions.md`, and `docs/architecture.md` provide concise entry points for coding agents without replacing the human contributor guide.

## Roadmap

Agent Zero is being developed incrementally around the **find, fix, and verify** loop. The current milestones are:

- **v0.1:** resolve GitHub review feedback with evidence
- **v0.2:** proactive PR review and confidence-gated autofix
- **v0.3:** control plane, task history, cost tracking, dashboard, and runner pools
- **v0.4:** bounded issue-to-PR autonomous workflows

See the [full project roadmap](./ROADMAP.md) for milestone goals, planned capabilities, longer-term directions, and explicit non-goals. Roadmap-level progress and changes are tracked in the roadmap tracking issue, [#5](https://github.com/wolfstar-project/agent-zero/issues/5).

Apache-2.0 © WolfStar Project.
