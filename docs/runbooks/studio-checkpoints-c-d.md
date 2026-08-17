# Studio Checkpoints C & D — Procedure

**Status: NOT EXECUTED.** This is the approval-gated procedure, not a
completed change record — unlike `docs/runbooks/checkpoint-{a,b,c}-*.md`
(the M2 records), no remote action described below has happened yet. When
executed, fill in the before/after-state and evidence fields inline or
append a dated completion record beneath each checkpoint, following the
M2 files' pattern.

Scope: #20 (T8) is runbook + provisioning only. Neither checkpoint may run
without Darko's separate, explicit approval at execution time, enumerated
per stage — approving one stage does not authorize the next.

## Preconditions

- Checkpoint A complete (`ops/checkpoints/checkpoint-a-github-app.sh`):
  GitHub App created, installed on `DarkoKuzmanovic/jelementi` only,
  `allow_auto_merge` + `delete_branch_on_merge` read back true, private key
  set as a Cloudflare Worker secret.
- Checkpoint B complete (`ops/checkpoints/checkpoint-b-access-policy.sh`):
  Access application covers `/studio*`, Allow policy scoped to exactly one
  operator email, anonymous request challenged, operator request passes.
- Both wizards' non-secret var writes (`ACCESS_*`, `GITHUB_APP_*`,
  `GITHUB_INSTALLATION_ID`) landed on one dedicated branch, not pushed
  directly to `main`.
- **Known pre-flight risk** (`docs/runbooks/studio-operations.md` §"Known
  pre-flight risk"): the installation-token permission request in
  `github-adapter.auth.ts` defaults every token to read-only
  (`contents:read`, `pull_requests:read`), which every Studio write
  operation needs write access to. This is confirmed for real at D1's
  pre-flight write, before anything else in Checkpoint D proceeds.

## Checkpoint C — protected deployment, read-only

Scope: get the config branch onto production and prove Studio is reachable
and correctly gated, without exercising any Studio write (Save, Publish,
Unpublish, Discard, Draft replacement). All Studio code (T0–T9) is already
on `main`; this checkpoint activates the configuration that makes it
actually usable, not new application code.

| Step | Action | Verification | Reversal |
|---|---|---|---|
| C1 | Reconfirm anonymous `/studio` request is challenged by Access, and the operator identity passes (re-run Checkpoint B Stage 5). | Same evidence as Checkpoint B, re-observed immediately before C2. | None — read-only. |
| C2 | Push the dedicated config branch from A/B and open its PR against `main`. | GitHub `verify` check green on the exact head; PR diff touches only `wrangler.jsonc`/`wrangler.m2.jsonc` var placeholders (no code, no secret value). | Close the PR without merging; `main` untouched. |
| C3 | Merge the PR through protected `main` (PR required, `verify` required, no bypass — same ruleset as M2 Checkpoint A). | Merge commit SHA recorded; branch auto-deleted per Checkpoint A's repo settings. | Normal Git revert PR through the same protected path. |
| C4 | Observe the automatic Workers Builds production deploy of the merged commit. | `wrangler deployments status --json` (or dashboard) reports 100% traffic on the new version; deployment ID + commit SHA recorded. | Cloudflare Worker version rollback to the last known-good version (see `cloudflare-m2-operations.md` incident rollback) — does not touch Access/DNS/secrets. |
| C5 | Run the existing production reader probes. | `pnpm verify:remote -- --base-url https://jelementi.quz.ma` passes in full (reader routes unaffected by Studio's addition). | Same as C4 if it fails. |
| C6 | Confirm Studio is reachable and read-only. Authenticated operator opens `/studio`, sees the article list (`deriveStudioArticleList` — a pure GitHub read), and performs **no** Save/Publish/Unpublish/Discard. | Article list renders with correct lifecycle facts for at least one real article; page load produces zero GitHub writes (no new branch/PR appears in `DarkoKuzmanovic/jelementi`). | None — nothing was written. |
| C7 | Reconfirm anonymous request is still challenged post-deploy (a bad merge could theoretically regress the Access application binding). | Same anonymous-challenge check as C1, re-run after C4. | If it regresses: disable the Access application immediately (security incident, not routine rollback) and roll back the Worker version. |

### Stop conditions (Checkpoint C)

Stop without proceeding if any of the following is true:

1. The `verify` check is not green on the exact merged head.
2. Anonymous `/studio` is not challenged by Access, before or after deploy.
3. The operator identity does not pass the Access challenge.
4. `verify:remote` fails against production.
5. C6 shows any unexpected write (a Studio branch or PR the operator did
   not intentionally create).
6. The config PR's diff touches anything beyond the expected var
   placeholders.

## Checkpoint D — state-changing production canary

Scope: prove the full write path against real GitHub and real production,
using one disposable canary article, then leave production exactly as it
was before D started. Requires Checkpoint C to have passed in full.

| Step | Action | Verification | Reversal |
|---|---|---|---|
| D1 | Create a canary article with an intentionally invalid body (e.g. an unsupported Markdown construct) and Save it. This Save is also the pre-flight proof that installation-token writes work at all (the flagged risk in the runbook) — it is the first real write attempted in this checkpoint. | If Save fails closed with a GitHub 403/`github`-reason failure, STOP immediately — this is the flagged token-permission-scope risk materializing; do not attempt D2 onward, do not work around it live, file a code-fix ticket instead. Otherwise: Save succeeds (persists even though invalid) and reports structured compiler issues; the canary is **absent** from `/index.json` and the public site (never published); Publish is disabled/rejected while invalid. | Discard (D5 covers this canary's full cleanup). If the pre-flight 403 fires, there is nothing to reverse — no branch/commit was created. |
| D2 | Fix the canary content to a valid, obviously-fake article (title clearly marked "CANARY — DO NOT INDEX" or similar) and Save again. | Save succeeds; draft is now valid; still absent from `/index.json` (unpublished). | Discard. |
| D3 | Publish the canary. | Draft PR flips ready, auto-merge enabled bound to the exact head; required `verify` check passes; PR merges; Refresh shows `merged` → `pending_deployment`. | Before merge: Discard. After merge: Unpublish (D4), not a Git revert — the canary is real content on `main` until archived. |
| D4 | Wait for deployment, then Refresh until `live`. | Refresh shows `live` only once the production article HTML fingerprint and the public index entry match — not on merge or deploy success alone; record the fingerprint. | N/A — this step only observes. |
| D5 | Unpublish the canary (type the exact slug), then confirm absence. | Refresh shows `unpublish_pending` → archived; the canary is provably absent from both `/index.json` and its own route (custom HTTP 404) — not merely `status: archived` in the file. | If Unpublish itself fails: Draft replacement or a manual archive commit through the normal protected-`main` path; there is no "undo" for a stuck Unpublish other than completing it. |
| D6 | Clean up: delete the canary's Markdown file from `content/articles/` via a normal PR (archived files are not auto-deleted — see the runbook's "Discard draft" note: Studio never deletes canonical content, only drafts). | `content/articles/` no longer contains the canary file on `main`; `pnpm content:validate` still passes. | N/A — this is the cleanup step. |
| D7 | Confirm no orphaned Studio branch or PR remains for the canary slug. | `gh api repos/DarkoKuzmanovic/jelementi/branches` and open-PR list show nothing referencing the canary slug. | Manually close/delete anything left over. |
| D8 | Retain secret-free evidence: canary slug, PR numbers (create + cleanup), commit SHAs, fingerprint value at `live`, timestamps. Never a token, key, or JWT value. | This document (or an appended dated record) contains the above. | N/A. |

### Stop conditions (Checkpoint D)

Stop without broadening scope if:

1. D1's pre-flight write reproduces the flagged token-permission failure.
2. The invalid canary (D1) is ever visible in `/index.json` or its route
   before being fixed and explicitly Published.
3. Publish enables auto-merge for a head other than the one explicitly
   approved.
4. `live` is reported without a matching fingerprint (a probe bug would be
   a production-trust failure, not a canary inconvenience).
5. Unpublish leaves the canary reachable at its route or present in the
   index past the documented completion condition.
6. Any step requires broadening the GitHub App's permissions beyond
   Checkpoint A's locked set (Contents RW, Pull requests RW, Checks R,
   Metadata R).

## Approval asks

Separate, explicit, one at a time — approving one does not carry forward:

1. Approve Checkpoint C (C1–C7).
2. Approve Checkpoint D (D1–D8). D1 is its own built-in stop gate — its
   first action is the pre-flight write (see D1's stop condition above);
   do not treat approval of D as authorization to push past a D1 failure.

A rejection or failure at any stage leaves later stages closed, per the
M2 precedent (`checkpoint-c-2026-07-29.md` §12).

Deliberately not a third, separate "D0-only" ask: the pre-flight check and
the D1 acceptance-criterion action are the same GitHub write, so splitting
approval before/after it would ask for sign-off twice on one action.

## Checkpoint D record — 2026-08-17

All secret-free evidence for the executed canary run (D1–D8). No token,
key, or JWT value appears below.

**Canary:** slug `canary-studio-checkpoint-d`, title
"CANARY — DO NOT INDEX (delete me)".

### Outcome per stage

| Stage | Result | Evidence |
| --- | --- | --- |
| D1 | PASS (attempt 5) | Save persisted invalid draft: commit `38f1ec1` on `studio/article/canary-studio-checkpoint-d`, Draft PR #43; compile gate reported `UNSUPPORTED_NODE` "Links must use HTTPS URLs."; Publish refused while invalid; canary absent from `/index.json`. Pre-flight write initially failed 403 — the flagged token-scope risk (issue #34, fixed via PR #35) — treated as the designed stop, fixed, then retried. |
| D2 | PASS | Link fixed to https; draft compiled clean; Publish enabled. |
| D3 | PASS (attempt 4) | Final publish PR #55 merged to `main` `f8f021e` at 10:28:40Z after status set to `published` + `publishedAt: 2026-08-17` and cover moved to versioned key. Earlier attempts: PR #43 merged `fc001ce` (see deviation 1), PRs #46/#50/#52 closed unmerged (see deviation 2). |
| D4 | PASS | Studio Refresh reported **Live**: fingerprint `72d4828ad74e25d389fa2d1b29c052983d0c221112851a7ed945bf2102bb1b9b` proven on both the public article and `/index.json` at `main` `41a9bcb`; deployment `1878ad55` (11:19:50Z). Required the SELF-binding probe fix (issue #56 → PR #57). |
| D5 | PASS | Archive commit `be9f478` on PR #58, ready + auto-merge bound to that head; merged `ca726d3` at 11:28:18Z; deployment `9f25758a` (11:34:18Z); canary absent from `/index.json` and its route serves the not-available page; operator Refresh confirmed archived. |
| D6 | PASS | Canonical file removed via PR #59, merged `de30e37`; `content:validate` passes. Orphaned media asset `articles/canary-studio-checkpoint-d/cover-v1.svg` deleted from R2 (`wrangler r2 object delete`, confirmed). |
| D7 | PASS | No branch or open PR references the canary slug. Pre-existing engineering branches `t5-publish-auto-merge` and `t7-lifecycle-regression-tests` remain (unrelated to Studio; predate the checkpoint). |
| D8 | This record. | — |

### Production bugs found live and fixed during D (issue → fix PR)

1. #34 → #35 — installation tokens requested read-only scopes; writes 403'd (the flagged pre-flight risk).
2. #36 → #38 — ref mutations used GitHub's singular `/git/ref/` path, which 404s for PATCH/DELETE.
3. #39 → #40 — article list 503'd on any draft branch without a canonical article.
4. #41 → #42 — interrupted-save branches (no committed file) 503'd the article page.
5. #44 → #45 — Publish accepted `status: draft` articles (spec §Publish step 4 gate was missing).
6. #47 → #48 + #51 — verify scripts assumed the newest article renders Sources/Footnotes; blocked any minimal article (assumption duplicated across verify-web/worker/remote).
7. #53 (part 1) → #54 — default Studio cover key was unversioned and could never be satisfied by `media-cli upload`.
8. #56 → #57 — production probes self-fetched the zone and bypassed the Worker; Live was unreachable (fixed via SELF service binding; ADR-0007).

### Deviations from the designed procedure

1. **`update-branch` on Studio PR #43** (operator-run `gh api`): the spec forbids Studio's flows from using in-place update-branch; the designed recovery was Draft replacement. Content was identical and verify re-ran, but this bypassed the design. Finding: GitHub auto-merge is **not** SHA-bound after enablement — it merged the post-update head; ADR-0004's head binding holds only at enable time.
2. **Manual `gh pr close` + branch delete for PRs #46, #50, #52**: a publish whose required check fails (`check_failed`) has no in-Studio recovery (Save, Discard, and re-Publish are all refused) — filed as issue #49.
3. **Mid-checkpoint CLI media upload**: the canary cover was uploaded with `media-cli upload` because Studio neither provisions nor verifies media existence before Publish — the remaining gap is issue #53 part 2.

### Open issues carried out of Checkpoint D

- **#49** — design gap: no in-Studio recovery from `check_failed` (spec amendment needed, e.g. Discard for a ready-but-unmerged Studio PR).
- **#53 (part 2)** — Publish should probe cover/media existence (bounded HEAD) before arming auto-merge, so a missing asset fails before the no-recovery state.

Checkpoint D is **complete**; the M3 Studio is live, operator-only, and its
full publish/unpublish lifecycle is proven against real production.
