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
  it('orders the full category list by count then name, independently of navigation', () => {
    const directory = projectCategoryDirectory(unsorted);
    expect(directory.map(({ name, count, newest }) => [name, count, newest.slug])).toEqual([
      ['Culture', 3, 'culture-new'],
      ['Science', 2, 'science-new'],
      ['Field Notes', 1, 'field-only'],
    ]);
    expect(directory.reduce((total, category) => total + category.count, 0)).toBe(6);
    expect(directory.at(-1)?.newestArticles).toEqual([unsorted[2]]);
  });
  it('retains every story including series parts, newest first for section previews', () => {
    const entries = Array.from({ length: 6 }, (_, i) => ({
      ...article(`part-${i + 1}`, 'Places', 'places', `2026-04-0${i + 1}`),
      series: { slug: 'citadel', title: 'Citadel', part: i + 1 },
    }));
    const [places] = projectCategoryDirectory(entries);
    expect(places?.count).toBe(6);
    expect(places?.newestArticles.map((entry) => entry.slug)).toEqual([
      'part-6',
      'part-5',
      'part-4',
      'part-3',
      'part-2',
      'part-1',
    ]);
    expect(entries[0]?.slug).toBe('part-1');
  });
  it('projects listings newest first with slug ordering for date ties, without mutating input', () => {
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
    expect(tied[0]?.slug).toBe('science-zulu');
    expect(projectCategoryDirectory([])).toEqual([]);
  });
});
