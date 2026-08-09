# Contributing to Agent Zero

Thanks for helping build Agent Zero. Bug reports, design discussions, documentation improvements, tests, and focused code changes are all welcome.

For questions and early design discussion, use the WolfStar community at [join.wolfstar.rocks](https://join.wolfstar.rocks). Read [SUPPORT.md](SUPPORT.md) to choose the right channel. Use GitHub issues for reproducible bugs and concrete proposals. Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md), and project decision-making is described in [GOVERNANCE.md](GOVERNANCE.md).

## Development setup

Requirements:

- Node.js 22.18 or newer
- Corepack
- Git

```bash
git clone https://github.com/wolfstar-project/agent-zero.git
cd agent-zero
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm check:repo
pnpm test
```

The lockfile pins pnpm. Do not use npm, Yarn, Bun, or another package manager in this repository.

## Choose the right package

| Change                           | Location          |
| -------------------------------- | ----------------- |
| Agent lifecycle and decisions    | `packages/agent`  |
| Commands and repository mutation | `packages/runner` |
| LLM providers                    | `packages/models` |
| GitHub adapters                  | `packages/github` |
| Configuration and policy         | `packages/config` |
| Shared contracts                 | `packages/shared` |
| CLI parsing and presentation     | `packages/cli`    |
| HTTP control-plane composition   | `apps/server`     |

Read [AGENTS.md](AGENTS.md) and the matching files in `.agents/skills/` before making architectural or safety-sensitive changes.

## Development workflow

1. Fork the repository and branch from `main`.
2. Reproduce the issue or define observable acceptance criteria.
3. Add or update a deterministic test where behavior changes.
4. Implement the smallest change at the correct package boundary.
5. Run the relevant package checks while iterating.
6. Run the complete verification suite.
7. Open a focused pull request using the repository template.

Useful commands:

```bash
pnpm dev             # watch workspace development tasks
pnpm zero doctor     # inspect the local environment
pnpm test            # deterministic Vitest suites
pnpm typecheck       # TypeScript checks across the graph
pnpm lint:ci         # Oxfmt check plus type-aware Oxlint
pnpm build           # build and package validation
pnpm check:repo      # community files and Agent Skills
pnpm skills:list     # show Skilld-managed project skills
pnpm skills:install  # restore Skilld links for Codex
```

## Tests and safety

- Add tests beside the source as `*.test.ts`.
- Prefer stable fixtures and explicit inputs over mocks of implementation details.
- Do not call GitHub, model providers, package registries, or other live services from unit tests.
- Cover success, rejection, and recovery transitions when modifying the agent state machine.
- Cover command allowlisting, paths, timeouts, output limits, and read-only behavior when modifying the runner.
- Verify that `observe` mode cannot write before changing execution policy.

## Style and commits

Oxfmt owns formatting and Oxlint owns linting. Avoid unrelated formatting churn.

`pnpm install` installs Git hooks through the `prepare` script (`.husky/install.mjs`), which skips hook installation in CI and production environments:

- `pre-commit` runs `pnpm exec nano-staged`, which formats staged files with Oxfmt and re-stages them.
- `commit-msg` runs `pnpm exec commitlint --edit`, which enforces Conventional Commit messages.

If `pre-commit` fails, fix the reported error and commit again; formatting fixes are applied automatically. If `commit-msg` rejects your message, reword it to follow the Conventional Commit format below (after a failed commit, rerun `git commit` with a valid message; to fix the previous commit, use `git commit --amend`).

Use Conventional Commit-style messages and PR titles:

```text
feat(cli): add machine-readable doctor output
fix(runner): reject paths outside the checkout
docs(contributing): document release verification
test(agent): cover failed verification transition
```

## Pull request checklist

Before opening a PR, run:

```bash
pnpm check:repo
pnpm lint:ci
pnpm typecheck
pnpm test
pnpm build
```

In the PR, describe what changed, why it belongs at that boundary, how it was verified, and whether it changes runtime permissions or safety guarantees. Screenshots are useful only for user-visible terminal or UI changes; logs or test names are better evidence for runtime changes.
