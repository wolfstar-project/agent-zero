# Issue-to-PR workflow

A scoped GitHub issue can become a verified, review-ready pull request without ever widening the runtime's authority.

## Opt-in twice

Issue-to-PR work requires two explicit opt-ins, so arbitrary issue text can never start a run:

```yaml
issues:
  enabled: true # 1. repository policy opts in
  requireLabel: agent-zero # 2. the issue must carry this label
  branchPrefix: agent-zero/
  validationComment: true
```

The entry point is the same authenticated webhook path as every other trigger: an `issues` event is parsed in `packages/source-control` and produces a task only when both conditions hold. The issue's title and body travel to the runtime as bounded, **untrusted** feedback — data to validate, never instructions — and the run mode comes only from repository policy, never from the wire.

## The run

The run itself is the ordinary [lifecycle](/guide/architecture/state-machine). During planning the model records verifiable acceptance criteria for the issue alongside its plan; the runtime bounds them and carries them into the task result and evidence bundle. Writes still require an explicit write mode, `autofix.enabled`, confidence, an allowed change-risk class, and — by default, like proactive work — an isolated runner. High-impact changes stop at `needs-human` exactly as before.

## The validation comment

Unless `issues.validationComment` is disabled, a finished run posts one comment on the issue, composed from the persisted evidence alone:

- **confirmed** — repository evidence supports the report, included with the comment;
- **not confirmed** — with every rejection reason;
- **inconclusive** — for a human to decide.

A run that failed before reaching a verdict posts nothing rather than something misleading. The comment adapter can only add a comment — it has no path to label, edit, or close an issue — and the comment claims a fix exists only when the run was actually verified.

## Publication

`prepareIssuePullRequest` in `packages/source-control` is the single place that decides whether a finished run has earned a pull request. It refuses any run that is not `completed`, not `accepted`, not verified by the repository's own checks, changed no files, or proposes a high-impact change — so a pull request can never claim success its evidence does not support. The body **is** the rendered evidence: acceptance criteria, plan, checks, and lifecycle.

Verified changes are published as a commit on a fresh `issues.branchPrefix` branch through the Git data API, and the pull request is opened against the default branch. Three invariants hold:

- the branch name is assembled only from operator policy, the issue number, and the task identifier;
- an existing ref is never force-updated;
- the default branch is never committed to.

A failed publication never fails the run — the evidence is already persisted — it is reported as the reason no pull request exists.
