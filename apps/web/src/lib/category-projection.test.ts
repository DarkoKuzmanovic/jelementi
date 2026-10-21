import { describe, expect, it } from 'vitest';
import type { ArticleIndexEntry } from '@jelementi/article-model';
import { projectCategoryArticles, projectCategoryDirectory } from './category-projection';

function article(
  slug: string,
  category: string,
  categorySlug: string,
  publishedAt: string,
): ArticleIndexEntry {
  return {
    slug,
    title: `${slug} title`,
    excerpt: `${slug} excerpt`,
    publishedAt,
    updatedAt: publishedAt,
    category,
    categorySlug,
    tags: [],
    author: 'Jelementi',
    cover: { src: `https://example.test/${slug}.webp`, alt: `${slug} cover` },
    readingTimeMinutes: 3,
    searchText: slug,
  };
}

const unsorted = [
  article('science-old', 'Science', 'science', '2026-01-01'),
  article('culture-old', 'Culture', 'culture', '2026-02-01'),
  article('field-only', 'Field Notes', 'field-notes', '2026-03-01'),
  article('science-new', 'Science', 'science', '2026-04-01'),
  article('culture-new', 'Culture', 'culture', '2026-05-01'),
  article('culture-middle', 'Culture', 'culture', '2026-03-15'),
];

describe('category projections', () => {
  it('orders categories by published count descending and category name for ties', () => {
    expect(projectCategoryDirectory(unsorted).map(({ name, count }) => [name, count])).toEqual([
      ['Culture', 3],
      ['Science', 2],
      ['Field Notes', 1],
    ]);
  });

  it('projects each category newest article independently of input order', () => {
    expect(
      projectCategoryDirectory(unsorted).map(({ slug, newest }) => [slug, newest.slug]),
    ).toEqual([
      ['culture', 'culture-new'],
      ['science', 'science-new'],
      ['field-notes', 'field-only'],
    ]);
  });

  it('includes exactly the three newest category articles for directory entries', () => {
    const directory = projectCategoryDirectory([
      ...unsorted,
      article('culture-oldest', 'Culture', 'culture', '2026-01-15'),
    ]);

    expect(
      directory[0]?.newestArticles.map((entry) =>
        entry.kind === 'article' ? entry.article.slug : entry.title,
      ),
    ).toEqual(['culture-new', 'culture-middle', 'culture-old']);
    expect(
      directory[1]?.newestArticles.map((entry) =>
        entry.kind === 'article' ? entry.article.slug : entry.title,
      ),
    ).toEqual(['science-new', 'science-old']);
  });

  it('collapses grouped parts into one newest-directory entry while retaining article counts', () => {
    const part = (slug: string, publishedAt: string, partNumber: number) => ({
      ...article(slug, 'Places', 'places', publishedAt),
      series: { slug: 'citadel', title: 'Citadel', part: partNumber },
    });
    const [places] = projectCategoryDirectory([
      part('citadel-1', '2026-04-10', 1),
      part('citadel-2', '2026-04-11', 2),
      part('citadel-3', '2026-04-12', 3),
      article('place-older-one', 'Places', 'places', '2026-04-09'),
      article('place-older-two', 'Places', 'places', '2026-04-08'),
    ]);

    expect(places?.count).toBe(5);
    expect(
      places?.newestArticles.map((entry) =>
        entry.kind === 'series' ? entry.title : entry.article.slug,
      ),
    ).toEqual(['Citadel · series in 3 parts', 'place-older-one', 'place-older-two']);
    expect(places?.newestArticles[0]).toMatchObject({
      kind: 'series',
      href: 'citadel-1',
      cover: { src: 'https://example.test/citadel-3.webp' },
    });
  });

  it('projects category listings newest first with slug ordering for date ties', () => {
    const tied = [
      article('science-zulu', 'Science', 'science', '2026-04-01'),
      article('science-alpha', 'Science', 'science', '2026-04-01'),
      ...unsorted,
    ];

    expect(projectCategoryArticles(tied, 'science').map(({ slug }) => slug)).toEqual([
      'science-alpha',
      'science-new',
      'science-zulu',
      'science-old',
    ]);
    expect(projectCategoryArticles(tied, 'missing')).toEqual([]);
  });
});
