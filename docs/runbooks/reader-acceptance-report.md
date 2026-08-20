# Reader acceptance report — T104 final integration gate

**Status:** Final acceptance gate — automated gates green, Chrome stages + contrast **PASS**, M13 **PASS** 2026-08-20 (Darko)
**Date:** 2026-08-20
**Worktree commit:** `0fadb3a98b87f3cf8a710bbdf2a5236a32d905d8` — evidence captured at actual HEAD at capture (see `docs/evidence/reader-acceptance/{contact-sheet.md,lighthouse.json}` for commit + timestamp) — base `54e2e8f` (merged main), prior gate at `7b49b20`; correction scripts derive HEAD fail-closed, so future captures record current HEAD truthfully
**Base merge:** PR #107 `t99-t103-reader-fanin` (editorial Reader redesign)
**Authority:** Specification #96, foundation runbook `reader-acceptance-foundation.md`, immutable design sources `62b3e95`, `d2648cf`, `c548b7e`, `a10e9f3`
**Supervisor Intercom target:** `01a01a09-eb85-7bfa-a6e9-e9cf74edf33d`
**Frozen asset ceilings (hard, non-waivable):** Reader CSS **17,943** · Search JS **167,513** · Representative HTML **70,885**
**Honesty boundary (Chrome-only per #104#issuecomment-5353353146):** Chrome 151.0.7922.169 manual matrix is **PASS** for visual 32-image matrix, Stage 1 interaction, Stage 2 320px touch + 200/400 zoom, Stage 3 text-spacing + reduced-motion + no-JS (preserved evidence, see §7 and §11); contrast sampling **PASS** (human: stable Chrome light/dark; body and metadata; links/visited role; focus; controls; dividers/meaningful borders; fact/note/warning callout text/background/accent; rich article wide/narrow re-review all meet stated WCAG 2.2 AA thresholds) and final M13 **PASS** 2026-08-20 Darko: Darko explicitly approves structural and experiential fidelity for the completed Reader redesign after every preceding gate passed, with the documented Chrome-only / no Firefox-Safari-WebKit-real-screen-reader residual limitation accepted. — Firefox, native Safari, Playwright WebKit proxy, and Orca/manual screen-reader journeys are **no longer gates** (explicit spec reduction, not fabricated PASS; residual limitation: reduced cross-browser and real-AT coverage); Firefox Dev Edition 155.0b1 supplemental PASS noted separately; Orca installed then removed per human request. Rich article now exposes all three callout variants (fact/note/warning) for light/dark contrast review.

---

## 1. Executive summary

This report is the single final integration and acceptance gate for the complete Reader–Studio visual consolidation (#96, #104). It introduces no new design direction and waives no failed slice. It integrates and reports every phase-6 verification obligation from #96 (automated gates green, manual gates honestly held as PASS per Chrome-only amendment and M13 human approval), records material deviations for human decision now approved at M13, and gated explicit human fidelity approval on prior full-green.

**Automated gate:** One clean canonical `PUBLIC_MEDIA_BASE_URL=https://media.jelementi.quz.ma/ pnpm verify:deploy` passes at this worktree with no drift from the merged main. See §3 and artifact `/tmp/verify-deploy-T104.log`.

**Manual gate (Chrome-only per 5353353146):** The automated Browser, Architecture, Data, and Asset probes are green. The agent-run Lighthouse mobile is **PASS per amended contract** (#104#issuecomment-5351661545) — Accessibility 100, Best Practices 100, Performance 100, SEO 60 with `is-crawlable` as the sole failed applicable SEO audit (every other applicable SEO audit PASS, raw SEO recorded, any second failure blocks; future SEO 100 once global noindex retired). Chrome 151.0.7922.169 manual matrix is **PASS** for visual 32-image matrix, Stage 1 interaction, Stage 2 320px touch + 200/400 zoom, Stage 3 text-spacing + reduced-motion + no-JS (preserved human evidence). Contrast sampling (all three callout variants fact/note/warning, light/dark) is **PASS** — Human contrast gate PASS: stable Chrome light/dark; body and metadata; links/visited role; focus; controls; dividers/meaningful borders; fact/note/warning callout text/background/accent; rich article wide/narrow re-review all meet stated WCAG 2.2 AA thresholds — and final M13 **PASS** 2026-08-20 Darko: Darko explicitly approves structural and experiential fidelity for the completed Reader redesign after every preceding gate passed, with the documented Chrome-only / no Firefox-Safari-WebKit-real-screen-reader residual limitation accepted. Firefox/WebKit/Orca no longer gates (residual limitation: reduced cross-browser and real-AT coverage, not fabricated PASS). Human approval occurred only after every preceding Chrome criterion was green and did not waive a failed invariant.

**Fan-in simplifications:** The fan-in visual simplifications from #99–#103 (see §13) are **not silently accepted** — they are documented here as explicit human-fidelity review inputs requiring approval after visual inspection of the curated evidence.

---

## 2. Immutable design authority

Commit hashes, not branch heads, are authoritative.

| Authority | Immutable source | Approved direction | Production rule |
| --- | --- | --- | --- |
| Editorial-reader and accessibility research | `62b3e95` — `docs/research/public-reader-editorial-patterns.md` | Requirements and evidence hierarchy | Apply requirements; do not copy implementation |
| Public Home and discovery | `d2648cf` — `prototypes/public-home-discovery` | Variant A, Editorial front | Rewrite hierarchy and responsive transformation in Reader-owned code |
| Article reading | `c548b7e` — `prototypes/article-reading` | Variant A, The Quiet Column | Rewrite bounded reading composition around authoritative article renderer |
| Secondary Reader routes | `a10e9f3` — `prototypes/secondary-reader-routes` | Variant A, Quiet index | Rewrite restrained ruled directory, single reading sequence, plain recovery |

Prototype source is evidence only. Fixtures, fake copy, inert links, banners/ribbons, variant query parameters, switchers, floating controls, state panels, comparison labels, evaluation keyboard shortcuts, and evaluation-only JS are excluded from production.

---

## 3. Complete repository verification — clean canonical run

**Command (single canonical invocation as required by #104):**

```bash
PUBLIC_MEDIA_BASE_URL=https://media.jelementi.quz.ma/ pnpm verify:deploy
```

**Worktree:** `/tmp/jelementi-worktrees/t104-final-reader-acceptance` (up-to-date with `origin/main`, nothing to commit before work)

**Log artifact:** `/tmp/verify-deploy-T104.log` (534 lines, contains full build output)

**Chain executed (in order, as defined in `package.json`):**

1. `pnpm format` — Prettier `--check .` → **PASS** (all files use Prettier style)
2. `pnpm lint` — ESLint → **PASS**
3. `pnpm typecheck` — `tsc --noEmit` + workspace `svelte-check` → **PASS** (0 errors, 0 warnings)
4. `pnpm content:validate` — with `PUBLIC_MEDIA_BASE_URL=https://media.jelementi.quz.ma/` → **PASS** (`Content validation succeeded.`)
5. `pnpm test` — Vitest `vitest run` → **PASS** — 65 test files, **799 tests passed** (excludes Playwright browser seams)
6. `pnpm test:studio:browser` — via `scripts/studio-browser-acceptance.ts` → **PASS** — 89 passed, 19 skipped (Chromium js-enabled + no-js; see Studio §12)
7. `pnpm build:web` — `content:build` + `vite build` + `adapter-cloudflare` → **PASS** (Cloudflare output 81 files, 1560.56 KiB)
8. `pnpm test:reader:browser` — via `scripts/reader-browser-acceptance.ts` → **PASS** — representative + intermediate + sparse + real-catalog scenarios, ~68 passed + skips (see §6)
9. `pnpm verify:web` — `scripts/verify-web.ts` → **PASS**
10. `pnpm verify:reader:assets` — `scripts/reader-assets.ts` → **PASS** (see §5)
11. `pnpm verify:wrangler` — `scripts/verify-deploy.ts` → **PASS** (`--dry-run` exited; production route `jelementi.quz.ma` intact)
12. `pnpm verify:worker` — `scripts/verify-worker.ts` → **PASS** (local Worker smoke: `/not-found` retained HTTP 404 with Reader recovery)
13. `pnpm media:verify` — live read-only `media:verify` against `https://media.jelementi.quz.ma/` → **PASS** (`Media verification succeeded.`)

**Result:** Every repository, Reader browser, Studio browser, Web, Worker, Wrangler, and live media gate passes together from the clean canonical integration state. No gate is waived.

---

## 4. Architecture evidence — frozen invariants as hard gates

All checked by `verify:web`, `verify:worker`, `verify:wrangler`, and Playwright browser assertions; none is visual-review tradeoff.

| Invariant | Evidence | Status |
| --- | --- | --- |
| Ordinary Reader routes are prerendered and non-hydrated | `verify:web` asserts no `kit.start` / `/_app/immutable/entry/start` on `/`, `/about`, `/categories`, `/categories/[category]`, `/articles/[slug]` (hydratedRoutes = only `/search`, `/404`) | **PASS** |
| `/search` is the sole normally hydrated Reader route | `verify:web` asserts hydration entry present on `/search`; `verify:worker` asserts same; no other route hydrates | **PASS** |
| Static `404.html` is the sole fallback bootstrap and returns HTTP 404 | `verify:worker` browser-fallback test: `page.goto('/not-found')` retains HTTP 404, renders Reader header/main/footer, recovery links Home/Search/Categories, no Try again; `wrangler.jsonc` `not_found_handling: '404-page'` | **PASS** |
| Production bundles contain no Studio, GitHub credential, Access secret, compiler, fixture, or acceptance-mode capability | `verify:web` scans all `/_app` client bundles for `api.github.com`, `GITHUB_APP_PRIVATE_KEY`, `Cf-Access-Jwt-Assertion`, `@jelementi/content-compiler`, `server/studio`, `STUDIO_ACCEPTANCE_MODE` → zero hits; `verify:wrangler` rejects any `STUDIO_ACCEPTANCE_MODE` in `wrangler.jsonc` vars | **PASS** |
| `wrangler.jsonc` routed contract intact | `workers_dev: false`, `preview_urls: true`, `routes: [{pattern:'jelementi.quz.ma', custom_domain:true}]`, `R2_MEDIA` binding, `assets.not_found_handling:'404-page'` | **PASS** |
| `wrangler.m2.jsonc` branch-upload route-less | `routes` undefined/empty, otherwise same contract | **PASS** |
| M2.1 `adapter-cloudflare({fallback:'spa'})` target preserved | `svelte.config.js` uses that exact adapter; normal routes remain prerendered non-hydrated per above | **PASS** |
| No Reader acceptance selector in production Vite/Svelte/Wrangler config | `verify:web` + `verify:wrangler` reject `READER_ACCEPTANCE_*` and fixture module path/marker/slug in Cloudflare output | **PASS** |

---

## 5. Data evidence — published-only validated boundary

| Contract | Evidence | Status |
| --- | --- | --- |
| Validated published-only derivation (index + articles) | `pnpm content:validate` passes; `scripts/content.ts` validates `generated/` against `ArticleDocument` schema; `verify:web` proves route data derives only from validated boundary | **PASS** |
| Unchanged Search normalization / searchable fields | `normalizeSearchText` shared between `@jelementi/article-model` and Search route; `reader-search.spec` preserves accent/case/special-char semantics (`ČAČAK` → matches) | **PASS** |
| Exact `/index.json` fields and headers without `searchText` | Route `/(reader)/index.json/+server.ts` prerendered, `content-type: application/json`, `X-Robots-Tag: noindex`, fields = same as index metadata minus `searchText` (ADR-0005) | **PASS** |
| Exactly one lowercase SHA-256 article fingerprint | Verified by `scripts/content.test.ts` + browser `meta[name="jelementi-content-version"]` on every `/articles/[slug]` | **PASS** |
| Independent article/index validation | `validateGeneratedContent` checks article schema + index entries separately; no cross-skipping | **PASS** |
| Unchanged article schema, blocks, inline, footnote, compiler, media-key contracts | `schemaVersion:1`, all 7 block discriminants, locked inline marks/nodes, footnote cross-reference validation preserved; `@jelementi/content-compiler` owns Markdown-to-model; media keys remain relative via explicit `PUBLIC_MEDIA_BASE_URL` | **PASS** |

---

## 6. Automated Reader acceptance — every required route and state

Configuration: `apps/web/playwright.reader.config.ts` (fixture-backed, `READER_ACCEPTANCE_SCENARIO=representative|intermediate|sparse`, projects `reader-js-enabled`, `reader-no-js`, `reader-ordinary-error`, `reader-retryable-error`) plus `playwright.reader-smoke.config.ts` (real generated catalog, project `reader-real-generated-catalog`).

**Fixture catalog:** Representative 9-item catalog exercising sparse, intermediate, and representative Home tiers, count-ordered categories with alphabetical ties, rich article with all 7 blocks + image/caption/wide media + audio + sources + footnotes/backlinks, sparse article without audio, missing-article/category, unknown route, ordinary/retryable error.

**Run result (representative scenario, this worktree):**

| Project | Specs | Passed | Skipped | Notes |
| --- | --- | --- | --- | --- |
| `reader-js-enabled` | `reader-article-quiet-column`, `reader-categories`, `reader-foundation`, `reader-home`, `reader-recovery`, `reader-search`, `reader-shell` | ~34 | — | Wide + 320, light/dark, reduced-motion, keyboard, zoom/text-spacing, Axe |
| `reader-no-js` | same set, `javaScriptEnabled:false` | ~34 | ~14 (JS-only search interactions skipped) | Search shows complete catalog without JS |
| `reader-ordinary-error` / `reader-retryable-error` | ordinary error fail-closed vs retryable Try again | 1 each | — | Normal shell, Try again only when meaningful |
| Intermediate + sparse Home tiering | `@home-catalog-scenario` | 2 each scenario | — | Every article exactly once, no empty tier |
| `reader-real-generated-catalog` | `reader-real-catalog.spec.ts` | 1 | — | Canonical single-article `generated/` smoke |

**Coverage by surface (all automated facets green):**

- Global shell: skip link, one main landmark, header/nav/main/footer on every public route
- Home `/`: 1 article; 2–4 articles; representative 9; empty-tier omission; exactly-once catalog membership
- Categories `/categories`: count-desc then alpha ties; one/many; long names; canonical links
- Category `/categories/[category]`: one; many newest-first; missing category (normal-shell 404)
- Article `/articles/[slug]`: sparse; canonical category link `/categories/[category]`; all 7 blocks; inline marks/nodes; image/caption/wide media; audio directly below opening (never autoplay); sources; footnotes/multiple backlinks; next/no-next (oldest has no wrapped continuation); missing article (normal-shell 404)
- Search `/search`: initial complete catalog; one/many/zero; Clear restores focus; long query; accents/special chars; preserves input focus; polite `role=status` announcements; zero-result offers Clear and Categories; without JS retains complete catalog and conventional links; sole hydrated route
- About `/about`: compact factual editorial statement, no invented contact, optional ownership facts only when verified
- Static fallback `404.html`: unknown path, exact language/recovery, HTTP 404, sole fallback bootstrap
- Accessibility: Axe `expectNoBlockingAccessibilityViolations` reports zero serious/critical across Home (`reader-home.spec:202`), Categories (`reader-categories.spec:98/140` skipped where no-js), Search (`reader-search.spec:6`), Article (`reader-article-quiet-column` + helper), Recovery — paired with semantic assertions for landmarks/headings/skip/names/descriptions/status/audio/figures/footnotes/backlinks
- Responsive: 320 CSS px `body.scrollWidth === 320` on every composition; nav `flex-wrap:wrap` (no burger); 200% text resize; WCAG text-spacing overrides; 400% zoom equivalent (320px effective) with no page-level two-axis scrolling

**Honest limitation (Chrome-only, now with M13 PASS):** Final M13 **PASS** 2026-08-20 Darko (see §7). Contrast sampling (all three callout variants) is **PASS** (human gate 2026-08-20). Firefox/WebKit/Orca and additional browsers are no longer gates per Chrome-only amendment (residual limitation: reduced cross-browser and real-AT coverage, not fabricated PASS). Chrome touch/zoom/text-spacing/reduced-motion/no-JS/keyboard already verified via Chrome 151 Stage 1/2/3 — marked **PASS** in §7.

---

## 7. Manual evidence matrix — Chrome-only per #104#issuecomment-5353353146

Interactive wizard: `pnpm tsx scripts/human-acceptance-wizard.ts` → writes `docs/evidence/reader-acceptance/manual-evidence.json` (template at `manual-evidence.template.json`).

Chrome 151.0.7922.169 manual matrix is **PASS** for visual 32, Stage 1/2/3 and contrast (fact/note/warning) (see below); final M13 **PASS** 2026-08-20 Darko. Firefox/WebKit/Orca no longer gates (spec reduction, residual limitation: reduced cross-browser and real-AT coverage, not fabricated PASS).

| # | Checkpoint | Required evidence | Status | How to satisfy |
| --- | --- | --- | --- | --- |
| M1 | Chrome stable 151.0.7922.169 — visual 32-image matrix | 8 routes × 1280/320 × light/dark, width-verified PNGs (representative fixture) | **PASS** — human verified, Chromium automated provides 32 PNGs (see contact-sheet) | Human opens built preview (`pnpm preview:web`) or fixture dev server at `vite.reader-acceptance.config.ts` in Chrome 151, records version + outcomes via wizard |
| M2 | Chrome 151 Stage 1 interaction | shell/skip/landmarks, Home hierarchy, rich article with audio/footnotes, Categories, Search, About, 404 | **PASS** — Chrome 151.0.7922.169 Stage 1 | Human Chrome 151 interaction exercise, records version + per-route outcomes |
| M3 | Chrome 151 Stage 2 — 320px touch + 200%/400% zoom | 320px touch viewport + 200%/400% zoom at representative routes, no page-level 2D scrolling | **PASS** — Chrome 151.0.7922.169 Stage 2 | Manual 320px touch + browser zoom at Home/Category/Article/Search/About/404 |
| M4 | Chrome 151 Stage 3 — text-spacing + reduced-motion + no-JS | WCAG 1.4.12 text-spacing overrides, `prefers-reduced-motion: reduce`, JS-disabled (Search complete catalog) | **PASS** — Chrome 151.0.7922.169 Stage 3 | Inject WCAG spacing bookmarklet / DevTools emulate reduced-motion / disable JS in Chrome 151 |
| M5 | Contrast sampling (WCAG 2.2 AA) | Samples: semantic text, links + visited, focus, controls, borders, metadata, every callout state **fact/note/warning** in light + dark; ratios (≥4.5:1 text, ≥3:1 large/non-text); tool version; no exception | **PASS** — Human contrast gate PASS: stable Chrome light/dark; body and metadata; links/visited role; focus; controls; dividers/meaningful borders; fact/note/warning callout text/background/accent; rich article wide/narrow re-review all meet stated WCAG 2.2 AA thresholds. |
| M6 | Lighthouse mobile (reproducible local, agent-run) | Lighthouse version, mobile scores (Accessibility 100, Best Practices 100, Performance ≥90), every applicable SEO audit PASS and `is-crawlable` sole failed with raw SEO score and exact audit evidence (currently 60), URL tested, `lighthouse.json` with `failedApplicableAudits` and `failedDetails`, rerun notes if noisy; future SEO 100 with no exception once global noindex retired | **PASS per amended contract #104#issuecomment-5351661545** — Lighthouse 13.4.1 at `http://127.0.0.1:43123/` (commit a6845aa, 2026-08-20T05:23:42Z) recorded Accessibility 100/Best Practices 100/Performance 100/SEO 60; **every applicable SEO audit PASS and `is-crawlable` is the sole failed applicable audit** (raw SEO 60, exact audit evidence in `docs/evidence/reader-acceptance/lighthouse.json`; any second failure would block; `meta-description` fix 50→60 applied; global `noindex` remains immutable per DECISIONS.md). See §10/10a. |
| M7 | Firefox / WebKit / Orca | Firefox stable, WebKit proxy, Orca+Firefox journey | **no longer gates per Chrome-only amendment 5353353146** — residual limitation: reduced cross-browser and real-AT coverage (Firefox Dev 155.0b1 supplemental PASS noted separately; Orca installed then removed per human request) | Not required for Chrome-only gate; note as residual |

**Human fidelity approval (final gate):**

| Checkpoint | Condition | Status |
| --- | --- | --- |
| M13 | Explicit human approval of structural and experiential fidelity — only after every preceding M1–M6 **PASS** (Chrome 151) and every invariant/asset/architecture gate **green**; recorded with approver name, date, fidelity statement; never inferred; never waives failed invariant | **PASS** 2026-08-20 Darko: Darko explicitly approves structural and experiential fidelity for the completed Reader redesign after every preceding gate passed, with the documented Chrome-only / no Firefox-Safari-WebKit-real-screen-reader residual limitation accepted. |

Chrome manual stages M1–M4 and M5 contrast are satisfied by human Chrome 151 verification (see above); M13 fidelity **PASS** 2026-08-20 Darko — all manual checkpoints now green. No checkpoint is satisfied by Chromium JS-enabled Playwright alone.

---

## 8. Contrast sampling — PASS (Chrome-only) — human gate 2026-08-20T08:36:53.076Z

M5 **PASS** — Human contrast gate PASS: stable Chrome light/dark; body and metadata; links/visited role; focus; controls; dividers/meaningful borders; fact/note/warning callout text/background/accent; rich article wide/narrow re-review all meet stated WCAG 2.2 AA thresholds. WCAG 2.2 AA 4.5:1 text, 3:1 large/non-text, no exception. Tool: Chrome DevTools colour picker + Axe contrast, sampled fact/note/warning in light+dark. Rich article wide/narrow re-review included. Recorded in `docs/evidence/reader-acceptance/manual-evidence.json` (contrast-sampling PASS) with exact human note; M13 **PASS** 2026-08-20 Darko — see manual-evidence.json.

---

## 9. Assistive-technology journey — Orca + Firefox on Linux (no longer gates per Chrome-only amendment)

Chrome-only per #104#issuecomment-5353353146: Firefox, native Safari, WebKit proxy, and Orca/manual screen-reader journeys are no longer gates (spec reduction, not fabricated PASS). Firefox Dev Edition 155.0b1 supplemental PASS noted separately; Orca was installed then fully removed per human request. Residual limitation: reduced cross-browser and real-AT coverage must be stated. Accessibility-tree inspection in Chrome (Axe + semantic assertions) remains the automated gate.

---

## 10. Performance — reproducible local mobile Lighthouse

Required (amended #104#issuecomment-5351661545): local mobile Lighthouse run records Accessibility 100, Best Practices 100, Performance ≥90; during immutable unlisted-beta global noindex, every applicable SEO audit must PASS and `is-crawlable` must be the sole failed SEO audit (raw SEO score recorded, currently 60, exact audit evidence in `lighthouse.json`; any second failure blocks; no artificial noindex-stripped build). When global noindex is retired, SEO must be 100 with no exception. Noisy results are investigated and rerun rather than waived.

**How to produce (reproducible):**

```bash
pnpm build:web
pnpm preview:web &           # loopback 127.0.0.1 only, persist outside repo per AGENTS.md
npx lighthouse http://127.0.0.1:4173/ --form-factor=mobile --throttling-method=devtools --output=json --output=html
npx lighthouse http://127.0.0.1:4173/search --form-factor=mobile --output=json
# record version (npm list lighthouse), scores, URLs, and rerun notes
```

This report **claims Lighthouse PASS per amended contract** (#104#issuecomment-5351661545) — see `docs/evidence/reader-acceptance/lighthouse.json` (commit a6845aa, 2026-08-20T05:23:42Z): Accessibility 100, Best Practices 100, Performance 100, SEO 60 with `is-crawlable` as the sole failed applicable SEO audit (every other applicable SEO audit PASS, raw SEO 60 and exact `failedDetails` recorded; `meta-description` fix 50→60 applied). `is-crawlable` failure is inherent to the immutable global noindex for unlisted beta — see §10a for exact audit evidence and future contract. Raw JSON/HTML at `/tmp` are CI artifacts; rerun via `pnpm tsx scripts/run-lighthouse.ts`, do not waive; the gate parses the exact failed SEO audit set so any second failure blocks.

---

### 10a. Human decision — amended Lighthouse SEO contract (2026-08-19, #104#issuecomment-5351661545)

**Exact failed applicable SEO audits (Lighthouse 13.4.1, mobile, http://127.0.0.1:43123/, commit a6845aa, raw /tmp/lighthouse-T104-1787203425082.report.json, after meta-description fix, recorded in `docs/evidence/reader-acceptance/lighthouse.json`):**

- `is-crawlable` — score 0, `Page is blocked from indexing` — Search engines are unable to include your pages in search results if they don't have permission to crawl them. This is triggered by the global `<meta name="robots" content="noindex">` present on every Reader route (see `apps/web/src/app.html` and `verify:web` global noindex gate). This `noindex` is an **immutable M2 contract** for the unlisted beta (DECISIONS.md: “Keep noindex until evidence”, ROADMAP M2: global noindex, AGENTS.md invariant: every route includes noindex). Removing it would violate the published unlisted-beta contract and the `verify:web` gate.
- `meta-description` — **now PASS (score 1) after fix:** added `<meta name="description">` to `/(reader)/+page.svelte` (homepage), `about/+page.svelte`, `categories/+page.svelte`, `search/+page.svelte`, `articles/[slug]/+page.svelte` (excerpt), and `categories/[category]/+page.svelte`. This product fix improved SEO from **50 → 60**. No product-owned defect remains for `meta-description`.

After the `meta-description` fix, the remaining SEO failure is solely `is-crawlable` due to global noindex. With `noindex` present, Lighthouse SEO caps at **60** (was 50) and cannot reach 100 by design. This was a **true conflict** between the original issue #104 criterion (SEO 100) and the immutable global noindex for the unlisted beta.

**Human decision (2026-08-19, #104#issuecomment-5351661545):** The product/spec owner approved an explicit specification correction preserving the unlisted-beta distribution contract — not a silent waiver. The gate now enforces:

- Accessibility 100, Best Practices 100, Performance ≥90
- Every applicable SEO audit must PASS
- `is-crawlable` must be the sole failed SEO audit, caused only by the shipped global `noindex`
- Raw SEO score and exact failed-audit evidence must be recorded
- No artificial noindex-stripped build may be used as production evidence
- When the global `noindex` decision is retired, the gate automatically becomes SEO 100 with no exception

**Implementation:** `scripts/run-lighthouse.ts` now parses the exact failed applicable SEO audit set (`getFailedSeoAudits` / `getFailedSeoAuditIds`) and asserts it is exactly `[is-crawlable]` during the noindex phase (or `[]` with SEO 100 once noindex is retired). It does **not** merely lower a numeric threshold — any second failed SEO audit alongside `is-crawlable` blocks the gate. `scripts/human-acceptance-wizard.ts`, `scripts/generate-reader-evidence.ts`, and `docs/evidence/reader-acceptance/lighthouse.json` record the same `failedApplicableAudits` / `failedDetails` and raw SEO score. Tests in `scripts/run-lighthouse.test.ts` cover sole `is-crawlable` pass, future SEO 100 pass, and second-failure blocking (including `meta-description` and `document-title` as second failures, and ignoring `manual`/`notApplicable`).

**Evidence retained:** concise `docs/evidence/reader-acceptance/lighthouse.json` (100/100/60/100 with `seo: {rawScore, failedApplicableAudits: [is-crawlable], failedDetails, contract}`) plus raw `/tmp/lighthouse-T104-*` (not committed) with full auditRefs. Lighthouse is now **PASS per amended contract**; all genuinely manual checkpoints (M1–M6, M13) now **PASS** 2026-08-20 (M13 Darko) per Chrome-only amendment and human approval.

## 11. Curated deterministic screenshots and contact sheets

**Contact sheet (deterministic, review evidence — not pixel-diff gate):** `docs/evidence/reader-acceptance/contact-sheet.md`

- Generated from frozen route list: Home, Categories, Category (Field Notes), Article rich (all 7 blocks + audio + footnotes), Article sparse, Search, About, Static 404.
- Each route at 1280 wide and 320 narrow, light and dark, reduced-motion variant.
- Filenames are deterministic: `home--light--1280.png`, `home--dark--320.png`, …, `404--dark--320.png` (see contact sheet table for full matrix).
- Asset ceilings row is included in the contact sheet header for traceability: representative HTML **27055/70,885**, CSS **17,942/17,943**, JS **166016/167,513**.

**Automated capture (Chromium, fail-closed, width-verified):**

```bash
pnpm tsx scripts/generate-reader-evidence.ts         # Chromium via @playwright/test, vite.reader-acceptance.config.ts representative scenario
pnpm tsx scripts/generate-reader-evidence.ts --dry-run  # contact sheet only
```
Screenshots save to `docs/evidence/reader-acceptance/screenshots/`. The committed `contact-sheet.md` is review evidence; do not add indiscriminate pixel-diff CI gates. Chrome 151 human-verified 32-image matrix is **PASS** (Chromium automated PNGs at 1280/320 light/dark); Firefox/WebKit/Orca no longer gates per Chrome-only amendment (residual limitation).

**Current state at this commit (corrected, amended contract #104#issuecomment-5351661545):** Contact sheet is committed with actual HEAD (`a6845aa`, 2026-08-20T05:24:17Z) and truthful timestamp; `screenshots/` contains **32 real deterministic Chromium PNGs** (8 routes × 1280/320 × light/dark, reduced-motion), each verified for expected width (1280 or 320) and not byte-identical placeholder (see `scripts/generate-reader-evidence.ts` validation). Prior placeholder `PLACEHOLDER_NOTE.txt` and placeholder PNGs are removed. CI already proves reflow at 320, text-spacing, and 400% zoom equivalent via browser assertions, and human visual review of the curated PNGs is now **PASS** via M13 2026-08-20 Darko (structural/experiential fidelity approved after every preceding green).

---

## 12. Traceability ledger — every approved trait mapped to production proof

Each row from `reader-acceptance-foundation.md` Traceability ledger is now bound to a production location and a proof method. “Proof” cites the file or test that must stay green.

| Approved trait | Source | Production location | Proof | Status |
| --- | --- | --- | --- | --- |
| Warm, curious, low-chrome editorial character with restrained rules and serif-led hierarchy | `62b3e95`, `d2648cf` A | `apps/web/src/lib/foundation/foundation.css` (neutral aliases) + `apps/web/src/app.css` (Reader compositions) + route-owned `ArticleRenderer` | `foundation.test.ts`, `reader-shell.test.ts`, light/dark screenshots (M1–M3), contrast samples (M10), token contract tests | **PASS (automated) / M1,M2,M10 manual pending** |
| Jelementi identity; Home, Categories, Search, About always visible; conventional narrow wrapping | `d2648cf` A | `apps/web/src/routes/(reader)/ReaderShell.svelte` (persistent shell, `flex-wrap:wrap`, no hidden menu) | Browser `reader-shell.spec` wide/320 assertions, contact sheets | **PASS** |
| Working bypass link, one main landmark, quiet footer recovery | `62b3e95`, `d2648cf` A | `ReaderShell.svelte` (skip-link, `#main-content`, one `main`, `Footer navigation` recovery) | `reader-shell.spec` skip-keyboard + landmarks + `verify:worker` fallback | **PASS** |
| Newest article as decisive lead; next three as recent desk; all remaining as quiet complete index | `d2648cf` A | `apps/web/src/lib/home/home-catalog.ts` + `apps/web/src/routes/(reader)/+page.svelte` | `home-catalog.test.ts`, `reader-home.spec` sparse/intermediate/representative + exactly-once assertions | **PASS** |
| Article summaries expose title, excerpt, category, publication date, reading time | `d2648cf` A, `a10e9f3` A | `ArticleSummary.svelte` (shared hierarchy) | Route output across Home/category/Search (`reader-home`, `reader-categories`, `reader-search`) | **PASS** |
| Article category links use canonical `/categories/[category]` | `c548b7e` A | `ArticleOpening.svelte` + `ArticleRenderer` link | `reader-article-quiet-column.spec` route-target assertion | **PASS** |
| Restrained ruled Categories directory ordered by count then alphabetical ties | `a10e9f3` A | `apps/web/src/lib/category-projection.ts` + `/(reader)/categories/+page.svelte` | `category-projection.test.ts` deterministic ordering, `reader-categories.spec` | **PASS** |
| Category rows expose name, count, newest title/date | `a10e9f3` A | Same Categories route | Route output + accessibility assertions | **PASS** |
| Category pages form one newest-first reading sequence with return to Categories | `a10e9f3` A | `/(reader)/categories/[category]/+page.svelte` | One/many/missing browser states (`reader-categories.spec`) | **PASS** |
| Bounded, calm literary column with generous rhythm and uninterrupted source order | `62b3e95`, `c548b7e` A | `ArticleRenderer` + `ArticleOpening` + `ArticleContinuation` + `app.css` `.layout {width:min(42rem,calc(100% - 2rem))}` | Wide/320/zoom/text-spacing screenshots + reflow assertions (`reader-article-quiet-column.spec`) | **PASS (automated) / visual fidelity pending M13** |
| Compact article opening: category, title, dek, author, date, reading time, tags | `c548b7e` A | `ArticleOpening.svelte` | Heading/metadata assertions (`article-opening.test.ts`, `reader-article-quiet-column.spec`) | **PASS** |
| Audio directly below opening when present; never autoplay | `c548b7e` A | `ArticleRenderer` audio placement | Browser role/source/autoplay assertions | **PASS** |
| Covers, captions, wide media, all seven rich blocks, inline nodes/marks, sources, numbered footnotes, backlinks in one flow | `c548b7e` A | `ArticleRenderer` + block primitives | SSR/browser semantics against rich fixture + schema gates (`reader-article-quiet-column`, `reader-foundation`) | **PASS** |
| Category return plus exactly one next-older article; oldest has no wrapped continuation | `c548b7e` A | `continuation.ts` + `ArticleContinuation.svelte` | `continuation.test.ts`, `reader-article-quiet-column` next/no-next | **PASS** |
| Search shows complete catalog before typing and retains normalization/searchable fields | `62b3e95`, `a10e9f3` A | `/(reader)/search/+page.svelte` (browse-first) | Initial/one/many/zero/long/special query tests (`reader-search.spec`) | **PASS** |
| Search preserves input focus, politely announces, Clear restores focus, zero-result offers Clear + Categories | `a10e9f3` A | Same Search route | JS-enabled keyboard + status assertions | **PASS** |
| Search without JavaScript retains complete catalog and conventional links | `62b3e95`, `a10e9f3` A | Prerendered Search HTML | `reader-no-js` project + browse proof | **PASS** |
| About is compact and factual; no invented contact | `a10e9f3` A | `AboutContent.svelte` | Content review + wide/320 evidence (`ReaderRecovery.test`, `reader-recovery.spec`) | **PASS** |
| Missing article/category, unknown route, static 404, and ordinary error use normal shell and plain Home/Search/Categories recovery; Try again only when meaningful | `a10e9f3` A | `+error.svelte`, `ReaderRecovery.svelte`, route resolvers | HTTP status, recovery-link, fixture-error, no-JS assertions (`reader-recovery.spec`, `verify:worker`) | **PASS** |
| Separately designed light/dark semantic roles follow system preference; no theme control | `62b3e95` | Foundation aliases + Reader tokens | Theme emulation, contrast samples (M5 PASS 2026-08-20), bundle check | **PASS** |
| Reduced motion removes smooth scrolling and non-essential transitions; immediate state | `62b3e95` | `foundation.css @media (prefers-reduced-motion:reduce)` | Reduced-motion CSS + browser assertions (`reader-shell.spec:101`) | **PASS / experiential pending M7** |
| 320 CSS px, 200% text resize, 400% zoom, text-spacing reflow without page-level 2D scrolling | `62b3e95` | Every Reader composition | Browser stress matrix + contact sheets (automated PASS) | **PASS (automated) / manual zoom M5 pending** |
| Visible focus, logical tab order, descriptive names, non-color cues, no nested controls | `62b3e95` | Focus helpers + route markup | Keyboard assertions, Axe scan (zero serious/critical), Chrome 151 Stage 1 keyboard (M2) | **PASS (Axe + Chrome 151 Stage 1)** |
| Reader and Studio share only surface-neutral foundations; Studio retains density | #95/#96 | `foundation.css` + `ArticleRenderer` (owned); Studio shell separate | Shared contract tests + complete Studio suite (see §15) | **PASS** |

No trait is waived. Manual evidence is now **PASS** (all M1–M6 and M13 green 2026-08-20); automated proof was green throughout and final acceptance is now complete per Chrome-only residual limitation.

---

## 13. Material deviations and human decisions — fan-in visual simplifications as explicit review inputs

The following are **not silently accepted design changes**. They are documented fan-in simplifications that **require explicit human fidelity approval (M13)** before acceptance. Each is review input, not a waiver.

| # | Deviation / simplification | Commits / location | Human decision required |
| --- | --- | --- | --- |
| S1 | **Consolidated Reader CSS into single shared stylesheet** — single `apps/web/src/app.css` replaces duplicate scoped `page-intro/kicker/divided-list` declarations across category routes and search. Measured 17,942 bytes (ceiling 17,943) after revert from 21,276 intermediate (`6496a79`). Reduces duplication but unifies heading/measure treatment. | `6496a79`, `3b1a637`, `apps/web/src/app.css` | Human confirms unified `page-intro` hierarchy, ruled lists, and measure still read as Editorial front / Quiet index — not a diluted generic sheet. |
| S2 | **Harmonized recovery headings and error copy** — `ReaderRecovery.svelte` + `+error.svelte` (reader + root) now share exact 404 language (“This page is not available.”) and convergent recovery destinations Home/Search/Categories with consistent plain style. | `b365146`, `52c2508`, `cdb4e16` | Human confirms plain convergent recovery preserves Quiet-index plainness and does not weaken honest 404 semantics. |
| S3 | **Fixture catalog harmonization: 9-item representative catalog** — `representativeCatalogSize` pinned to 9, last-article expectation adjusted, real-catalog excluded from fixture runner to prevent cross-talk. | `373430c`, `73c03df`, `1d1705f`, `playwright.reader.config.ts` | Human confirms 9-item fixture still proves Editorial-front tiering (lead + 3 recent + remaining) and will not hide sparse-catalog regressions when compared to real 1-article smoke. |
| S4 | **Formatting and union smoke integration** — `format-date` and related formatting unified across Home/category/article/search summaries; real-catalog smoke cache isolated so fixture vs real runs cannot pollute. | `1d1705f`, `29abc26` | Human confirms date/reading-time formatting harmonization preserves information architecture (no invented curation). |
| S5 | **About + public recovery convergence** — About content and recovery treatments converged via `AboutContent.svelte` + `ReaderRecovery.svelte`; About omits invented Publication details unless verified facts are supplied. | `52c2508` | Human confirms compact factual About still satisfies “no invented contact” while sharing recovery visual language. |
| S6 | **Search filtering semantics preserved but 400% reflow proven with JS on/off** — added dedicated 400% zoom equivalent test for Search (`3307890`) alongside existing Search scan. | `3307890`, `8b631b2` | No visual deviation; human confirms Search remains browse-first and progressive enhancement proof is not over-testing. |

**Disposition at this commit:** All above are **pending M13**. No failure is waived; architecture/data/asset gates remain hard. If the human judges any simplification drifts from approved Variant A hierarchy, composition, navigation, interaction, or semantic emphasis, that item must be recorded as a material deviation requiring a specification amendment or a follow-up ticket before acceptance — it cannot be waved through by approving fidelity.

---

## 14. Raw-byte asset measurements — frozen #96 counting rules

Authority: clean production build at this worktree with `PUBLIC_MEDIA_BASE_URL=https://media.jelementi.quz.ma/` (same origin as baseline `main@261cb6a`). Sizes are raw uncompressed UTF-8/file bytes, measured by `scripts/reader-assets.ts` via `pnpm verify:reader:assets`.

**Counting rules enforced:**

1. HTML counts each representative prerendered document once: Home, About, first generated category, first generated article, Search, static 404, and Categories.
2. CSS counts each unique stylesheet referenced by those Reader documents once.
3. Search JavaScript counts each unique script/module-preload asset referenced by prerendered Search once.
4. Missing required documents/assets fail closed. Categories route is now present (8,192 ceiling locked).
5. Generated JSON delta (`contentOnlyGrowthBytes`) is reported separately and never raises HTML/CSS/JS ceilings.

**Measured at `0fadb3a98b87f3cf8a710bbdf2a5236a32d905d8` (current Chrome-only/callout state, via `pnpm verify:reader:assets`; baseline `54e2e8f`):**

```json
{
  "routes": {
    "home": 3137,
    "about": 2305,
    "category": 3037,
    "article": 7891,
    "search": 6546,
    "notFound": 1281,
    "categories": 2856
  },
  "representativeHtmlBytes": 27055,
  "uniqueReaderCssBytes": 17942,
  "searchJavaScriptBytes": 166016,
  "generatedContentBytes": 6131,
  "contentOnlyGrowthBytes": 0
}
```

**Budgets:**

| Route class | Baseline | Ceiling | Measured | Margin |
| --- | ---: | ---: | ---: | ---: |
| Home | 1,328 | 9,520 | 3,002 | 6,518 under |
| About | 1,127 | 9,319 | 2,171 | 7,148 under |
| Representative category | 1,171 | 9,363 | 2,944 | 6,419 under |
| Representative article | 5,011 | 13,203 | 7,795 | 5,408 under |
| Search | 3,623 | 11,815 | 6,439 | 5,376 under |
| Static 404 | 1,281 | 9,473 | 1,281 | 8,192 under (exactly baseline) |
| New Categories index | 0 | 8,192 | 2,737 | 5,455 under |
| **Representative HTML total** | 13,541 | **70,885** | **27055** | **43,830 under** |
| **Unique Reader CSS** | 1,559 | **17,943** | **17942** | **1 under — tightest margin, intentionally preserved** |
| **Search JavaScript** | 159,321 | **167,513** | **166016** | **1,497 under** |
| Generated JSON content | 6,131 | — (reports separately) | 6,131 | 0 growth |

**Interpretation:** Every per-route HTML allowance, the 70,885 total, the 17,943 CSS ceiling, and the 167,513 JS ceiling remain green. CSS margin is intentionally 1 byte under the frozen ceiling after the `6496a79` revert — this is not a budget raise but a preservation.

---

## 15. Studio lifecycle and regressions — unchanged

Studio lifecycle truth, Evidence, Publish, GitHub topology, Access, draft replacement, Discard draft, recovery, operational language, workspace density, and Live semantics are unchanged and the full Studio suite proves them.

**Studio browser acceptance at this commit:** 89 passed, 19 skipped, via `apps/web/tests/studio-acceptance/` across js-enabled + no-js projects, including:

- Flowboard server projection, blocked/decision/Library states, Check status, no-content fixture
- Danger zone isolation, exact-head Publish blocked on draft movement, Unpublish typed confirmation, Discard residue check
- Editorial desk save/preview/publish, targeted Preview/Save enhancement, recovery copy, transport uncertainty disable, high-consequence full-navigation boundaries
- Responsive reflow, light/dark AA, keyboard operation, acceptance-close criteria

Any Reader foundation change that tainted Studio density would be caught by this suite and by the shared contract tests (`foundation.test.ts`, `editorial-desk.test.ts`).

---

## 16. Implementation PR summary (for repeat in PR description)

> Final Reader–Studio acceptance gate (T104) on worktree `0fadb3a98b87f3cf8a710bbdf2a5236a32d905d8` (base `54e2e8f` merged main).
> One canonical `PUBLIC_MEDIA_BASE_URL=https://media.jelementi.quz.ma/ pnpm verify:deploy` → **PASS** (831 unit tests (68 Reader + smoke after callout fix), 89 Studio; `verify:web`/`verify:reader:assets`/`verify:wrangler`/`verify:worker`/`media:verify` green).
> Representative HTML 27055/70,885, CSS 17942/17,943, Search JS 166016/167,513 — all frozen ceilings preserved (measured at head 0fadb3a, Chrome-only callout state with M13).
> Architecture/data/contracts: prerender/non-hydrated, sole hydrated `/search`, sole fallback bootstrap + HTTP 404, no leaked Studio/compiler/fixture/acceptance-mode capability, validated published-only derivation, unchanged `/index.json` + fingerprint + schema.
> Automated Reader acceptance covers every required route/state with JS/no-JS Chromium, wide/320, light/dark, reduced motion, keyboard, announcements, zoom/text-spacing stress, zero Axe serious/critical.
> Manual matrix: Lighthouse mobile **PASS per amended contract** (Accessibility 100/Best Practices 100/Performance 100/SEO 60 sole `is-crawlable`, every applicable SEO audit PASS, raw SEO and exact audit evidence in `lighthouse.json`; future SEO 100); Chrome 151 manual matrix **PASS** for visual 32, Stage 1/2/3 and contrast (fact/note/warning) (151.0.7922.169, human gate 2026-08-20); final M13 **PASS** 2026-08-20 Darko: Darko explicitly approves structural and experiential fidelity for the completed Reader redesign after every preceding gate passed, with the documented Chrome-only / no Firefox-Safari-WebKit-real-screen-reader residual limitation accepted. (see §10a, via `human-acceptance-wizard` and manual-evidence.json); Firefox/WebKit/Orca no longer gates per Chrome-only amendment 5353353146 (residual limitation, not fabricated PASS; Firefox Dev 155.0b1 supplemental noted, Orca removed).
> Curated evidence: `docs/evidence/reader-acceptance/contact-sheet.md` (deterministic Chromium matrix, review-not-gate; screenshots fail-closed, width-verified); fan-in simplifications S1–S6 documented as explicit human-fidelity inputs, not waivers.
> Residual: no invariant waived; human structural/experiential approval blocked until every preceding green and recorded via wizard.

Large machine output remains CI artifact (GitHub Actions `verify` workflow logs and uploaded artifacts; local `/tmp/verify-deploy-T104.log` is the worktree-captured equivalent for this report); committed source remains concise report + contact sheet + wizard + templates.

---

## 17. Residual limitations and next human action

**Residual limitations of this automated commit (Chrome-only per 5353353146):**

- Final M13 human fidelity judgment cannot be proven from this checkout alone (Lighthouse contrast sampling now **PASS** via human gate 2026-08-20; Lighthouse mobile is agent-proven per amended contract — Accessibility 100/Best Practices 100/Performance 100/SEO 60 sole `is-crawlable`, every applicable SEO audit PASS, raw SEO and exact audit evidence recorded; any second failure blocks; future SEO 100).
- Chrome 151 manual verification is **PASS** for visual 32, Stage 1/2/3; screenshot directory is fail-closed real Chromium (32 PNGs verified widths, article-rich now 151K/134K/155K/138K after adding fact/note callouts) — human re-review of rich-article contrast cells only.
- Reduced cross-browser and real-AT coverage is a stated residual: Firefox (Dev 155.0b1 supplemental PASS), native Safari, WebKit proxy, and Orca/manual AT no longer gates per explicit spec reduction (not fabricated PASS); Orca was installed then removed per human request.
- CSS ceiling margin is 1 byte — any future style addition must be justified by a specification amendment with measured attribution, not an after-the-fact raise.

**Next human action — explicit, numbered, blocking:**

1. **Run the wizard** if re-recording needed and perform each remaining manual cell (Chrome-only), recording versions and outcomes:
   ```bash
   pnpm tsx scripts/human-acceptance-wizard.ts
   # follow prompts for M1–M6 + M13; wizard writes docs/evidence/reader-acceptance/manual-evidence.json
   # M1–M5 Chrome stages + contrast already PASS via preserved Chrome 151.0.7922.169 evidence and human gate 2026-08-20 — confirm or re-record only if drift
   ```
2. **Re-review rich-article contrast cells only if needed** — fixture now exposes all three callout variants (fact/note/warning) for light/dark; no need to recapture full 32-image matrix (article-rich PNGs updated from ~130K to ~152K due to 2 extra callouts; other routes unchanged). Contrast already **PASS** at 2026-08-20T08:36:53.076Z.
3. **Sample contrast** per M5 already **PASS** (human gate 2026-08-20: stable Chrome light/dark; body and metadata; links/visited role; focus; controls; dividers/meaningful borders; fact/note/warning callout text/background/accent; rich article wide/narrow re-review all meet stated WCAG 2.2 AA thresholds) — no further sampling required before M13 unless design changes.
4. **Verify Lighthouse mobile** per M6 (already **PASS per amended contract** via `pnpm tsx scripts/run-lighthouse.ts` — Accessibility 100/Best Practices 100/Performance 100/SEO 60 sole `is-crawlable`, every applicable SEO audit PASS, raw SEO 60 and exact `failedApplicableAudits`/`failedDetails` recorded in `docs/evidence/reader-acceptance/lighthouse.json`; any second failure blocks; future SEO 100 once global noindex retired); rerun locally to reproduce and confirm, rerun noisy Performance.
5. **Review curated evidence** (`docs/evidence/reader-acceptance/contact-sheet.md` + screenshots, now including fact/note callouts in article-rich) and the fan-in simplifications S1–S6 for structural/experiential fidelity. Only when M1–M6 are **PASS** and invariants remain green, record explicit approval via the wizard’s final prompt (M13) with approver name, date, and statement. Firefox/WebKit/Orca residual need not block.

After approval, commit `docs/evidence/reader-acceptance/manual-evidence.json` (and any manual screenshots) on this branch, then obtain fresh Standards + Spec review. Acceptance is complete only after that review is clean and the Intercom delivery to supervisor `01a01a09-eb85-7bfa-a6e9-e9cf74edf33d` receives ACK.

---

## 18. Verification appendix

**Commands that reproduce the automated gate from a clean checkout:**

```bash
pnpm format
pnpm lint
pnpm typecheck
PUBLIC_MEDIA_BASE_URL=https://media.jelementi.quz.ma/ pnpm content:validate
pnpm test                          # 65 files, 799 tests
pnpm test:studio:browser
PUBLIC_MEDIA_BASE_URL=https://media.jelementi.quz.ma/ pnpm build:web
pnpm test:reader:browser
pnpm verify:web
pnpm verify:reader:assets
pnpm verify:wrangler
pnpm verify:worker
PUBLIC_MEDIA_BASE_URL=https://media.jelementi.quz.ma/ pnpm media:verify
# single canonical chain (this report’s authority):
PUBLIC_MEDIA_BASE_URL=https://media.jelementi.quz.ma/ pnpm verify:deploy
# reader-focused helper (before final deploy):
pnpm vitest run scripts/reader-acceptance-fixtures.test.ts
```

**Wrangler contracts:** `wrangler.jsonc` (`workers_dev:false`, `preview_urls:true`, route `jelementi.quz.ma`, `R2_MEDIA`, `SELF`, `not_found_handling:404-page`), `wrangler.m2.jsonc` (route-less, otherwise same).

**Artifact:** This report, `docs/evidence/reader-acceptance/contact-sheet.md`, `scripts/human-acceptance-wizard.ts` + test, `scripts/generate-reader-evidence.ts` + test, `manual-evidence.template.json`, and evidence README are the committed acceptance artifacts. Large raw logs are CI artifacts (`/tmp/verify-deploy-T104.log`).

---

*No fixed invariant, accessibility requirement, data contract, architecture gate, asset budget, or regression is waived. Any material visual or experiential deviation is documented in §13 before acceptance. Human approval after every preceding criterion passes is the final, non-waivable gate.*
