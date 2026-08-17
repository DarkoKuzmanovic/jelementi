---
status: accepted
---

# Discard unmerged approved Draft PRs after check failure

## Context

A Publish approval makes a Draft PR ready and enables head-bound auto-merge (ADR-0004). The required `verify` check can still fail, leaving the Draft PR open in `check_failed`. Save must not mutate that approved branch, and Publish cannot repair a failed required check by re-approving the same head. Without a recovery path, the operator must perform manual GitHub cleanup.

## Decision

Discard draft is also available for a still-open, unmerged Draft PR whose head is unchanged and whose topology is unambiguous. This includes the `ready`, `checking`, and `check_failed` states when auto-merge has not fired.

The server operation must freshly verify that:

1. the deterministic Studio branch exists at the expected head SHA;
2. exactly one open Draft PR targets that branch and `main`, with the same head SHA;
3. the Draft PR has not merged and its topology is otherwise valid;
4. the Draft PR is closed before the branch is deleted; and
5. branch deletion still uses the expected-head precondition.

A successful Discard closes only that Draft PR and deletes only that Studio branch. It never changes `main`, canonical article content, or the approved branch contents. A moved head, merged Draft PR, wrong ref/base, or ambiguous topology returns a conflict or named failure and performs no unsafe deletion.

## Consequences

- A failed required check has an in-Studio recovery that resets the approved candidate without weakening Publish's head-bound approval.
- The UI must pass the Draft PR head SHA for `ready`, `checking`, and `check_failed`, not only the branch evidence carried by draft states.
- Closing the Draft PR cancels the abandoned approval; a later attempt requires a new Save and Publish flow.
- The existing idempotent close-then-delete recovery remains valid for both not-yet-ready and ready Draft PRs.

## Rejected alternative

Mutating or retrying the approved branch was rejected because it would violate ADR-0004. Re-running checks in place was also rejected: Studio does not own GitHub check orchestration, and a new content or approval decision must create a new head.
