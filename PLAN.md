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
- **Dispatches:** 3 delivered
- **Burned:** 0
- **Burned-minutes:** 0
- **Review-bundles:** 2
- **Review-dispatches:** 2
- **Worker-retries:** 0
- **Oracle:** 0
- **Completed outcomes:** 1/3
- **Child-runtime-minutes:** 38.1
- **Session compactions observed before run:** 1

## M1 — Content engine and web reader

**Counters:** dispatches: 3/14 (delivered across outcome ceilings) · burned: 0 · review-bundles: 2 · review-dispatches: 2 · fix-cycles: 1/1 for M1.1 · oracle: 0 · worker-retries: 0 · direct-edits: 0

- [x] **M1.1 — Complete the public article contract and pure Markdown compiler**
- [ ] **M1.2 — Generate published content and index atomically from canonical Markdown**
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

## Later outcome boundaries

### M1.2 — Atomic generation and index

Own filesystem discovery, duplicate/collision checks, strict draft/archived validation, published-only JSON/index output, atomic replacement, watch mode, root environment contract, canonical sample Markdown, and a working local fixture asset. Gate with `reviewer` lane `deep` because output replacement is an integrity boundary.

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

## Deferred

- None.
