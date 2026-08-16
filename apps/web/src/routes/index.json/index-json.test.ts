import { describe, expect, it } from 'vitest';
import { generatedContent } from '../../lib/generated-content.server';
import { GET, prerender } from './+server';

describe('/index.json', () => {
  it('is prerendered', () => {
    expect(prerender).toBe(true);
  });

  it('serves the site index as JSON, dropping search text, with a noindex header', async () => {
    const response = GET({} as unknown as Parameters<typeof GET>[0]) as Response;

    expect(response.headers.get('content-type')).toBe('application/json');
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex');

    const body: unknown = await response.json();
    expect(Array.isArray(body)).toBe(true);
    const entries = body as Record<string, unknown>[];
    expect(entries.length).toBe(generatedContent.index.length);
    expect(entries.length).toBeGreaterThan(0);

    for (const [index, entry] of entries.entries()) {
      const source = generatedContent.index[index];
      if (source === undefined) throw new Error('missing generated index entry');
      expect(entry).toEqual({
        slug: source.slug,
        title: source.title,
        excerpt: source.excerpt,
        publishedAt: source.publishedAt,
        updatedAt: source.updatedAt,
        category: source.category,
        categorySlug: source.categorySlug,
        tags: source.tags,
        author: source.author,
        cover: source.cover,
        readingTimeMinutes: source.readingTimeMinutes,
      });
      expect(entry).not.toHaveProperty('searchText');
    }
  });
});
