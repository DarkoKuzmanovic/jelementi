# Reader acceptance evidence — T104 final gate (corrected 7b49b20 → HEAD)

Worktree branch `t104-final-reader-acceptance`. Evidence records the **actual** HEAD being tested (`git rev-parse HEAD` at capture time) and a truthful ISO capture timestamp — no hard-coded `54e2e8f` or pinned `2026-08-19`.

## Contents

- `contact-sheet.md` — deterministic curated visual evidence index (Chromium automated, actual HEAD + timestamp, review-not-gate). Regenerated via `pnpm tsx scripts/generate-reader-evidence.ts`.
- `screenshots/` — **real** deterministic Chromium screenshots for the representative fixture (8 routes × 1280/320 × light/dark = 32 PNGs), each verified for expected width (1280 or 320) and byte size, never a 1×1 placeholder. Chrome 151.0.7922.169 human-verified visual 32-image matrix **PASS** (Chromium automated provides PNGs; human confirms at 1280/320 light/dark). Firefox/WebKit/Orca no longer gates per Chrome-only amendment #104#issuecomment-5353353146 — residual limitation: reduced cross-browser and real-AT coverage (Firefox Dev 155.0b1 supplemental only, Orca removed).
- `lighthouse.json` — concise mobile Lighthouse evidence for `/` (Accessibility 100, Best Practices 100, Performance 100, SEO 60 with `is-crawlable` as the sole failed applicable SEO audit due to immutable global noindex — every other applicable SEO audit PASS, raw SEO score and exact audit evidence recorded; future SEO 100 with no exception once global noindex retired — see amended contract #104#issuecomment-5351661545). Raw `*.json`/`*.html` at `/tmp/lighthouse-T104-*` are CI artifacts, not committed. Performance is rerun if noisy, not waived.
- `manual-evidence.json` — written by `pnpm tsx scripts/human-acceptance-wizard.ts` after a human completes the matrix. Chrome-only per 5353353146: Chrome 151 Stage 1/2/3 (visual 32, interaction, 320 touch + 200/400 zoom, text-spacing + reduced-motion + no-JS) and contrast sampling are **PASS** (human gate 2026-08-20T08:36:53.076Z: stable Chrome light/dark; body and metadata; links/visited role; focus; controls; dividers/meaningful borders; fact/note/warning callout text/background/accent; rich article wide/narrow re-review all meet stated WCAG 2.2 AA thresholds); final M13 **PASS** 2026-08-20 Darko: Darko explicitly approves structural and experiential fidelity for the completed Reader redesign after every preceding gate passed, with the documented Chrome-only / no Firefox-Safari-WebKit-real-screen-reader residual limitation accepted. (recorded 2026-08-20T08:56:33.076Z, HEAD 0fadb3a98b87f3cf8a710bbdf2a5236a32d905d8); Firefox/WebKit/Orca no longer gates (residual limitation: reduced cross-browser and real-AT coverage, not fabricated PASS). Wizard fails closed: derives HEAD via `git rev-parse`, requires invariantsGreen, non-empty notes per PASS.

## Honesty boundary

Chrome 151.0.7922.169 manual matrix is **PASS** for visual 32, Stage 1 interaction, Stage 2 320 touch + 200/400 zoom, Stage 3 text-spacing + reduced-motion + no-JS (preserved evidence, see contact-sheet and report). Contrast sampling **PASS** (human gate 2026-08-20T08:36:53.076Z: stable Chrome light/dark; body and metadata; links/visited role; focus; controls; dividers/meaningful borders; fact/note/warning callout text/background/accent; rich article wide/narrow re-review all meet stated WCAG 2.2 AA thresholds) and final M13 **PASS** 2026-08-20 Darko: Darko explicitly approves structural and experiential fidelity for the completed Reader redesign after every preceding gate passed, with the documented Chrome-only / no Firefox-Safari-WebKit-real-screen-reader residual limitation accepted. — Firefox/WebKit/Orca no longer gates per Chrome-only amendment 5353353146 (spec reduction, not fabricated PASS; residual limitation: reduced cross-browser and real-AT coverage); Firefox Dev 155.0b1 supplemental PASS noted separately; Orca was installed then removed per human request — residual limitation must be stated in final docs. Rich article now exposes all three callout variants (fact/note/warning) for light/dark contrast sampling. Lighthouse **is** agent-capable and is now **PASS per amended contract** (#104#issuecomment-5351661545) — Accessibility 100, Best Practices 100, Performance 100, `is-crawlable` sole failed applicable SEO audit (raw SEO 60, exact audit evidence in `lighthouse.json`; any second failure blocks, future SEO 100 with no exception).

## Commands (from worktree root)

```bash
# Real Chromium matrix (fail-closed, width-verified, no placeholders)
pnpm tsx scripts/generate-reader-evidence.ts
# Dry run (contact sheet only)
pnpm tsx scripts/generate-reader-evidence.ts --dry-run
# Reproducible mobile Lighthouse (loopback preview)
pnpm tsx scripts/run-lighthouse.ts
# Human matrix (remains blocked)
pnpm tsx scripts/human-acceptance-wizard.ts
# fills docs/evidence/reader-acceptance/manual-evidence.json
```
