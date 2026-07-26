# PLAN.md

## Scope decision

- **Tier:** Standard
- **Risk:** contained protected
- **Delivery:** local
- **Run branch:** `crew/m1-content-engine`
- **Started-at:** 2026-07-26T13:55:17+02:00
- **Evidence:** one repository; three bounded cross-package outcomes; architecture and grammar are approved in `docs/specs/2026-07-26-phase-1-content-engine-design.md`; no unresolved architecture fork; deterministic tests and Git rollback exist.
- **Protected boundaries:** `ArticleDocument`/index are public contracts; generated-output replacement is a contained integrity invariant. Canonical Markdown is never mutated, so the run is not critical protected risk.
- **Allowed ceremony:** compact orchestrator plan; no planner dispatch; one supervised TDD worker per coherent wave; deep combined review at every protected outcome; full repository gate for every outcome.
- **Promotion triggers:** a new repository or runtime service, an unresolved AST/model fork, non-reproducible generation, canonical-content mutation, or a migration/data-loss surface.
- **Outcome dispatch ceilings:** M1.1 `5`; M1.2 `5`; M1.3 `4` delivered dispatches. A ceiling may be raised once only with written evidence before the extra dispatch.

## Grill decisions

- Every canonical article, including `draft` and `archived`, must compile successfully; one invalid non-published article blocks the batch and web build.
- The sample article must render a working local fixture media asset. It uses the same relative media key that Phase 2 will upload to R2.

## Conventions

- The approved design spec is the behavior source: `docs/specs/2026-07-26-phase-1-content-engine-design.md`.
- Product output, source, tests, public documentation, and commits are English; Darko-facing coordination is Serbian.
- TDD stays in one worker context per task: record observable RED, implement, then record GREEN.
- Workers never commit. The orchestrator commits one gated outcome at a time.
- `generated/` is reproducible and gitignored; canonical Markdown is never modified by generation.
- Do not add Cloudflare, R2 upload, Studio, mobile, push, audio playback, migration, Tailwind, or final visual-design work.
- No environment workaround has been discovered yet.

## Run metrics

- **Started-at:** 2026-07-26T13:55:17+02:00
- **Ended-at:** 2026-07-26T16:47:21+02:00
- **First-worker-at:** 2026-07-26T13:57:38+02:00
- **Time-to-first-worker:** 2m21s
- **Dispatches:** 9 delivered
- **Burned:** 0
- **Burned-minutes:** 0
- **Review-bundles:** 6
- **Review-dispatches:** 6
- **Worker-retries:** 0
- **Oracle:** 0
- **Completed outcomes:** 3/3
- **Child-runtime-minutes:** 130.8
- **Session compactions observed before run:** 1

## M1 — Content engine and web reader

**Counters:** dispatches: 9/14 (delivered across outcome ceilings) · burned: 0 · review-bundles: 6 · review-dispatches: 6 · fix-cycles: 1/1 for M1.1, 1/1 for M1.2, 1/1 for M1.3 · oracle: 0 · worker-retries: 0 · direct-edits: 0

- [x] **M1.1 — Complete the public article contract and pure Markdown compiler**
- [x] **M1.2 — Generate published content and index atomically from canonical Markdown**
- [x] **M1.3 — Ship the complete prerendered web reader, search, CI, and documentation**

## Completed outcome — M1.1

### Outcome

Complete the framework-neutral model and pure, filesystem-free Markdown compiler before any generation or route migration.

### Acceptance

- [x] `@jelementi/article-model` validates all seven block types, all locked inline marks/nodes, footnotes, `ArticleIndexEntry`, and the shared search normalizer.
- [x] `@jelementi/content-compiler` compiles the approved Markdown/frontmatter grammar into a validated `ArticleDocument` plus body search text.
- [x] Every unsupported construct fails with stable code, source path, and line/column when available; content is never silently dropped.
- [x] Media keys resolve only through the explicit compiler option; the compiler reads no files, writes no files, and reads no process-global environment.
- [x] Tests show RED before implementation and cover every supported discriminant plus representative rejection cases.
- [x] Full gate is green: format, lint, typecheck, 42 tests, and web build.
- [x] Documentation: README reflects the compiler/model contract and Phase 1 status; root AGENTS.md records owning boundaries, invariants, and verification commands.

### Runway

- Existing public contract: `packages/article-model/src/schema.ts` and exports under `packages/article-model/src/index.ts`.
- Existing exhaustive consumers: `apps/web/src/lib/article/ArticleRenderer.svelte` and `InlineContent.svelte`; M1.1 may update their compile-time branches only as required to keep the full gate green, while final presentation belongs to M1.3.
- Test runner: root Vitest; article-model tests already live under `packages/article-model/test/` and are typechecked.
- Compiler libraries are locked by the spec: Unified/Remark parse, frontmatter, GFM, directives, a maintained YAML parser, Zod validation through article-model, and a pinned TypeScript script/test toolchain.
- No generation script or route may consume the new compiler until M1.1 is gated.

### Suggested execution

- **Difficulty:** hard
- **Worker lane:** hard
- **Gate:** one fresh combined reviewer, `lane:deep`, because this outcome changes the public content contract.
- **Files:** `packages/article-model/**`, new `packages/content-compiler/**`, focused exhaustive web branches, workspace/package config, tests, README.md, AGENTS.md.

### Counters

- **Dispatches:** 3/5 delivered
- **Burned:** 0
- **Review-bundles:** 2
- **Review-dispatches:** 2
- **Fix-cycles:** 1/1
- **Oracle:** 0
- **Worker-retries:** 0
- **Direct-edits:** 0
- **Documentation:** README — updated content contract/current constraints; AGENTS — created ownership boundaries, invariants, and verification commands.

## Completed outcome — M1.2

### Outcome

Generate validated published artifacts and a deterministic article index from canonical Markdown through filesystem scripts that restore the previous output after ordinary failures and preserve a recoverable backup after catastrophic double-rename failure.

### Acceptance

- [x] Root `content:validate`, `content:build`, and `content:watch` scripts run through exact-pinned `tsx@4.23.1`, explicitly load an optional root `.env`, and require `PUBLIC_MEDIA_BASE_URL` with concise English errors and no expected-error stack traces.
- [x] Every `content/articles/*.md` file is discovered in deterministic path order and compiled in memory; draft and archived articles are fully validated and can block the batch, but produce no public JSON or index entry.
- [x] Duplicate article slugs and distinct category names that normalize to the same category slug fail the complete batch.
- [x] `content:validate` validates the would-be published index and writes no files or directories.
- [x] `content:build` writes stable two-space JSON with a trailing newline to `generated/articles/<slug>.json` plus `generated/index.json`; the index contains published articles only, ordered by `publishedAt` descending and then slug ascending.
- [x] Output replacement is atomic at the directory boundary: compile/temp-write/ordinary replacement failure preserves or restores the previous `generated/`; a double rename failure preserves its backup and raises `AggregateError`; success removes stale files and leaves no temp/backup directories.
- [x] Watch mode debounces changes, runs builds single-flight with one trailing rebuild, preserves the last successful output after an error, retries on the next change, and cancels pending work on close.
- [x] Canonical `content/articles/tristan-da-cunha.md`, `.env.example`, and working local media under `apps/web/static/media/articles/tristan-da-cunha/` use the same relative keys intended for later R2 upload; the Phase 0 TypeScript fixture and routes remain untouched until M1.3.
- [x] Focused tests capture RED before implementation and cover validation purity, draft/archive exclusion, collision guards, deterministic output, atomic survival/rollback/stale cleanup, watch debounce/single-flight/recovery, environment/CLI errors, and the canonical sample.
- [x] Full gate is green with an explicit local media base: format, lint, typecheck, `content:validate`, 64 tests, `content:build`, existing web build, and sample generated-output assertions.
- [x] Documentation: README explains canonical content/scripts/output/environment; root AGENTS.md records filesystem ownership, atomicity, and validation commands.

### Runway

- Keep `packages/content-compiler/src/index.ts` pure. Filesystem discovery, environment loading, CLI formatting, atomic replacement, and watch orchestration belong in typed root scripts covered by the root TypeScript project and Vitest.
- Source layout is locked to top-level `content/articles/*.md`; output layout is locked to root `generated/index.json` and `generated/articles/*.json`.
- Add one framework-neutral deterministic category-slug helper to `@jelementi/article-model` so M1.2 generation and M1.3 routes cannot diverge. Collision checks compare distinct original category names after normalization.
- Load `.env` only when present, then read `process.env.PUBLIC_MEDIA_BASE_URL`; CI/external environment values remain valid. If using Node's standard env loader, raise the documented/runtime engine floor to the exact supported Node 20 minor rather than claiming unsupported versions.
- Atomic replacement must stage a sibling temporary directory, move any prior target to a sibling backup, install the complete temp directory, restore the backup if installation fails, and clean temp/backup paths on every settled path. Tests must exercise rollback behavior, not only pre-write compile failure.
- Generated files remain gitignored and are test/build products, not committed artifacts.
- M1.2 must not migrate the web route, remove the TypeScript fixture, add category/search/About routes, add CI, or change deployment.

### Suggested execution

- **Difficulty:** hard
- **Worker lane:** hard
- **Gate:** one fresh combined reviewer, `lane:deep`, because filesystem replacement and draft exclusion are integrity boundaries.
- **Files:** typed root content scripts/tests/config, `content/articles/**`, local static fixture media, `.env.example`, package scripts/lockfile, focused model helper/tests, README.md, AGENTS.md.

### Counters

- **Dispatches:** 3/5 delivered
- **Burned:** 0
- **Review-bundles:** 2
- **Review-dispatches:** 2
- **Fix-cycles:** 1/1
- **Oracle:** 0
- **Worker-retries:** 0
- **Direct-edits:** 0
- **Documentation:** README — updated canonical content/scripts/output/environment; AGENTS — updated filesystem ownership, atomicity, and validation commands.

## Completed outcome — M1.3

### Outcome

Replace the Phase 0 fixture with validated generated data and ship the complete prerendered English beta reader. Reader client JavaScript is limited to search; the static `404.html` fallback loads it only to resolve unknown URLs into the custom error page.

### Acceptance

- [x] The web app consumes root `generated/` through build-time imports only, validates `index.json` and every article with `@jelementi/article-model`, rejects missing/orphan/mismatched/non-published artifacts, and imports neither the compiler nor runtime filesystem APIs.
- [x] Root `build:web` generates content before SvelteKit build so a clean checkout cannot build from missing/stale artifacts; local development has an explicit generation-first workflow while `content:watch` remains the canonical rebuild path.
- [x] `/` lists published entries newest-first; `/articles/[slug]` renders the full article plus Sources and Footnotes; `/categories/[category]` lists one validated category; `/search` filters the small static index with the shared normalizer; `/about` and root `+error.svelte` provide concise English beta copy.
- [x] Article and category dynamic routes provide explicit published-only prerender entries. Unknown article/category slugs produce 404 and the custom error experience through the static fallback.
- [x] Non-search reader pages set `csr = false` and built HTML contains no SvelteKit hydration/client-entry scripts; `/search` is the only hydrated reader page and remains functional with case/diacritic-insensitive filtering. Static `404.html` intentionally bootstraps the client.
- [x] Global `noindex` remains in every page through `app.html`; there is no accidental `nofollow` restoration.
- [x] Navigation, headings, form labels, links, image alternatives, Sources, and Footnotes are semantically accessible; final visual design remains out of scope.
- [x] The Phase 0 `sampleArticle` fixture/export was removed only after generated data drove every current consumer and broader renderer/output assertions passed.
- [x] Focused tests were written before implementation; retained RED evidence covers clean-checkout generated coupling and the future-reader hydration regression, while the 77-test GREEN suite covers generated-boundary congruence, published-only route data, category/search behavior, unknown-route 404, Sources/Footnotes, and fixture removal.
- [x] Typed `verify:web` inspects all expected output plus every discovered reader HTML route for representative content, global noindex, non-search no-hydration, search/404 bootstrap, and missing/stale output; its deterministic CLI guard fails non-zero when build output is absent or incomplete.
- [x] CI on Node 24 installs with the frozen lockfile, supplies an HTTPS media base, and runs format, lint, typecheck, content validation, tests, web build, and web smoke verification with read-only repository permissions and no deployment.
- [x] Full local gate is green: format, lint, clean-generated typecheck and 77 tests, content validation, generation-backed web build, web smoke, negative missing-output smoke probes, and explicit unknown-route checks.
- [x] README, root AGENTS.md, this PLAN, the approved design spec, and ROADMAP accurately mark Phase 1/M1 complete and keep Cloudflare/R2/Studio/mobile work deferred.

### Runway

- Web boundary code may import only generated JSON and `@jelementi/article-model`; Markdown parsing and content generation remain root-script/compiler concerns.
- Prefer a server/build-only generated-content module with eager static imports (for example `import.meta.glob`) so root `typecheck` does not require committed generated files and no runtime `fs`/fetch path appears.
- Boundary validation must prove one-to-one index/article slug sets, filename/document slug agreement, `status: published`, category-slug agreement, and metadata consistency needed by cards/routes.
- Route data and prerender entries derive from the validated index; do not hand-maintain route lists or duplicate category/search normalization.
- Non-search reader pages explicitly disable CSR at the page boundary. Do not disable CSR globally if that would prevent `/search` or the static custom-error fallback from hydrating.
- `build:web` owns generation-before-build; CI and smoke commands set `PUBLIC_MEDIA_BASE_URL=https://media.jelementi.quz.ma/`. Local `.env` remains supported.
- Use existing Svelte/SvelteKit/Vitest/Node APIs; add no browser-test or UI dependency unless the existing stack cannot prove an acceptance criterion.
- Remove `packages/article-model/src/fixture.ts` and its export/test only after the generated route path and production-output smoke assertions are green.
- Keep the implementation visually restrained and content-first. Do not add authentication, Studio, Cloudflare adapter/deployment, R2 upload, service workers, mobile behavior, audio, analytics, or final design.

### Suggested execution

- **Difficulty:** hard
- **Worker lane:** hard
- **Gate:** fresh combined reviewers, `lane:deep`, because this closed Phase 1 and changed public routing, hydration, and CI boundaries.
- **Files:** generated-data boundary/helpers/tests, SvelteKit routes/layout/error/styles, ArticleRenderer Sources/Footnotes, root scripts/package config, `.github/workflows/ci.yml`, README.md, AGENTS.md, fixture removal, PLAN/ROADMAP close-out evidence.

### Counters

- **Dispatches:** 3/4 delivered
- **Burned:** 0
- **Review-bundles:** 2
- **Review-dispatches:** 2
- **Fix-cycles:** 1/1
- **Oracle:** 0
- **Worker-retries:** 0
- **Direct-edits:** 0
- **Documentation:** README — updated reader/build/CI boundary · AGENTS — updated web ownership and hydration exception · design spec — marked implemented and reconciled static fallback · ROADMAP — M1 released, M2 current

## Gate log

- 2026-07-26 — Spec approved by Darko; commits `6e436b3` and `a3c0d93`.
- 2026-07-26 — Gentle grill resolved two branches: invalid non-published content blocks the batch; local sample media must render successfully.
- 2026-07-26 — Scope checkpoint approved: Standard, contained protected, local delivery, three outcomes.
- 2026-07-26 — M1.1 worker delivered model/compiler/rendering/docs with RED → GREEN evidence; parent verification found and closed media traversal and ISO-date blockers in the same worker context.
- 2026-07-26 — First fresh deep review: PASS with locale determinism, timestamp-calendar, and strict nested-frontmatter should-fixes; one reviewer-triggered fix cycle opened.
- 2026-07-26 — Parent verification continued that same fix cycle to close optional-field silent omission; this continuation did not increment the fix-cycle or unique-dispatch counters.
- 2026-07-26 — Final parent gate green (format, lint, typecheck, 42/42 tests, web build) and fresh final deep review PASS with no blockers; M1.1 accepted.
- 2026-07-26 — M1.2 worker delivered typed generation/validation/watch scripts, canonical Markdown/media, deterministic index, and atomic replacement; parent verification closed empty-source catalog wipe, category-slug schema drift, and a weak debounce proof in the same worker context before review.
- 2026-07-26 — First M1.2 fresh deep review: PASS with no blockers; one optional reviewer-triggered hardening cycle consumed the 1/1 budget for watch single-flight, exact Node engine support, and rollback branch tests.
- 2026-07-26 — Final parent gate green (format, lint, typecheck, content validation/build, 64/64 tests, web build) and fresh final deep review PASS with no blockers; M1.2 accepted. Parent corrections before first review did not consume a fix cycle; the reviewer-triggered hardening loop did.
- 2026-07-26 — M1.3 worker delivered generated-data validation, published reader routes, search, Sources/Footnotes, static build/smoke tooling, CI, and fixture removal. Parent verification found and closed clean-checkout test coupling, duplicate index-slug acceptance, and the missing static 404 fallback in the same worker context before review.
- 2026-07-26 — First M1.3 fresh deep review: PASS with no blockers; one reviewer-triggered hardening cycle consumed the 1/1 budget for deterministic smoke CLI execution, dynamic hydration checks across every discovered reader route, and direct missing-artifact/category-mismatch tests.
- 2026-07-26 — Final parent gate green (format, lint, clean-generated typecheck, 77/77 tests, content validation, generation-backed static build, positive and negative web smoke) and final fresh deep review PASS with no blockers; M1.3 and M1 accepted.
- 2026-07-26 — Close-out reconciled the intentional hydrated `404.html` fallback in AGENTS/design wording and moved M1 to Released with M2 as Current.

## Deferred

- Rare catastrophic install+restore rename failures preserve the previous output in `generated.backup-*`; improve CLI AggregateError detail only when operational recovery work begins.
- Confirm Cloudflare serves the static `404.html` fallback with the intended HTTP status and unknown-path routing during M2 deployment verification.
