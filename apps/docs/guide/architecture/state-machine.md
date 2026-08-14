# State machine

Every run — reviewer feedback, proactive diff review, or a labeled issue — walks the same lifecycle:

```text
discover → understand → validate → plan → execute → verify → review
                                     ↑                    │
                                     └────── repair ◀─────┘
```

`LifecycleMachine` in `packages/agent` holds the transition table and refuses any move it does not define, so an implementation mistake becomes a thrown error rather than an unverified result that looks finished. Notably:

- `executing` cannot reach `completed` without passing through `verifying`;
- `planning` cannot skip to `reviewing`;
- every non-terminal state can reach `failed`.

## What each stage owns

| Stage          | Decision                                                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **discover**   | Collect the checkout, its working-tree or pull-request base-to-head diff, and its native check commands through the runner.             |
| **understand** | Ask the model to interpret untrusted feedback, proactively inspect the complete diff, or interpret an issue task in repository context. |
| **validate**   | Decide the verdict from repository evidence, never from the reviewer's or the model's assertion.                                        |
| **plan**       | Record the plan and resolve authorization. Each refusal is a distinct reportable outcome rather than a silent downgrade.                |
| **execute**    | Apply changes restricted to the validated scope, through the runner.                                                                    |
| **verify**     | Run the repository's own checks and capture their output.                                                                               |
| **review**     | Inspect the resulting diff before a run may call itself complete.                                                                       |

Repair re-enters `plan` with the failing output as context, until `agent.maxAttempts` is spent.

## Verdicts

Validation lives in `packages/agent/src/validation.ts` and is independent of any provider. It rejects a claim that cites no evidence, names no existing file, or quotes repository content that is not there; it reports a supported but low-confidence claim as inconclusive. Rejection reasons are collected in full rather than short-circuiting on the first, because the report is the product.

| Verdict           | Meaning                                                              |
| ----------------- | -------------------------------------------------------------------- |
| **confirmed**     | Repository evidence supports the report.                             |
| **not confirmed** | Evidence contradicts the report; every rejection reason is included. |
| **inconclusive**  | A human should decide.                                               |

## Evidence

`TaskResult.verified` is derived in exactly one place, at the point a run produces its terminal result: it requires a completed state, an applied change, and every executed check passing. No branch can assert verification it did not earn — a failed verification is never presented as success.

`EvidenceBundle` and its Markdown renderer live in `packages/shared` because both the source-control adapters and the CLI consume them. Terminal states map deterministically onto a provider-neutral run outcome in `packages/source-control`, which each provider adapter translates into its own status vocabulary — explicitly noting any conclusion the platform cannot express (see [Source-control providers](/reference/source-control-providers)).
