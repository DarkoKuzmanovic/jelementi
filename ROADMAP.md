# Jelementi roadmap

**Status:** active

## Released

- **M0** — Bootstrap the monorepo and prove the shared `ArticleDocument` → web/WebView architecture.
- **M1** — Build the Markdown content engine and complete the static web reader.
- **M2** — Unlisted Cloudflare web beta with R2 media. Production `https://jelementi.quz.ma` auto-deploys from `main` (`noindex`); Access-protected Worker version previews; immutable `media.jelementi.quz.ma`. Checkpoint C complete 2026-08-11. Correct-version rollback drill skipped by choice (recovery: version deploy or Git revert PR).

## Current

- **M3** — Add the minimal Access-protected publishing Studio. Design approved (`specs/m3-studio.md`, ADRs 0001–0004); work tracked as GitHub issues T0–T8 (#11–#20). T0–T4 done (route shell + auth guard, GitHub adapter, article list, editor + preview, save draft with concurrency — merged in PR #21). Remaining: T5 publish (#17), T6 unpublish/discard (#18), T7 regression tests (#19), T8 runbook + checkpoints A–D (#20).

## Planned

- **M4** — Deliver the private Android shell with trusted navigation and push.
- **M5** — Add native background audio and lock-screen controls.
- **M6** — Publish the initial migrated beta catalog and complete MVP hardening.
