# Maintainer contract

## Ownership boundaries

- `@jelementi/article-model` owns the framework-neutral public `ArticleDocument`, index schemas, and shared search normalization. It does not parse Markdown or access the filesystem/environment.
- `@jelementi/content-compiler` owns pure Markdown-to-model transformation. Its public core accepts explicit content, source path, and media base URL; it never performs filesystem I/O or reads process-global environment.
- Web renderers consume validated model values and keep block and inline dispatch exhaustive. Filesystem generation, generated output, and routes are later Phase 1 work.

## Invariants

- Preserve `schemaVersion: 1`, all seven block discriminants, locked inline marks/nodes, and footnote cross-reference validation.
- Unsupported Markdown must fail with a structured source-located compiler issue; never silently flatten or drop it.
- Media keys remain relative and resolve only through the explicit compiler option.
- Keep generated artifacts out of source changes unless a generation outcome explicitly owns them.

## Verification

Run from the repository root:

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm build:web
```
