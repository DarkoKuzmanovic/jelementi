# Checkpoint A Change Record — 2026-07-26

## Approval and operator

- Approval: Darko explicitly approved Checkpoint A in the active M2 Crew session.
- Authenticated GitHub owner: `DarkoKuzmanovic`, discovered read-only with `gh api user`.
- Operator path: GitHub CLI over HTTPS from the local Jelementi repository.
- No credential or token value is recorded here.

## Before-state

- Local working tree: clean before this record was written.
- Local `main`: `edec344`.
- Local `crew/m2-cloudflare-beta`: `725c29c`.
- Local `crew/m1-content-engine`: `edec344`.
- Git remotes: none.
- `DarkoKuzmanovic/jelementi`: absent at read-only preflight time.
- Cloudflare, DNS, Access, Worker, token, and R2 state: outside Checkpoint A and unchanged.

## Approved mutations and reversals

| Step | Approved mutation | Required verification | Recorded reversal |
|---|---|---|---|
| 1 | Create `DarkoKuzmanovic/jelementi` as a private GitHub repository without an initial push. | Repository visibility is `PRIVATE`; no unexpected branch or collaborator exists. | Remove the local remote if added and leave/archive the private repository. Repository deletion is destructive and requires separate explicit approval; it is never automatic. |
| 2 | Add local `origin` pointing to the new HTTPS repository. | `git remote -v` contains only the expected owner/repository URL. | `git remote remove origin` restores the local before-state. |
| 3 | Push only local `main` and `crew/m2-cloudflare-beta`, without force. | Remote branch SHAs equal the recorded local SHAs; default branch is `main`. | Do not rewrite or automatically delete remote history. If bootstrap is abandoned, remove `origin` locally and handle remote archival/deletion only through a separate approved action. |
| 4 | Create one active branch ruleset for `main`, with no bypass actor, requiring a pull request and successful `CI / verify`. | Read back the ruleset ID, target, enforcement, conditions, bypass list, pull-request rule, and required status-check context. | Disable the recorded ruleset by ID with a separately reviewed API call; delete it only with explicit approval. |

## Planned ruleset contract

- Name: `Protect main`.
- Target: branch.
- Enforcement: active.
- Included ref: `refs/heads/main`.
- Bypass actors: none.
- Required pull request: yes; zero approving reviews is acceptable for the sole-maintainer beta, but direct pushes remain disallowed.
- Required status check: exact context `CI / verify`, strict branch update required.
- Branch deletion and non-fast-forward updates: blocked.

## Stop rules

Stop without broadening scope if:

- the authenticated owner differs from `DarkoKuzmanovic`;
- the repository name becomes occupied;
- private visibility cannot be confirmed;
- branch SHAs differ from the recorded local state;
- GitHub rejects the no-bypass PR/status-check ruleset;
- satisfying the ruleset would require a routine bypass, broader token scope, force push, or a Cloudflare mutation.

## Post-state

Pending execution. Fill in the repository URL, remote branch SHAs, default branch, ruleset ID, and verification result after the approved operations.
