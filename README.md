# Jelementi

Jelementi is a custom-built digital magazine. This pnpm monorepo is progressing
through Phase 1: its public content contract and pure Markdown compiler are now
separate from filesystem generation and web route migration.

## Content contract

- **`@jelementi/article-model`** owns framework-neutral Zod schemas and inferred
  types for `ArticleDocument`, all seven article block types, inline text marks,
  links, footnote references/definitions, public references, and generated
  article-index entries. It also exports `normalizeSearchText()` for identical
  compiler and reader search behavior.
- **`@jelementi/content-compiler`** exports a pure `compileArticle()` core:

  ```ts
  compileArticle({ markdown, sourcePath, mediaBaseUrl });
  // => { document, searchText }
  ```

  It parses the locked frontmatter/Markdown grammar, resolves only relative media
  keys against the explicit `mediaBaseUrl`, computes reading time, and validates
  its final document through `@jelementi/article-model`. It has no filesystem I/O,
  writes, or process-global environment reads. Unsupported Markdown fails with a
  `ContentCompileError` containing stable, source-located issues.

The current hand-made fixture remains in use by the Phase 0 web route. Content
filesystem generation, canonical Markdown, generated output, and route migration
are intentionally later Phase 1 outcomes.

## Repository structure

```text
apps/
  web/                         # SvelteKit article renderer
  mobile/                      # Expo WebView shell (no native article renderer)
packages/
  article-model/               # public schema, validation, fixture, search helper
  content-compiler/            # pure Markdown compiler and fixture tests
  config/                      # shared TypeScript config
```

## Prerequisites

- Node.js >= 20 (developed on Node 24)
- pnpm 11

## Commands

Run from the repository root:

```bash
pnpm install
pnpm dev:web
pnpm build:web
pnpm preview:web
pnpm format
pnpm lint
pnpm typecheck
pnpm test
```

`pnpm typecheck` includes the article model, compiler, SvelteKit web app, and
mobile shell. `pnpm build:web` keeps renderer exhaustiveness and the existing
fixture route buildable; it does not yet invoke content generation.

## Current constraints

Phase 1 does not yet include filesystem generation, `content/articles`,
`generated/`, route migration, category/search/About pages, R2/Cloudflare,
Studio, audio playback, migration, or final visual design. The web app still uses
`@sveltejs/adapter-auto`; no deployment adapter is part of this milestone.
