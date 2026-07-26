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
| 4 | After a 14-commit secret-pattern audit, change repository visibility from private to public with Darko's second explicit confirmation of irreversible source-history disclosure. | Visibility is `PUBLIC`; default branch and branch SHAs remain unchanged. | Visibility may later be changed to private, but existing clones cannot be recalled; private ruleset enforcement requires a paid plan or a different owner. |
| 5 | Create one active branch ruleset for `main`, with no bypass actor, requiring a pull request and successful GitHub Actions check-run context `verify`. | Read back ruleset `19777485`, target, enforcement, conditions, empty bypass list, pull-request rule, and required status-check context. | Disable ruleset `19777485` with a separately reviewed API call; delete it only with explicit approval. |

## Planned ruleset contract

- Name: `Protect main`.
- Target: branch.
- Enforcement: active.
- Included ref: `refs/heads/main`.
- Bypass actors: none.
- Required pull request: yes; zero approving reviews is acceptable for the sole-maintainer beta, but direct pushes remain disallowed.
- Required status check: exact GitHub Checks API context `verify`, strict branch update required.
- Branch deletion and non-fast-forward updates: blocked.

## Stop rules

Stop without broadening scope if:

- the authenticated owner differs from `DarkoKuzmanovic`;
- the repository name becomes occupied;
- the explicitly approved repository visibility cannot be confirmed;
- branch SHAs differ from the recorded local state;
- GitHub rejects the no-bypass PR/status-check ruleset;
- satisfying the ruleset would require a routine bypass, broader token scope, force push, or a Cloudflare mutation.

## Post-state

- Repository: `https://github.com/DarkoKuzmanovic/jelementi`.
- Visibility: public after Darko's second explicit confirmation; the history audit found no recognized secret pattern in 14 commits.
- Default branch: `main`.
- Local remote: `origin` → `https://github.com/DarkoKuzmanovic/jelementi.git`.
- Remote `main`: `edec3445d9b3af45ece8ef72ffd27b3f4b99492b`.
- Remote `crew/m2-cloudflare-beta`: `f859cc0681892f1f6da9e68722da4e79259a78aa` after the clean-install fix and before this final record update.
- Ruleset: `19777485`, `Protect main`, active on `refs/heads/main`, no bypass actors, PR required, deletion/non-fast-forward blocked, strict required check-run context `verify`, zero required approvals.
- Initial remote `main` CI check-run `verify`: registered but failed during frozen install before tests because pnpm 11 rejected unreviewed `esbuild` lifecycle scripts.
- Clean-install fix: exact `allowBuilds` approvals for `esbuild@0.28.1` and `workerd@1.20260722.1`; a clean clone then passed frozen install and the complete 95/95-test local gate.
- Cloudflare, DNS, Access, Worker, token, and R2 state: unchanged.

## Resolved blockers

1. Private-repository rulesets returned HTTP 403 on GitHub Free. Darko explicitly selected public visibility and reconfirmed after the irreversible-disclosure warning and history secret scan.
2. The designed literal `CI / verify` did not match GitHub's actual Checks API context. The observed check-run name is `verify`; the ruleset and source-of-truth docs were corrected to preserve mandatory CI enforcement.
3. The first pnpm 11 fix hypothesis (`onlyBuiltDependencies`) failed because pnpm 11 removed that setting. The owning `pnpm-workspace.yaml` boundary now uses exact `allowBuilds` entries; clean install and full gate are green.

Checkpoint A's repository, visibility, branch, and ruleset controls are complete, but integration is not closed: protected `main` remains on the failed `edec3445` check until an explicitly approved pull request lands the clean-install fix and M2.1 delta with a green `verify` result. Checkpoint B must not start before that merge.
