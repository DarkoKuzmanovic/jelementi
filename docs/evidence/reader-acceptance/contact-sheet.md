# Reader acceptance — deterministic curated evidence

Generated: 2026-08-20T05:22:11.009Z | Commit: dc880029b02a9f2a349d6301a944ffe9b3801cac

Deterministic curated evidence — review, not gate. No pixel-diff CI assertion.

## Asset ceilings (frozen #96 counting rules)

| Surface | Measured | Ceiling | Status |
| --- | ---: | ---: | --- |
| Representative HTML total | 26369 | 70885 | PASS |
| Unique Reader CSS | 17942 | 17943 | PASS |
| Search JavaScript | 165878 | 167513 | PASS |

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

## Manual matrix — honestly marked

All genuinely manual checkpoints remain **BLOCKED_PENDING_HUMAN** until a human performs and records them; Lighthouse is **PASS per amended contract** (agent-run, reproducible) — see below:

- Firefox stable desktop (wide/320, light/dark, reduced motion, keyboard, zoom 100/200/400, text spacing, no-JS) — **BLOCKED_PENDING_HUMAN**
- Playwright WebKit explicitly as Safari proxy — **BLOCKED_PENDING_HUMAN**
- Coarse-pointer / touch mobile viewport — **BLOCKED_PENDING_HUMAN**
- 100% / 200% / 400% zoom cells at representative routes — **BLOCKED_PENDING_HUMAN** (Chromium 320 + text-spacing automated; manual zoom still required)
- Text spacing (WCAG 1.4.12) overrides — **BLOCKED_PENDING_HUMAN**
- Contrast sampling (semantic text, links/visited, focus, controls, borders, metadata, every callout state, light+dark, WCAG 2.2 AA 4.5:1/3:1) — **BLOCKED_PENDING_HUMAN**
- Orca + Firefox on Linux journey (shell/skip/landmarks, Home hierarchy, rich article with audio/footnotes, Categories, Search initial/result/zero/clear, About, 404, ordinary error) — **BLOCKED_PENDING_HUMAN**
- Lighthouse mobile: **PASS per amended contract #104#issuecomment-5351661545** — Accessibility 100, Best Practices 100, Performance 100, SEO 60 with `is-crawlable` as the sole failed applicable SEO audit (every other applicable SEO audit PASS, raw SEO 60 and exact audit evidence in `lighthouse.json`; any second failure blocks; future SEO 100 with no exception once global noindex retired) — **PASS** (agent-run, reproducible via `pnpm tsx scripts/run-lighthouse.ts`)
- Human structural and experiential fidelity approval — **BLOCKED_PENDING_HUMAN** (only after every preceding green; never waives failed invariant)

Use `pnpm tsx scripts/human-acceptance-wizard.ts` to fill `docs/evidence/reader-acceptance/manual-evidence.json`.
