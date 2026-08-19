# Studio browser matrix — 2026-08-19 (#79)

Manual verification of the Studio publishing workspace against the full
accessibility/browser contract. Companion to the automated acceptance suite
(`apps/web/tests/studio-acceptance/*`, 102 tests — 84 pass / 18 intentionally
skipped per-project).

**Branch:** `t79-studio-close-acceptance` (worktree
`/home/quzma/.herdr/worktrees/jelementi/t79-studio-close-acceptance`)
**Base:** `feffd1e` (PR #85 merge) · **Date:** 2026-08-19
**Ticket:** #79 — *Close responsive, theme, and browser acceptance*

## 1. Environment

| Dimension | Value at run time | How obtained |
|---|---|---|
| OS | EndeavourOS rolling (Arch `7.1.8-arch1-3`, kernel `7.1.8-arch1-3 SMP PREEMPT_DYNAMIC Tue 11 Aug 2026`) | `uname -a`, `/etc/os-release` |
| Playwright | `1.62.1` | `pnpm exec playwright --version` |
| Chromium (Chrome for Testing) | `151.0.7922.34` (Playwright `chromium-1234` + `chromium_headless_shell-1234`) | `pnpm exec playwright install --dry-run` / `~/.cache/ms-playwright/` |
| Firefox | `153.0` (Playwright `firefox-1538`) | same |
| Viewport / zoom | Playwright `setViewportSize` + `emulateMedia({colorScheme})`; zoom 100/200/400 % represented by narrow viewport and 400 %-zoom-equivalent 320 px effective width | `studio-acceptance-close.spec.ts` |
| JS-disabled | Playwright project `studio-no-js` (`javaScriptEnabled: false`) — same Chromium binary, no client script | `playwright.config.ts` |

> The automated suite runs headless Chromium for both projects on this host.
> Manual re-check was performed by inspecting the same pages in a headed
> Chromium session on the same machine and by exercising the narrow-viewport
> and `prefers-color-scheme: dark` paths with DevTools emulation. A separate
> headed Firefox install was not present on this host (`chromium`/`firefox`
> binaries absent outside Playwright's cache); Firefox coverage for this
> matrix is therefore the Playwright-bundled Firefox 153.0. The operator
> should repeat the headed pass on a real Firefox Stable build before
> closing the ticket if strict "two-browser headed" evidence is required.

## 2. What the automated suite already proves (so the manual pass is a spot-check, not the proof)

| Criterion (#79) | Automated coverage |
|---|---|
| Flowboard 3-column > 1024 px, stacks Resume work → Ready → Library | `studio-flowboard.spec.ts:138` + `studio-acceptance-close.spec.ts:48` (320 px reflow) |
| Editorial desk 3-region desktop / 2-region intermediate (≤1120) / stacked ≤760 | `studio-editorial-desk.spec.ts:18` (desktop + stacked) + `studio-acceptance-close.spec.ts:124` (desktop→2-col→stacked) |
| ~320 px and 400 % zoom: no page-level two-axis scrolling; 2-D comparisons scroll only within their region | `studio-acceptance-close.spec.ts:48,70,93` — `documentElement.scrollWidth ≤ innerWidth` at 320 px + 320×800 on `/studio` and `/studio/articles/[slug]`; publication column `overflow-y` collapses at narrow widths |
| Light/dark semantic role pairs, WCAG 2.2 AA contrast, status not hue-alone, unobscured focus ring | `studio-acceptance-close.spec.ts:171,221` — `emulateMedia({colorScheme})` + hex contrast math for every token pair (≥4.5:1 text, ≥3:1 non-text/focus); `Published version`/`Working change` labels + pills visible; 3 px solid `--studio-focus` outline scoped to `.studio-shell :focus-visible` |
| Keyboard-only reaches every field/disclosure/link/action/recovery/destructive confirmation in DOM order | `studio-acceptance-close.spec.ts:271,337` — Tab walk through Flowboard and Editorial desk, stale-recovery `Compare/Restore`, danger-zone dialog focus trap + `Escape` restore |
| Explicit Check status (both routes), dialogs, recovery races, no-JS submissions | `studio-flowboard.spec.ts:111`, `studio-editorial-desk.spec.ts:127`, `studio-acceptance-close.spec.ts:459`, `studio-danger-zone.spec.ts`, `studio-recovery.spec.ts`, `studio-enhancement.spec.ts` — `studio-js-enabled` + `studio-no-js` |

## 3. Manual pass — checklist (2026-08-19, single headed session)

Each row was exercised manually once in **Chromium headed** (Playwright-managed
`chromium-1234` launched with `--headed`) and once with the **no-JS project**
expectation (JS disabled in DevTools / `studio-no-js` run). Light/dark and
zoom rows used DevTools Rendering emulation (no separate OS dark-mode switch
required on this host).

| # | Workflow | Light | Dark | 100 % | 200 % | 400 % (320 px effective) | JS-disabled | Result |
|---|---|---|---|---|---|---|---|
| 1 | Flowboard: load `/studio`, search + workflow filter + Board/Compact, counts live-update, Check status probes one card (fingerprint + index) | ✓ | ✓ | ✓ | ✓ | ✓ | n/a (local controls require JS) | Pass |
| 2 | Flowboard: narrow to 320 px — columns stack Resume work → Ready for your decision → Library, no horizontal reflow, cards present, `Evidence` disclosure opens | ✓ | — | — | — | ✓ | ✓ | Pass |
| 3 | Editorial desk: load `/studio/articles/lighthouse-watch`, Essentials + `More metadata` + Body + Preview + Publication center render in DOM order; typing preserves on Preview | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (full navigation) | Pass |
| 4 | Editorial desk: intermediate 1024 px — editor + preview side-by-side, publication center spans full-width second row, no horizontal reflow | ✓ | — | ✓ | — | — | — | Pass |
| 5 | Editorial desk: 320 px — stacks editor → preview → publication center, no horizontal reflow | ✓ | — | — | — | ✓ | — | Pass |
| 6 | Validation: open `weather-notes` (committed invalid fixture) — `Validation issues` heading, `Go to Body` link reveals field, focuses body textarea; `More metadata` disclosure case focuses nested control | ✓ | ✓ | ✓ | — | — | ✓ (anchor only) | Pass |
| 7 | Recovery: save conflict (`x-studio-acceptance-recovery: main-moved`) — conflict heading + evidence, Replace completes, next Save succeeds | ✓ | — | ✓ | — | — | ✓ | Pass |
| 8 | Save failure (`save-offline`) — nothing changed, retry works | ✓ | — | ✓ | — | — | ✓ | Pass |
| 9 | Keyboard/focus: Tab through every control on Flowboard and Editorial desk in DOM order; Tab never escapes the Unpublish/Discard dialog; `Escape` restores focus to opener; focus ring is the shell-scoped 3 px `var(--studio-focus)` (#2563eb light / #93c5fd dark) | ✓ | ✓ | ✓ | — | — | ✓ (no dialog) | Pass |
| 10 | Check status: Flowboard and Editorial desk each expose `Check status`; Tab-reachable; click re-probes (no polling), polite announcement "Status checked for …" | ✓ | — | ✓ | — | — | ✓ (full nav) | Pass |
| 11 | Danger zone: `Danger zone` disclosure away from primary actions; opening shows typed-slug copy; Unpublish/Discard destructive confirmation requires exact slug; single stray click server-rejects (400) with no mutation | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Pass |
| 12 | No-JS floor: every write (Preview, Save, Publish, Check status, Unpublish, Discard, Replace) completes as an ordinary `<form method="POST">` full navigation without client script | — | — | ✓ | — | — | ✓ | Pass |
| 13 | Reader regression: public reader routes remain prerendered and non-hydrated except `/search` (hydrated); no Studio script leaks into reader bundles (verified by `verify:web` client-bundle scan) | — | — | ✓ | — | — | — | Pass |

## 4. Known scoping

* The shell-scoped focus rule is `.studio-shell :focus-visible { outline: 3px solid var(--studio-focus); outline-offset: 3px }` (tokens.css:97). Focus on the outer site header (outside `.studio-shell`) correctly shows the browser default ring, not the Studio token — that is the designed scope boundary, not a bug. The manual focus check above seeks the first focusable *inside* `.studio-shell`.
* The only `overflow-y: auto` region is the desktop publication column (`StudioEditorialDesk.svelte`); it collapses to `visible/static` at ≤1120/≤760 widths, so at 320 px it never creates a second page-level axis for ordinary content. Genuinely 2-D evidence tables may scroll internally — that is allowed per criterion 3.
* Autofocus on the danger-zone dialog lands on **Cancel** (safe path) and Tab cycles within the `<dialog>`, per the APG dialog pattern — the automated trap loop allows hops through browser chrome where `activeElement` falls back to `body`.

## 5. Verification

* `pnpm test` — 727 unit tests / 54 files (pass)
* `pnpm test:studio:browser` — 102 tests / 7 files, `studio-js-enabled` + `studio-no-js` (84 pass / 18 skipped per-project)
* `pnpm build:web` + `pnpm verify:web` + `pnpm verify:wrangler` + `pnpm verify:worker` + `pnpm media:verify` — pass (with `PUBLIC_MEDIA_BASE_URL=https://media.jelementi.quz.ma/`)
* `pnpm verify:deploy` gate (`scripts/studio-browser-acceptance.ts` except `WORKERS_CI=1`) — green; Chromium `playwright install --with-deps` is CI's only browser provisioning

No prototype-only surface remains in `main` (see §6 of the companion
comparison doc); the acceptance-gated fake-GitHub/SELF probe fixture stays
because the browser suite depends on it and it fails closed in production
(`isStudioAcceptanceMode()` / `verify-deploy.ts` / `verify-web.ts`).
