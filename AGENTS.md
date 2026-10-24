# Maintainer contract

Jelementi is a small personal magazine (mainly for Lenka). Keep the process light: guard the content model and the live site, nothing more.

## Ownership boundaries

- `@jelementi/article-model` owns the framework-neutral `ArticleDocument`, index schemas, and shared search normalization. It does not parse Markdown or touch the filesystem/environment.
- `@jelementi/content-compiler` owns pure Markdown-to-model transformation from explicit content, source path, and media base URL; no filesystem I/O or process environment.
- Root scripts own filesystem discovery, environment loading, atomic generation, and watch. The web app owns generated-data validation and reader routes.

## Invariants

- Preserve `schemaVersion: 1`, all seven block types, the locked inline marks/nodes, and footnote cross-reference validation.
- Unsupported Markdown fails with a structured, source-located compiler issue; never silently drop it.
- Media keys stay relative and resolve only through the explicit compiler option. Media objects are immutable: a replacement gets a new `-vN` key.
- Only top-level `content/articles/*.md` are discovered; drafts and archives are validated but never published. Series parts share one title and category and number contiguously from 1 (ADR-0009).
- `content:build` atomically replaces `generated/`; any failure keeps the last good output. `content:validate` writes nothing. Generated output is never committed.
- Web code statically imports generated JSON, validates it with `@jelementi/article-model`, and imports neither the compiler nor runtime filesystem/fetch APIs (tests may use the compiler).
- Reader routes are prerendered from the validated index. Pages set `csr = false`; `/search` is the only hydrated page, and the static 404 fallback loads the client only to render the error page while keeping HTTP 404.
- `wrangler.jsonc` keeps `workers_dev: false`, `preview_urls: true`, and the `jelementi.quz.ma` route; `wrangler.m2.jsonc` is the route-less branch-upload twin. Never commit credentials, `.dev.vars`, or Wrangler state.

## Publishing and deploys

- Every merge to `main` deploys through Workers Builds, which runs `pnpm verify:deploy` first; a failed build leaves the previous version live.
- A story ships after Darko approves it ("ship it" or similar). Then: `pnpm media:upload` for each new file, and `pnpm ship "feat(content): publish <title>"`. `ship` validates content and live media, opens a PR, waits for the `verify` check, and squash-merges. No separate deploy approval or probe is needed.
- Code changes go through a normal PR; merge only work Darko approved.
- After a merge, confirm the article URL returns 200 with the new title. If Workers Builds is red, production still serves the old version: fix forward or revert through a PR. `pnpm deploy:web` is a manual fallback only when Workers Builds itself is down.

## Verification

```bash
pnpm verify:deploy   # format, lint, typecheck, content:validate, test, build, live media:verify
pnpm verify:full     # plus reader browser acceptance, bundle checks, asset budget (before reader redesigns)
```

`verify:deploy` needs `PUBLIC_MEDIA_BASE_URL=https://media.jelementi.quz.ma/` (or `.env`). Fix formatting with `pnpm format:fix`, not `npx prettier`.

## Agent skills

- Issues: GitHub issues on DarkoKuzmanovic/jelementi via `gh` (`docs/agents/issue-tracker.md`, labels in `docs/agents/triage-labels.md`).
- Domain docs: `CONTEXT.md` + `docs/adr/` (`docs/agents/domain.md`).
