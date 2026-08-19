import { describe, expect, it } from 'vitest';
import type { ArticleIndexEntry } from '@jelementi/article-model';
import { projectHomeCatalog } from './home-catalog';

function article(slug: string, publishedAt: string): ArticleIndexEntry {
  return {
    slug,
    title: `Title ${slug}`,
    excerpt: `Excerpt ${slug}`,
    publishedAt,
    updatedAt: publishedAt,
    category: 'Field Notes',
    categorySlug: 'field-notes',
    tags: [],
    author: 'Jelementi',
    cover: { src: `https://example.test/${slug}.webp`, alt: `Cover ${slug}` },
    readingTimeMinutes: 3,
    searchText: slug,
  };
}

describe('Home catalog projection', () => {
  it('sorts published metadata deterministically into lead, recent, and more tiers', () => {
    const input = [
      article('older-b', '2026-08-01'),
      article('recent-c', '2026-08-15'),
      article('newest', '2026-08-18'),
      article('older-a', '2026-08-01'),
      article('recent-a', '2026-08-16'),
      article('recent-b', '2026-08-15'),
      article('more-newest', '2026-08-10'),
    ];

    const projected = projectHomeCatalog(input);

    expect(projected.lead?.slug).toBe('newest');
    expect(projected.recent.map(({ slug }) => slug)).toEqual(['recent-a', 'recent-b', 'recent-c']);
    expect(projected.more.map(({ slug }) => slug)).toEqual(['more-newest', 'older-a', 'older-b']);
    expect(input.map(({ slug }) => slug)).toEqual([
      'older-b',
      'recent-c',
      'newest',
      'older-a',
      'recent-a',
      'recent-b',
      'more-newest',
    ]);
  });

  it('omits empty tiers for sparse and intermediate catalogs without losing membership', () => {
    const sparse = projectHomeCatalog([article('only', '2026-08-18')]);
    expect(sparse.lead?.slug).toBe('only');
    expect(sparse.recent).toEqual([]);
    expect(sparse.more).toEqual([]);

    const intermediateInput = [
      article('second', '2026-08-17'),
      article('fourth', '2026-08-15'),
      article('first', '2026-08-18'),
      article('third', '2026-08-16'),
    ];
    const intermediate = projectHomeCatalog(intermediateInput);
    expect(intermediate.lead?.slug).toBe('first');
    expect(intermediate.recent.map(({ slug }) => slug)).toEqual(['second', 'third', 'fourth']);
    expect(intermediate.more).toEqual([]);

    const allSlugs = [intermediate.lead, ...intermediate.recent, ...intermediate.more].flatMap(
      (entry) => (entry === undefined ? [] : [entry.slug]),
    );
    expect(allSlugs).toEqual(['first', 'second', 'third', 'fourth']);
    expect(new Set(allSlugs).size).toBe(intermediateInput.length);
  });
});
