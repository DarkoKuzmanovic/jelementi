import type { ArticleIndex, ArticleIndexEntry } from '@jelementi/article-model';

export interface CategoryDirectoryEntry {
  name: string;
  slug: string;
  count: number;
  newest: ArticleIndexEntry;
}

function newestFirst(left: ArticleIndexEntry, right: ArticleIndexEntry): number {
  return right.publishedAt.localeCompare(left.publishedAt) || left.slug.localeCompare(right.slug);
}

/** Projects one deterministic newest-first reading sequence from the validated published index. */
export function projectCategoryArticles(index: ArticleIndex, categorySlug: string): ArticleIndex {
  return index.filter((entry) => entry.categorySlug === categorySlug).sort(newestFirst);
}

/** Projects the restrained Categories directory without introducing category state. */
export function projectCategoryDirectory(index: ArticleIndex): CategoryDirectoryEntry[] {
  const grouped = new Map<string, ArticleIndexEntry[]>();
  for (const article of index) {
    const articles = grouped.get(article.categorySlug) ?? [];
    articles.push(article);
    grouped.set(article.categorySlug, articles);
  }

  return [...grouped.entries()]
    .map(([slug, articles]) => {
      const ordered = [...articles].sort(newestFirst);
      const newest = ordered[0];
      if (newest === undefined) throw new Error(`Category projection is empty: ${slug}.`);
      return { name: newest.category, slug, count: ordered.length, newest };
    })
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, 'en'));
}
