# Maintainer contract

## Ownership boundaries

- `@jelementi/article-model` owns the framework-neutral public `ArticleDocument`, index schemas, and shared search normalization. It does not parse Markdown or access the filesystem/environment.
- `@jelementi/content-compiler` owns pure Markdown-to-model transformation. Its public core accepts explicit content, source path, and media base URL; it never performs filesystem I/O or reads process-global environment.
- Root typed scripts own filesystem discovery, environment loading, atomic generation, and watch orchestration. The web app owns generated-data validation and reader routes.

## Invariants

- Preserve `schemaVersion: 1`, all seven block discriminants, locked inline marks/nodes, and footnote cross-reference validation.
- Unsupported Markdown must fail with a structured source-located compiler issue; never silently flatten or drop it.
- Media keys remain relative and resolve only through the explicit compiler option.
- Keep generated artifacts out of source changes unless a generation outcome explicitly owns them.
- Root scripts discover only top-level `content/articles/*.md` in deterministic path order. They validate drafts and archives but publish neither.
- `content:build` must stage a sibling directory and atomically replace `generated/`; every compile, write, or replacement failure preserves the last successful output.
- `content:validate` is a required read-only verification command: it must create and write no output paths.
- Web code statically imports generated JSON and validates the complete index/article boundary with `@jelementi/article-model`; it imports neither `@jelementi/content-compiler` nor runtime filesystem/fetch APIs.
- Published-only route data, category lists, and prerender entries derive exclusively from the validated index. Non-search reader pages explicitly set `csr = false`; `/search` is the sole hydrated reader route, while static `404.html` loads the client only to render the custom error fallback.
- M2.1 targets `adapter-cloudflare({ fallback: 'spa' })`; normal reader routes remain prerendered and non-hydrated, `/search` remains the only normal hydrated route, and the 404 fallback alone bootstraps the client while preserving HTTP 404 through Static Assets `404-page` handling.
- `/index.json` is a prerendered, non-hydrated public contract (ADR-0005): the same validated index metadata bundled into the homepage and `/search`, minus `searchText`, served as JSON with `X-Robots-Tag: noindex`. It is the second, independent Live evidence surface Studio probes alongside an article page's content fingerprint; changing its field set or removing it is a breaking change to that probe contract.
- `wrangler.jsonc` is the routed production contract: `workers_dev` stays false, `preview_urls` stays true (Access-protected version previews; production deploys with `preview_urls: false` disable Worker-level previews), and the production route is `jelementi.quz.ma`. `wrangler.m2.jsonc` is the route-less Workers Builds branch-upload contract: no production route, `workers_dev` false, `preview_urls` true behind the verified email-scoped Access policy. `R2_MEDIA` remains a declared future binding; M2 application code must not read or write it.
- `verify:deploy` is the canonical M2.2 non-deploy gate and includes read-only, networked live `media:verify`.
- Production deploys on merge to `main`, automatically, through Workers Builds. Merging an approved pull request is the deploy action: there is no separate manual step, and no further checkpoint approval is required for an ordinary merge. Treat the merge itself as the approval, and never merge to `main` work the operator has not approved.
- A merge is deployable only with the `main` pull-request rule satisfied: green `verify` and green `Workers Builds: jelementi-web`. After a merge, watch both checks on the merge commit and report the outcome; a red check on `main` means production may be serving the prior version and needs the incident path, not a retry.
- `deploy:web` (`verify:deploy` then `wrangler deploy`) remains an operator-only escape hatch for when Workers Builds cannot deploy, and still requires the runbook and explicit checkpoint approval. `media:upload` stays operator-only on the same terms; media is never published by merging.
- Rollback is still never automatic: a bad `main` follows the runbook's incident path — Cloudflare rollback to the recorded known-good Worker version first, then a revert commit through a normal green pull request.
- Local Wrangler smoke uses loopback only and persists outside the repository. Never commit credentials, `.dev.vars`, Wrangler state, or generated Cloudflare output.

## Verification

Run from the repository root:

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm content:validate
PUBLIC_MEDIA_BASE_URL=https://media.jelementi.quz.ma/ pnpm verify:deploy
```

Agents must run `pnpm format` (Prettier `--check .`) before every push — CI runs it as the
first step of `verify:deploy`, so a formatting miss fails the job in seconds. Fix locally
with `pnpm format:fix` (`prettier --write .`) and re-push; do not use `npx prettier`
directly — the repo pins Prettier via `pnpm` and `prettier-plugin-svelte`.

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues on DarkoKuzmanovic/jelementi, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles mapped to default labels (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
