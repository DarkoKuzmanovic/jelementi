# Jelementi

Jelementi is a custom-built digital magazine. Phase 1 now has a pure Markdown
compiler and root-owned filesystem generation; the Phase 0 web route still uses
its hand-made TypeScript fixture until the later route-migration outcome.

## Content contract

- **`@jelementi/article-model`** owns framework-neutral Zod schemas and inferred
  types for `ArticleDocument`, all seven article block types, inline nodes,
  footnotes, references, generated index entries, `normalizeSearchText()`, and
  the deterministic `categorySlug()` helper.
- **`@jelementi/content-compiler`** exports a pure `compileArticle()` core:

  ```ts
  compileArticle({ markdown, sourcePath, mediaBaseUrl });
  // => { document, searchText }
  ```

  It parses the locked grammar, resolves relative media keys through the
  explicit base URL, and validates its output. It has no filesystem I/O or
  process-global environment reads.
- Root `scripts/content.ts` owns discovery, batch validation, index creation,
  atomic generated-output replacement, and watch orchestration.

## Canonical content and generated output

Canonical Markdown lives at `content/articles/<slug>.md`. Only top-level
`.md` files are discovered. Draft and archived articles are fully validated but
never produce public JSON or index entries; invalid non-published content still
blocks the batch.

The committed sample is `content/articles/tristan-da-cunha.md`. Its relative
media keys correspond to local fixtures under
`apps/web/static/media/articles/tristan-da-cunha/`, and can later use the same
keys in R2.

`content:build` writes reproducible, gitignored output:

```text
generated/
  index.json
  articles/<slug>.json
```

It stages a complete sibling directory and replaces `generated/` only after a
successful batch. A failure preserves the previous successful output.

## Prerequisites

- Node.js >= 20.12 <21 || >= 21.7 (the root script uses `process.loadEnvFile`, available since Node 20.12 and 21.7)
- pnpm 11

Copy `.env.example` to `.env` for local work. `PUBLIC_MEDIA_BASE_URL` is
required; CI or other external environments may set it directly instead.

```dotenv
PUBLIC_MEDIA_BASE_URL=http://localhost:5173/
```

## Commands

Run from the repository root:

```bash
pnpm install
pnpm dev:web
pnpm build:web
pnpm preview:web
pnpm content:validate
pnpm content:build
pnpm content:watch
pnpm format
pnpm lint
pnpm typecheck
pnpm test
```

`content:validate` compiles and validates the complete would-be published index
in memory and creates no files. `content:build` writes generated artifacts.
`content:watch` uses the same build path after debounced canonical-content
changes and preserves the last successful output when a subsequent change is
invalid.

## Current boundary

M1.2 deliberately does not migrate the web route, remove the TypeScript
fixture, add reader/category/search/About routes, add CI, or add deployment
work. `pnpm build:web` remains independently buildable and does not invoke
content generation yet.
