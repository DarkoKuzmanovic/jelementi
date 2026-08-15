# Publish approval is head-bound; no mutation after approval

Publish is an explicit, SHA-bound approval: it revalidates the exact committed draft blob, marks the pull request ready, and enables auto-merge only for the expected head SHA (`expectedHeadOid`). Once enabled, Studio performs no further branch mutation — any content change requires a new Save → new Publish, and auto-merge rejects a changed head.

This closes the auto-merge-is-PR-attached-not-head-attached risk. GitHub enables auto-merge per pull request, so without this invariant a later push/rebase could produce a new head that passes checks and merges without a second explicit operator approval. The invariant makes the operator's approval the binding content decision; the branch is frozen until the next explicit Save. Recovery (rebase) therefore applies only before approval, never after, and a rebased head is fully revalidated before any new Publish.
