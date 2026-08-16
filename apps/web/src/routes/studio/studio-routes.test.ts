import { describe, expect, it, vi } from 'vitest';

const { requireStudioAccess } = vi.hoisted(() => ({
  requireStudioAccess: vi.fn(async () => ({ ok: true as const, email: 'darko@example.com' })),
}));

vi.mock('$lib/server/studio/request-guard.server', () => ({ requireStudioAccess }));

import {
  load as studioArticleLoad,
  prerender as articlePrerender,
} from './articles/[slug]/+page.server';
import { load as studioLayoutLoad, prerender as layoutPrerender } from './+layout.server';
import { load as studioLoad, prerender as studioPrerender } from './+page.server';

const request = new Request('https://jelementi.quz.ma/studio');

function eventFor<T extends (...args: never[]) => unknown>(
  load: T,
  params: Record<string, string> = {},
): Parameters<T>[0] {
  return {
    request,
    platform: undefined,
    params,
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
    await studioLoad(eventFor(studioLoad));
    await studioArticleLoad(eventFor(studioArticleLoad, { slug: 'tristan-da-cunha' }));

    expect(requireStudioAccess).toHaveBeenCalledTimes(3);
  });

  it('returns the requested article slug only after authorization', async () => {
    const result = await studioArticleLoad(
      eventFor(studioArticleLoad, { slug: 'tristan-da-cunha' }),
    );

    expect(result).toEqual({ slug: 'tristan-da-cunha' });
  });

  it('rejects malformed article slugs', async () => {
    await expect(
      studioArticleLoad(eventFor(studioArticleLoad, { slug: '../secrets' })),
    ).rejects.toMatchObject({ status: 400 });
  });
});
