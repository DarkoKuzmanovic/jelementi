---
status: superseded by ADR-0006
---

# Draft-branch rebase as the concurrency recovery path

When a Studio operation finds a stale base (newer `main` article version or unexpected active draft head), the recovery is: re-base the Studio branch onto the newer `main` when the target article blob is unchanged and the merge is clean; otherwise block with a comparison and offer the operator a copy of the local text (discard local, reload remote). Studio never auto-merges and never overwrites.

This extends the spec's own Publish-time rule (branch update only under unchanged-article + clean-merge conditions) to Save. The alternative — always blocking and requiring manual GitHub surgery — leaves the operator with no working path when unrelated content reaches `main`; unconditional force-save would violate the never-overwrite invariant. The rule keeps concurrency evidence meaningful: expected `main` SHA, draft head SHA, and blob SHA are compared with fresh GitHub reads before any write.
