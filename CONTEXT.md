# Jelementi

The Jelementi content platform. Authoring, publishing, and reader surface for a single-operator site.

## Language

**Article**:
A unit of published content with canonical Markdown at `content/articles/<slug>.md` on `main`. Has status `draft | published | archived`.
_Avoid_: Post, piece, content item

**Canonical article**:
The article as it exists on `main`. A draft branch or pull request is not the article; the article is canonical only when its blob is on `main`.

**Studio**:
The Access-protected publishing workspace. One product; three facets: the Studio routes (SvelteKit surface), the Studio server (operation layer), and the Studio Access policy (Cloudflare boundary). Not the reader, not the editor.
_Avoid_: Editor, publishing service, CMS, gateway

**Studio draft**:
The working copy of an article in Studio: the deterministic `studio/article/<slug>` branch plus its one open draft pull request. Not the `draft` article status.
_Avoid_: Draft (when meaning the branch/PR)

**Draft (status)**:
The canonical article status meaning "not yet published".
_Avoid_: Draft (when meaning the branch/PR)

**Studio operator**:
The single trusted human who can access and operate Studio. Identified by one configured email.
_Avoid_: User, author, admin, editor

**Studio lifecycle**:
Two independent axes per article, never merged into one line. **Production**: absent / live / pending deployment / pending removal. **Change**: none / draft / ready / checking / merged. The UI may combine them, but the facts stay separate.
_Avoid_: Status, state, phase, one linear state machine

**Publish**:
An explicit content approval. Revalidates the exact committed draft, marks the pull request ready, enables auto-merge for the expected head SHA. Never publishes unsaved editor text. An invalid draft can never merge; Publish is the only path to readiness. Once Publish enables auto-merge, Studio performs no further branch mutation; any content change is a new Save → new Publish.
_Avoid_: Save, deploy, release

**Committed draft**:
The exact article blob on the Studio branch head, as committed by a Save. The thing Publish validates; never unsaved editor text.
_Avoid_: Draft document, working copy, editor content

**Draft PR**:
The single open pull request from the Studio branch to `main`. After a successful publish it is terminal (merged, then branch deleted); the next edit starts a fresh branch and PR from the new `main`.
_Avoid_: Draft (when meaning the branch), pull request (generic)

**Studio branch**:
The deterministic `studio/article/<slug>` branch. One per article at a time; created from the observed `main` SHA; deleted after merge.
_Avoid_: Feature branch, work branch

**Unpublish**:
Changes article status to `archived` through the same one-draft topology. Requires typing the exact slug. Complete only when public absence is proven: the article is absent from the public index (which drives categories/listings) and the article route returns the custom HTTP 404.
_Avoid_: Delete, remove, take-down

**Discard draft**:
Closes only the article's draft pull request and deletes only its Studio branch, after confirmation. `main` is unchanged.
_Avoid_: Cancel, abandon

**Live**:
The production-axis state where the public route and index prove the expected published version. Requires content fingerprint + index metadata match; never equivalent to merge or build success. Probed through the Worker's `SELF` service binding, so it proves the current deployment's worker+assets serving path, not the edge DNS/routing layer (ADR-0007). Persists while an edit draft exists; starting an edit does not make production non-live.
_Avoid_: Deployed, done, released

**Draft replacement**:
The explicit recovery path when unrelated `main` movement makes a Studio draft stale: preserve the submitted candidate, close and confirm the exact old pull request unmerged, delete its expected branch head, then recreate the deterministic Studio branch from fresh `main`, recommit the candidate, and open a new Draft PR. Allowed only when the loaded draft head still matches, the target article blob on `main` is unchanged, and the draft changes exactly that article. The replacement head requires full validation and a fresh Publish. Never mutates an approved branch or uses GitHub's in-place `update-branch` operation.
_Avoid_: Rebase, refresh, sync, force-save

**Concurrency evidence**:
The `main` SHA, draft head SHA, and expected blob SHA a Studio operation carries, compared with fresh GitHub reads before Save or Publish.
_Avoid_: Version, lock, timestamp

**Check**:
A required GitHub check on a draft PR (the `verify` check). The merge gate; failure leaves the PR open with the failed check visible.
_Avoid_: Test, CI, build

**Deployment**:
The Workers Builds rollout after a merge. Diagnostic evidence only; never trusted for Live.
_Avoid_: Deploy (when meaning Live), release

**Probe**:
A bounded, cache-busted production HTTPS fetch used to prove content evidence (article HTML fingerprint + public index metadata).
_Avoid_: Ping, fetch, health check

**Evidence**:
The sanitized proof attached to a lifecycle status: SHAs, PR number/URL, check conclusion, branch-preview URL, deployment link, probe timestamp, failure category. Never includes secrets or raw upstream bodies.
_Avoid_: Log, metadata, proof

**Fingerprint**:
The lowercase SHA-256 hex digest of a published article's canonical JSON, exposed as `<meta name="jelementi-content-version">` on public HTML. Public, non-secret content identity.
_Avoid_: Hash, checksum, version
