---
status: accepted
---

# Replace stale Studio drafts instead of rebasing them in place

ADR-0002 is superseded. When unrelated `main` movement makes a Studio draft stale, recovery preserves the submitted candidate, closes and confirms the exact old pull request unmerged, deletes only its expected branch head, recreates the deterministic branch from fresh `main`, recommits the candidate, and opens a new Draft PR requiring a fresh Publish. Recovery proceeds only when the loaded head still matches, the target article blob is unchanged on fresh `main`, and the draft changes exactly that article; every ambiguous partial result is rediscovered before retry.

GitHub's asynchronous `update-branch` endpoint can guard the expected head SHA but cannot atomically require the pull request to remain Draft. A concurrent approval could therefore mutate an approved, auto-merge-enabled branch and violate ADR-0004. Application-level serialization was rejected because it cannot include direct GitHub UI actions without adding a new enforced approval boundary. Draft replacement instead makes races conservative: closing cancels publication without changing content, while a merge or moved head makes recovery abort and return the preserved candidate.
