# Phase 1 — Content Engine and Web Reader Design

**Status:** Approved design, pending written-spec review  
**Date:** 2026-07-26  
**Owner:** Darko  
**Source of truth:** `handoff.md`, Phase 1

## 1. Outcome

Phase 1 replaces the hand-written TypeScript article fixture with a build-time content system:

```text
content/articles/<slug>.md
  → @jelementi/content-compiler
  → validated ArticleDocument JSON + published article index
  → prerendered SvelteKit reader routes
```

The phase is complete when:

1. sample Markdown compiles to a valid `ArticleDocument`;
2. unsupported Markdown produces a clear, source-located error;
3. published articles drive home, article, category, search, About, and error pages;
4. draft content is validated but cannot appear in public generated output or routes;
5. non-search reader pages work without client JavaScript;
6. the full compiler, generation, index, renderer, route, and CI behavior is covered by tests.

## 2. Scope

### In scope

- expand the framework-neutral article model;
- add a standalone `@jelementi/content-compiler` package;
- parse one canonical Markdown file per article;
- support the locked Markdown grammar in this document;
- generate validated published article JSON and a static search/index file;
- complete the Svelte block and inline renderers;
- add home, article, category, search, About, and error routes;
- preserve global beta `noindex` behavior;
- integrate content validation and generation into local scripts and CI.

### Out of scope

- Cloudflare adapter, Wrangler, deployment, bindings, or production domains;
- R2 upload or media-management workflows;
- Studio, Cloudflare Access, GitHub publishing, or preview UI;
- Android changes, EAS builds, push notifications, D1, or WebView bridge work;
- audio playback or native media controls;
- Lenkalica migration;
- Tailwind or final visual design;
- a native mobile article renderer;
- raw HTML, MDX, arbitrary components, tables, fenced code blocks, or nested rich blocks.

## 3. Locked decisions

- Canonical article path: `content/articles/<slug>.md`.
- Lists, quotes, and dividers use standard Markdown syntax.
- Only Jelementi callouts use container directives: `fact`, `note`, and `warning`.
- GFM footnotes are supported through a dedicated `footnotes` collection; public `references` remain a separate Sources concept.
- Reading time is compiler-generated at 200 words per minute, rounded up, with a minimum of one minute and no frontmatter override.
- Search covers metadata and normalized body text.
- Draft and archived articles are fully validated but produce no public JSON and no index entry.
- Jelementi media is stored in Markdown as a relative key and resolved with `PUBLIC_MEDIA_BASE_URL`.
- Compilation is a standalone package plus root scripts, not a Vite plugin or SvelteKit hook.
- `generated/` remains gitignored and reproducible from canonical Markdown.

## 4. Package boundaries

### `@jelementi/article-model`

Owns public, framework-neutral runtime schemas and inferred TypeScript types for:

- `ArticleDocument`;
- every block and inline node;
- footnotes and public references;
- `ArticleIndexEntry` and the generated index.
- the pure search-normalization helper shared by compiler and web.

It does not parse Markdown, read files, resolve environment variables, or import Svelte/Expo code.

### `@jelementi/content-compiler`

Owns pure content transformation:

- frontmatter parsing and validation;
- Markdown AST parsing;
- AST-to-`ArticleDocument` normalization;
- media-key resolution;
- heading ID generation;
- footnote collection;
- reading-time calculation;
- body search-text extraction;
- final validation through `@jelementi/article-model`;
- structured compile errors.

Its core API accepts content and explicit options. It does not read process-global environment variables and does not write files.

```ts
interface CompileArticleInput {
  markdown: string;
  sourcePath: string;
  mediaBaseUrl: string;
}

interface CompiledArticle {
  document: ArticleDocument;
  searchText: string;
}

function compileArticle(input: CompileArticleInput): CompiledArticle;
```

### Root scripts

Root scripts own filesystem orchestration:

- discover `content/articles/*.md`;
- reject duplicate slugs;
- load `PUBLIC_MEDIA_BASE_URL`;
- compile every article;
- build published JSON/index output;
- perform atomic output replacement;
- implement watch mode.

Root scripts run through a pinned TypeScript runner and load the root `.env` explicitly. A committed `.env.example` documents `PUBLIC_MEDIA_BASE_URL`; CI supplies the value directly rather than depending on a local file.

### SvelteKit web app

The web app consumes generated, already validated data. It does not parse Markdown or depend on the compiler package and its Remark dependency tree.

## 5. Article model additions

`schemaVersion` remains `1` because Phase 1 completes the initial, not-yet-public contract.

### Inline nodes

- `text` with marks: `strong`, `emphasis`, `code`, `strikethrough`;
- `link` with inline children;
- `footnoteReference` with a stable `id`.

### Blocks

- `paragraph`;
- `heading` at levels 2, 3, or 4;
- `image`;
- `list` with `ordered` and flat inline items;
- `quote` with inline children and optional attribution;
- `callout` with `fact`, `note`, or `warning` variant;
- `divider`.

### Footnotes

```ts
interface ArticleFootnote {
  id: string;
  children: InlineNode[];
}
```

`ArticleDocument` receives a required `footnotes: ArticleFootnote[]`. Every `footnoteReference.id` must have exactly one matching definition, duplicate definitions are invalid, and unreferenced definitions are invalid.

`references` remains a required array of public Sources entries with title and HTTPS URL. Footnotes never replace public source references.

### Article index

The shared model defines and validates an index entry containing:

- slug;
- title and excerpt;
- published and updated dates;
- category and deterministic category slug;
- tags and author;
- resolved cover URL and alt text;
- reading time;
- normalized `searchText`.

The generated index is a validated array of published entries only.

## 6. Markdown and frontmatter contract

### Frontmatter

Required fields remain those defined by `handoff.md`: title, slug, excerpt, updated date, status, category, tags, author, cover key, cover alt, and public references. A published article also requires `publishedAt`.

The source filename stem must equal the frontmatter slug. This prevents file identity, generated filenames, and public routes from drifting apart.

`readingTimeMinutes` is forbidden in frontmatter. The compiler owns it.

Cover, optional audio, and Markdown image destinations are relative media keys. Keys must:

- be relative, without a scheme or leading slash;
- contain no `.` or `..` path segments;
- resolve under `PUBLIC_MEDIA_BASE_URL`;
- produce a valid absolute URL in `ArticleDocument`; HTTPS is required except for loopback HTTP during local development.

Public links and `references.url` are full HTTPS URLs.

### Supported block syntax

| Markdown | Article model |
|---|---|
| paragraph | `ParagraphBlock` |
| `##`–`####` | `HeadingBlock` |
| `![alt](media/key "caption")` | `ImageBlock` |
| `-` or `1.` | flat `ListBlock` |
| `>` | `QuoteBlock` |
| `---` outside frontmatter | `DividerBlock` |
| `:::fact`, `:::note`, `:::warning` | `CalloutBlock` |

A Markdown image becomes an `ImageBlock` only when it is the paragraph's sole content. Inline images mixed with text are rejected.

A list is flat, each item contains exactly one paragraph, and an ordered list must start at `1`. Nested lists, task-list checkboxes, and custom ordered-list starts are rejected because the locked `ListBlock` cannot represent them without data loss.

A quote may contain one paragraph. When the paragraph's final source line begins with an em dash followed by non-empty plain text, for example `— Ursula Le Guin`, that line becomes `attribution` and is removed from quote children. The remaining quote text must be non-empty.

Callout directives may contain exactly one paragraph. Their optional `title` attribute must be a string; unknown attributes are rejected.

### Supported inline syntax

- plain text;
- strong and emphasis;
- inline code;
- GFM strikethrough;
- links;
- GFM footnote references.

A footnote definition may contain exactly one paragraph of supported inline content. The compiler rejects multi-paragraph or block-rich definitions.

### Deterministic headings

Heading IDs are generated from visible heading text with one locked slugifier. Duplicate IDs receive `-2`, `-3`, and subsequent numeric suffixes in document order.

### Explicitly rejected syntax

The compiler fails rather than silently dropping or flattening:

- level-1, level-5, or level-6 headings;
- raw HTML;
- fenced or indented code blocks;
- tables;
- nested lists, task lists, or ordered lists starting at a value other than `1`;
- multi-paragraph quotes or callouts;
- nested block content inside a callout;
- multi-paragraph or block-rich footnotes;
- unknown directives or directive attributes;
- unsupported Markdown/MDAST nodes.

## 7. Compiler errors

All author-facing failures use one structured error contract:

```ts
interface ContentCompileIssue {
  code: string;
  message: string;
  sourcePath: string;
  line?: number;
  column?: number;
}
```

`ContentCompileError` contains one or more issues. Stable error codes cover at least:

- invalid frontmatter;
- duplicate slug or category-slug collision;
- unsupported block or inline node;
- invalid directive;
- invalid media key/base URL;
- invalid or missing footnote definition;
- final article-model validation failure.

CLI output prints the source path and location first, followed by a concise English explanation. Expected author errors do not print a JavaScript stack trace by default.

## 8. Generation and atomicity

### `content:validate`

- discovers and compiles every Markdown file in memory;
- validates draft, archived, and published articles identically;
- validates the would-be published index;
- writes nothing;
- exits non-zero if any issue exists.

### `content:build`

1. discovers all Markdown files in deterministic path order;
2. compiles the complete batch in memory;
3. rejects duplicate slugs and any compile issue;
4. selects only published documents;
5. validates article JSON and the complete index;
6. writes a sibling temporary output directory;
7. replaces `generated/` only after the full temporary output succeeds.

A failed build leaves the previous successful `generated/` directory untouched. A successful replacement removes stale article JSON that no longer corresponds to published source.

If two distinct category names normalize to the same category slug, the batch fails rather than merging their routes implicitly.

Generated JSON uses stable formatting and ends with a newline so local output is inspectable despite being gitignored.

### `content:watch`

Watch mode debounces file changes, invokes the same batch build path, reports errors without destroying the last successful output, and resumes after the next change. It introduces no separate compilation logic.

## 9. Web reader design

### Data loading

The SvelteKit app statically imports generated index and article JSON at build time. Every imported artifact is validated at the web boundary as defense against stale or manually modified output.

Dynamic article and category routes provide explicit prerender entries derived from the published index. Unknown slugs or categories return 404.

### Routes

- `/` — published article cards ordered newest-first;
- `/articles/[slug]` — complete article and Sources/Footnotes sections;
- `/categories/[category]` — published entries in one category;
- `/search` — client-side filtering of the small static index;
- `/about` — static English explanation of Jelementi;
- `+error.svelte` — English 404/500 fallback.

### Search

The compiler creates `searchText` from normalized title, excerpt, category, tags, author, and readable article body. It excludes URLs, media alt duplication, footnote identifiers, and draft content.

Search comparison is case-insensitive and diacritic-insensitive. Query terms use the same pure normalization helper exported by `@jelementi/article-model` and used during index generation. Results preserve index order.

Only `/search` uses client JavaScript. Home, article, category, About, and error routes explicitly disable CSR and remain fully functional as prerendered HTML.

### Beta indexing policy

The global robots meta remains exactly `noindex`. Phase 1 does not add sitemap, RSS, structured-data launch work, or any automatic removal of `noindex`.

## 10. Rendering

The Svelte renderer remains exhaustive. Adding a block or inline-node union member without a corresponding renderer must fail typecheck.

New rendering behavior:

- flat ordered and unordered lists;
- block quotes with optional attribution;
- dividers;
- inline code and strikethrough;
- superscript footnote references with reciprocal anchors;
- a Footnotes section when footnotes exist;
- a Sources section when public references exist.

Renderer components receive validated model values and never render raw HTML.

## 11. TDD and verification strategy

Implementation must preserve explicit RED → GREEN evidence for each boundary.

### Model tests

- accept every new block and inline node;
- reject invalid discriminants, heading levels, marks, footnotes, and index entries;
- enforce published-date and footnote-reference invariants.

### Compiler fixtures

Positive fixtures cover every supported block, inline mark, directive, footnote, media key, heading-ID collision, and reading-time calculation.

Negative fixtures cover every explicitly rejected syntax form and assert stable error code, path, and source position.

### Generation integration tests

Using temporary directories, prove that:

- validation writes nothing;
- draft and archived articles produce no JSON or index entry;
- duplicate slugs fail;
- one invalid file prevents all replacement;
- the previous successful output survives a failed build;
- a successful build removes stale output;
- output ordering and formatting are deterministic.

### Index and search tests

Prove metadata matches, body-only matches, case/diacritic normalization, deterministic ordering, category filtering, and complete draft exclusion.

### Web verification

- component/typecheck exhaustiveness for every block and inline node;
- production build prerenders all expected article/category routes;
- smoke assertions inspect generated HTML for every rendering behavior;
- unknown routes return the expected error page;
- non-search pages contain no hydration/client entry script;
- search remains functional with its intentionally scoped client JavaScript.

### Required gate

```text
pnpm install --frozen-lockfile
pnpm format
pnpm lint
pnpm typecheck
pnpm content:validate
pnpm test
pnpm build:web
```

`build:web` runs `content:build` before SvelteKit build, so a standalone web build cannot consume missing or stale generated output.

## 12. Delivery sequence

Phase 1 is one coherent outcome but is implemented in bounded, reviewable steps:

1. expand `@jelementi/article-model` schemas and tests;
2. build the pure compiler and fixture tests;
3. add exhaustive Svelte renderers;
4. add filesystem generation, validation, watch scripts, and sample Markdown;
5. migrate article/home loading from the TypeScript fixture to generated output;
6. add category, search, About, and error routes;
7. add CI, smoke verification, and README documentation;
8. run fresh verification and fresh-context review before the Phase 1 commit.

The sample Tristan da Cunha article is ported from the Phase 0 fixture to Markdown. The TypeScript fixture is removed only after generated content drives all current consumers and equivalent rendered-output assertions pass.

## 13. Key risks and mitigations

### Schema/compiler/renderer drift

Mitigation: schema-first changes, exhaustive renderer guards, final Zod validation, and fixtures that cover every discriminant.

### Unsupported Markdown silently losing content

Mitigation: reject every unhandled MDAST node with a source-located error; never flatten unknown nodes.

### Draft leakage

Mitigation: draft and archived articles are omitted before artifact generation; routes and prerender entries derive only from the published index.

### Partial or stale generated output

Mitigation: compile the whole batch first and atomically replace output only after complete success.

### Search behavior diverging from indexing

Mitigation: one framework-neutral normalization helper is used by index generation and browser filtering.

### Future Cloudflare constraints

Mitigation: Phase 1 bundles generated static JSON through Vite/SvelteKit and adds no runtime filesystem reads. Phase 2 can change only the adapter/deployment layer.

## 14. Acceptance trace

| Handoff acceptance | Design evidence |
|---|---|
| Sample Markdown produces valid `ArticleDocument` | Compiler API, final Zod validation, positive fixture |
| Unsupported block gives clear error | Explicit rejection list and structured source-located issues |
| Public reader works without unnecessary client JavaScript | CSR disabled on every non-search public route |
| Draft is not visible publicly | Drafts validate but generate no artifact, index entry, route, or prerender entry |

## 15. Rollback

Phase 1 can be rolled back without content loss because Markdown remains canonical and generated files are reproducible. Before the Phase 0 fixture is removed, rollback is a normal Git revert. After migration, a per-file rollback restores the fixture imports and removes the compiler/index route wiring; no database, remote storage, or external service migration is involved.
