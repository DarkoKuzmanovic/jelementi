/**
 * Studio browser acceptance bootstrap (#73).
 *
 * Imported ONLY from `hooks.server.ts`, and only reached at runtime when
 * `env.STUDIO_ACCEPTANCE_MODE === '1'` — a binding the real production
 * Wrangler configuration never defines (mirrors the identity bypass gate in
 * `request-guard.server.ts` and ADR-0007's SELF-binding fail-closed
 * pattern: no explicit opt-in binding, no fixture path). It substitutes the
 * real GitHub adapter for a `FakeGithubAdapter` seeded through the real
 * `saveStudioDraft` domain function — never hand-rolled fixture JSON — so
 * the seeded state obeys the exact same topology rules production does.
 */

import { saveStudioDraft } from './editor.server';
import { FakeGithubAdapter } from './github-adapter.fake';
import type { GithubAdapter } from './github-adapter';
import type { StudioGithubConfig } from './config.server';
import type { StudioMetadata } from '../../studio/contracts';

/** The one representative saved-and-ready article the #73 seam renders. */
export const STUDIO_ACCEPTANCE_ARTICLE_SLUG = 'lighthouse-watch';
export const STUDIO_ACCEPTANCE_ARTICLE_TITLE = 'The Lighthouse Watch';

const FIXTURE_GITHUB_CONFIG: Omit<StudioGithubConfig, 'owner' | 'repo'> = {
  appId: '1',
  clientId: 'studio-acceptance-fixture-client-id',
  installationId: '1',
  privateKey: '-----BEGIN STUDIO ACCEPTANCE FIXTURE KEY-----',
};

const FIXTURE_MEDIA_BASE_URL = 'https://media.studio-acceptance.invalid/';

export function isStudioAcceptanceMode(env: WorkerEnv | undefined): boolean {
  return (env as Readonly<Record<string, unknown>> | undefined)?.STUDIO_ACCEPTANCE_MODE === '1';
}

function readEnvString(env: WorkerEnv | undefined, key: string, fallback: string): string {
  const value = (env as Readonly<Record<string, unknown>> | undefined)?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

/**
 * One `FakeGithubAdapter`, seeded once, reused for the lifetime of one
 * runtime `env` object — mirrors `hooks.server.ts`'s own per-env caching
 * for the real adapter so acceptance mode has the same "resolved once"
 * shape as production, not a special case.
 */
const adapterCache = new WeakMap<WorkerEnv, Promise<GithubAdapter>>();

export function resolveStudioAcceptanceAdapter(env: WorkerEnv): Promise<GithubAdapter> {
  const cached = adapterCache.get(env);
  if (cached !== undefined) return cached;
  const built = buildStudioAcceptanceAdapter(env);
  adapterCache.set(env, built);
  return built;
}

async function buildStudioAcceptanceAdapter(env: WorkerEnv): Promise<GithubAdapter> {
  const config: StudioGithubConfig = {
    ...FIXTURE_GITHUB_CONFIG,
    owner: readEnvString(env, 'GITHUB_REPO_OWNER', 'studio-acceptance-fixture-owner'),
    repo: readEnvString(env, 'GITHUB_REPO_NAME', 'studio-acceptance-fixture-repo'),
  };
  const adapter = new FakeGithubAdapter(config);

  const main = await adapter.getMainRef();
  if (!main.ok) {
    throw new Error('Studio acceptance bootstrap failed: main ref unavailable.');
  }

  const metadata: StudioMetadata = {
    title: STUDIO_ACCEPTANCE_ARTICLE_TITLE,
    slug: STUDIO_ACCEPTANCE_ARTICLE_SLUG,
    excerpt: 'A deterministic acceptance fixture article, saved and ready to publish.',
    status: 'draft',
    updatedAt: '2026-01-01',
    category: 'Fixtures',
    tags: ['acceptance'],
    author: 'Studio Acceptance',
    cover: { src: 'articles/lighthouse-watch/cover.svg', alt: 'A lighthouse at dusk.' },
    references: [],
  };

  const saved = await saveStudioDraft(
    adapter,
    STUDIO_ACCEPTANCE_ARTICLE_SLUG,
    {
      metadata,
      body: 'A deterministic paragraph of acceptance body copy, proving the Studio presentation seam end to end.',
      concurrency: { baseMainSha: main.value.sha },
    },
    { mediaBaseUrl: FIXTURE_MEDIA_BASE_URL },
  );
  if (saved.kind !== 'saved') {
    throw new Error(
      `Studio acceptance bootstrap failed to seed the representative article (${saved.kind}).`,
    );
  }

  return adapter;
}

/**
 * Deterministic fake probe transport (#73: Playwright must run "with
 * deterministic fake GitHub, probe transport, and bounded test identity").
 * Production probe construction still requires `platform.env.SELF.fetch`
 * and fails closed (503) when absent (ADR-0007) — that fail-closed path is
 * unchanged and is proven by the existing unit test
 * `studio-routes.test.ts`: "refresh fails closed when the SELF probe
 * binding is absent". This function is a substitute *value* for `SELF`,
 * wired in only by `hooks.server.ts`'s acceptance-mode branch — it does not
 * touch, weaken, or bypass that guard.
 *
 * The one representative acceptance article (`lighthouse-watch`) is an
 * unmerged Studio draft: it has never been committed to `main`, so it is
 * structurally absent from both probe surfaces (the article route and
 * `/index.json`). A deterministic 404 for every probe request is therefore
 * the faithful, correct fake response for this scenario — it is exactly
 * what the real production origin would also return, and the domain layer
 * already treats a 404 as "not yet propagated", never an error.
 */
export async function studioAcceptanceProbeFetch(
  _input: RequestInfo | URL,
  _init?: RequestInit,
): Promise<Response> {
  return new Response('Studio acceptance fixture: no production content exists yet.', {
    status: 404,
  });
}

/**
 * Injects the deterministic fake probe transport as `env.SELF` when running
 * in acceptance mode and no `SELF` binding is already present, so route
 * code that reads `platform.env.SELF.fetch` (`articles/[slug]/+page.server.ts`'s
 * `refresh` action) needs no acceptance-mode branch of its own — the same
 * production code path just finds a working binding. Idempotent: safe to
 * call on every request.
 */
export function injectStudioAcceptanceSelfBinding(env: WorkerEnv): void {
  const target = env as Record<string, unknown>;
  const existing = target.SELF as { fetch?: unknown } | undefined;
  if (existing !== undefined && typeof existing.fetch === 'function') return;
  target.SELF = { fetch: studioAcceptanceProbeFetch };
}
