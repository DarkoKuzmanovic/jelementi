import { describe, expect, it } from 'vitest';
import type { ArticleIndexEntry } from '@jelementi/article-model';
import { projectHomeCatalog } from './home-catalog';

function article(
  slug: string,
  publishedAt: string,
  category = 'Field Notes',
  categorySlug = 'field-notes',
): ArticleIndexEntry {
  return {
    slug,
    title: `Title ${slug}`,
    excerpt: `Excerpt ${slug}`,
    publishedAt,
    updatedAt: publishedAt,
    category,
    categorySlug,
    tags: [],
    author: 'Jelementi',
    cover: { src: `https://example.test/${slug}.webp`, alt: `Cover ${slug}` },
    readingTimeMinutes: 3,
    searchText: slug,
  };
}

describe('Home catalog projection', () => {
  it('orders the lead and recent tiers by publication date with deterministic slug ties', () => {
    const input = [
      article('older-b', '2026-08-01'),
      article('recent-c', '2026-08-15'),
      article('newest', '2026-08-18'),
      article('older-a', '2026-08-01'),
      article('recent-a', '2026-08-16'),
      article('recent-b', '2026-08-15'),
    ];

    const projected = projectHomeCatalog(input);

    expect(projected.lead?.slug).toBe('newest');
    expect(projected.recent.map(({ slug }) => slug)).toEqual(['recent-a', 'recent-b', 'recent-c']);
    expect(
      projected.shelves.map(({ category, categorySlug, total, entries }) => ({
        category,
        categorySlug,
        total,
        entries: entries.map((entry) =>
          entry.kind === 'article' ? entry.article.slug : entry.title,
        ),
      })),
    ).toEqual([
      {
        category: 'Field Notes',
        categorySlug: 'field-notes',
        total: 6,
        entries: ['older-a', 'older-b'],
      },
    ]);
    expect(input.map(({ slug }) => slug)).toEqual([
      'older-b',
      'recent-c',
      'newest',
      'older-a',
      'recent-a',
      'recent-b',
    ]);
  });

  it('excludes lead and recent, follows directory ordering, caps shelves, and omits empty categories', () => {
    const input = [
      article('history-old', '2026-08-11', 'History', 'history'),
      article('place-old', '2026-08-14', 'Places', 'places'),
      article('lead-place', '2026-08-18', 'Places', 'places'),
      article('science-fourth', '2026-08-08', 'Science', 'science'),
      article('science-new', '2026-08-13', 'Science', 'science'),
      article('recent-solo', '2026-08-15', 'Solo', 'solo'),
      article('place-older', '2026-08-09', 'Places', 'places'),
      article('recent-history', '2026-08-17', 'History', 'history'),
      article('science-third', '2026-08-10', 'Science', 'science'),
      article('recent-place', '2026-08-16', 'Places', 'places'),
      article('science-middle', '2026-08-12', 'Science', 'science'),
    ];

    const projected = projectHomeCatalog(input);

    expect(projected.lead?.slug).toBe('lead-place');
    expect(projected.recent.map(({ slug }) => slug)).toEqual([
      'recent-history',
      'recent-place',
      'recent-solo',
    ]);
    expect(
      projected.shelves.map(({ category, total, entries }) => [
        category,
        total,
        entries.map((entry) => (entry.kind === 'article' ? entry.article.slug : entry.title)),
      ]),
    ).toEqual([
      ['Places', 4, ['place-old', 'place-older']],
      ['Science', 4, ['science-new', 'science-middle', 'science-third']],
      ['History', 2, ['history-old']],
    ]);
    expect(
      projected.shelves.flatMap(({ entries }) =>
        entries.map((entry) => (entry.kind === 'article' ? entry.article.slug : entry.title)),
      ),
    ).not.toContain('lead-place');
    expect(
      projected.shelves.flatMap(({ entries }) =>
        entries.map((entry) => (entry.kind === 'article' ? entry.article.slug : entry.title)),
      ),
    ).not.toContain('recent-place');
  });

  it('collapses remaining series parts to one shelf entry without changing article counts', () => {
    const seriesPart = (slug: string, publishedAt: string, part: number) => ({
      ...article(slug, publishedAt),
      series: { slug: 'ridge', title: 'Ridge', part },
    });
    const projected = projectHomeCatalog([
      article('lead', '2026-08-18'),
      article('recent-a', '2026-08-17'),
      article('recent-b', '2026-08-16'),
      article('recent-c', '2026-08-15'),
      seriesPart('ridge-1', '2026-08-12', 1),
      seriesPart('ridge-2', '2026-08-13', 2),
      seriesPart('ridge-3', '2026-08-14', 3),
    ]);

    expect(projected.shelves[0]?.total).toBe(7);
    expect(projected.shelves[0]?.entries).toMatchObject([
      {
        kind: 'series',
        href: 'ridge-1',
        title: 'Ridge · series in 3 parts',
        cover: { src: 'https://example.test/ridge-3.webp' },
        readingTimeMinutes: 9,
      },
    ]);
  });

  it('omits empty lead/recent and shelf tiers for sparse catalogs', () => {
    const sparse = projectHomeCatalog([article('only', '2026-08-18')]);
    expect(sparse.lead?.slug).toBe('only');
    expect(sparse.recent).toEqual([]);
    expect(sparse.shelves).toEqual([]);

    const intermediateInput = [
      article('second', '2026-08-17'),
      article('fourth', '2026-08-15'),
      article('first', '2026-08-18'),
      article('third', '2026-08-16'),
    ];
    const intermediate = projectHomeCatalog(intermediateInput);
    expect(intermediate.lead?.slug).toBe('first');
    expect(intermediate.recent.map(({ slug }) => slug)).toEqual(['second', 'third', 'fourth']);
    expect(intermediate.shelves).toEqual([]);
  });
});
