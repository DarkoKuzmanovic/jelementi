# Jelementi

Jelementi is a custom-built digital magazine. This repository is the **Phase 0 —
bootstrap and first architectural proof** slice: a pnpm monorepo that proves the
central trust boundary (Markdown → `ArticleDocument` → Svelte renderer → web and
Expo WebView) without any premature integrations.

## What Phase 0 contains

- A **pnpm workspace** with a shared TypeScript config.
- **`@jelementi/article-model`** — a minimal, framework-neutral `ArticleDocument`
  contract with strict TypeScript types and **Zod** runtime validation. The
  Phase 0 model covers four block types: `paragraph`, `heading`, `image` and
  `callout` (variant `fact` / `note` / `warning`).
- A hand-made **`ArticleDocument` fixture** (`sampleArticle`) shared by web and
  mobile, served at the stable route `/articles/tristan-da-cunha`.
- A **SvelteKit** web app with one focused Svelte component per block type and
  exhaustive block dispatch (compile-time checked, plus a runtime guard).
- An **Expo + Expo Router + react-native-webview** shell that opens the same
  configurable article route. There is **no React Native article renderer** —
  the editorial layout lives entirely in the web app.
- Root **`lint`**, **`typecheck`** and **`test`** commands, a basic **GitHub
  Actions** CI, and this English README.

## What Phase 0 deliberately does NOT contain

These are locked product decisions but are scheduled for later phases
(see `handoff.md` §19): Cloudflare deployment + `adapter-cloudflare` + Wrangler
(Phase 2), R2 media, the private Studio, Expo push, the native audio bridge, D1,
the Lenkalica content migration, and the final editorial design system (incl.
Tailwind). The web app uses `@sveltejs/adapter-auto` for now; the swap to
`adapter-cloudflare` is a Phase 2 task.

## Repository structure

```text
jelementi/
├── apps/
│   ├── web/                 # SvelteKit (Svelte 5, TypeScript strict)
│   │   ├── src/
│   │   │   ├── lib/article/ # ArticleRenderer + focused block components
│   │   │   └── routes/      # home + /articles/[slug]
│   │   └── ...
│   └── mobile/              # Expo Router WebView shell (no article renderer)
│       ├── src/app/         # _layout.tsx + index.tsx (WebView)
│       └── ...
├── packages/
│   ├── article-model/       # types + Zod schema + fixture + validation
│   └── config/              # shared TypeScript base config
├── .github/workflows/ci.yml
├── eslint.config.js
├── vitest.config.ts
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.json
```

## Prerequisites

- Node.js >= 20 (developed on Node 24)
- pnpm 11

## Install

```bash
pnpm install
```

## Commands (run from the repo root)

```bash
pnpm install         # install all workspaces
pnpm dev:web         # SvelteKit dev server (http://localhost:5173)
pnpm build:web       # production build of the web app
pnpm preview:web     # preview the built web app
pnpm typecheck       # typecheck every workspace (article-model, web, mobile)
pnpm lint            # ESLint across the whole workspace
pnpm test            # Vitest across the workspace
pnpm format          # Prettier check
pnpm format:fix      # Prettier write
```

The sample article renders at `/articles/tristan-da-cunha` (linked from the
home page). With `pnpm dev:web` running, open
`http://localhost:5173/articles/tristan-da-cunha`.

## Expo mobile shell

The Expo app is a WebView that opens the same article route the web app serves.
Configure the target with environment variables (see `apps/mobile/.env.example`):

```bash
EXPO_PUBLIC_SITE_URL=http://localhost:5173
EXPO_PUBLIC_ARTICLE_PATH=/articles/tristan-da-cunha
```

Phase 0 validates the mobile shell with `pnpm typecheck` (strict `tsc --noEmit`).
A native/EAS build and on-device run are **not** part of Phase 0 — they land in
Phase 4 together with the trusted-origin navigation and push work.

## Article model and testing

`@jelementi/article-model` is the stable contract between content, renderer and
future consumers. Types are derived from the Zod schema so the TypeScript view
and the runtime validation stay in lockstep. Every `ArticleDocument` is
validated with Zod; an unsupported block type, an invalid `schemaVersion`, a
published article without `publishedAt`, or a callout with an unknown variant
all fail validation with a clear error.

Tests live next to the model under `packages/article-model/test/`. The block
renderer uses an exhaustive `{:else}` dispatch whose `never`-typed guard makes
adding a new block type without a renderer case a compile error — verified by
`pnpm typecheck` and by the SvelteKit build prerendering the sample article.

## Notes and known constraints

- **TypeScript version**: the workspace pins `typescript@6.0.3`. Expo SDK 57 expects
  the 6.0 line, and the current Svelte tooling accepts it. Treat a future TypeScript
  major upgrade as a deliberate toolchain change rather than an automatic update.
- **No Tailwind in Phase 0**: the locked Tailwind + editorial design system is
  a design-phase concern; Phase 0 ships minimal plain CSS so the architectural
  proof stays surgical.
- The `@jelementi/article-model` package ships TypeScript source directly (no
  compiled `dist`); a build step can be added in Phase 1 if a compiled artifact
  is needed.
