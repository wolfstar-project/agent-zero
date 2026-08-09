## Summary

<!-- What changed? Keep this focused on observable behavior. -->

## Why

<!-- What problem does this solve, and why is this the correct package boundary? -->

## Verification

<!-- List exact commands, tests, or manual scenarios and their results. -->

- [ ] `aube run check:repo`
- [ ] `aube run lint:ci`
- [ ] `aube run typecheck`
- [ ] `aube test`
- [ ] `aube run build`

## Safety and compatibility

- [ ] I added or updated deterministic tests for changed behavior.
- [ ] I preserved `observe` mode as read-only, or explained the policy change above.
- [ ] Runtime commands and target-repository writes remain inside the runner boundary.
- [ ] I did not expose secrets, tokens, personal data, or untrusted output in logs.
- [ ] I updated documentation and Agent Skills when workflows or boundaries changed.

## Reviewer notes

<!-- Highlight risky decisions, follow-up work, screenshots, or areas needing special attention. -->
