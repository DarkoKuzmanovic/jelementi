# M3 — Access-Protected Publishing Studio Design

**Status:** Approved design; implementation not started<br>
**Date:** 2026-08-13<br>
**Owner:** Darko<br>
**Source of truth:** `handoff.md`, the released M2 production contract, and the M3 decisions approved section by section in the 2026-08-13 `/crew M3` design session

## 1. Outcome

M3 adds a narrow, desktop-first publishing workspace for one trusted operator:

```text
Darko's browser
  → Cloudflare Access
  → server-side Access JWT and email verification
  → SvelteKit Studio service
  → short-lived GitHub App installation token
  → one article branch + one draft pull request
  → required GitHub `verify` check
  → auto-merge to main
  → Workers Builds production deploy
  → expected-content production probe
  → Live
```

GitHub remains the sole canonical record for article bodies, draft history, review state, and publishing transitions. M3 does not add a Studio database or use GitHub Actions as a publishing broker.

M3 is complete when:

1. only Darko can access `/studio` or any Studio read/write endpoint;
2. Darko can create, resume, edit, save, preview, publish, discard, and unpublish one article;
3. invalid work can be saved without entering the public index, but cannot be published;
4. concurrent changes are detected and never silently overwritten;
5. a successful commit or merge is never reported as live;
6. production becomes `Live` only after the public route serves the expected article version;
7. failures identify the failed phase and preserve recoverable GitHub state;
8. the existing static reader, generated-data boundary, hydration boundary, and reserved `R2_MEDIA` contract remain intact;
9. the GitHub App, Access policy, secrets, and production canary flow are provisioned only through separately approved operator checkpoints.

## 2. Scope

### In scope

- dynamic, non-prerendered `/studio` pages inside the existing SvelteKit application;
- an article list with GitHub-derived lifecycle status;
- create and edit screens with a metadata form and Markdown body editor;
- server-compiled preview of the current unsaved input using the existing content compiler and reader renderer;
- a link to the Access-protected branch preview after a draft is saved and deployed;
- server-side Cloudflare Access JWT verification plus an exact allowed-email check;
- a repository-scoped GitHub App with short-lived installation access tokens;
- one deterministic Studio branch and one draft pull request per article;
- Save draft, Publish, Discard draft, Unpublish, and status refresh operations;
- required-check and auto-merge orchestration without bypassing the protected `main` branch;
- optimistic concurrency checks against `main` and the active draft head;
- production verification that distinguishes committed, checking, merged, deploying, failed/unknown, and live states;
- tests, runbook changes, and explicit GitHub/Cloudflare/production checkpoints.

### Out of scope

- article bodies or publishing state in D1;
- GitHub Actions as a write broker;
- browser-held GitHub credentials;
- R2 upload or media management;
- autosave, browser-local draft recovery, collaboration, or multiple simultaneous authors;
- batch or multi-article pull requests;
- automatic conflict merging or last-write-wins behavior;
- raw frontmatter editing, WYSIWYG editing, or a generic CMS;
- mobile preview modes;
- push notifications, Android work, analytics, or final visual redesign.

## 3. Locked decisions

- GitHub is the sole Studio publishing source of truth. Studio derives current state from repository refs, commits, pull requests, checks, and merged `main`.
- The Studio server talks directly to GitHub through a repository-scoped GitHub App. It creates a fresh, short-lived installation token server-side and never exposes App credentials or installation tokens to the browser.
- One article has at most one active Studio branch and one draft pull request.
- One pull request contains exactly one article. Batch publishing is deferred until a recurring atomic-series need exists.
- `Save draft` may commit invalid Markdown. Studio shows structured compiler issues prominently and keeps `Publish` disabled.
- `Publish` is an explicit content approval. It revalidates the exact committed draft server-side, marks the pull request ready for review, and enables auto-merge for the expected head SHA. The required GitHub `verify` check remains the merge gate.
- Studio never pushes directly to `main`, bypasses branch protection, or treats a successful GitHub write as a deployment.
- Preview has two layers: immediate server compilation of the current editor input, and an Access-protected branch-preview link after Save.
- The editor exposes known metadata as form fields and only the Markdown body as source text. M3 does not provide a raw YAML/frontmatter mode.
- Every Studio endpoint validates the Access JWT signature, issuer, audience, expiry, and exact configured Darko email. Trusting an identity header alone is forbidden.
- A newer `main` article version or unexpected active draft head blocks Save and Publish. Studio shows a comparison and offers recovery; it never automatically merges or overwrites.
- `Live` requires the deployed public article HTML and published index to prove the expected article version. GitHub merge and Cloudflare build success are intermediate evidence only.
- `Unpublish` changes article status to `archived` through the same one-draft topology. If a content draft already differs from `main`, Unpublish is blocked until that draft is published or discarded. The operator must type the exact slug before auto-merge is enabled.
- `Discard draft` is available in Studio. After confirmation it closes only that article's draft pull request and deletes only its Studio branch; `main` is unchanged.
- M3 includes GitHub App and Access provisioning plus a production canary as explicit operator checkpoints. Design approval does not authorize those remote mutations.
- The M2 public-reader and deployment invariants remain locked: `schemaVersion: 1`; all seven block discriminants and inline contracts; static validated generated data; reader routes non-hydrated except `/search`; production `preview_urls: true`, `workers_dev: false`, route `jelementi.quz.ma`; `R2_MEDIA` remains unused by M3 application code.

## 4. Alternatives considered

### D1 publishing state machine

A D1 operation row could model every transition and retry. This would improve explicit operation history, but it creates a second state source that must reconcile with GitHub and Cloudflare after partial failures. M3 has one operator and GitHub already provides durable refs, commits, pull requests, checks, and audit history. The extra consistency protocol is not justified.

### GitHub Actions publishing broker

Studio could dispatch a workflow rather than hold a GitHub App credential. This narrows direct Worker write authority, but makes Save slow, complicates invalid draft commits and conflict comparison, and still requires a separate GitHub read channel. It also moves interactive application behavior into CI. M3 therefore uses a narrowly permissioned GitHub App directly.

## 5. Ownership boundaries

### `@jelementi/article-model`

No M3 ownership change. It remains the framework-neutral public model and keeps `schemaVersion: 1`, article statuses `draft | published | archived`, all seven block discriminants, inline nodes, marks, footnote rules, and index schemas.

### `@jelementi/content-compiler`

No filesystem, environment, GitHub, Cloudflare, or SvelteKit responsibility is added. Studio calls the existing pure compiler with explicit Markdown, source path, and media base URL for validation and immediate preview.

M3 may add a focused public serialization helper only if implementation proves that deterministic frontmatter/body reconstruction cannot reuse an existing pure compiler boundary. Any such helper remains pure and compiler-owned; Studio does not duplicate the Markdown contract.

### SvelteKit web application

The web app owns Studio pages, authenticated server actions/endpoints, the editor experience, preview rendering, and presentation of lifecycle evidence. Studio server modules may import `@jelementi/content-compiler`; public reader modules must continue to consume only generated data validated by `@jelementi/article-model`.

Studio client code receives only bounded display data and operation results. GitHub App keys, installation tokens, Access configuration secrets, and raw upstream error bodies remain server-only.

### GitHub

GitHub owns canonical content, draft branches, commits, pull requests, required checks, auto-merge, merge history, and reconstructable publish intent. GitHub is queried again after ambiguous or partial failures before any retry; M3 assumes no hidden process-local publishing state.

### Cloudflare

Cloudflare Access owns the outer Studio policy and authenticated session. The application independently validates the Access assertion. Workers Builds owns branch previews and production deployment. Production HTTP evidence owns the final `Live` claim.

D1 and R2 own no M3 Studio state or article-body writes.

## 6. Article identity and GitHub topology

The canonical article path remains:

```text
content/articles/<slug>.md
```

Branch and pull-request identity must be deterministic and reversible from the slug. The implementation plan locks the exact naming function and tests normalization, length, and collision behavior before GitHub writes are added. A representative shape is:

```text
studio/article/<slug>
```

The exact branch name is not a user-editable value.

For each slug, Studio recognizes at most:

- the article blob on `main`;
- one active Studio branch;
- one open pull request from that branch to `main`.

Multiple matching branches or pull requests are an invariant violation. Studio fails closed, links to the conflicting GitHub resources, and requires operator cleanup rather than guessing which draft is canonical.

A draft carries concurrency evidence:

- the `main` commit SHA from which the draft was opened or last explicitly reconciled;
- the active Studio branch head SHA last loaded by the editor;
- the expected article blob SHA when one exists.

Save and Publish compare supplied evidence with fresh GitHub reads. A mismatch returns a structured conflict, not a blind retry.

## 7. Lifecycle

### Open or create

Studio lists canonical articles from `main` and discovers active Studio pull requests. Opening an article resumes its sole active draft when present; otherwise the editor starts from the current `main` file. A new article begins with form defaults and no public artifact.

The editor receives bounded content plus base/head identity. It does not receive a GitHub token.

### Immediate preview

The browser submits the current metadata and body to an authenticated server preview endpoint. The server deterministically assembles the candidate Markdown and invokes `compileArticle` with explicit options.

On success, the endpoint returns a validated `ArticleDocument` suitable for the existing renderer. On expected author failure, it returns structured `ContentCompileIssue` values with source locations and no stack trace. Preview writes nothing to GitHub or generated output.

### Save draft

Save performs this sequence:

1. authenticate and authorize the request;
2. validate request shape and slug/path containment;
3. fetch current `main`, branch, pull-request, and article identities;
4. reject stale or ambiguous state;
5. deterministically serialize metadata plus Markdown body;
6. compile for diagnostics, but do not require success;
7. create the article branch from the observed `main` SHA if absent;
8. commit exactly the article file to that branch using an expected-head precondition;
9. create one draft pull request if absent, otherwise reuse it;
10. re-read GitHub and return canonical branch, commit, pull-request, and validation state.

An invalid draft may make the pull request's `verify` check red. This is accepted draft behavior. Draft and archived articles still produce no public generated JSON, index entry, route, or prerender entry.

Every retry first discovers what already succeeded. A branch, commit, or pull request created before a timeout must be reused rather than duplicated.

### Publish

Publish operates only on a saved commit and never silently includes unsaved editor text:

1. authenticate and refresh GitHub state;
2. verify base/head evidence and the one-article diff invariant;
3. compile the exact Markdown blob at the current Studio branch head on the server;
4. require a valid article with `status: published` and the existing published metadata invariants;
5. mark the draft pull request ready for review;
6. enable GitHub auto-merge for the expected head SHA using the squash merge method;
7. return a checking/ready status while the required `verify` check runs.

The GitHub App receives no branch-protection bypass. A failing required check yields `check_failed`, leaves the pull request open, and exposes the failed check. The repository currently requires strict up-to-date `verify` checks. If unrelated content reaches `main` first, Studio may update the draft branch only when the target article blob on `main` is unchanged, the draft head still matches, and GitHub reports a clean update. A changed target article or merge conflict yields `conflict` and requires operator resolution.

### Deploy and verify

After merge, Studio reports `pending_deployment`. Cloudflare build information may be shown as diagnostic evidence, but it is not required or trusted for the final state because Workers Builds does not provide the content proof M3 needs.

M3 locks one production fingerprint contract. During content generation, each published article is serialized as UTF-8 JSON with recursively lexicographically sorted object keys, array order preserved, and no insignificant whitespace. Its lowercase 64-character SHA-256 hex digest is the content fingerprint. The prerendered public article HTML exposes it exactly as `<meta name="jelementi-content-version" content="<digest>">`. This public, non-secret fingerprint does not change `ArticleDocument` or index schema version. Studio computes the same fingerprint from the exact draft document before Publish.

Status refresh is asynchronous and reconstructable: it lists pull requests for the deterministic article branch, including closed and merged results, then selects the unique newest pull request whose recorded head SHA or resulting article blob matches the current operation. Ambiguous matching history yields `conflict`; missing or unavailable evidence yields `unknown`. It then performs bounded, cache-busted production probes. No in-memory timer or background operation is required for correctness. The operator may revisit or refresh Studio after a later deployment.

`Live` requires all of:

- the pull request reports that the expected Studio head was squash-merged and identifies the resulting `main` commit;
- the public article URL succeeds;
- the returned article HTML carries the expected `jelementi-content-version` fingerprint;
- the production published index entry for the slug matches the draft document's title, excerpt, `publishedAt`, `updatedAt`, category, tags, author, cover, and reading time.

Timeout, unavailable evidence, or fingerprint mismatch yields `unknown` or `failed`, never `live`.

### Unpublish

Unpublish requires the operator to type the exact slug. If the article already has a draft whose blob differs from `main`, Studio blocks Unpublish until that work is published or discarded; it never overwrites a content draft. Otherwise Studio creates or reuses the same deterministic one-article branch and pull request, changes only `status` to `archived`, validates the exact commit, and follows the same ready/check/auto-merge flow.

After merge, removal is complete only when production verification proves both:

- the article is absent from the public index;
- the public article route returns the existing custom HTTP 404 behavior rather than the published article.

The canonical archived Markdown remains on `main`, so republishing is a future normal pull request rather than data recovery.

### Discard draft

Discard requires explicit confirmation and fresh GitHub discovery. It closes the active draft pull request and deletes only the expected Studio branch after verifying the branch still points to the expected head. If either resource changed, deletion stops and reports a conflict. It never changes `main` or deletes canonical content.

## 8. Studio interface

### Routes

The minimum page surface is:

- `/studio` — article list, active draft discovery, and lifecycle summary;
- `/studio/articles/new` — new article editor;
- `/studio/articles/[slug]` — existing or resumed article editor.

Studio routes are dynamic and never prerendered. Existing public reader routes retain their current prerender and CSR settings.

Implementation may use colocated SvelteKit server actions or dedicated `/studio/api/...` handlers. The trust rule is invariant: every server load, action, and endpoint that reads Studio state or performs a write independently calls the same authorization boundary. Page-level Access protection alone is insufficient.

### Article list

Each row shows:

- article title and slug;
- canonical status on `main`;
- active draft presence;
- pull-request/check/deployment phase;
- last known evidence timestamp;
- links to the pull request, branch preview, build evidence, and public article when applicable.

Statuses are derived on request and may be refreshed. M3 does not persist a shadow status table.

### Editor

The metadata form covers every existing frontmatter field:

- title;
- slug;
- excerpt;
- updated date;
- status;
- category;
- tags;
- author;
- cover media key and alt text;
- optional audio metadata;
- public references;
- `publishedAt` when required by published status.

The Markdown editor contains the article body only. Reading time remains compiler-generated and is never editable.

For an established article, changing the slug would change filename and public identity. M3 therefore treats slug as immutable after the first saved draft unless a separately designed rename flow is approved. New articles may edit the slug until first Save.

### Preview and evidence

The primary preview renders current unsaved input through the same exhaustive reader component tree. It is fast and does not wait for GitHub or Cloudflare.

After Save, the interface also provides the Access-protected branch-preview URL when available. Instant preview and deployed branch preview are labeled separately; neither is production.

GitHub checks, merge, Cloudflare build, and production probe are separate phases. The UI never compresses them into a generic success indicator.

### Destructive actions

- Publish requires an explicit action and a valid saved commit.
- Unpublish requires typing the exact slug.
- Discard requires confirmation and shows the pull request and branch that will be closed/deleted.
- No destructive action is triggered by a GET request.
- Every state-changing request requires POST, a same-origin `Origin` header matching the configured production origin, and SvelteKit's CSRF protection. Missing, cross-origin, or malformed origins are rejected before authentication side effects or GitHub writes.

## 9. Authentication and authorization

Cloudflare Access is the outer enforcement layer for `/studio*` and every Studio endpoint. The production reader remains public and globally `noindex`.

The server reads `Cf-Access-Jwt-Assertion` and validates the complete token using the Access application's JWKS. Validation requires:

- signature verification against the configured team-domain JWKS;
- exact issuer;
- exact application audience;
- normal expiry/not-before validation;
- a non-empty email claim;
- constant-time comparison with the configured allowed operator email after one documented normalization rule.

Missing Access configuration, a missing token, JWKS failure, bad claims, or wrong email fails closed. Authentication errors do not echo token contents, upstream bodies, keys, or internal stack traces.

The Access team domain, application audience, allowed email, GitHub App ID, installation ID, repository owner/name, production origin, and media base URL are explicit server configuration. Private keys and credentials are Cloudflare secrets. Non-secret identifiers may be Wrangler vars when appropriate. Generated Wrangler types, not handwritten binding types, describe runtime configuration.

The same authorization helper protects reads and writes to prevent metadata or draft-content disclosure to a wrong-but-Access-authenticated identity.

Cloudflare's current Access guidance requires validating the application token rather than trusting the header alone. The implementation must retrieve and follow current documentation again when coding because API/library details may change.

## 10. GitHub App boundary

The GitHub App is installed only on `DarkoKuzmanovic/jelementi`. At design time, the live repository has auto-merge disabled, allows merge/squash/rebase, and protects `main` with pull requests plus a strict up-to-date required `verify` check and no bypass actors. M3 uses squash merge so one article PR becomes one resulting `main` commit while GitHub retains the PR's head and merge identities. Checkpoint A must explicitly approve enabling repository auto-merge and must abort if that ruleset has drifted. The implementation runbook derives final App permissions from the exact endpoints used and records them before creation. Expected categories are:

- repository contents: write, for refs and article commits;
- pull requests: write, for draft PR lifecycle and readiness;
- metadata: read;
- checks/status/deployment evidence: read as required by the chosen APIs.

No organization-wide installation, administration permission, secrets permission, Actions-workflow write, issue write, or branch-protection bypass is accepted without a new explicit security decision. The approved GraphQL auto-merge operation uses `expectedHeadOid`; its final App permission and the ready-for-review permission must be verified against current GitHub documentation during implementation.

For each operation, the server:

1. signs a short-lived App JWT from the private key;
2. exchanges it for a repository-scoped installation token using GitHub's current short-lived token contract;
3. uses bounded GitHub requests with explicit API versions and response validation;
4. does not persist the installation token;
5. redacts authorization headers, JWTs, keys, and raw sensitive bodies from logs.

Private-key parsing and line-ending normalization are isolated and tested. Request-scoped credentials and mutable state never live in module-level variables.

## 11. Status model

The UI may refine labels, but it must preserve these distinct facts:

| Status | Meaning |
|---|---|
| `draft_invalid` | Saved on the Studio branch; compiler issues exist; Publish blocked. |
| `draft_valid` | Saved and valid; Publish is available. |
| `ready` | Publish approved; PR ready and auto-merge requested. |
| `checking` | Required GitHub checks are pending. |
| `check_failed` | A required check failed; PR remains open. |
| `merged` | Expected commit reached `main`; production not yet proven. |
| `pending_deployment` | Production rollout or verification is in progress. |
| `live` | Public route and index prove the expected published version. |
| `unpublish_pending` | Archive change merged or deploying; public absence not yet proven. |
| `archived` | Production index and route prove public removal. |
| `conflict` | `main`, branch head, or topology differs from the loaded expectation. |
| `failed` | A named phase failed with actionable evidence. |
| `unknown` | Evidence is unavailable or timed out; never equivalent to Live. |

These are presentation/operation states, not additions to `ArticleStatusSchema`. Canonical article status remains `draft | published | archived`.

Every returned status includes the evidence needed to explain it: relevant SHA, pull-request number and URL, check conclusion, branch-preview URL when known, deployment/build link when available, production probe timestamp, and a sanitized failure category.

## 12. Failure behavior and idempotency

### Validation failure

Return structured compiler issues. Save remains available. Publish remains blocked. Expected author errors do not log a JavaScript stack trace by default.

### Stale base or branch

Return HTTP conflict semantics with the loaded and current identities plus a bounded comparison. Preserve the user's editor text. Offer reload/copy recovery; do not auto-merge.

### Partial GitHub failure

An operation may time out after GitHub accepted a mutation. Before retrying, discover current refs, commit tree, pull request, readiness, and merge state. Deterministic naming and exact content comparison decide whether to reuse the result. Never create duplicate branches or pull requests merely because a response was lost.

### Upstream rate limit or outage

Return a retriable, sanitized failure with retry timing when supplied by GitHub. Do not substitute stale state as authoritative and do not claim success.

### Authentication or configuration failure

Fail closed before a GitHub write. Return a generic operator-facing error and structured secret-free logs.

### Check, merge, deployment, or probe failure

Name the phase, preserve GitHub evidence, and link to the relevant external surface. A successful earlier phase stays visible but never upgrades the final state.

### Logging

Use structured server logs with operation kind, slug, request correlation ID, non-secret GitHub resource identifiers, phase, and outcome. Never log article bodies by default, Access JWTs, App JWTs, installation tokens, private keys, authorization headers, or raw upstream error bodies.

## 13. Verification strategy

Implementation follows RED → GREEN at each owned boundary.

### Access tests

- missing assertion rejected;
- invalid signature rejected;
- wrong issuer rejected;
- wrong audience rejected;
- expired/not-yet-valid token rejected;
- missing or wrong email rejected;
- exact configured email accepted;
- missing configuration fails closed;
- reads and writes use the same guard.
- state-changing requests with missing, malformed, or cross-origin `Origin` headers are rejected before GitHub access;

### Serialization and preview tests

- every current frontmatter field round-trips deterministically;
- body-only editing reconstructs valid canonical Markdown;
- reading time remains compiler-owned;
- invalid input returns stable source-located issues;
- preview writes no files, refs, commits, pull requests, or generated output;
- valid preview produces an `ArticleDocument` accepted by the existing renderer;
- unsupported Markdown is never flattened or dropped.

### GitHub adapter tests

Mock at the HTTP boundary and prove:

- App JWT and installation-token exchange are server-only;
- deterministic branch/PR discovery;
- one active draft per article;
- branch creation from the observed `main` SHA;
- exact one-file commit behavior;
- save retry after branch, commit, or PR creation does not duplicate resources;
- ready-for-review and auto-merge are separate explicit steps, and auto-merge rejects a changed `expectedHeadOid`;
- protected-main bypass is absent;
- unexpected refs, multiple PRs, malformed responses, rate limits, and timeouts fail safely;
- discard verifies the expected head before branch deletion.

### Lifecycle integration tests

- invalid content can be saved but cannot publish;
- drafts and archives remain absent from public generated output;
- unsaved editor input is never published;
- a newer `main` article or draft head blocks Save and Publish;
- a failed required check stays visible and unmerged;
- an unrelated `main` change updates the branch only when the target article is unchanged and the merge is clean;
- merge yields pending, not Live;
- production 200 with the wrong fingerprint is not Live;
- matching article fingerprint plus index metadata yields Live;
- status remains reconstructable after process restart and a later production deployment;
- deployment timeout/failure is visible;
- unpublish requires exact slug confirmation and is complete only after public absence;
- unpublish is blocked rather than overwriting a differing active content draft;
- discard leaves `main` unchanged.

### Reader and deployment regression tests

- all seven block discriminants, inline nodes, marks, and footnote cross-references remain locked;
- public generated JSON and complete index are validated at the web boundary;
- public routes remain prerendered and explicitly `csr = false` where currently required;
- `/search` remains the sole normal hydrated reader route;
- the static 404 fallback retains HTTP 404 behavior;
- no GitHub client, private key, Access secret, compiler dependency, runtime filesystem API, or Studio server module enters public reader client bundles;
- `R2_MEDIA` remains unread and unwritten by M3 application code;
- global `noindex` remains present in production article HTML;
- `wrangler.jsonc` retains the M2 production route/preview contract.

### Required local gate

Run the repository contract from the root:

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm content:validate
PUBLIC_MEDIA_BASE_URL=https://media.jelementi.quz.ma/ pnpm verify:deploy
```

Tests use injected/fake GitHub, Access/JWKS, and production-probe boundaries. Ordinary automated tests never mutate GitHub or Cloudflare.

## 14. Delivery sequence

M3 is implemented in bounded slices:

1. lock deterministic article serialization, Studio request/result schemas, and the expected production fingerprint contract;
2. add Access verification and dynamic Studio route guards with failing tests first;
3. add the server-only GitHub App adapter and deterministic draft discovery;
4. implement immediate preview and the metadata/body editor;
5. implement Save draft with concurrency and idempotent recovery;
6. implement Publish, required-check/auto-merge status, deployment tracking, and Live verification;
7. implement typed-slug Unpublish and confirmed Discard draft;
8. add full lifecycle, bundle-boundary, reader-regression, and deployment tests;
9. write the operator runbook and complete fresh-context code review;
10. stop at Checkpoint A to provision the GitHub App, enable repository auto-merge, and set secrets;
11. stop at Checkpoint B to create and verify the Studio Access application before any Studio code reaches production;
12. stop at Checkpoint C to push the implementation branch, merge through protected `main`, deploy, and verify authenticated Studio read-only loading; if Access is absent or failing, no deployment is allowed;
13. stop at Checkpoint D to run the state-changing protected production canary;
14. record accepted outcomes in `DECISIONS.md` and `ROADMAP.md`.

The Crew implementation plan may split these slices further, but it must not merge remote checkpoints into ordinary code tasks.

## 15. Operator checkpoints

Approval of this design authorizes only writing and planning local repository changes. Each checkpoint requires fresh, named approval at execution time.

### Checkpoint A — GitHub App and Cloudflare secrets

Before mutation, present:

- exact App name and repository installation target;
- exact GitHub permissions justified by endpoint;
- the current `main` ruleset and the repository-level auto-merge change from disabled to enabled;
- token/key ownership and rotation path;
- Cloudflare secret names without values;
- rollback: disable repository auto-merge, uninstall the App, revoke/delete App credentials, and remove Worker secrets.

After approval:

1. create or register the App;
2. install it only on `DarkoKuzmanovic/jelementi`;
3. enable repository auto-merge without changing the `main` ruleset;
4. set server-side secrets and non-secret identifiers;
5. verify read access and a non-destructive permission probe;
6. prove credentials are absent from Git, browser bundles, logs, and responses.

### Checkpoint B — Cloudflare Access Studio policy

Before mutation, present:

- exact host/path coverage for `/studio*` and every Studio endpoint;
- exact allowed email and identity provider;
- Access application audience and team-domain configuration;
- interaction with existing public production and branch-preview policies;
- rollback: disable/delete only the Studio application/policy and remove its vars.

After approval:

1. create the Studio Access application/policy;
2. verify anonymous requests are challenged or denied;
3. verify wrong identity is denied;
4. verify Darko succeeds;
5. verify the application itself rejects missing, malformed, wrong-audience, and wrong-email assertions.

### Checkpoint C — Protected Studio deployment

Before mutation, present the implementation branch and commit, the exact push/PR/merge/deploy actions, Access evidence, smoke probes, and rollback steps.

After approval:

1. re-verify anonymous denial, wrong-identity denial, and Darko's Access success before deployment;
2. push the named implementation branch and open its pull request;
3. merge only through the protected `main` ruleset after `verify` succeeds;
4. allow Workers Builds to deploy production;
5. verify the public reader regression probes;
6. verify Darko can load Studio and perform read-only draft discovery;
7. stop before any Studio write operation.

If the Access application is absent, does not cover every Studio route/endpoint, or fails any identity probe, no Studio code is merged or deployed.

### Checkpoint D — State-changing production canary

Before mutation, present the canary slug/content, expected branch/PR, cleanup, and rollback steps.

After approval:

1. create and save an invalid canary draft; prove it is absent publicly and Publish is blocked;
2. make the canary valid and save; prove the draft remains absent publicly;
3. publish through required checks and observe checking then pending deployment;
4. prove Live only after the production fingerprint matches;
5. unpublish using typed slug confirmation;
6. prove the article is absent from the production index and route;
7. close/delete any remaining canary PR/branch through the designed cleanup path;
8. retain only secret-free evidence in the runbook.

Any anonymous Studio 200, wrong-email success, branch-protection bypass, duplicate draft topology, public draft leak, or false Live result is a stop condition.

## 16. Risks and mitigations

### Worker compromise grants repository writes

Mitigation: repository-only GitHub App installation, minimum endpoint-derived permissions, short-lived installation tokens, no browser credential, secret redaction, and no protected-main bypass.

### Access policy drift broadens Studio access

Mitigation: application-level JWT signature/issuer/audience verification plus an exact allowed-email check on every Studio read and write.

### GitHub and Studio state diverge after timeouts

Mitigation: GitHub is the sole source of truth; deterministic topology and re-read-before-retry make operations idempotent without a shadow database.

### Concurrent edits lose article content

Mitigation: expected `main`, branch-head, and blob identities; conflict response and comparison; no automatic merge or last-write-wins.

### Invalid draft breaks CI noise expectations

Mitigation: invalid commits are permitted only on article-specific draft branches, clearly labeled, never public, and never mergeable until the exact committed blob validates.

### Merge is mistaken for deployment

Mitigation: explicit merged and pending-deployment states; Live requires route and index evidence bound to the expected content fingerprint.

### Auto-merge permission becomes too broad

Mitigation: verify current GitHub API and permission requirements during implementation; stop for an explicit decision if minimum permissions cannot enable the approved flow.

### Studio dependencies leak into the static reader

Mitigation: server-only modules, bundle-boundary assertions, unchanged generated-data imports, and regression checks for hydration and `R2_MEDIA` access.

## 17. Acceptance trace

| M3 requirement | Design evidence |
|---|---|
| Studio and write/status endpoints behind Access | Dynamic `/studio*` surface, Access policy, and shared per-endpoint JWT/email guard |
| Metadata form + Markdown editor + preview + validation | Body-only editor, complete metadata form, pure compiler preview, structured issues |
| Save draft | Deterministic one-article branch/PR; invalid saves allowed |
| Publish | Exact saved blob revalidated; PR ready + auto-merge behind required `verify` |
| Deployment status | Separate check, merged, pending, failed/unknown, and Live phases |
| Unpublish | Typed slug confirmation; archived PR; production absence verification |
| GitHub canonical; no D1 article bodies | GitHub-only source of truth and no M3 state database |
| Secrets server-side | Access and GitHub credentials confined to server config/secrets |
| Commit must not claim Live | Merge yields pending; expected-content production proof owns Live |
| Invalid content blocked from publishing | Save allowed, Publish disabled until exact committed draft validates |
| Draft absent from public index | Existing compiler/generator status invariant retained and regression-tested |
| Deployment failure visible | Named failed phase, evidence links, no fallback to Live |

## 18. Rollback

### Code rollback

Before remote provisioning, M3 is a normal Git revert of Studio routes, server modules, tests, configuration declarations, and documentation. Canonical Markdown and the public reader remain unchanged.

After provisioning, revert application code through the protected pull-request path. Do not use `git restore .`, history rewriting, or direct `main` pushes.

### Remote rollback

Remote state is removed in the reverse order and only with explicit approval:

1. stop new Studio use and preserve secret-free evidence;
2. disable the Studio Access application/policy while leaving the public reader and branch-preview policy intact;
3. remove GitHub App secrets from the Worker;
4. uninstall the App from only the Jelementi repository;
5. revoke/delete App credentials or the App itself if no longer needed;
6. close Studio pull requests and delete Studio branches only after checking that their work is no longer needed.

Disabling Studio does not roll back published articles. Published content is reverted through a normal article pull request or the existing M2 production recovery procedure.

## 19. Documentation references

Implementation must re-check current product documentation before coding or provisioning. Design-time references included:

- Cloudflare Access application-token validation: `Cf-Access-Jwt-Assertion`, team-domain JWKS, issuer, and application audience validation;
- Cloudflare Workers production practices for server-only secrets, generated Wrangler types, request-scoped state, structured logging, and explicit promise handling;
- GitHub documentation for GitHub App permission selection, installation access tokens, pull requests, required checks, and auto-merge.

Product docs are authoritative over remembered API signatures or this design's representative shapes.
