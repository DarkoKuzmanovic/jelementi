# Jelementi

Jelementi is a custom-built digital magazine. Phase 1 is a generated, prerendered English beta reader.

## Content boundary

- `@jelementi/article-model` owns the framework-neutral document/index schemas, category slug, and shared search normalizer.
- `@jelementi/content-compiler` transforms explicit Markdown input into the model without filesystem or environment access.
- Root content scripts discover canonical Markdown, validate every source, and atomically generate gitignored `generated/index.json` plus `generated/articles/<slug>.json`.
- The web app statically imports and validates those JSON artifacts at its build/server boundary. It never imports the compiler or reads generated data with runtime filesystem/fetch APIs.

Only published documents appear in the generated index and all reader routes/prerender entries derive from that validated index. The reader provides `/`, `/articles/[slug]`, `/categories/[category]`, `/search`, and `/about`; unknown article/category values return the shared error experience.

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
pnpm verify:web        # production-output smoke assertions
pnpm format
pnpm lint
pnpm typecheck
pnpm test
```

Reader pages are server-rendered static HTML with JavaScript disabled per page. `/search` is deliberately the sole hydrated route; it filters the small validated index in the browser using the model's shared normalizer. Global robots remains exactly `noindex`.

## CI

GitHub Actions runs on Node 24 and pnpm 11 with a frozen lockfile and an HTTPS media base. It runs formatting, lint, typecheck, content validation, tests, generation-backed web build, and the production HTML smoke check. CI has read-only repository permissions and performs no deploy or publish action.
