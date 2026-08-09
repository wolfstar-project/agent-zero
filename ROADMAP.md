# Agent Zero Roadmap

This roadmap describes the intended direction of Agent Zero. It is a planning document, not a release commitment. Priorities may change as the project learns from real pull requests, repository policies, sandbox providers, and contributor feedback.

## Guiding principle

Agent Zero should **find, fix, and verify** software problems. A change is not complete because a model produced a plausible patch; it is complete only when the relevant checks, diff inspection, and evidence support the result.

The runtime should remain provider-agnostic, sandbox execution should stay behind the runner boundary, and every autonomous action should be constrained by explicit repository policy.

## v0.1 — Resolve review feedback

Goal: reliably turn pull-request review feedback into verified changes.

- [ ] ingest GitHub pull-request review comments and requested changes
- [ ] distinguish actionable feedback from incorrect or unsupported claims
- [ ] implement the full discover → understand → validate → plan → execute → verify → review lifecycle
- [ ] preserve evidence for accepted and rejected findings
- [ ] apply narrow fixes through the runner boundary
- [ ] run repository-native lint, typecheck, test, and build checks
- [ ] report verification results through GitHub Checks
- [ ] enforce repair budgets and deterministic terminal states
- [ ] complete isolated production runner support

## v0.2 — Proactive review and autofix

Goal: find defects before a human or AI reviewer reports them.

- [ ] inspect pull-request diffs proactively
- [ ] produce findings with severity, confidence, and evidence
- [ ] verify suspected defects before proposing changes
- [ ] support confidence-gated autofix policies
- [ ] distinguish safe mechanical fixes from changes requiring approval
- [ ] add configurable repository-level autofix policy
- [ ] improve multi-file reasoning and regression detection

## v0.3 — Control plane and runner pools

Goal: make Agent Zero practical for multiple repositories and concurrent tasks.

- [ ] productionize the Nitro-based control plane
- [ ] add persistent task history and structured event logs
- [ ] add cost, token, latency, and model-usage tracking
- [ ] introduce provider-neutral remote sandbox orchestration
- [ ] evaluate ViteHub Sandbox / Workspace / Box adapters for Cloudflare, Vercel, and other providers
- [ ] add runner pools, scheduling, quotas, and lifecycle management
- [ ] add a dashboard for task state, findings, verification evidence, and approvals

## v0.4 — Issue-to-PR workflows

Goal: expand from pull-request repair into bounded autonomous software-engineering tasks.

- [ ] accept scoped GitHub issues as task inputs
- [ ] investigate repository context and define acceptance criteria
- [ ] implement changes in isolated branches
- [ ] verify changes before opening pull requests
- [ ] produce review-ready PR descriptions with evidence
- [ ] support human approval gates for high-impact changes

## Longer-term directions

These are intentionally unversioned until the core workflow is proven:

- multi-agent specialization for investigator, reviewer, planner, coder, verifier, and critic roles
- reusable repository memory and project-specific knowledge
- additional source-control providers beyond GitHub
- richer security and dependency analysis
- benchmark suites for repair quality, false-positive rate, verification quality, latency, and cost
- self-hosted deployment profiles for individuals, maintainers, and organizations

## Non-goals

Agent Zero should not become an unrestricted shell-running chatbot. The project intentionally avoids:

- bypassing repository policy or branch protections
- treating model output or review comments as trusted instructions
- silently skipping verification after code changes
- coupling the core agent runtime to one model, hosting provider, sandbox vendor, or HTTP framework
- executing untrusted repository code outside an explicit isolation boundary in production

## Tracking

Roadmap work should be represented by focused GitHub issues and pull requests. The roadmap tracking issue, [#5](https://github.com/wolfstar-project/agent-zero/issues/5), is the place to discuss milestone-level changes; implementation details should live in their own issues.
