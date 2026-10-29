# Jelementi roadmap

**Status:** active

## Released

- **M0** — Bootstrap the monorepo and prove the shared `ArticleDocument` → web/WebView architecture.
- **M1** — Build the Markdown content engine and complete the static web reader.
- **M2** — Unlisted Cloudflare web beta with R2 media. Production `https://jelementi.quz.ma` auto-deploys from `main` (`noindex`); immutable `media.jelementi.quz.ma`.
- **Reader** — Second-edition Home, sections, article, search and small-page design; podcast feed, article series, full-text article feed, series e-books and date study cards, link previews.

## Retired

- **M3 Studio** (2026-10-24) — Built, then never used for publishing: every story since August shipped through the agent workflow. Removed with its ADRs; `pnpm ship` replaces it. Recover it from git history if ever needed.

## Planned

- **M4** — Deliver the private Android shell with trusted navigation and push.
- **M5** — Add native background audio and lock-screen controls.
- **M6** — Publish the initial migrated beta catalog and complete MVP hardening.
