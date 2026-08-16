# Studio Operations Runbook

Governs the M3 Studio — the Access-protected publishing workspace at `/studio*`.
Companion to `docs/runbooks/cloudflare-m2-operations.md` (reader/production
infrastructure) and `docs/runbooks/studio-checkpoints-c-d.md` (the two
remaining approval-gated provisioning stages). This document is secret-free:
it never records a credential, token, or private-key value.

Vocabulary follows `CONTEXT.md` — Studio draft, Committed draft, Draft PR,
Studio branch, Publish, Unpublish, Discard draft, Live, Draft replacement,
Concurrency evidence, Check, Deployment, Probe, Evidence, Fingerprint. Use
those terms, not synonyms, in any change record derived from this runbook.

## Scope and source of truth

GitHub is the sole canonical source of truth. Studio holds no shadow state:
every operation re-reads `main`, Studio branches, pull requests, and checks
from GitHub before acting, and every status is reconstructed fresh on
Refresh — no background poller, no in-memory timer. A process restart loses
nothing observable.

Studio never pushes directly to `main`, never bypasses branch protection,
and never treats a successful GitHub write as a deployment or a merge as
Live. The required GitHub `verify` check remains the only merge gate.

## Runtime configuration

Non-secret identifiers are `vars` in `wrangler.jsonc` / `wrangler.m2.jsonc`;
the GitHub App private key is the sole `secrets.required` entry. Missing or
malformed configuration fails closed (`StudioConfigError`, naming only the
missing binding identifiers, never values). Local overrides go in
`.dev.vars` (gitignored) — see `.env.example` for the full annotated list.

| Binding | Kind | Set by |
|---|---|---|
| `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ALLOWED_OPERATOR_EMAIL` | var | Checkpoint B |
| `GITHUB_APP_ID`, `GITHUB_APP_CLIENT_ID`, `GITHUB_INSTALLATION_ID` | var | Checkpoint A |
| `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`, `PRODUCTION_ORIGIN`, `PUBLIC_MEDIA_BASE_URL` | var | already set (M2) |
| `GITHUB_APP_PRIVATE_KEY` | secret | Checkpoint A |

## Authentication and CSRF boundary

Every Studio server load, form action, and endpoint independently calls the
request guard in `apps/web/src/lib/server/studio/request-guard.server.ts` —
page-level Cloudflare Access protection alone is never trusted:

- **Read boundary** (`authorizeStudioRequest`): verifies the
  `Cf-Access-Jwt-Assertion` header against the team-domain JWKS
  (`<teamDomain>/cdn-cgi/access/certs`), exact issuer, exact application
  audience, expiry/not-before, and a non-empty `email` claim compared with
  `ALLOWED_OPERATOR_EMAIL` after one normalization rule (trim, lowercase).
- **Mutation boundary** (`authorizeStudioMutation`): checks a same-origin
  `Origin` header against `PRODUCTION_ORIGIN` *before* Access verification,
  so a rejected cross-site JSON request never reaches JWT verification or a
  GitHub call.

Failure reasons are stable, bounded codes (`missing-config`,
`missing-assertion`, `invalid-token`, `missing-email`, `wrong-email`,
`missing-origin`, `invalid-origin`, `cross-origin`) — never token contents,
upstream bodies, or stack traces.

## Studio operations

Each entry: what it does, its preconditions, and how to reverse it. All
operations are idempotent under retry — a partial failure is recovered by
re-running the same action, not by manual GitHub surgery, except where
noted.

### Create

Starts a new article with form defaults and no public artifact. No GitHub
write happens until the first Save.

- **Rollback:** none needed — nothing was written.

### Resume / Edit

Opens an existing canonical article. Resumes the sole active Studio draft
(`studio/article/<slug>` branch + its one Draft PR) when one exists;
otherwise starts from the current `main` file. Never forks a second
concurrent draft for the same article.

- **Rollback:** none needed — read-only.

### Save

Form action `save`. Commits exactly one article file to the deterministic
`studio/article/<slug>` branch, created from the observed `main` SHA if it
doesn't exist yet. Concurrency evidence (main SHA, draft head SHA, expected
blob SHA) is compared with a fresh GitHub read first; a mismatch is a
`conflict`, never a silent overwrite. Save succeeds even when the draft is
invalid — invalid saves surface structured, source-located compiler issues
but are never mergeable.

- **Rollback:** run **Discard** to close the Draft PR and delete the Studio
  branch; `main` is untouched by Save, so no `main` reversal is ever needed.

### Preview

Form action `preview`. Server-compiles the current unsaved editor input
with `@jelementi/content-compiler` and the reader renderer. No GitHub read
or write.

- **Rollback:** none needed — no side effect.

### Publish

Form action `publish` (`publish.server.ts`). Explicit, head-bound approval
(ADR-0004):

1. re-reads the branch head and rejects if it moved since the operator
   loaded the page (`publish_conflict`);
2. re-parses and recompiles the exact committed blob at that head
   (`publish_rejected` on any compiler issue — never publishes unsaved
   editor text);
3. flips the sole open Draft PR from draft to ready;
4. enables auto-merge bound to the exact approved head SHA.

After auto-merge is enabled, Studio performs no further branch mutation. A
content change requires a new Save producing a new head, which needs a new
Publish — never a silent re-approval of a moved head. A failed required
`verify` check leaves the PR open with the failure visible; auto-merge
stays enabled so fixing the draft and letting the check re-run completes
the merge without a second Publish.

- **Rollback (before merge):** run **Discard** to close the PR and delete
  the branch — `main` is never touched.
- **Rollback (after merge):** create a normal Git revert PR through the
  same protected-`main` path; Studio has no "un-merge" operation. A merge
  is `merged`/`pending_deployment`, never `live`, until the production
  probe proves the fingerprint — see **Live** below.

### Unpublish

Form action `unpublish` (`unpublish.server.ts`). Requires the operator to
type the exact slug. Archives the *published* canonical article through the
same one-draft topology as Publish: a Studio branch carries a commit that
changes **only** `status` to `archived` — every other byte of the canonical
source is preserved byte-for-byte. Blocked (`unpublish_blocked`,
`differing-draft`) if an active content draft differs from `main`, so an
in-progress edit is never silently overwritten by an archive commit; a
draft identical to `main` is archived in place, and a draft that already
*is* the archive change is reused (idempotent retry, no duplicate
branch/PR). Complete only when both the public index and the article route
prove absence — a merged archive commit alone is not "unpublished".

- **Rollback (before merge):** run **Discard**.
- **Rollback (after merge, still want it back):** re-`Save` with
  `status: published` and Publish again through the normal flow — there is
  no dedicated "restore" operation, by design (ADR-0001/CONTEXT.md: Publish
  is the only path to a status change reaching `main`).

### Discard draft

Form action `discard` (`discard.server.ts`). Closes only the article's sole
active Draft PR and deletes only its Studio branch, after confirmation.
`main` is never touched. Re-reads topology fresh on every call, so a retry
after a partial failure (PR closed, branch deletion failed) resumes from
exactly where it left off — never a duplicate close or a second PR.

- **Rollback:** none — Discard is itself the reversal for Save/Publish/
  Unpublish. The next edit starts a fresh branch and PR from current
  `main`.

### Draft replacement (recovery)

Form action `replace` (`draft-replacement.server.ts`). The explicit
recovery path when unrelated `main` movement makes a Studio draft stale.
Allowed **only** when the loaded draft head still matches, the target
article's blob on `main` is unchanged since the draft was loaded, and the
draft changes exactly that one article. Preserves the submitted candidate
(metadata + body) through success, conflict, or partial failure. Composes:
close and *confirm* the exact old PR unmerged → delete only its expected
branch head → recreate the deterministic branch from fresh `main` →
recommit the candidate → open a new Draft PR. Never calls GitHub's
in-place `update-branch`; the replacement head requires full revalidation
and a fresh Publish — a replacement is never itself an approval.

- **Rollback:** run **Discard** on the new branch/PR the replacement
  created; the old PR was already closed unmerged by the replacement
  itself and needs no further action.

### Refresh (status)

Re-reads GitHub refs, PRs, and checks, then re-runs the production probes.
No background polling exists; "is it live yet" is answered only by an
explicit Refresh. Safe to call at any time — read-only.

- **Rollback:** none needed.

### Live (production probe)

Not an operator action but the production-axis proof every other operation
is measured against. A bounded, cache-busted HTTPS fetch (`probe.server.ts`,
≤30s total, backoff retry) proves the public article HTML carries the
expected content fingerprint and the public `/index.json` entry matches the
draft's metadata. Absence or timeout never yields `live` — it yields
`unknown` or `failed`. A merge, a green check, or a successful Workers
Builds deployment are diagnostic evidence only and are never substituted
for a passing probe.

## Two-axis lifecycle

Every article carries two independent facts, never merged into one line
(`apps/web/src/lib/studio/contracts.ts: STUDIO_STATUS_KINDS`):

- **Change axis:** `draft_invalid` → `draft_valid` → `ready` → `checking` →
  (`check_failed` ⟲ `checking`) → `merged`.
- **Production axis:** absent → `pending_deployment` → `live` (or
  `unpublish_pending` → absent).
- Cross-cutting: `conflict` (concurrency mismatch), `failed` (named phase +
  reason), `unknown` (probe timeout/absence).

## Local preflight

Before requesting any remote checkpoint approval, confirm a green canonical
gate:

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm test
pnpm content:validate
PUBLIC_MEDIA_BASE_URL=https://media.jelementi.quz.ma/ pnpm verify:deploy
```

`verify:deploy` is read-only with respect to GitHub and Cloudflare: it
builds, type-checks, tests, runs a Wrangler dry-run deploy, and verifies
already-published media over HTTPS. It performs no Studio GitHub write and
no Cloudflare mutation.

## Known pre-flight risk — installation token permission scope

`github-adapter.auth.ts` requests every installation access token with a
fixed, code-level default:

```ts
const DEFAULT_INSTALLATION_PERMISSIONS = {
  checks: 'read', contents: 'read', metadata: 'read', pull_requests: 'read',
};
```

`github-adapter.production.ts` never overrides this — every operation,
including the five that write (`createBranch`, `commitFile`,
`createPullRequest`, `updatePullRequest`, `enableAutoMerge`,
`closePullRequest`, `deleteBranch`), reuses the single cached token minted
with this **read-only** request. Per GitHub's installation-token API, a
token's effective permissions are the intersection of the App's granted
installation permissions *and* the `permissions` object requested at
exchange time — requesting `contents: read` yields a read-only token even
when the App installation itself has `contents: write`. Every existing
adapter test runs against a fake or a mocked `fetch`, so none of them
exercise this against GitHub's real authorization enforcement.

**Practical effect:** as written, every Studio write against real GitHub —
Save, Publish, Unpublish, Discard, Draft replacement — is expected to fail
closed with a `403`/`github`-reason failure the first time it is attempted
in Checkpoint D, independent of the GitHub App's own installation
permissions (Checkpoint A). This is **not** fixed by this ticket (T8 is
runbook + provisioning, not a code change) and is flagged here as a
pre-flight check for whoever executes Checkpoint D: confirm write
operations succeed against a disposable canary *before* trusting the
checkpoint's "valid canary published through checks" criterion, and file a
separate ready-for-agent ticket to pass explicit `write` permissions on the
token requests those five operations need if this reproduces.

## Incident rollback

For a stuck or wrong Studio state:

- **Failed check on an open Draft PR:** fix the draft's content with a new
  Save (creates a new head); Publish again — auto-merge is already enabled
  and re-triggers on the next green check without a second approval prompt
  as long as the head is unchanged. If the head *did* change, Publish must
  run again explicitly (a changed blob always requires a fresh Publish).
- **Draft stuck stale after unrelated `main` movement:** use **Draft
  replacement** if eligible; otherwise **Discard** and start a fresh edit
  from current `main`.
- **A merge that never reaches `live`:** run **Refresh**. If the probe
  stays `unknown`/`failed` past the expected Workers Builds rollout window,
  treat it as a production reader incident — the recorded incident
  procedure in `docs/runbooks/cloudflare-m2-operations.md` (identify the
  known-good Worker version, Cloudflare rollback, verify, then a normal
  Git revert PR) applies; Studio has no override for a broken deployment.
- **Suspected leaked GitHub App credential:** rotate the App private key
  (GitHub App settings → generate new key, delete the old one), update the
  `GITHUB_APP_PRIVATE_KEY` Worker secret, and confirm no request succeeds
  with the old key. Never recorded here — see Checkpoint A.
- **Suspected Access misconfiguration (anonymous read succeeds):** this is
  a security incident, not a routine rollback — disable the Studio Access
  application in the Cloudflare dashboard immediately, preserve evidence,
  and re-run Checkpoint B's verification in full before re-enabling.

A Studio operation never mutates `main` directly and never bypasses the
`verify` check, so the reversal for almost every failure mode is **Discard**
plus a fresh edit — not a manual GitHub API call.
