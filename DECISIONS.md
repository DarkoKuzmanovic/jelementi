# Decisions

Append-only record of durable product and delivery decisions.
Execution state lives in `PLAN.md` only while a Crew build is in flight;
strategic milestones live in `ROADMAP.md`.

## 2026-07 — Product baseline (from handoff)

- **Primary user for MVP:** Jelena is the sole product compass for the first MVP.
- **Public web, unlisted beta:** site is publicly reachable on `jelementi.quz.ma` with global `noindex`; this phase is **unlisted beta**, not private/closed beta.
- **Public GitHub repo:** source and Markdown draft history are not secret.
- **Android distribution:** private EAS/internal build only; no public Play Store release in MVP.
- **Web-before-Android:** Jelena may use the web beta before the Android MVP is complete.
- **Initial catalog:** 3–5 manually ported Lenkalica articles; no automated migration script; articles are cleaned through Studio later.
- **Optional audio:** audio is optional per article and may be added after text publication.
- **Keep `noindex` until evidence:** do not remove `noindex` until public text/assets are good enough for distribution.
- **R2 backup risk accepted for beta:** R2 may be the only media copy during beta; backup is not an MVP requirement.

## 2026-07 — Language split (from handoff)

- **Serbian:** conversation with Darko, status reports, temporary local planning notes, and this project's handoff narrative.
- **English:** source identifiers, commits, public UI/a11y, articles/metadata, `README.md`, durable public technical docs, ADRs, GitHub issues/PRs.

## 2026-07-26 — M2 grill and delivery (from closed M2 PLAN)

- Additional Crew grill was explicitly skipped because the approved M2 design already passed collaborative design, self-review, and a high-risk advisory pressure-test. Spec: `docs/specs/2026-07-26-m2-cloudflare-web-beta-design.md`.
- Single M2 beta article: `content/articles/tristan-da-cunha.md`.
- R2 assets may be publicly reachable before the article is merged (accepted beta trade-off).
- `main` requires a pull request and the successful GitHub Actions check-run context `verify` before automatic Cloudflare production deployment.
- Preview URLs are enabled only after official Cloudflare Preview URLs Access protection is attached and audited.
- Incident rollback is Cloudflare version rollback, verification, then a normal Git revert pull request.
- Checkpoints A/B/C require fresh explicit user approval at execution time; design approval is not remote-write authority.
- M2.1 and M2.2 shipped on `crew/m2-cloudflare-beta` and merged to `main` (PR #1–#3). Do not continue M2.3 on that branch; a fresh Crew run owns the next branch after its scope checkpoint.

## 2026-07-28 — M2 status at close-out

- M2.1 (local Cloudflare target and media/audio tooling) and M2.2 (R2 delivery + Access-protected branch preview) are done and merged.
- Checkpoint C (production domain, auto-deploy, rollback) and M2.3 remain **closed** until explicit Darko approval in a fresh `/crew` session from merged `main`.
- Production route stays inactive; protected preview is the live remote surface. Operator procedures: `docs/runbooks/cloudflare-m2-operations.md` and `docs/runbooks/checkpoint-c-2026-07-29.md`.

## 2026-08-10 — Known follow-ups (migrated from closed PLAN Deferred)

Not authorization to implement; pick up when related surface is next touched or a Crew run scopes them.

1. **`content:build` AggregateError detail** — rare catastrophic install+restore rename failures preserve the previous output in `generated.backup-*`; improve CLI `AggregateError` detail only when operational recovery work begins.
2. **`scripts/verify-worker.ts` temp-config cleanup** — nest local temporary-config cleanup so it still runs if bounded SIGTERM→SIGKILL reaping itself throws. Low-severity, effectively unreachable under normal Linux process states; fix when the verifier is next touched.

## 2026-08-10 — Crew layout migration

- Closed M2 execution archive (`PLAN.md`) was graduated: durable decisions live here, strategic state in `ROADMAP.md`, evidence in git history. No active Crew DAG until a new run starts for M2.3 / Checkpoint C.
- Merged leftover run branches `crew/m1-content-engine` and `crew/m2-cloudflare-beta` were discarded after merge into `main`.

## 2026-08-10 — Checkpoint C / Stage I

- Darko approved Checkpoint C item 2 only: local M2.3 Stage I implementation. Stages P (push/PR), A (production deploy-command flip + first routed deploy), and the rollback drill remain closed until separately named approvals.
- Stage S completed the same day: `jelementi-workers-build` is the Jelementi Workers Builds token; broad `quzma build token` is retained for the separate `quz.ma` Worker and was not revoked.
- `verify:remote` is the post-deploy production probe; it is not part of `verify:deploy` and must not target Access-protected preview URLs.

## 2026-08-10 — Stage P/A production activation; drill skipped; preview URLs

- Stage P and Stage A completed: production deploy command uses routed `wrangler.jsonc`; `jelementi.quz.ma` is live; `verify:remote` is the production acceptance probe.
- Correct-version rollback drill **skipped** (Darko, 2026-08-11): optional for this personal unlisted beta. Incident recovery remains Cloudflare version deploy to a recorded prior version, or a normal Git revert PR through Workers Builds.
- Production `wrangler.jsonc` must keep `preview_urls: true` with `workers_dev: false`. A production deploy with `preview_urls: false` disables Worker-level version previews (anonymous probes return Cloudflare 404 JSON instead of Access 302). Branch `versions upload` alone did not restore them after Stage A. Access policy on `*-jelementi-web.*.workers.dev` remains the preview gate; do not enable `workers_dev`.
