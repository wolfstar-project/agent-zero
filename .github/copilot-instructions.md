# Agent Zero repository instructions

Read `/AGENTS.md` before editing and load the relevant skill from `/.agents/skills/`.

- Use pnpm and the root scripts.
- Preserve the package dependency direction documented in `/docs/architecture.md`.
- Keep runtime command execution and target-repository mutation inside `packages/runner`.
- Keep `observe` mode read-only.
- Add deterministic tests for behavior, state transitions, and safety-sensitive changes.
- Use oRPC in `apps/server`, `@bomb.sh/args` plus `@clack/prompts` in the CLI, tsdown for builds, and Oxlint/Oxfmt for code quality.
- Do not introduce Hono, ESLint, Prettier, npm, Yarn, or Bun without an accepted architectural proposal.
- Run `pnpm check:repo`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test`, and `pnpm build` before handing off a complete change.
