# Studio prototype → production comparison — 2026-08-19 (#79)

Closes #79 criterion 8: structural and experiential comparison against the
approved prototypes — Flowboard `dbc96f1` and Editorial desk `7238079` — with
no unresolved hierarchy, action, evidence, or small-screen gap.

**Branch:** `t79-studio-close-acceptance` · **Base:** `feffd1e` (PR #85)
**Date:** 2026-08-19 · **Reviewer:** single-operator pass on `/home/quzma/.herdr/worktrees/jelementi/t79-studio-close-acceptance`

Prototype refs (never merged to `main`):

* Flowboard — `origin/prototype/studio-resume-work-home` @ `dbc96f1`
  (`apps/web/src/routes/studio/prototype-home/+page.svelte`, 2699 lines)
* Editorial desk — `origin/prototype/studio-editor-status-workspace` @ `7238079`
  (`apps/web/src/routes/prototype/studio-editor-status/+page.svelte`, 1429 lines)

Both prototype routes are absent from `main` and from this branch (verified
by `git show-ref | grep prototype` — only the remote tracking refs exist;
no local checkout touches `.pi/agent` or `~/.pi/agent`).

## 1. What the prototypes explored vs what shipped

| Concern | Prototype decision (evidence) | Production decision (where it lives) | Gap? |
|---|---|---|---|
| **Flowboard hierarchy** | Three columns: *Resume work / Ready for your decision / Library* (`variant B`, `flowboard-grid: repeat(3, 1fr)`, ≤1024 → `1fr`) | Same three columns, same order, same ≤1024 stack (`StudioFlowboard.svelte`: `columns: repeat(3,minmax(0,1fr))` → `@media (max-width:1024px) { grid-template-columns:1fr }`). Headings `Resume work`, `Ready for your decision`, `Library` preserved. | None |
| **Flowboard responsive** | ≤1024 single-column; ≤640 toolbar column; prototype switcher excluded from prod | ≤1024 single-column; ≤760 toolbar adapts; ≤640 toolbar stacks; ≤400 `calc(100vw-20px)` — matches 320 px contract. Viewed and proven by `studio-acceptance-close.spec.ts:48,70`. | None |
| **Flowboard actions per card** | Per-card Publish/Edit/Fix/Check affordance (mock state machine) | Per-card primary action + secondary `Check status` form; server-derived `card.projection.publishedVersion`/`workingChange` labels always present. | None (higher fidelity: real lifecycle) |
| **Editorial desk grid** | Two layout families: `three-pane-desk: minmax(21rem,1fr) minmax(21rem,1fr) minmax(18rem,0.72fr)` (variant B) and `editor-preview-split: minmax(20rem,1fr) minmax(18rem,0.9fr)` (variant A). Breakpoints: ≤1120 `1fr 1fr` (status spans), ≤760 `1fr` stacked. | Single layout: `StudioEditorialDesk.svelte: minmax(22rem,1fr) minmax(22rem,1fr) minmax(18rem,20rem)` — within rounding of B's widths; same breakpoints `1120` / `760` / `400` with identical span semantics. Publication column sticky desktop → static intermediate. Proven by `studio-acceptance-close.spec.ts:124`. | None (width rounding only; hierarchy identical) |
| **Editor fields** | Metadata field-grid `1fr 1fr` → `1fr` at ≤640; `<details> More metadata` with nested fields; body textarea `body-editor` | Same: `StudioEditor.svelte` `field-grid: repeat(2,minmax(0,1fr))` → `minmax(0,1fr)` at ≤640; `<details class="studio-editor__metadata">` with identical fields; body `#studio-body` bound to live form candidate. | None |
| **Preview** | Scenario-bound prose preview per `ScenarioKey` (new/dirty/invalid/ready/conflict/checking/failed/live) | Real compiler preview: `StudioPreviewPane` renders current unsaved form through `@jelementi/content-compiler`; server-authored envelope never invents lifecycle. Scenario coverage now lives in `studio-recovery.spec.ts` via real save-conflict/failure/replacement journeys. | None (real compiler replaces mock prose) |
| **Publication / evidence** | Tone-coded scenario summary + evidence table per state; danger actions gated by typed slug | `StudioPublishPanel` + `StudioEvidenceDisclosure` (`<details>`) with sanitized, per-status evidence rows (SHA, PR, check, probe timestamp); same two-axis model; typed-slug confirmation via `StudioDestructiveConfirmation` dialog/fallback. | None (real evidence, same disclosure pattern) |
| **Danger zone** | Not a prototype concept — added in #76 | `StudioDangerZone` disclosure + modal dialog (`StudioDestructiveConfirmation`) with Cancel autofocus, Tab trap, `Escape` restore, server-side 400 on stray click. | None (net-new feature post-prototype) |
| **Selective enhancement & recovery** | Not a prototype concept — planned in `specs/2026-08-13-m3-publishing-studio-design.md` §12 and ADR 0008 | `#78` shipped targeted enhancement (Preview/Save/Check in-place via decoded envelope), bounded per-article `sessionStorage` recovery, transport uncertainty/disabled fallback. Automated in `studio-enhancement.spec.ts` + `studio-recovery.spec.ts`. | None |
| **Theme / tokens** | Prototype used ad-hoc CSS vars | Production locked `tokens.css` `.studio-shell` semantic tokens with `prefers-color-scheme: dark` swap; every Studio surface reads only the tokens. WCAG AA proven in `studio-acceptance-close.spec.ts:171`. | None (intentionally narrowed; no gap) |
| **Routes** | `/studio/prototype-home` and `/prototype/studio-editor-status` — both development-only (`if (!dev) throw`) | Real routes: `/studio`, `/studio/articles/new`, `/studio/articles/[slug]`; no switcher, no variant query param. | None (switchers removed by design — see §2) |
| **Small-screen** | Both prototypes stacked at ≤640/≤760 but had no 320 px / 400 % contract | Production adds explicit 320 px proof (no page-level two-axis, stacked order preserved) per `studio-acceptance-close.spec.ts:48,70,93`. | None (contract tightened) |

## 2. What was intentionally dropped (no open gap)

All of the following were prototype-only mechanics whose behavior transferred
or was explicitly superseded — their removal is itself the close proof,
tracked in §3 of `studio-browser-matrix-2026-08-19.md`.

| Removed surface | Why it was prototype-only | Where the behavior now lives |
|---|---|---|
| Variant switcher (`?variant=A|B|C`, ←/→ arrow cycling) and `DemoState` switcher (`active|blocked|live|empty`, `ScenarioKey` 8-way) | Design exploration — pick one approved structure and ship it | Variant **B** (Flowboard) and variant **B** (Editorial desk) are the shipped layouts; the other variants are not code paths in production. |
| `mockDatasets` / `scenarios` fixtures and `mockDemoDatasets` | Static mock data standing in for the GitHub-derived lifecycle | Real deterministic fake-GitHub world (`acceptance-bootstrap.server.ts`) + real `flowboard-projection` / `workspace-projection` / `lifecycle.server` truth. |
| `app.html` prototype asset preloads | Prototype-only static assets | No production route references them. |
| `routes/studio/prototype-home/+page.ts` + `routes/prototype/studio-editor-status/+page.ts` dev-only loaders | Gated prototype mounts | No import chain references them on `main`; `verify-web.ts` scans the client bundle for acceptance strings. |
| Simulated actions / lifecycle transitions (prototype `updateVariant` / `updateUrl` history-replace) | Approximated GitHub writes without a real GitHub boundary | Real server actions `?/save`, `?/preview`, `?/publish`, `?/refresh`, `?/unpublish`, `?/discard`, `?/replace` with `verify:deploy` wrangler-contract enforcement that `STUDIO_ACCEPTANCE_MODE` never ships. |

No remaining prototype surface needs removal — `main` at `feffd1e` already
carries only the production Flowboard/Editorial desk. The acceptance fixture
surface (`STUDIO_ACCEPTANCE_MODE`, fake GitHub, `x-studio-acceptance-*`
headers, flowboard empty-state header) must stay because the `102`-test
browser suite depends on it and it fails closed in production
(`acceptance-bootstrap.server.ts:isStudioAcceptanceMode()` +
`verify-deploy.ts:verifyWranglerContract()` + `verify-web.ts` bundle scan).

## 3. Experiential parity — what the operator would notice before vs now

* **Spatial hierarchy:** identical three-column / three-pane intent at desktop,
  same stacking decision at narrow widths. An operator moving from the
  prototype's Variant B to production would land in the same spatial map.
* **Information density:** every status the prototype summarized with mock
  prose (ready, checking, check_failed, merged, pending_deployment, live,
  conflict, failed) is now carried by real evidence rows on the same
  panels — no information loss.
* **Keyboard/destructive flow:** the prototype had no keyboard or destructive
  flow beyond focus-visible — production adds that flow and it is proven
  (`studio-danger-zone.spec.ts`, `studio-acceptance-close.spec.ts:337`).
* **Responsive feel:** the prototype stacked at ~1024/760 but never had the
  320 px/400 % guarantee — production adds it and it is automated.

## 4. Verdict

**No unresolved gap.** The two approved prototypes' structural decisions
(column order, desktop grid, intermediate span, stacked order) and
experiential decisions (separated Published/Working axes, evidence
disclosure, actionable validation, destructive confirm) are all present in
production Studio on `t79-studio-close-acceptance` at 320–1280 px, light and
dark. Prototype-only switchers, fixture lifecycle authority, simulated
actions, and prototype-only routes/assets are absent from production as
intended; the remaining `STUDIO_ACCEPTANCE_MODE` surface is production-
fail-closed and intentionally retained.
