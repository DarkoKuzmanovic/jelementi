# Jelementi

Jelementi is a custom-built digital magazine. The Phase 1 reader is a generated, prerendered English beta; it ships as an unlisted Cloudflare Worker at [`https://jelementi.quz.ma`](https://jelementi.quz.ma) (`noindex`) with R2 media.

## Content boundary

- `@jelementi/article-model` owns the framework-neutral document/index schemas, category slug, and shared search normalizer.
- `@jelementi/content-compiler` transforms explicit Markdown input into the model without filesystem or environment access.
- Root content scripts discover canonical Markdown, validate every source, and atomically generate gitignored `generated/index.json` plus `generated/articles/<slug>.json`.
- The web app statically imports and validates those JSON artifacts at its build/server boundary. It never imports the compiler or reads generated data with runtime filesystem/fetch APIs.

Only published documents appear in the generated index and all reader routes/prerender entries derive from that validated index. The reader provides `/`, `/articles/[slug]`, `/categories/[category]`, `/search`, and `/about`; unknown article/category values return the shared error experience. Multi-part series are featured on Home and grouped once in its category shelves and the Categories directory; category pages continue to list every part individually.

## Local development

Node.js >= 20.12 <21 or >= 21.7 and pnpm 11 are required. Set `PUBLIC_MEDIA_BASE_URL` in `.env` (see `.env.example`) or in the command environment.

```bash
pnpm install
pnpm dev:web
# In another terminal while editing content:
pnpm content:watch
```

`dev:web` generates content before starting Vite. `content:watch` remains the canonical incremental content rebuild workflow. `build:web` also always runs `content:build` first. Generated output is reproducible and must not be committed.

## Commands

```bash
pnpm content:validate  # read-only source validation
pnpm content:build     # atomic generated-output replacement
pnpm content:watch
pnpm build:web         # generation-backed SvelteKit prerender
pnpm format            # also lint, typecheck, test
pnpm media:upload -- --file <path> --key articles/<slug>/<asset>-vN.<ext> --content-type <mime>
pnpm media:verify      # read-only live media check
pnpm verify:deploy     # the gate CI and Workers Builds run
pnpm verify:full       # plus reader browser acceptance, bundle checks, asset budget
pnpm ship "<message>"  # publish content/articles changes: PR, wait for verify, merge
```

## Publishing and deployment

Every merge to `main` deploys through Cloudflare Workers Builds, which runs `verify:deploy` first. To publish an approved story: upload its media with `media:upload` (immutable, new `-vN` key per replacement), add the Markdown under `content/articles/`, then run `pnpm ship "feat(content): publish <title>"` from a clean `main`. If a deploy breaks the site, revert through a PR; `pnpm deploy:web` is a manual fallback for when Workers Builds is down.

Reader pages are prerendered static HTML with JavaScript disabled per page. `/search` is the only hydrated route. Global robots stays `noindex`.

## Reader extras

- `/podcast.xml` — podcast feed of narrated articles (see `docs/runbooks/podcast-feed.md`).
- `/feed.xml` — full-text article feed, e.g. for KOReader's news downloader.
- `/series/<slug>.epub` — a whole series as a text-only EPUB.
- `/series/<slug>/dates` — tap-to-reveal study cards built from each part's "Dates to remember" list.
- Article pages carry Open Graph tags, so shared links show the cover and excerpt.
