# PLAN.md

## Scope decision

- **Tier:** Full
- **Risk:** critical protected
- **Delivery:** local
- **Run branch:** `crew/m2-cloudflare-beta`
- **Started-at:** 2026-07-26T21:17:21+02:00
- **Evidence:** one repository and no unresolved architecture fork, but three independently verifiable outcomes cross local Cloudflare compatibility, standing GitHub/Cloudflare permissions, Access enforcement, public R2 delivery, production promotion, and a real rollback boundary. The approved design is `docs/specs/2026-07-26-m2-cloudflare-web-beta-design.md`.
- **Protected boundaries:** M2.1 changes build/runtime and public reader deployment contracts without remote mutation; M2.2 creates a standing deployment credential, public R2 resource, and Access permission boundary; M2.3 activates a public custom domain, automatic production promotion, and rollback controls. Credential scope and preview authorization make the remote outcomes critical protected risk.
- **Allowed ceremony:** one planner dispatch for the outcome map and detailed M2.1 slice; one supervised TDD worker per coherent wave; no parallel writes across shared package/configuration surfaces; full repository verification for every outcome; M2.1 receives one deep combined review, while M2.2 and M2.3 use the critical protected two-phase gate (fresh scrutinize pass, then separate deep combined review). One judgment fix cycle per outcome.
- **Promotion triggers:** a second repository, unresolved adapter/runtime fork, Studio or API scope, destructive R2/DNS operations, secrets entering GitHub, inability to attach Access before preview enablement, a required token scope broader than approved, or media publication requiring concurrent writers.
- **Outcome dispatch ceilings:** M2.1 `5`; M2.2 `6`; M2.3 `6` delivered dispatches. Each may be raised once only with written evidence before the additional dispatch.

## Grill decisions

- Darko explicitly skipped an additional Crew grill because the approved spec already passed collaborative design, self-review, and a high-risk advisory pressure-test.
- The existing `content/articles/tristan-da-cunha.md` is the single M2 beta article.
- R2 assets may be publicly reachable before the article is merged; this beta trade-off is accepted.
- `main` requires a pull request and the successful GitHub Actions check-run context `verify` before automatic Cloudflare production deployment.
- Preview URLs are enabled only after official Cloudflare Preview URLs Access protection is attached and audited.
- Incident rollback is Cloudflare version rollback, verification, then a normal Git revert pull request.

## Conventions

- Follow `AGENTS.md`, `handoff.md`, and the approved M2 spec; the spec owns M2 architecture and checkpoint boundaries.
- Node is 24 in CI/cloud; `pnpm@11.1.3` is locked; direct dependencies are pinned exactly.
- `PUBLIC_MEDIA_BASE_URL` is explicit and non-secret: loopback `/media/` locally, `https://media.jelementi.quz.ma/` in cloud verification.
- Generated artifacts, credentials, `.dev.vars`, Wrangler local state, and newly sourced production media are not committed.
- M2.1 performs no Git remote, Cloudflare, DNS, Access, token, Worker, or R2 mutation.
- Checkpoints A, B, and C require fresh explicit user approval at execution time; design approval is not remote-write authority.
- Workers never commit. The orchestrator owns verification, PLAN updates, explicit staging, and commits.
- A Crew dispatch resolving to GLM uses a configured high-thinking lane; never lower its thinking level.
- Full repository gate for M2 outcomes: format, lint, typecheck, tests, content validation/build, Cloudflare web build, applicable Wrangler verification, and applicable web/media smoke.

## Run metrics

- **Started-at:** 2026-07-26T21:17:21+02:00
- **First-worker-at:** 2026-07-26T21:33:13+02:00
- **Time-to-first-worker:** 15m52s
- **Dispatches:** 5 delivered (1 planner, 3 worker turns, 1 reviewer)
- **Burned:** 0
- **Burned-minutes:** 0
- **Review-bundles:** 1
- **Review-dispatches:** 1
- **Worker-retries:** 0
- **Oracle:** 0
- **Completed outcomes:** 1/3
- **Child-runtime-minutes:** 60.4
- **Session compactions observed before run:** 1

## M2 — Cloudflare web beta and R2 media

**Counters:** dispatches: 4/17 delivered across outcome ceilings · burned: 0 · review-bundles: 1 · review-dispatches: 1 · fix-cycles: 0/1 for M2.1, 0/1 for M2.2, 0/1 for M2.3 · oracle: 0 · worker-retries: 0 · direct-edits: 1

**Execution order:** M2.1 → Checkpoint A → read-only Cloudflare inventory → Checkpoint B → M2.2 → Checkpoint C → M2.3.

- [x] **M2.1 — Local Cloudflare target and media/audio tooling**
- [ ] **M2.2 — R2 delivery and Access-protected branch preview**
- [ ] **M2.3 — Automatic production deployment and rollback drill**

Checkpoint A follows an accepted M2.1 and alone authorizes the GitHub repository, explicitly confirmed visibility, remote, named-branch push, and `main` ruleset. The read-only Cloudflare inventory follows A. Checkpoint B alone authorizes R2, DNS/CORS, Workers Builds/token, hidden Worker, Access attachment, and protected preview enablement. Checkpoint C follows accepted M2.2 and Darko's content/assets re-approval and alone authorizes the production branch setting, `jelementi.quz.ma`, and automatic `main` deployment.

## Completed outcome — M2.1

### Outcome

Deliver a deterministic local Cloudflare Workers target, canonical media-key and optional browser-audio behavior, guarded future R2 tooling, and a complete local deployment gate without creating or mutating any remote resource.

### Acceptance

- [x] `apps/web/package.json` uses exactly `@sveltejs/adapter-cloudflare@7.2.9` and no `@sveltejs/adapter-static`; root uses exactly `wrangler@4.114.0`; `pnpm-lock.yaml` contains no unrelated dependency drift.
- [x] Root `wrangler.jsonc` matches the approved Section 6 contract: `jelementi-web`, `.svelte-kit/cloudflare/_worker.js`, locked compatibility date and `nodejs_als`, `ASSETS`, `.svelte-kit/cloudflare`, `not_found_handling: "404-page"`, production custom-domain route, and `R2_MEDIA` declaration; M2.1 keeps `workers_dev` and `preview_urls` false.
- [x] Root scripts expose the locked local/operator roles: `dev:web`, `build:web`, `preview:web`, `deploy:web`, `verify:web`, `verify:worker`, `media:upload`, `media:verify`, and `verify:deploy`; M2.1 executes no `deploy:web`, live `media:upload`, or live `media:verify`.
- [x] `verify:deploy` runs format → lint → typecheck → content validation → tests → Cloudflare `build:web` → `verify:web` → Wrangler deploy dry-run → `verify:worker`; live `media:verify` joins this gate only after M2.2 creates and verifies R2.
- [x] GitHub CI remains independent and non-deploying on Node 24 with locked pnpm/frozen lockfile; it uses the canonical local gate and has no deployment credential or upload/deploy/promote/DNS/Access/R2 step.
- [x] Canonical Markdown media keys are `articles/<slug>/<asset>-vN.<ext>`; Tristan fixtures no longer contain a duplicate `media/` segment; local base is `http://localhost:5173/media/`, cloud base is `https://media.jelementi.quz.ma/`, and tests prove both resolutions plus existing traversal/containment rejection.
- [x] A focused Svelte component renders optional `article.audio` as native `<audio controls preload="metadata">` with an article-specific accessible label and fallback source link; no audio field renders no audio region; no autoplay, eager download, custom/native/background player, or new hydration boundary is introduced.
- [x] A synthetic document proves audio SSR/component output and no-audio omission without changing `schemaVersion: 1` or the seven block discriminants.
- [x] `media:upload -- --file <path> --key <key> --content-type <mime>` validates the locked versioned key, non-empty regular file, and explicit SVG/WebP/PNG/JPEG/MP3/M4A MIME mapping; it requires the production media origin, performs cache-busted `HEAD`, proceeds only after 404, uses argument arrays, preserves Wrangler failure detail, and post-verifies status/type/cache/non-zero length plus audio range semantics.
- [x] `media:verify` read-only collects and deduplicates published cover, every `ImageBlock.src`, and optional `audio.src`; it rejects non-HTTPS/non-`media.jelementi.quz.ma`, cross-host redirects, bad status/type/cache/length, and invalid audio `206`/range responses; failures identify URL and invariant without credentials or response bodies.
- [x] Media tests use injected fetch and process-runner boundaries with no network/Cloudflare access and cover key/MIME validation, existing objects, argument construction, upload failure, image headers, audio ranges, URL collection/deduplication, and redirect-host rejection.
- [x] `ops/cloudflare/r2-cors.json` contains only the approved production and loopback origins, `GET`/`HEAD`, `Range`, exposed response headers, no credentials, and one-hour preflight cache; M2.1 does not apply it.
- [x] `verify:web` reads Cloudflare adapter output, derives article/category expectations from generated data, and retains route coverage, representative content, global `noindex`, non-search no-hydration, `/search` hydration, and the explicit fallback hydration exception.
- [x] `verify:worker` launches pinned Wrangler locally, polls HTTP readiness without fixed sleeps, verifies home/article/category/search/about and direct `/search?query=tristan`, Sources/Footnotes/noindex/hydration/static assets, and always terminates the child on success, failure, or timeout.
- [x] The recovered M1 404 obligation is proven under `adapter-cloudflare({ fallback: 'spa' })` plus Static Assets `404-page`: an unknown path returns HTTP 404, English Jelementi error copy, global `noindex`, the expected fallback client bootstrap, and no redirect to `/`.
- [x] A source/search guard proves M2 application code never reads or writes `R2_MEDIA`; the name appears only in configuration, declarations, documentation, and test evidence.
- [x] A draft operational runbook covers A/B/C stop points, preflight, single-author immutable upload without overwrite/delete/dashboard upload, Workers Builds token review, Access-before-preview ordering, production rollback then normal Git revert, and before-state plus one-step reversal recording before each future remote mutation.
- [x] No scope leakage enters Studio, GitHub API publishing, push, Android/native audio, D1/KV/Queues/Durable Objects, public indexing, R2 overwrite/delete/backup automation, or destructive teardown.
- [x] `README.md` and `AGENTS.md` describe the actual M2.1 runtime/media/gate delta; PLAN records concrete documentation evidence before review.
- [x] The complete local M2.1 gate and one fresh deep combined review are green; the reviewer rejects stubs, mock-only composition, unsupported claims, stale docs, and security/integrity regressions.
- [x] No Git remote is created/added/pushed and no Cloudflare, DNS, Access, token, Worker, or R2 mutation occurs; no credential, `.dev.vars`, Wrangler local state, generated artifact, or new production media asset is committed.

### Runway (pre-implementation)

- Root `package.json` currently has content, format/lint/typecheck/test, Vite `preview:web`, `build:web`, and `verify:web`; it has no Wrangler, media, Worker-smoke, or canonical deploy-gate commands.
- `apps/web` currently uses `@sveltejs/adapter-static@3.0.10` with `fallback: '404.html'`; the root has no `wrangler.jsonc`, `ops/cloudflare/`, media CLI, Worker verifier, or runbook.
- `scripts/content.ts` already exposes `validateContent`, `buildContent`, `loadMediaBaseUrl`, and `ContentBatch.published`; `compileArticle` already owns explicit media-base resolution and traversal containment. Media tooling must reuse those seams rather than add web-runtime or compiler-core filesystem/environment access.
- `ArticleDocumentSchema` and frontmatter already support optional `audio.src` and `durationSeconds`; `ArticleRenderer.svelte` has no audio rendering. M2.1 does not change the public schema version or block grammar.
- Tristan Markdown/tests still use `media/articles/...`; `.env.example` still uses `http://localhost:5173/`; static fixtures already live under `apps/web/static/media/articles/tristan-da-cunha/`.
- `scripts/verify-web.ts` reads `apps/web/build` and hardcodes representative required routes while recursively checking all HTML; existing tests already provide noindex/hydration/404 assertion seams. Extend this verifier rather than create a parallel artifact contract.
- Article/category entries derive from validated generated data; normal non-search pages disable CSR, `/search` hydrates, and `+error.svelte` owns current English error copy.
- Root Vitest runs TypeScript tests in Node but has no Svelte transform plugin; Wave 1 must prove the smallest existing SvelteKit/Vite-compatible SSR/component seam rather than add another test runner.
- CI already uses Node 24, pnpm 11.1.3, frozen lockfile, production media env, and read-only permissions; it must remain non-deploying.
- M2.1 has no remote prerequisite. Checkpoints A, B, and C remain closed.

### Dependencies and order

1. The approved spec, local branch preparation, and accepted M1 reader are the only prerequisites.
2. Wave 1 establishes media/audio behavior and tested CLI seams.
3. Wave 2 consumes those seams while migrating the adapter, adding Wrangler configuration and local Worker smoke, composing the canonical gate, and updating docs.
4. Full local verification precedes review; accepted M2.1 precedes Checkpoint A, any read-only inventory, Checkpoint B, and M2.2.

### Suggested execution

**Wave 1 — Media lifecycle and optional reader audio**

- Difficulty: hard; worker lane: hard; one supervised RED → GREEN TDD dispatch.
- Coherent write set: `.env.example`, Tristan Markdown/static fixture references, relevant compiler/content tests, focused audio renderer/component/test seam, `ArticleRenderer.svelte`, minimal styling, media modules/CLI/tests, and `ops/cloudflare/r2-cors.json`.
- Focused gate: compiler/content/media/audio tests, then root typecheck and lint.

**Wave 2 — Cloudflare local runtime, canonical gate, and documentation**

- Difficulty: hard; worker lane: hard; one supervised RED → GREEN TDD dispatch after Wave 1.
- Coherent write set: root/web manifests and lockfile, `apps/web/svelte.config.js`, `wrangler.jsonc`, CI, existing web verifier/tests, new Worker verifier/tests, root command composition, `README.md`, `AGENTS.md`, and the M2 operations runbook.
- Full deterministic gate: `PUBLIC_MEDIA_BASE_URL=https://media.jelementi.quz.ma/ pnpm verify:deploy`. Live media verification is intentionally excluded until M2.2.

Two worker waves, one pre-review blocker correction, and one deep review consumed 4/5 calls. The final call was not needed; the reviewer returned PASS and fix-cycle usage remains 0/1.

### Documentation evidence

- Status: accepted for M2.1.
- Evidence: `README.md` documents the Cloudflare target, local commands, canonical gate, and media operators; `AGENTS.md` records runtime/media/hydration/verification invariants; `docs/runbooks/cloudflare-m2-operations.md` records A/B/C, token, Access, immutable upload, production probe, and rollback boundaries.

### Counters

**dispatches:** 4/5 delivered · **burned:** 0 · **review-bundles:** 1 · **review-dispatches:** 1 · **fix-cycles:** 0/1 · **oracle:** 0 (triggers: none) · **worker-retries:** 0 · **direct-edits:** 0

## Future outcome — M2.2

Public immutable R2 delivery plus public GitHub/Workers Builds integration and hidden Worker → audited Access → enabled protected branch preview. It depends on accepted M2.1 and explicit Checkpoints A and B. Production remains inactive. Its future gate is full repository plus remote verification followed by fresh deep scrutinize and a separate fresh deep combined review.

## Future outcome — M2.3

Checkpoint-C-controlled automatic `main` production, public custom domain, production probe/link delivery, and harmless correct-version rollback/restoration drill. It depends on accepted M2.2 and explicit Checkpoint C. Its future gate is full repository plus production verification followed by fresh deep scrutinize and a separate fresh deep combined review.
## Gate log

- 2026-07-26 — M2 written spec explicitly approved by Darko; commits `73f40fb`, `77fed08`, and sequencing clarification `edec344`.
- 2026-07-26 — Additional Crew grill explicitly skipped after prior self-review and high-risk advisory pressure-test.
- 2026-07-26 — Scope checkpoint accepted: Full · critical protected · Delivery local.
- 2026-07-26 — Local `main` fast-forwarded without history rewriting to accepted `edec344`; `crew/m2-cloudflare-beta` created; no remote exists and no remote resource changed.
- 2026-07-26 — Full-tier planner output was reconciled into the M2 outcome map and detailed M2.1 slice. Its stray lowercase `plan.md` artifact was removed; no implementation or remote operation occurred.
- 2026-07-26 — Planning reconciliation recovered the prior M1 Cloudflare 404 obligation into M2.1 acceptance and retained the unrelated catastrophic replacement-error detail as deferred, correcting information lost in the temporary PLAN skeleton.
- 2026-07-26 — M2.1 Wave 1 worker delivered canonical versioned media keys, audio SSR rendering, guarded upload/verify seams, exact R2 CORS policy, and injected tests with no remote/network/Git mutation; focused 37/37 and full 85/85 tests passed.
- 2026-07-26 — Parent Wave 1 verification passed format, lint, typecheck, content validation, focused 37/37 tests, full 85/85 tests, legacy static web build, and legacy `verify:web`; Wave 2 remains responsible for manifest wiring and Cloudflare runtime integration.
- 2026-07-26 — M2.1 Wave 2 worker delivered exact Cloudflare/Wrangler pins, checked-in runtime contract, dynamic artifact verifier, local Worker smoke, canonical non-deploy CI gate, CLI integration coverage, and operations runbook; local gate passed with 91/91 tests and zero remote mutations.
- 2026-07-26 — Parent pre-review verification found a real child-process ownership blocker: late exit/error listener attachment could lose an already-emitted event and hang cleanup. The same worker corrected it before first review with immediate exit capture, bounded SIGTERM→SIGKILL cleanup, temporary-state cleanup, and realistic lifecycle tests; fix-cycle budget remains 0/1 because review had not started.
- 2026-07-26 — Fresh parent M2.1 gate passed format, lint, typecheck, content validation, 95/95 tests, Cloudflare build, generated-artifact smoke, Wrangler dry-run, and loopback Worker smoke proving custom HTTP 404/no redirect. No Git remote or Cloudflare mutation exists.
- 2026-07-26 — Dependency audit remains at the two advisories already present before M2: low `cookie@0.6.0` is a runtime transitive of existing `@sveltejs/kit` (not introduced by Wrangler; Wrangler uses `cookie@1.1.1`), while moderate `uuid@7.0.3` is confined to the Expo mobile toolchain. No high/critical advisory was added; review must weigh the existing low runtime exposure explicitly.
- 2026-07-26 — Fresh deep M2.1 review returned PASS with 21/21 acceptance items met and an independent 95/95-test canonical gate. The existing low Kit cookie advisory is non-blocking because this prerendered no-auth reader has no cookie-setting sink; no high/critical advisory was introduced.
- 2026-07-26 — Reviewer found one non-blocking cleanup edge: if a local Worker survives both SIGTERM and SIGKILL and `reap()` throws, temporary config cleanup is skipped. This requires an effectively unreachable Linux process state, targets only `os.tmpdir()`, and did not consume the judgment fix cycle; it is retained explicitly under Deferred.
- 2026-07-26 — Darko explicitly approved Checkpoint A. Read-only preflight confirmed authenticated GitHub owner `DarkoKuzmanovic`, available private repo name `DarkoKuzmanovic/jelementi`, local `main` at `edec344`, accepted Crew branch at `725c29c`, clean tree, and no remote; before-state and per-resource reversals are recorded in `docs/runbooks/checkpoint-a-2026-07-26.md` before mutation.
- 2026-07-26 — Checkpoint A partially executed: private `DarkoKuzmanovic/jelementi` created, `origin` added, remote `main` verified at `edec3445`, and `crew/m2-cloudflare-beta` first pushed at `760b6ee7`; default branch is `main` and no unrelated branch was pushed.
- 2026-07-26 — Checkpoint A stopped before protection mutation when GitHub returned HTTP 403 for private-repository rulesets. The then-assumed `CI / verify` protection could not be enforced on the private GitHub Free repository; no bypass or Cloudflare mutation was attempted.
- 2026-07-26 — Darko explicitly chose PUBLIC visibility and confirmed irreversible source-history disclosure after a read-only scan of all 14 commits found no token, private-key, bearer, or secret-assignment pattern; both tracked `.env.example` files contain public localhost values only.
- 2026-07-26 — `Protect main` ruleset `19777485` is active on `refs/heads/main` with no bypass actor, PR required, deletion/non-fast-forward blocked, strict required check-run context `verify`, and zero required approvals. The locked literal `CI / verify` was corrected as a factual API detail after GitHub's Checks API proved the workflow job reports context `verify`; this preserves the intended mandatory-CI invariant rather than weakening it.
- 2026-07-26 — Initial remote `main` CI registered the `verify` check but failed clean installation with `ERR_PNPM_IGNORED_BUILDS`. RED reproduced in a clean clone; the first `onlyBuiltDependencies` hypothesis failed because pnpm 11 removed that setting. GREEN uses exact `allowBuilds` entries for `esbuild@0.28.1` and `workerd@1.20260722.1`; a second clean clone passed frozen install and the complete 95/95-test `verify:deploy` gate. Fix commit `f859cc0` is pushed only to the Crew branch.
- 2026-07-26 — Checkpoint A integration closed through protected PR #1: required `verify` passed on head `6cf6062`, Darko separately approved merge, and GitHub created merge commit `71d419a` on `main`. Push CI run `30220719418` passed on that exact main SHA. A fresh depth-one clone of merged `main` passed frozen install and the complete 95/95-test `verify:deploy` gate; repository/ruleset controls remain public, active, and bypass-free. Checkpoints B/C remain unapproved.

## Deferred

- Rare catastrophic `content:build` install+restore rename failures preserve the previous output in `generated.backup-*`; improve CLI `AggregateError` detail only when operational recovery work begins. The former Cloudflare 404 item is no longer deferred because M2.1 acceptance now owns it explicitly.
- In `scripts/verify-worker.ts`, nest local temporary-config cleanup so it still runs if bounded SIGTERM→SIGKILL reaping itself throws. This is a low-severity unreachable-in-practice path under Linux and should be fixed when M2.2 next touches the verifier.
