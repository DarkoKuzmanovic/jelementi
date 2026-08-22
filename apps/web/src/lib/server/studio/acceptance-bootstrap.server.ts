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

import { compileArticle, serializeArticleSource } from '@jelementi/content-compiler';
import { articleContentFingerprint, categorySlug } from '@jelementi/article-model';
import { saveStudioDraft } from './editor.server';
import { FakeGithubAdapter } from './github-adapter.fake';
import type { GithubAdapter } from './github-adapter';
import type { StudioGithubConfig } from './config.server';
import type { StudioMetadata } from '../../studio/contracts';

/** The representative saved-and-ready article the #73 seam renders. */
export const STUDIO_ACCEPTANCE_ARTICLE_SLUG = 'lighthouse-watch';
export const STUDIO_ACCEPTANCE_ARTICLE_TITLE = 'The Lighthouse Watch';

/** Additional deterministic Flowboard fixtures owned by #74. */
export const STUDIO_ACCEPTANCE_INVALID_SLUG = 'weather-notes';
export const STUDIO_ACCEPTANCE_FAILED_SLUG = 'failed-crossing';
export const STUDIO_ACCEPTANCE_APPROVED_SLUG = 'approved-passage';
export const STUDIO_ACCEPTANCE_CHECKING_SLUG = 'checking-tide';
export const STUDIO_ACCEPTANCE_LIVE_SLUG = 'verified-harbor';
export const STUDIO_ACCEPTANCE_FLOWBOARD_HEADER = 'x-studio-acceptance-flowboard';

/**
 * #111 fixtures. With lifecycle Status read-only in the editor form, a
 * brand-new Studio draft can never carry `status: published`, so the
 * ordinary Save→Publish acceptance journey starts from a canonical article
 * that is already published on `main` (its derived draft status stays
 * `published`). One pristine fixture PER BROWSER PROJECT: the journey's
 * Publish merges an edit into `main`, and the shared acceptance world means
 * the second project would otherwise start from the first project's merged
 * state. The undated companion is a committed-but-invalid draft whose only
 * compile issue is a published status without `publishedAt` — the
 * deterministic anchor for validation-targeting journeys.
 */
const STUDIO_ACCEPTANCE_PUBLISHABLE_BASE = 'open-cove';
export const STUDIO_ACCEPTANCE_PUBLISHABLE_SLUGS = [
  `${STUDIO_ACCEPTANCE_PUBLISHABLE_BASE}-js`,
  `${STUDIO_ACCEPTANCE_PUBLISHABLE_BASE}-no-js`,
] as const;
export const STUDIO_ACCEPTANCE_UNDATED_SLUG = 'undated-notes';

/**
 * Deterministic recovery-scenario trigger owned by #77. A Playwright test
 * sets this header on a Studio mutation to make the shared fake-GitHub
 * world change out from under the operator *before* the real domain
 * function runs — exactly the way a concurrent session or an outage would.
 * The domain functions themselves are never faked or branched: they observe
 * the mutated world and produce the real `save_conflict` /
 * `publish_conflict` / `save_failed` results the recovery presentation
 * exists for.
 */
export const STUDIO_ACCEPTANCE_RECOVERY_HEADER = 'x-studio-acceptance-recovery';

const FIXTURE_GITHUB_CONFIG: Omit<StudioGithubConfig, 'owner' | 'repo'> = {
  appId: '1',
  clientId: 'studio-acceptance-fixture-client-id',
  installationId: '1',
  privateKey: '-----BEGIN STUDIO ACCEPTANCE FIXTURE KEY-----',
};

const FIXTURE_MEDIA_BASE_URL = 'https://media.studio-acceptance.invalid/';

const liveMetadata: StudioMetadata = {
  title: 'The Verified Harbor',
  slug: STUDIO_ACCEPTANCE_LIVE_SLUG,
  excerpt: 'A canonical article with deterministic production evidence.',
  status: 'published',
  publishedAt: '2026-01-01',
  updatedAt: '2026-01-02',
  category: 'Fixtures',
  tags: ['acceptance'],
  author: 'Studio Acceptance',
  cover: { src: 'articles/verified-harbor/cover.svg', alt: 'A sheltered harbor.' },
  references: [],
};
const liveSource = serializeArticleSource({
  frontmatter: liveMetadata,
  body: 'A deterministic published paragraph for the Flowboard Live fixture.',
});
const liveDocument = compileArticle({
  markdown: liveSource,
  sourcePath: `content/articles/${STUDIO_ACCEPTANCE_LIVE_SLUG}.md`,
  mediaBaseUrl: FIXTURE_MEDIA_BASE_URL,
}).document;
const liveFingerprintPromise = articleContentFingerprint(liveDocument);
const liveIndexEvidence = {
  slug: liveDocument.slug,
  title: liveDocument.title,
  excerpt: liveDocument.excerpt,
  publishedAt: liveDocument.publishedAt as string,
  updatedAt: liveDocument.updatedAt,
  category: liveDocument.category,
  categorySlug: categorySlug(liveDocument.category),
  tags: liveDocument.tags,
  author: liveDocument.author,
  cover: liveDocument.cover,
  readingTimeMinutes: liveDocument.readingTimeMinutes,
};

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

async function seedApprovedChange(
  adapter: FakeGithubAdapter,
  mainSha: string,
  baseMetadata: StudioMetadata,
  slug: string,
  title: string,
): Promise<number> {
  const saved = await saveStudioDraft(
    adapter,
    slug,
    {
      metadata: {
        ...baseMetadata,
        title,
        slug,
        cover: { src: `articles/${slug}/cover.svg`, alt: `${title} fixture.` },
      },
      body: `A valid approved acceptance change for ${title}.`,
      concurrency: { baseMainSha: mainSha },
    },
    { mediaBaseUrl: FIXTURE_MEDIA_BASE_URL },
  );
  if (saved.kind !== 'saved') {
    throw new Error(`Studio acceptance bootstrap failed to seed ${slug} (${saved.kind}).`);
  }
  const approved = await adapter.updatePullRequest(saved.pullRequest.number, { draft: false });
  if (!approved.ok) {
    throw new Error(`Studio acceptance bootstrap failed to approve ${slug}.`);
  }
  return saved.pullRequest.number;
}

async function buildStudioAcceptanceAdapter(env: WorkerEnv): Promise<GithubAdapter> {
  const config: StudioGithubConfig = {
    ...FIXTURE_GITHUB_CONFIG,
    owner: readEnvString(env, 'GITHUB_REPO_OWNER', 'studio-acceptance-fixture-owner'),
    repo: readEnvString(env, 'GITHUB_REPO_NAME', 'studio-acceptance-fixture-repo'),
  };
  const adapter = new FakeGithubAdapter(config);

  adapter.seedFile(
    'main',
    `content/articles/${STUDIO_ACCEPTANCE_LIVE_SLUG}.md`,
    liveSource,
    'd'.repeat(64),
  );
  // #111: seeded BEFORE any Studio branch exists, so every later draft
  // branch's tree differs from canonical main by exactly its own article
  // file — the invariant Draft-replacement eligibility checks.
  for (const [index, publishableSlug] of STUDIO_ACCEPTANCE_PUBLISHABLE_SLUGS.entries()) {
    adapter.seedFile(
      'main',
      `content/articles/${publishableSlug}.md`,
      serializeArticleSource({
        frontmatter: {
          title: 'The Open Cove',
          slug: publishableSlug,
          excerpt: 'A canonical published article with no active draft.',
          publishedAt: '2026-02-01',
          updatedAt: '2026-02-01',
          status: 'published',
          category: 'Fixtures',
          tags: ['acceptance'],
          author: 'Studio Acceptance',
          cover: {
            src: `articles/${publishableSlug}/cover.svg`,
            alt: 'An open cove.',
          },
          references: [],
        },
        body: 'A deterministic published paragraph awaiting an ordinary edit journey.',
      }),
      // Distinct per-fixture blob identity; the fake only requires shape.
      `e${String(index).padStart(63, '0')}`,
    );
  }

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

  const invalid = await saveStudioDraft(
    adapter,
    STUDIO_ACCEPTANCE_INVALID_SLUG,
    {
      metadata: {
        ...metadata,
        title: 'Weather Notes',
        slug: STUDIO_ACCEPTANCE_INVALID_SLUG,
        cover: { src: 'articles/weather-notes/cover.svg', alt: 'Weather notes.' },
      },
      body: '# Unsupported acceptance heading',
      concurrency: { baseMainSha: main.value.sha },
    },
    { mediaBaseUrl: FIXTURE_MEDIA_BASE_URL },
  );
  if (invalid.kind !== 'saved') {
    throw new Error(`Studio acceptance bootstrap failed to seed invalid work (${invalid.kind}).`);
  }

  // #111: a committed draft whose single compile issue is a published status
  // without `publishedAt`, so validation targets the Published date control.
  const undated = await saveStudioDraft(
    adapter,
    STUDIO_ACCEPTANCE_UNDATED_SLUG,
    {
      metadata: {
        ...metadata,
        title: 'Undated Notes',
        slug: STUDIO_ACCEPTANCE_UNDATED_SLUG,
        status: 'published',
        cover: { src: 'articles/undated-notes/cover.svg', alt: 'Undated notes.' },
      },
      body: 'A valid paragraph whose metadata is not publishable yet.',
      concurrency: { baseMainSha: main.value.sha },
    },
    { mediaBaseUrl: FIXTURE_MEDIA_BASE_URL },
  );
  if (undated.kind !== 'saved') {
    throw new Error(`Studio acceptance bootstrap failed to seed undated work (${undated.kind}).`);
  }

  const failedPullNumber = await seedApprovedChange(
    adapter,
    main.value.sha,
    metadata,
    STUDIO_ACCEPTANCE_FAILED_SLUG,
    'Failed Crossing',
  );
  adapter.seedCheckRun(failedPullNumber, {
    name: 'verify',
    status: 'completed',
    conclusion: 'failure',
    url: 'https://github.com/studio-acceptance-fixture/checks/failed-crossing',
  });

  await seedApprovedChange(
    adapter,
    main.value.sha,
    metadata,
    STUDIO_ACCEPTANCE_APPROVED_SLUG,
    'Approved Passage',
  );

  const checkingPullNumber = await seedApprovedChange(
    adapter,
    main.value.sha,
    metadata,
    STUDIO_ACCEPTANCE_CHECKING_SLUG,
    'Checking Tide',
  );
  adapter.seedCheckRun(checkingPullNumber, {
    name: 'verify',
    status: 'in_progress',
    conclusion: null,
    url: 'https://github.com/studio-acceptance-fixture/checks/checking-tide',
  });

  return adapter;
}

/**
 * Applies a #77 recovery scenario requested via
 * `STUDIO_ACCEPTANCE_RECOVERY_HEADER` by mutating the shared acceptance
 * fake-GitHub world. Wired only into the existing-article mutation actions
 * (`save`, `replace`, `publish`), and a no-op unless acceptance mode is
 * active — production never defines the gating binding, and a stray header
 * on a real deployment changes nothing.
 *
 * Scenarios (header value):
 * - `main-moved`   — advances `main` by one unrelated commit, so a save
 *   whose loaded evidence predates it fails closed as `save_conflict`
 *   (with `replacementAvailable` when the real eligibility gate passes).
 *   Idempotent per request: a header that also rides on the follow-up
 *   Replace submission just moves `main` again, which replacement
 *   tolerates by construction (it re-reads fresh `main`).
 * - `draft-moved`  — lands one further commit on the article's own draft
 *   branch (a concurrent session's save), so an exact-head Publish fails
 *   closed as `publish_conflict`.
 * - `save-offline` — makes exactly the NEXT `get-main-ref` call fail with
 *   a transport failure (one-shot), so the targeted Save reports
 *   `save_failed` while the follow-up page load still renders.
 * - `replace-late-offline` — advances `main` by one unrelated commit AND
 *   makes exactly the NEXT `delete-branch` call fail with a transport
 *   failure (one-shot), so a targeted Replace verifies eligibility against
 *   the just-moved `main`, closes the old Draft PR, and then stops at the
 *   `delete-branch` phase — the post-mutation partial replacement state
 *   (#77). The main move is part of the scenario because a post-conflict
 *   page re-render refreshes the form's concurrency evidence: without a
 *   further move the replacement would stop pre-mutation as `not-eligible`
 *   and the armed failure would leak to an unrelated later operation.
 *
 * Unknown or absent header values change nothing.
 */
export async function applyStudioAcceptanceRecoveryScenario(
  request: Request,
  env: WorkerEnv | undefined,
  slug: string,
): Promise<void> {
  if (!isStudioAcceptanceMode(env)) return;
  const scenario = request.headers.get(STUDIO_ACCEPTANCE_RECOVERY_HEADER);
  if (scenario === null) return;
  const adapter = await resolveStudioAcceptanceAdapter(env as WorkerEnv);
  if (!(adapter instanceof FakeGithubAdapter)) return;
  switch (scenario) {
    case 'main-moved': {
      adapter.advanceMain();
      return;
    }
    case 'draft-moved': {
      const branchName = `studio/article/${slug}`;
      const branch = await adapter.getBranch(branchName);
      if (!branch.ok) return;
      await adapter.commitFile({
        branch: branchName,
        path: `content/articles/${slug}.md`,
        content: `Moved by a concurrent session for the ${slug} recovery scenario.`,
        message: `Studio: save draft for ${slug}`,
        expectedHeadSha: branch.value.sha,
      });
      return;
    }
    case 'save-offline': {
      adapter.failNextOperation('get-main-ref');
      return;
    }
    case 'replace-late-offline': {
      adapter.advanceMain();
      adapter.failNextOperation('delete-branch');
      return;
    }
    default:
      return;
  }
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
  input: RequestInfo | URL,
  _init?: RequestInit,
): Promise<Response> {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (url.pathname === `/articles/${STUDIO_ACCEPTANCE_LIVE_SLUG}`) {
    const liveFingerprint = await liveFingerprintPromise;
    return new Response(`<meta name="jelementi-content-version" content="${liveFingerprint}" />`, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  }
  if (url.pathname === '/index.json') {
    return Response.json([liveIndexEvidence]);
  }
  return new Response('Studio acceptance fixture: no matching production content exists.', {
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
