# Reader acceptance foundation

This runbook is the phase 1 acceptance authority for specification #96 and ticket #97. It freezes the approved Reader references, production exclusions, route/state inventory, asset budgets, and test seams before visual implementation.

## Immutable design authority

Commit hashes, not branch heads, are authoritative.

| Authority | Immutable source | Approved direction | Production rule |
| --- | --- | --- | --- |
| Editorial-reader and accessibility research | `62b3e95` — `docs/research/public-reader-editorial-patterns.md` | Requirements and evidence hierarchy | Apply the requirements; do not copy an implementation. |
| Public Home and discovery | `d2648cf` — `prototypes/public-home-discovery` | Variant A, **Editorial front** | Rewrite the approved hierarchy and responsive transformation in Reader-owned production code. |
| Article reading | `c548b7e` — `prototypes/article-reading` | Variant A, **The Quiet Column** | Rewrite the bounded reading composition around the authoritative article renderer. |
| Secondary Reader routes | `a10e9f3` — `prototypes/secondary-reader-routes` | Variant A, **Quiet index** | Rewrite the restrained ruled directory, single reading sequence, and plain recovery treatment. |

Prototype source is evidence only. Prototype fixtures, copy, fake contact details, inert links, banners/ribbons, variant query parameters, switchers, floating controls, state panels, comparison labels, evaluation keyboard shortcuts, and evaluation-only JavaScript are excluded from production.

## Traceability ledger

“Pending” means the named later implementation slice must supply durable proof. A pending visual proof is not permission to change the approved trait.

| Approved trait | Source | Intended production location | Proof | State after #97 |
| --- | --- | --- | --- | --- |
| Warm, curious, low-chrome editorial character with restrained rules and serif-led hierarchy | `62b3e95`, `d2648cf` A | Shared semantic foundations plus Reader-owned compositions | Light/dark screenshots, contrast samples, token contract tests | Pending #98–#103 |
| Jelementi identity; Home, Categories, Search, About always visible; conventional narrow wrapping | `d2648cf` A | Reader shell | Wide/320 browser assertions and contact sheets | Fixture/browser seam ready; production pending #99 |
| Working bypass link, one main landmark, quiet footer recovery | `62b3e95`, `d2648cf` A | Reader shell | Semantic browser assertions and keyboard journey | Pending #99 |
| Newest article as decisive lead; next three as recent desk; all remaining articles as quiet complete index | `d2648cf` A | Home projection and page | Sparse/representative transformation tests, exactly-once route assertions | Catalog fixtures ready; production pending #99 |
| Article summaries expose title, excerpt, category, publication date, and reading time | `d2648cf` A, `a10e9f3` A | Reader discovery summary | Semantic route assertions across Home/category/Search | Fixture data ready; production pending #99/#101 |
| Article category links use the canonical `/categories/[category]` route | `c548b7e` A | Article opening in the authoritative renderer | Route-target assertion against generated category slugs | Existing renderer behavior and fixture-browser regression proof present |
| Restrained ruled Categories directory ordered by count then alphabetical ties | `a10e9f3` A | `/categories` | Deterministic ordering test and route/browser evidence | Tie fixtures and 8,192-byte route budget locked; route pending #99 |
| Category rows expose name, count, newest title/date | `a10e9f3` A | `/categories` | Route output and accessibility assertions | Data seam ready; production pending #99 |
| Category pages form one newest-first reading sequence with return to Categories | `a10e9f3` A | `/categories/[category]` | One/many/missing browser states | Representative and missing-content seams ready; production pending #99 |
| Bounded, calm literary column with generous rhythm and uninterrupted source order | `62b3e95`, `c548b7e` A | Article route and Reader content tokens | Wide/320/zoom/text-spacing screenshots and reflow assertions | Rich fixture ready; production pending #100 |
| Compact article opening: category, title, dek, author, date, reading time, tags | `c548b7e` A | Article route around authoritative renderer | Semantic heading/metadata assertions | Fixture data ready; production pending #100 |
| Audio directly below the opening when present; never autoplay | `c548b7e` A | Authoritative article renderer | Browser role/source/autoplay assertions | Deterministic audio fixture and current renderer proof present; visual placement pending #100 |
| Covers, captions, wide media, all seven rich blocks, inline nodes/marks, sources, numbered footnotes, and backlinks remain in one reading flow | `c548b7e` A | Authoritative article renderer and block primitives | SSR/browser semantics against the rich fixture plus schema gates | Deterministic all-structure fixture and browser proof present; styling pending #100 |
| Category return plus exactly one next-older article; oldest article has no wrapped continuation | `c548b7e` A | Article continuation projection | Next/no-next transformation and browser states | Three-article category fixture ready; production pending #100 |
| Search shows the complete catalog before typing and retains existing normalization/searchable fields | `62b3e95`, `a10e9f3` A | `/search` | Initial/one/many/zero/long/special query tests | Shared search exercised by fixtures; interaction pending #101 |
| Search preserves input focus, politely announces results, Clear restores focus, and zero-result recovery offers Clear and Categories | `a10e9f3` A | `/search` enhancement | JS-enabled keyboard and status assertions | Browser project ready; production pending #101 |
| Search without JavaScript retains the complete catalog and conventional links | `62b3e95`, `a10e9f3` A | Prerendered `/search` HTML | `reader-no-js` project | Project and representative browse proof present; final copy pending #101 |
| About is compact and factual; no invented contact or ownership details | `a10e9f3` A | `/about` | Content review and wide/320 evidence | Inventory locked; production pending #99 |
| Missing article/category, unknown route, static 404, and ordinary error use the normal shell and plain Home/Search/Categories recovery; Try again only when meaningful | `a10e9f3` A | `+error.svelte`, route resolvers, static fallback | HTTP status, recovery-link, fixture-error, and no-JS assertions | Missing-content/404 seam present; ordinary-error scenario present; production composition pending #99 |
| Separately designed light/dark semantic roles follow system preference; no theme control or persisted theme state | `62b3e95`, all approved Variant A references | Shared foundation and Reader aliases | Theme emulation, contrast samples, production-bundle check | Pending #98/#102 |
| Reduced motion removes smooth scrolling and non-essential transitions; state changes are immediate | `62b3e95`, all approved Variant A references | Shared accessibility foundation | Reduced-motion CSS and browser assertions | Inventory locked; pending #98/#102 |
| 320 CSS px, 200% text resize, 400% zoom, and text-spacing reflow preserve meaning without page-level two-dimensional scrolling | `62b3e95`, all approved Variant A references | Every Reader composition | Browser stress matrix and contact sheets | 320 project seam present; complete matrix pending #102/#103 |
| Visible focus, logical tab order, descriptive names, non-color cues, and no nested interactive controls | `62b3e95`, all approved Variant A references | Shared focus helpers and route markup | Keyboard assertions, accessibility scan, Orca journey | Pending #98–#103 |
| Reader and Studio share only surface-neutral foundations; Studio retains operational density and meaning | #95/#96 | Web-app foundation and authoritative article renderer | Shared contract tests plus complete Studio suite | Production boundary unchanged; later proof pending #98/#102 |

## Route and state inventory

Every row must ultimately be covered at wide and 320 CSS px, light and dark, reduced motion, keyboard operation, and no JavaScript where the route has a meaningful no-JS path. The real generated catalog is always a separate smoke surface from deterministic fixture coverage.

| Surface | Required states | JavaScript contract | Deterministic source | Current #97 evidence |
| --- | --- | --- | --- | --- |
| Global shell | Current destination, long/wrapped navigation, skip target, header/nav/main/footer | Static | Representative catalog | Inventory only; later shell slice |
| Home `/` | 1 article; 2–4 articles; representative catalog; every article exactly once; no empty tier | None (`csr = false`) | Sparse + representative fixtures | Actual route through both fixture projects |
| Categories `/categories` | Count ordering; alphabetical ties; one/many categories; long names | None (`csr = false`) | Representative fixtures | Data and budget ready; route pending |
| Category `/categories/[category]` | One article; many newest-first; missing category | None (`csr = false`) | Sparse + representative + missing route | Representative and 404 route proof |
| Article `/articles/[slug]` | Sparse article; canonical category link; all seven blocks; all inline marks/nodes; image/caption/wide media; audio; references; footnotes/multiple backlinks; next/no-next; missing article | None (`csr = false`) | Sparse + rich + three-article category fixtures | Rich, audio, canonical-link, multiple-footnote-backlink, and missing proof |
| Search `/search` | Initial complete catalog; one/many/zero; clear; long query; accents/special characters; focus/status | Sole normally hydrated Reader route | Representative fixtures | JS/no-JS project and static browse proof; interactions pending |
| About `/about` | Compact factual content; long text | None (`csr = false`) | Route content | Real-catalog smoke available; final content pending |
| Static fallback `404.html` | Unknown path, exact 404 language/recovery, HTTP 404 | Sole fallback bootstrap | Unknown route | Existing architecture gate; final shell pending |
| Missing content | Missing article; missing category | None beyond 404 fallback | Unknown fixture slugs | Missing article proof; category state available |
| Ordinary error | Plain error; optional meaningful Try again; recovery links | No broader hydration | `ordinary-error` fixture scenario | Fail-closed scenario ready; browser assertion pending |
| Real generated content | Current Home, representative category, rich article, Search, About, 404 | Production architecture | `generated/` from canonical Markdown | Separate `reader-real-generated-catalog` project |

The Playwright configs are intentionally separate:

- `apps/web/playwright.reader.config.ts`: actual SvelteKit routes with an exact test-only replacement of `generated-content.server.ts`; projects `reader-js-enabled` and `reader-no-js`.
- `apps/web/playwright.reader-smoke.config.ts`: normal Vite config and canonical generated content; project `reader-real-generated-catalog`.

The replacement config requires an explicit `READER_ACCEPTANCE_SCENARIO`, rejects unknown values, and never appears in Svelte, Vite, or Wrangler production configuration. Fixture-specific titles make an alias fall-through fail the browser assertions rather than silently testing real data.

## Frozen architecture and data invariants

These are hard gates, not visual-review tradeoffs.

- Ordinary Reader routes remain prerendered and non-hydrated.
- `/search` remains the sole normally hydrated Reader route.
- Static `404.html` remains the sole fallback bootstrap and Cloudflare Static Assets keeps `404-page` handling.
- Published-only data from the completely validated generated boundary remains authoritative.
- `/index.json` retains its exact field set without `searchText`, JSON content type, `X-Robots-Tag: noindex`, and prerendered behavior (ADR-0005).
- Each article exposes exactly one lowercase SHA-256 fingerprint of canonical `ArticleDocument` JSON.
- `schemaVersion: 1`, all seven block discriminants, locked inline marks/nodes, and footnote cross-reference validation remain unchanged.
- Search continues to use shared `normalizeSearchText` and the existing title, excerpt, category, tags, author, and indexed `searchText` fields.
- Markdown/compiler behavior and relative media-key semantics remain owned by `@jelementi/content-compiler`; the Reader harness imports neither compiler nor prototype source.
- Public bundles contain no Studio server, GitHub credential/client, Access secret, compiler, fixture, or Reader acceptance-mode capability.
- Production `vite.config.ts`, `svelte.config.js`, `wrangler.jsonc`, and `wrangler.m2.jsonc` contain no Reader acceptance selector.
- Studio lifecycle, Evidence, Publish, recovery, Access, GitHub topology, and density remain unchanged (ADRs 0001, 0003, 0004, 0006, 0007, and 0008).

`pnpm verify:web` scans the complete deployable Cloudflare output for the fixture module path, fixture marker, fixture slug, and Reader acceptance selector. `pnpm verify:wrangler` independently rejects every `READER_ACCEPTANCE_*` variable in routed and branch-upload Wrangler contracts.

## Frozen raw asset baselines and ceilings

Authority: clean production build at `main@261cb6a` with `PUBLIC_MEDIA_BASE_URL=https://media.jelementi.quz.ma/`. All sizes are raw uncompressed UTF-8/file bytes.

| Route class | Frozen baseline | Hard ceiling |
| --- | ---: | ---: |
| Home | 1,328 | 9,520 |
| About | 1,127 | 9,319 |
| Representative category | 1,171 | 9,363 |
| Representative article | 5,011 | 13,203 |
| Search | 3,623 | 11,815 |
| Static 404 | 1,281 | 9,473 |
| New Categories index | 0 | 8,192 |
| Representative HTML total | 13,541 baseline | 70,885 ceiling |
| Unique Reader CSS | 1,559 baseline | 17,943 ceiling |
| Search JavaScript | 159,321 baseline | 167,513 ceiling |

Counting rules enforced by `pnpm verify:reader:assets`:

1. HTML counts each representative prerendered document once: Home, About, first generated category, first generated article, Search, static 404, and Categories when that route exists.
2. CSS counts each unique stylesheet referenced by those Reader documents once.
3. Search JavaScript counts each unique script or module-preload asset referenced by the prerendered Search document once.
4. Missing required documents or linked assets fail closed. The future Categories route may be absent only until its implementation slice; its 8,192-byte ceiling is already locked.
5. Current generated JSON totals 6,131 raw bytes. Its delta is reported as `contentOnlyGrowthBytes` separately and never increases an HTML, CSS, or JavaScript ceiling.

## Commands

Focused development:

```bash
pnpm vitest run scripts/reader-acceptance-fixtures.test.ts
pnpm vitest run scripts/reader-assets.test.ts
pnpm exec playwright test -c apps/web/playwright.reader.config.ts
```

Production smoke and gates (after `pnpm build:web`):

```bash
pnpm exec playwright test -c apps/web/playwright.reader-smoke.config.ts
pnpm verify:web
pnpm verify:reader:assets
```

The canonical `pnpm verify:deploy` chain runs both Reader browser surfaces after the production build, then the production architecture and asset gates. Browser acceptance has the same explicit `WORKERS_CI=1` Cloudflare Workers Builds exception as Studio; all non-browser gates continue.

## Pending durable evidence

Later tickets #98–#103 must fill the final acceptance report with curated screenshots/contact sheets, complete wide/320/light/dark/reduced-motion/zoom/text-spacing results, Chromium/Firefox/WebKit and touch evidence, contrast samples, accessibility scan results, Orca + Firefox journey, Lighthouse results, complete Reader and Studio regression evidence, material deviations/human decisions, and final explicit human fidelity approval. None of those pending cells weakens the fixed invariants above.
