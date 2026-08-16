import { describe, expect, it, vi } from 'vitest';
import { serializeArticleSource } from '@jelementi/content-compiler';
import { FakeGithubAdapter } from '../../lib/server/studio/github-adapter.fake';
import { saveStudioDraft } from '../../lib/server/studio/editor.server';
import type { StudioGithubConfig } from '../../lib/server/studio/config.server';
import type { StudioMetadata } from '../../lib/studio/contracts';

const { requireStudioAccess, requireStudioMutation } = vi.hoisted(() => ({
  requireStudioAccess: vi.fn(async () => ({ ok: true as const, email: 'darko@example.com' })),
  requireStudioMutation: vi.fn(async () => ({ ok: true as const, email: 'darko@example.com' })),
}));

vi.mock('$lib/server/studio/request-guard.server', () => ({
  requireStudioAccess,
  requireStudioMutation,
}));
vi.mock('../../lib/server/studio/request-guard.server', () => ({
  requireStudioAccess,
  requireStudioMutation,
}));

import {
  actions as studioArticleActions,
  load as studioArticleLoad,
  prerender as articlePrerender,
} from './articles/[slug]/+page.server';
import { load as studioLayoutLoad, prerender as layoutPrerender } from './+layout.server';
import {
  load as newArticleLoad,
  prerender as newArticlePrerender,
} from './articles/new/+page.server';
import { load as studioLoad, prerender as studioPrerender } from './+page.server';

const request = new Request('https://jelementi.quz.ma/studio');
const studioEnv: WorkerEnv = {
  ACCESS_TEAM_DOMAIN: 'https://jelementi.cloudflareaccess.com',
  ACCESS_AUD: 'studio-audience',
  ALLOWED_OPERATOR_EMAIL: 'darko@example.com',
  GITHUB_APP_ID: '123456',
  GITHUB_APP_CLIENT_ID: 'Iv1.client',
  GITHUB_INSTALLATION_ID: '654321',
  GITHUB_REPO_OWNER: 'DarkoKuzmanovic',
  GITHUB_REPO_NAME: 'jelementi',
  PRODUCTION_ORIGIN: 'https://jelementi.quz.ma',
  PUBLIC_MEDIA_BASE_URL: 'https://media.jelementi.quz.ma/',
  GITHUB_APP_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nfake\\n-----END PRIVATE KEY-----',
  R2_MEDIA: undefined,
};
const githubConfig: StudioGithubConfig = {
  appId: '12345',
  clientId: 'Iv1.client',
  installationId: '67890',
  owner: 'DarkoKuzmanovic',
  repo: 'jelementi',
  privateKey: 'test-private-key',
};
const studioAdapter = new FakeGithubAdapter(githubConfig);
studioAdapter.seedFile(
  'main',
  'content/articles/tristan-da-cunha.md',
  serializeArticleSource({
    frontmatter: {
      title: 'The 250 People at the End of the World',
      slug: 'tristan-da-cunha',
      excerpt: 'A remote settlement.',
      publishedAt: '2026-07-26',
      updatedAt: '2026-07-26',
      status: 'published',
      category: 'History',
      tags: ['islands'],
      author: 'Jelementi',
      cover: { src: 'articles/tristan-da-cunha/cover.svg', alt: 'Island' },
      references: [],
    },
    body: 'Body.',
  }),
  'b'.repeat(64),
);

function eventFor<T extends (...args: never[]) => unknown>(
  load: T,
  params: Record<string, string> = {},
  locals: Record<string, unknown> = {},
  platform: { env?: WorkerEnv } | undefined = undefined,
): Parameters<T>[0] {
  return {
    request,
    platform,
    params,
    locals,
  } as unknown as Parameters<T>[0];
}

describe('Studio route shell', () => {
  it('keeps every Studio route dynamic and server-rendered', () => {
    expect(layoutPrerender).toBe(false);
    expect(studioPrerender).toBe(false);
    expect(articlePrerender).toBe(false);
  });

  it('independently authorizes the Studio layout, list, and article loads', async () => {
    requireStudioAccess.mockClear();

    await studioLayoutLoad(eventFor(studioLayoutLoad));
    await studioLoad(
      eventFor(studioLoad, {}, { studioGithubAdapter: studioAdapter }, { env: studioEnv }),
    );
    await studioArticleLoad(
      eventFor(
        studioArticleLoad,
        { slug: 'tristan-da-cunha' },
        { studioGithubAdapter: studioAdapter },
        { env: studioEnv },
      ),
    );
    await newArticleLoad(
      eventFor(newArticleLoad, {}, { studioGithubAdapter: studioAdapter }, { env: studioEnv }),
    );

    expect(requireStudioAccess).toHaveBeenCalledTimes(4);
  });

  it('returns GitHub-derived article rows from the protected list load', async () => {
    const result = await studioLoad(
      eventFor(studioLoad, {}, { studioGithubAdapter: studioAdapter }, { env: studioEnv }),
    );

    expect(result.articles).toEqual([
      expect.objectContaining({
        slug: 'tristan-da-cunha',
        canonicalStatus: 'published',
        production: 'pending_deployment',
        change: 'none',
      }),
    ]);
  });

  it('returns the requested article slug only after authorization', async () => {
    const result = await studioArticleLoad(
      eventFor(
        studioArticleLoad,
        { slug: 'tristan-da-cunha' },
        { studioGithubAdapter: studioAdapter },
        { env: studioEnv },
      ),
    );

    expect(result.editor.metadata.slug).toBe('tristan-da-cunha');
    expect(result.editor.slugEditable).toBe(false);
  });

  it('keeps the new-article screen dynamic and starts with an editable slug', async () => {
    const result = await newArticleLoad(
      eventFor(newArticleLoad, {}, { studioGithubAdapter: studioAdapter }, { env: studioEnv }),
    );

    expect(newArticlePrerender).toBe(false);
    expect(result.editor.metadata.slug).toBe('new-article');
    expect(result.editor.slugEditable).toBe(true);
  });

  it('rejects malformed article slugs', async () => {
    await expect(
      studioArticleLoad(eventFor(studioArticleLoad, { slug: '../secrets' })),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('does not turn an unknown dynamic slug into a second creation route', async () => {
    await expect(
      studioArticleLoad(
        eventFor(
          studioArticleLoad,
          { slug: 'not-on-main' },
          { studioGithubAdapter: studioAdapter },
          { env: studioEnv },
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});

function actionEventFor(
  slug: string,
  locals: Record<string, unknown>,
  platform: { env?: WorkerEnv } | undefined,
  formFields?: Record<string, string>,
) {
  const actionRequest =
    formFields === undefined
      ? new Request('https://jelementi.quz.ma/studio/articles/' + slug, { method: 'POST' })
      : new Request('https://jelementi.quz.ma/studio/articles/' + slug, {
          method: 'POST',
          body: new URLSearchParams(formFields),
        });
  return {
    request: actionRequest,
    platform,
    params: { slug },
    locals,
  } as unknown as Parameters<NonNullable<typeof studioArticleActions.publish>>[0];
}

const draftSlug = 'a-draft-article';
const draftMetadata: StudioMetadata = {
  title: 'A Draft Article',
  slug: draftSlug,
  excerpt: 'An article being written in Studio.',
  status: 'draft',
  updatedAt: '2026-08-01',
  category: 'Ideas',
  tags: ['studio'],
  author: 'Jelementi',
  cover: { src: 'articles/a-draft-article/cover.svg', alt: 'A draft cover' },
  references: [],
};

describe('Studio publish & refresh actions', () => {
  it('rejects malformed article slugs for publish and refresh', async () => {
    await expect(
      studioArticleActions.publish?.(actionEventFor('../secrets', {}, undefined, {})),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      studioArticleActions.refresh?.(actionEventFor('../secrets', {}, undefined)),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects a publish request with a missing or malformed expectedHeadSha', async () => {
    requireStudioMutation.mockClear();
    const adapter = new FakeGithubAdapter(githubConfig);

    await expect(
      studioArticleActions.publish?.(
        actionEventFor(
          draftSlug,
          { studioGithubAdapter: adapter },
          { env: studioEnv },
          { expectedHeadSha: 'not-a-sha' },
        ),
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(requireStudioMutation).toHaveBeenCalledTimes(1);
  });

  it('publishes a saved draft: revalidates, flips ready, and enables auto-merge for the expected head', async () => {
    const adapter = new FakeGithubAdapter(githubConfig);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    const saved = await saveStudioDraft(
      adapter,
      draftSlug,
      {
        metadata: draftMetadata,
        body: 'Saved body.',
        concurrency: { baseMainSha: main.value.sha },
      },
      { mediaBaseUrl: studioEnv.PUBLIC_MEDIA_BASE_URL as string },
    );
    if (saved.kind !== 'saved') throw new Error(`save failed: ${saved.kind}`);

    const result = await studioArticleActions.publish?.(
      actionEventFor(
        draftSlug,
        { studioGithubAdapter: adapter },
        { env: studioEnv },
        { expectedHeadSha: saved.concurrency.draftHeadSha as string },
      ),
    );

    expect(result).toMatchObject({
      publish: { kind: 'published', pullRequest: { number: saved.pullRequest.number } },
    });
  });

  it('refreshes status via requireStudioMutation without background polling', async () => {
    requireStudioMutation.mockClear();
    const adapter = new FakeGithubAdapter(githubConfig);
    const main = await adapter.getMainRef();
    if (!main.ok) throw new Error('main missing');
    await saveStudioDraft(
      adapter,
      draftSlug,
      {
        metadata: draftMetadata,
        body: 'Saved body.',
        concurrency: { baseMainSha: main.value.sha },
      },
      { mediaBaseUrl: studioEnv.PUBLIC_MEDIA_BASE_URL as string },
    );

    const result = await studioArticleActions.refresh?.(
      actionEventFor(draftSlug, { studioGithubAdapter: adapter }, { env: studioEnv }),
    );

    expect(requireStudioMutation).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ status: { kind: 'draft_valid' } });
  });
});
