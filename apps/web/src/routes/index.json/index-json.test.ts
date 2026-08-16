import { describe, expect, it, vi } from 'vitest';
import type { ArticleIndexEntry } from '@jelementi/article-model';
import type { GeneratedContent } from '../../lib/generated-content';

// This route statically imports the real, eagerly-globbed generated/index.json
// via generated-content.server.ts (a build-time artifact that only exists
// after `content:build` has run). Mocking it here keeps this unit test
// hermetic and independent of pipeline step order (`pnpm test` runs before
// `pnpm build:web` in `verify:deploy`).
const entry: ArticleIndexEntry = {
  slug: 'known',
  title: 'Known',
  excerpt: 'Excerpt',
  publishedAt: '2026-07-26',
  updatedAt: '2026-07-26',
  category: 'History',
  categorySlug: 'history',
  tags: ['remote places'],
  author: 'Jelementi',
  cover: { src: 'https://example.org/c.webp', alt: 'Cover' },
  readingTimeMinutes: 1,
  searchText: 'known excerpt',
};

const generatedContent: GeneratedContent = { index: [entry], articles: {} };

vi.mock('../../lib/generated-content.server', () => ({ generatedContent }));

const { GET, prerender } = await import('./+server');

describe('/index.json', () => {
  it('is prerendered', () => {
    expect(prerender).toBe(true);
  });

  it('serves the site index as JSON, dropping search text, with a noindex header', async () => {
    const response = GET({} as unknown as Parameters<typeof GET>[0]) as Response;

    expect(response.headers.get('content-type')).toBe('application/json');
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex');

    const body: unknown = await response.json();
    expect(body).toEqual([
      {
        slug: entry.slug,
        title: entry.title,
        excerpt: entry.excerpt,
        publishedAt: entry.publishedAt,
        updatedAt: entry.updatedAt,
        category: entry.category,
        categorySlug: entry.categorySlug,
        tags: entry.tags,
        author: entry.author,
        cover: entry.cover,
        readingTimeMinutes: entry.readingTimeMinutes,
      },
    ]);
    expect((body as Record<string, unknown>[])[0]).not.toHaveProperty('searchText');
  });
});
