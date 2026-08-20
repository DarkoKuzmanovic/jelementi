# Reader acceptance — deterministic curated evidence

Generated: 2026-08-20T08:28:36.217Z | Commit: 0fadb3a98b87f3cf8a710bbdf2a5236a32d905d8

Deterministic curated evidence — review, not gate. No pixel-diff CI assertion.

## Asset ceilings (frozen #96 counting rules)

| Surface | Measured | Ceiling | Status |
| --- | ---: | ---: | --- |
| Representative HTML total | 27055 | 70885 | PASS |
| Unique Reader CSS | 17942 | 17943 | PASS |
| Search JavaScript | 166016 | 167513 | PASS |

Per-route HTML ceilings: Home 9,520; About 9,319; category 9,363; article 13,203; Search 11,815; 404 9,473; Categories 8,192.

## Curated screenshot matrix (Chromium automated)

Chromium automated via Playwright `reader-js-enabled` at representative fixture. Each cell is 1280 wide and 320 narrow, light and dark, reduced-motion where noted.

| Route | Path | 1280 light | 1280 dark | 320 light | 320 dark |
| --- | --- | --- | --- | --- | --- |
| Home (Editorial front — complete catalog) | `/` | `home--light--1280.png` | `home--dark--1280.png` | `home--light--320.png` | `home--dark--320.png` |
| Categories (Quiet index directory) | `/categories` | `categories--light--1280.png` | `categories--dark--1280.png` | `categories--light--320.png` | `categories--dark--320.png` |
| Category — Field Notes (newest-first sequence) | `/categories/field-notes` | `category-field-notes--light--1280.png` | `category-field-notes--dark--1280.png` | `category-field-notes--light--320.png` | `category-field-notes--dark--320.png` |
| Article — rich column with audio, footnotes, 7 blocks | `/articles/acceptance-rich-column` | `article-rich--light--1280.png` | `article-rich--dark--1280.png` | `article-rich--light--320.png` | `article-rich--dark--320.png` |
| Article — sparse without audio (representative fixture) | `/articles/acceptance-no-audio-long-column` | `article-sparse--light--1280.png` | `article-sparse--dark--1280.png` | `article-sparse--light--320.png` | `article-sparse--dark--320.png` |
| Search (browse-first, progressive enhancement) | `/search` | `search--light--1280.png` | `search--dark--1280.png` | `search--light--320.png` | `search--dark--320.png` |
| About (compact factual) | `/about` | `about--light--1280.png` | `about--dark--1280.png` | `about--light--320.png` | `about--dark--320.png` |
| Static 404 fallback (normal shell, HTTP 404) | `/unknown-reader-acceptance-route` | `404--light--1280.png` | `404--dark--1280.png` | `404--light--320.png` | `404--dark--320.png` |

Screenshots saved under `docs/evidence/reader-acceptance/screenshots/` (git-tracked). Review them visually; do not add pixel-diff CI gates.

## Manual matrix — Chrome-only per #104#issuecomment-5353353146

Chrome manual matrix honestly marked; Firefox/WebKit/Orca no longer gates (spec reduction, not fabricated PASS) — see residual limitation below. Lighthouse is **PASS per amended contract** (agent-run, reproducible) — see below:

- Chrome stable desktop 151.0.7922.169 — visual 32-image matrix (8 routes × 1280/320 × light/dark, width-verified) — **PASS** (human verified, Chromium automated provides 32 PNGs)
- Chrome 151 Stage 1 interaction (shell/skip/landmarks, Home hierarchy, rich article with audio/footnotes, Categories, Search, About, 404) — **PASS**
- Chrome 151 Stage 2 — 320px touch + 200%/400% zoom cells at representative routes, no 2D scrolling — **PASS**
- Chrome 151 Stage 3 — WCAG 1.4.12 text-spacing + reduced-motion + no-JS (Search complete catalog) — **PASS**
- Coarse-pointer / touch mobile viewport — **PASS via Chrome Stage 2** (at least one coarse-pointer/touch viewport verified at 320px)
- 100% / 200% / 400% zoom cells at representative routes — **PASS via Chrome Stage 2** (reflow preserved, no page-level 2D scrolling)
- Text spacing (WCAG 1.4.12) overrides — **PASS via Chrome Stage 3**
- Reduced motion manual verification — **PASS via Chrome Stage 3**
- Keyboard-only traversal — **PASS via Chrome Stage 1**
- No-JavaScript manual behavior — **PASS via Chrome Stage 3**
- Contrast sampling (semantic text, links/visited, focus, controls, borders, metadata, every callout state fact/note/warning, light+dark, WCAG 2.2 AA 4.5:1/3:1) — **PASS** — Human contrast gate PASS: stable Chrome light/dark; body and metadata; links/visited role; focus; controls; dividers/meaningful borders; fact/note/warning callout text/background/accent; rich article wide/narrow re-review all meet stated WCAG 2.2 AA thresholds.
- Firefox stable / WebKit proxy / Orca+Firefox journey — **no longer gates per Chrome-only amendment 5353353146** (Firefox Dev Edition 155.0b1 supplemental PASS noted separately; Orca was installed then removed per human request) — residual limitation: reduced cross-browser and real-AT coverage
- Lighthouse mobile: **PASS per amended contract #104#issuecomment-5351661545** — Accessibility 100, Best Practices 100, Performance 100, SEO 60 with `is-crawlable` as the sole failed applicable SEO audit (every other applicable SEO audit PASS, raw SEO 60 and exact audit evidence in `lighthouse.json`; any second failure blocks; future SEO 100 with no exception once global noindex retired) — **PASS** (agent-run, reproducible via `pnpm tsx scripts/run-lighthouse.ts`)
- Human structural and experiential fidelity approval — **PASS** — 2026-08-20 Darko: Darko explicitly approves structural and experiential fidelity for the completed Reader redesign after every preceding gate passed, with the documented Chrome-only / no Firefox-Safari-WebKit-real-screen-reader residual limitation accepted. (only after every preceding green; never waives failed invariant) — recorded in `manual-evidence.json` 2026-08-20T08:56:33.076Z

Use `pnpm tsx scripts/human-acceptance-wizard.ts` to fill `docs/evidence/reader-acceptance/manual-evidence.json`.
