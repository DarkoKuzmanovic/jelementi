# Reader acceptance evidence — T104 final gate (corrected 7b49b20 → HEAD)

Worktree branch `t104-final-reader-acceptance`. Evidence records the **actual** HEAD being tested (`git rev-parse HEAD` at capture time) and a truthful ISO capture timestamp — no hard-coded `54e2e8f` or pinned `2026-08-19`.

## Contents

- `contact-sheet.md` — deterministic curated visual evidence index (Chromium automated, actual HEAD + timestamp, review-not-gate). Regenerated via `pnpm tsx scripts/generate-reader-evidence.ts`.
- `screenshots/` — **real** deterministic Chromium screenshots for the representative fixture (8 routes × 1280/320 × light/dark = 32 PNGs), each verified for expected width (1280 or 320) and byte size, never a 1×1 placeholder. The prior placeholder `PLACEHOLDER_NOTE.txt` and placeholder PNGs are removed in the final evidence set. Firefox/WebKit/touch remain **BLOCKED_PENDING_HUMAN** (contact sheet table explicitly marks them).
- `lighthouse.json` — concise mobile Lighthouse evidence for `/` (Accessibility 100, Best Practices 100, SEO 100, Performance ≥90, version + URL + commit). Raw `*.json`/`*.html` at `/tmp/lighthouse-T104-*` are CI artifacts, not committed. Performance is rerun if noisy, not waived.
- `manual-evidence.json` — written by `pnpm tsx scripts/human-acceptance-wizard.ts` after a human completes the matrix. Initially **BLOCKED_PENDING_HUMAN** for all genuinely manual cells (Firefox, coarse-pointer/touch, WebKit proxy, 100/200/400 zoom, text spacing, reduced motion experiential, keyboard-only, no-JS experiential, contrast sampling, Orca+Firefox journey). Wizard now fails closed: it derives HEAD via `git rev-parse`, requires invariantsGreen confirmation, and requires non-empty notes per PASS.

## Honesty boundary

No manual Firefox, coarse-pointer/touch, WebKit real-device, Orca, contrast sampling, keyboard experiential, zoom/text-spacing, or human structural/experiential approval is claimed. The report and contact sheet honestly mark those **BLOCKED_PENDING_HUMAN** until a human records them. Lighthouse **is** agent-capable and is now recorded here.

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
