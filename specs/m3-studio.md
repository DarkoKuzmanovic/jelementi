# Studio — Access-Protected Publishing Workspace

## Problem Statement

As the single operator of the Jelementi site, I have no way to create, edit, and publish articles from the browser. Publishing requires touching the repository by hand (or delegating to a tool with full repository access). There is no protected writing surface, no draft lifecycle, and no way to know whether a published article is actually the one I approved.

## Solution

A narrow, desktop-first **Studio** inside the existing SvelteKit app, protected by Cloudflare Access and per-endpoint JWT verification, that lets one operator create, resume, edit, save, preview, publish, unpublish, and discard articles — with GitHub as the sole canonical source of truth, and `Live` proven only by public content evidence, never by a successful merge or build.

## User Stories

1. As the Studio operator, I want the Studio to be reachable only through my verified Cloudflare Access identity, so that no other person can read or write article drafts.
2. As the Studio operator, I want every Studio read and write to be individually verified with a valid Access JWT (signature, issuer, audience, expiry, exact operator email), so that page-level protection alone can never leak or mutate content.
3. As the Studio operator, I want state-changing Studio actions to require a same-origin `Origin` header and be protected by SvelteKit CSRF checks, so that cross-site requests cannot trigger writes.
4. As the Studio operator, I want to see a list of all canonical articles with their production and change states, so that I know what exists, what is being edited, and what is live.
5. As the Studio operator, I want each article row to show its active draft presence, pull-request/check/deployment phase, and links to its pull request, branch preview, build evidence, and public article, so that I can trace exactly where each article is in its lifecycle.
6. As the Studio operator, I want to create a new article with form defaults and no public artifact, so that I can begin writing without any canonical effect.
7. As the Studio operator, I want to edit an existing article, resuming its sole active draft when one exists or starting from the current `main` file otherwise, so that I always continue the canonical work rather than forking it.
8. As the Studio operator, I want the editor to expose every known metadata field as form fields and only the Markdown body as source text, so that I never hand-write frontmatter and reading time stays compiler-generated.
9. As the Studio operator, I want the slug to be immutable after the first saved draft (unless a separately designed rename flow is approved), so that public identity and filename stay stable.
10. As the Studio operator, I want an immediate server-compiled preview of my current unsaved input using the existing content compiler and reader renderer, so that I can see how the article will look without touching GitHub or generated output.
11. As the Studio operator, I want to Save a draft even when it is invalid, so that I can persist work-in-progress without being blocked.
12. As the Studio operator, I want invalid saves to surface structured compiler issues with source locations, so that I can fix exactly what is wrong.
13. As the Studio operator, I want an invalid draft to never be mergeable, so that a failed validation can never reach `main` by accident.
14. As the Studio operator, I want Publish to be disabled while the draft is invalid, so that approval is impossible without a valid committed draft.
15. As the Studio operator, I want Save to commit exactly one article file to a deterministic `studio/article/<slug>` branch created from the observed `main` SHA, so that the draft topology is predictable and reversible.
16. As the Studio operator, I want at most one active Studio branch and one Draft PR per article, so that there is never ambiguity about which copy is canonical.
17. As the Studio operator, I want Save and Publish to compare my concurrency evidence (main SHA, draft head SHA, expected blob SHA) with fresh GitHub reads, so that concurrent changes are detected and never silently overwritten.
18. As the Studio operator, I want a stale base (newer `main` article or unexpected draft head) to block Save and Publish and show a comparison with recovery options, so that I never lose work to a blind retry.
19. As the Studio operator, I want recovery to re-base my Studio branch onto the newer `main` only when the target article blob is unchanged and the merge is clean, so that unrelated `main` movement does not dead-end my draft.
20. As the Studio operator, I want recovery to keep a copy of my local text when a re-base is not possible, so that I never lose unsaved content to a conflict.
21. As the Studio operator, I want Publish to revalidate the exact committed draft server-side, so that unsaved editor text can never be published.
22. As the Studio operator, I want Publish to mark the Draft PR ready for review and enable auto-merge only for the expected head SHA, so that my approval is bound to exactly the content I approved.
23. As the Studio operator, I want no Studio operation to mutate the Studio branch after Publish approval, so that a later push cannot merge unapproved content behind my back.
24. As the Studio operator, I want the required GitHub `verify` check to be the merge gate, so that Studio can never bypass branch protection.
25. As the Studio operator, I want a failed required check to leave the pull request open with the failed check visible, so that the failure is actionable and never silently swallowed.
26. As the Studio operator, I want auto-merge to remain enabled after a check failure, so that fixing the draft and letting the check re-run completes the merge without a new approval for unchanged content.
27. As the Studio operator, I want a changed committed blob to require a new Publish, so that a content change is always a fresh explicit approval.
28. As the Studio operator, I want the lifecycle to distinguish `merged` from `pending_deployment` from `live`, so that a successful merge is never reported as a successful deployment.
29. As the Studio operator, I want `Live` to require the production article HTML to carry the expected content fingerprint and the public index entry to match the draft's metadata, so that only proven content is ever called live.
30. As the Studio operator, I want production probes to be bounded, cache-busted, and never treated as Live on absence or timeout, so that verification is safe and deterministic.
31. As the Studio operator, I want a status refresh to re-read GitHub refs, PRs, and checks and re-run the production probes, so that I can check "is it live yet" without a background poller.
32. As the Studio operator, I want no background polling or in-memory timers to be required for correctness, so that the system has no hidden state and survives process restarts.
33. As the Studio operator, I want Unpublish to require typing the exact slug, so that destructive archive action is deliberate.
34. As the Studio operator, I want Unpublish to block while a differing active content draft exists, so that a draft is never overwritten by an archive operation.
35. As the Studio operator, I want Unpublish to be complete only when the public index and the article route prove absence, so that an article is never reported archived while still publicly served.
36. As the Studio operator, I want Discard draft to close only the article's Draft PR and delete only its Studio branch after confirmation, so that `main` and canonical content are untouched.
37. As the Studio operator, I want every destructive action to require an explicit confirmation (and typed slug for Unpublish), so that nothing destructive happens from a GET or an accidental click.
38. As the Studio operator, I want GitHub state to be discovered again before any retry after a partial failure, so that operations are idempotent and never create duplicate branches or pull requests.
39. As the Studio operator, I want failures to name the failed phase and preserve recoverable GitHub evidence, so that I know exactly what failed and can recover.
40. As the Studio operator, I want authentication failures to fail closed before any GitHub write and to return only sanitized, secret-free errors, so that credentials and token contents never leak.
41. As the Studio operator, I want GitHub App credentials and installation tokens to live only server-side and never reach the browser, bundles, logs, or responses, so that repository write authority stays confined to the server.
42. As the Studio operator, I want the existing public reader, generated-data boundary, hydration boundary, and reserved `R2_MEDIA` contract to remain intact, so that adding Studio never regresses the published site.
43. As the Studio operator, I want the Studio to never push directly to `main`, bypass branch protection, or treat a GitHub write as a deployment, so that the protected publishing contract is absolute.
44. As the Studio operator, I want the GitHub App to be installed only on this repository with minimum endpoint-derived permissions and short-lived installation tokens, so that a compromised Worker cannot write elsewhere.
45. As the Studio operator, I want all GitHub/Cloudflare/production provisioning to happen only through separately approved operator checkpoints, so that no remote mutation happens without explicit sign-off.

## Implementation Decisions

### Seams

- **One new seam — the GitHub adapter**: a single server-side `GitHubAdapter` behind which all Studio routes, lifecycle logic, and the editor sit. It owns GitHub interaction: App JWT signing, installation-token exchange, refs/commits/branches/PRs/checks, auto-merge, and deterministic discovery. Studio routes and lifecycle code never touch GitHub APIs directly. All GitHub behavior is tested against a fake adapter; no network, no credentials in tests.
- **Existing seams (reused, not new)**:
  - **Authentication boundary**: `access-auth.server.ts` + `config.server.ts` (M3.1) — every Studio server load, action, and endpoint independently calls this guard; page-level Access protection alone is insufficient.
  - **Contracts**: `studio/contracts.ts` (M3.1) — typed request/result schemas for metadata, concurrency evidence, lifecycle states, and preview results.
  - **Compiler**: `@jelementi/content-compiler` — pure, no I/O; used for preview and Publish revalidation of the exact committed draft.
  - **Model**: `@jelementi/article-model` — fingerprint and index schemas already used by the reader.
  - **Probe slot**: an injected HTTP fetch for production probes (cache-busted, bounded retries), injectable in tests.

### Domain model (from CONTEXT.md and ADRs)

- **Canonical article** — exists only on `main` at `content/articles/<slug>.md`. A draft branch/PR is derivative, not the article.
- **Two-axis lifecycle** — per article, two independent facts: **production** (absent / live / pending deployment / pending removal) and **change** (none / draft / ready / checking / merged). Never merged into one linear state machine; the UI may combine them but the facts stay separate.
- **Studio draft** — the working copy: the deterministic `studio/article/<slug>` branch plus its one Draft PR. Branch pattern locked by M3.1: `^studio\/article\/[a-z0-9]+(?:-[a-z0-9]+)*$`.
- **Committed draft** — the exact article blob on the Studio branch head as committed by a Save. The thing Publish validates; never unsaved editor text.
- **Draft PR** — created as a GitHub draft PR; Publish flips it ready. Terminal after a successful publish (merged, then branch deleted); the next edit starts a fresh branch and PR from the new `main`.
- **Concurrency evidence** — main SHA, draft head SHA, expected blob SHA carried on every operation, compared with fresh GitHub reads before Save or Publish.
- **Publish** — explicit, head-bound approval (ADR-0004). Revalidates the committed draft, flips the Draft PR ready, enables auto-merge for the expected head SHA. No branch mutation after approval; a content change is a new Save → new Publish.
- **Rebase (Studio)** — recovery path (ADR-0002): re-base the branch onto newer `main` only when the target article blob is unchanged and the merge is clean; otherwise block with comparison and keep a local copy. Applies only before approval; a rebased head is fully revalidated before any new Publish.
- **Live** — production-axis state requiring the public article HTML fingerprint and public index metadata to match; never merge/build success. Persists while an edit draft exists.
- **Unpublish** — typed-slug confirmation; changes status to `archived` via the same branch/PR topology; complete only when the public index and route prove absence.
- **Check** — the required GitHub `verify` check; the merge gate.
- **Deployment** — Workers Builds rollout; diagnostic evidence only, never trusted for Live.
- **Probe** — bounded, cache-busted production HTTPS fetch proving content evidence.
- **Evidence** — sanitized proof attached to a lifecycle status: SHAs, PR number/URL, check conclusion, branch-preview URL, deployment link, probe timestamp, failure category. Never secrets or raw upstream bodies.
- **Fingerprint** — lowercase SHA-256 hex digest of the published article's canonical JSON, exposed as `<meta name="jelementi-content-version">`; public, non-secret.

### Architectural decisions

- **Single GitHub App installation** shared across dev/preview/production (ADR-0003). One install on `DarkoKuzmanovic/jelementi`; credentials server-only; short-lived installation tokens; no env-separated installs.
- **GitHub is the sole source of truth.** No D1 shadow state, no GitHub Actions broker, no browser-held credentials.
- **One operator** (ADR-0001): single configured email, exact-match, enforced per endpoint.
- **Probes own Live.** Merge and build success are intermediate evidence only. Refresh re-reads GitHub AND re-runs probes; no background polling.
- **Explicit Save only.** No autosave, no browser-local draft recovery.
- **Draft PRs start as GitHub draft PRs**; Publish flips readiness; auto-merge stays enabled after check failure (fix → check re-runs → auto-merge); a changed blob needs a new Publish.
- **Failures name the phase** and preserve recoverable GitHub evidence; retry discovers before re-attempting (idempotent, no duplicates).
- **Provisioning stays checkpointed**: Checkpoint A (GitHub App + secrets), B (Access Studio policy), C (protected deployment), D (state-changing canary). The adapter is built now, fully tested against a fake; Checkpoints activate it remotely.

### API contracts (interfaces, not paths)

- **GitHubAdapter** — methods for: deterministic branch/PR discovery; branch creation from an observed `main` SHA; one-file commit with expected-head precondition; create/reuse Draft PR; flip Draft PR ready; enable auto-merge with expected head SHA; read refs/PRs/checks; close PR + delete branch (discard); re-read-before-retry discovery. Every method returns bounded, validated results; unexpected topology fails closed.
- **Lifecycle result** — the Studio lifecycle states (draft_invalid, draft_valid, ready, checking, check_failed, merged, pending_deployment, live, unpublish_pending, archived, conflict, failed, unknown) each carrying the evidence needed to explain it.
- **Probe contract** — bounded retries, cache-busted requests, total ≤30s; absence/timeout yields `unknown` or `failed`, never `live`.
- **Auth contract** — every Studio server boundary validates the Access JWT (signature, issuer, audience, expiry, exact normalized email) and rejects missing/cross-origin `Origin` before any GitHub access on state-changing requests.

## Testing Decisions

- **Test only external behavior** — Studio behavior is tested at its public seams: the lifecycle over the fake `GitHubAdapter`, the auth guard over injected JWKS, the probes over injected HTTP fetch, and the routes over SvelteKit's request layer. Never test GitHub HTTP internals, jose internals, or implementation details.
- **Modules tested** (existing prior art):
  - `access-auth.server.test.ts` — full JWT matrix (missing/invalid/wrong-issuer/wrong-audience/expired/missing-email/wrong-email/OK), fail-closed on missing config; extend with Origin/CSRF rejection tests.
  - `config.server.test.ts` — missing/malformed bindings fail closed with sanitized errors.
  - `contracts.test.ts` — decode/validation matrix for metadata, concurrency evidence, lifecycle, preview.
  - `content-compiler` tests — round-trip serialization, invalid-input source-located issues, no-I/O preview, unsupported Markdown never flattened.
  - `article-model` tests — fingerprint contract, index/metadata validation.
- **New tests**:
  - **GitHub adapter (fake)**: branch/PR discovery, one-article topology, branch creation from observed SHA, one-file commit, save retry no-duplicates, ready+auto-merge with expected head, auto-merge rejects changed head, no protected-main bypass, unexpected refs/multiple PRs/malformed responses/rate limits/timeouts fail safely, discard verifies expected head before branch deletion.
  - **Lifecycle integration (fake adapter + injected probes)**: invalid save allowed but unmergeable; drafts/archives absent from public output; unsaved text never published; stale base blocks Save/Publish; failed check stays visible and unmerged; unrelated main change updates branch only when article unchanged and merge clean; merge yields pending not Live; wrong fingerprint is not Live; matching fingerprint + index yields Live; status reconstructable after restart; unpublish typed-slug + blocked-with-differing-draft; discard leaves main unchanged; rebase recovery before approval only, fully revalidated.
  - **Probe tests**: cache-bust headers present; bounded retries; absence/timeout → unknown/failed, never live.
  - **Bundle-boundary + reader regression tests**: no GitHub client/private key/Access secret/compiler dependency/Studio server module enters public reader client bundles; `R2_MEDIA` untouched; reader routes remain prerendered, `/search` sole hydrated route, 404 fallback retains HTTP 404; production `noindex` retained; `wrangler.jsonc` retains the M2 route/preview contract.

## Out of Scope

- Autosave, browser-local draft recovery, collaboration, or multiple simultaneous authors
- Raw YAML/frontmatter editing, WYSIWYG, or a generic CMS
- Batch or multi-article pull requests; automatic conflict merging; last-write-wins
- R2 upload or media management; D1 article bodies or publishing state; GitHub Actions as a write broker
- Mobile preview modes; push notifications; analytics; final visual redesign
- Slug rename flow (deferred until separately designed)
- Remote provisioning (GitHub App, Access policy, secrets, production canary) — operator checkpoints A–D only

## Further Notes

- **Required `verify` check**: the repo's existing required check is the merge gate; Studio does not create or run it. Its exact mechanism is confirmed during implementation (facts, not a decision).
- **Cache-bust effectiveness**: probes set `no-cache` and verify cache headers against Cloudflare; a stale 200 with a wrong fingerprint yields `unknown`, never Live (fail-safe already holds).
- **Shared-App blast radius**: preview/dev code cannot mutate production `main` without the production `Origin` + JWT; environment-level safeguards, repository allowlist, and least-privilege permissions apply.
- **Checkpoint A** provisions the real GitHub App; the adapter is fully testable before it. **Checkpoint B** creates the Access Studio policy before any Studio code reaches production. **Checkpoint C** deploys Studio read-only. **Checkpoint D** runs the state-changing canary.
- The spec, CONTEXT.md, and ADRs 0001–0004 are the authoritative paper trail for M3.2–M3.4 implementation.
