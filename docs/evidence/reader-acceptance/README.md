# Reader acceptance evidence — T104 final gate

Worktree commit: `54e2e8f` (branch `t104-final-reader-acceptance`, base `54e2e8f` merged main)
Generated: 2026-08-19 via `pnpm tsx scripts/generate-reader-evidence.ts --dry-run`

## Contents

- `contact-sheet.md` — deterministic curated visual evidence index (Chromium automated + honest manual gaps)
- `screenshots/` — Chromium screenshots (wide 1280 / narrow 320, light/dark, reduced-motion). Best-effort automated capture; directory may be empty until a human runs `pnpm tsx scripts/generate-reader-evidence.ts` on a machine with Playwright browsers. Contact sheet already marks Firefox/WebKit/touch as **BLOCKED_PENDING_HUMAN**.
- `manual-evidence.json` — written by `pnpm tsx scripts/human-acceptance-wizard.ts` after a human completes the matrix. Initially **BLOCKED_PENDING_HUMAN** for all manual cells.

## Honesty boundary

No manual Firefox, coarse-pointer/touch, Orca, contrast sampling, keyboard-only experiential, zoom/text-spacing, or human structural/experiential approval is claimed here. The report honestly marks those cells **BLOCKED_PENDING_HUMAN** and provides the wizard to fill them.

Run the wizard:

```bash
pnpm tsx scripts/human-acceptance-wizard.ts
# fills docs/evidence/reader-acceptance/manual-evidence.json
```

Run curated capture (Chromium only, best-effort):

```bash
pnpm tsx scripts/generate-reader-evidence.ts
```
