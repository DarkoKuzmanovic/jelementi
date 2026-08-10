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
pnpm media:verify       # read-only live R2 media verification
pnpm verify:deploy      # complete non-deploy gate, including media:verify
pnpm verify:remote -- --base-url https://jelementi.quz.ma  # post-deploy production probe (after production is live)
```


## Cloudflare M2 deployment gate

`build:web` emits the Cloudflare adapter artifact in `.svelte-kit/cloudflare`. `preview:web` starts Wrangler only on loopback with local persistence under `/tmp`; `verify:worker` starts the same local runtime, polls readiness, exercises reader routes and the static 404 path, then terminates it.

```bash
PUBLIC_MEDIA_BASE_URL=https://media.jelementi.quz.ma/ pnpm verify:deploy
```

`verify:remote` is the post-deploy HTTP probe for a supplied HTTPS origin. It is **not** part of `verify:deploy` and must not be pointed at Access-protected preview URLs (anonymous Access 302 is an intentional fail). Use it only after production is live or against an intentionally public origin.

`verify:deploy` is the canonical non-deploy gate: format, lint, typecheck, content validation, tests, Cloudflare build, artifact assertions, Wrangler `deploy --dry-run`, local Worker smoke, and read-only live `media:verify`. It performs no upload, deployment, or Cloudflare configuration mutation, but it does contact the public `media.jelementi.quz.ma` origin and therefore requires network access.

`deploy:web` is operator-only and runs the gate before a real Wrangler deployment; do not use it without the applicable checkpoint approval. `media:upload` is an operator-only immutable R2 write; `media:verify` is read-only and is part of both `verify:deploy` and CI after M2.2. The checked-in Worker binding `R2_MEDIA` is reserved for future server work; M2 application code does not read or write it.

Operational checkpoint, upload, Access, production-probe, and rollback procedures are in [the Cloudflare M2 operations runbook](docs/runbooks/cloudflare-m2-operations.md).

Reader pages are server-rendered static HTML with JavaScript disabled per page. `/search` is deliberately the sole hydrated route; it filters the small validated index in the browser using the model's shared normalizer. Global robots remains exactly `noindex`.

## CI

GitHub Actions runs Node 24 with pnpm 11.1.3 and a frozen lockfile. It executes `verify:deploy` with the HTTPS media base. Its only public-origin operation is unauthenticated read-only media verification; CI has read-only repository permissions and no credential, upload, deployment, promotion, DNS, Access, or R2 mutation step.
