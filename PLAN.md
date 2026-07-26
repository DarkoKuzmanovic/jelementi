# PLAN.md

## Scope decision

- **Tier:** Standard
- **Risk:** contained protected
- **Delivery:** local
- **Run branch:** `crew/m1-content-engine`
- **Started-at:** 2026-07-26T13:55:17+02:00
- **Evidence:** one repository; three bounded cross-package outcomes; architecture and grammar are approved in `docs/specs/2026-07-26-phase-1-content-engine-design.md`; no unresolved architecture fork; deterministic tests and Git rollback exist.
- **Protected boundaries:** `ArticleDocument`/index are public contracts; generated-output replacement is a contained integrity invariant. Canonical Markdown is never mutated, so the run is not critical protected risk.
- **Allowed ceremony:** compact orchestrator plan; no planner dispatch; one supervised TDD worker per coherent wave; deep combined review at M1.1 and M1.2 protected boundaries; standard combined review at M1.3; full repository gate for every outcome.
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
- **First-worker-at:** 2026-07-26T13:57:38+02:00
- **Time-to-first-worker:** 2m21s
- **Dispatches:** 6 delivered
- **Burned:** 0
- **Burned-minutes:** 0
- **Review-bundles:** 4
- **Review-dispatches:** 4
- **Worker-retries:** 0
- **Oracle:** 0
- **Completed outcomes:** 2/3
- **Child-runtime-minutes:** 86.3
- **Session compactions observed before run:** 1

## M1 — Content engine and web reader

**Counters:** dispatches: 6/14 (delivered across outcome ceilings) · burned: 0 · review-bundles: 4 · review-dispatches: 4 · fix-cycles: 1/1 for M1.1, 1/1 for M1.2 · oracle: 0 · worker-retries: 0 · direct-edits: 0

- [x] **M1.1 — Complete the public article contract and pure Markdown compiler**
- [x] **M1.2 — Generate published content and index atomically from canonical Markdown**
- [ ] **M1.3 — Ship the complete prerendered web reader, search, CI, and documentation**

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

## Later outcome boundary

### M1.3 — Complete web reader

Own generated-data loading, exhaustive final renderers, home/article/category/search/About/error routes, published-only prerender entries, client-JS scoping, smoke assertions, CI, README/AGENTS freshness, and final integration verification. Gate with `reviewer` lane `standard` unless new protected evidence promotes it.

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

## Deferred

- Rare catastrophic install+restore rename failures preserve the previous output in `generated.backup-*`; improve CLI AggregateError detail only when operational recovery work begins.
