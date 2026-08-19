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
