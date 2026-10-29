import type { ArticleIndexEntry } from '@jelementi/article-model';

export interface CategoryDirectoryEntry {
  name: string;
  slug: string;
  count: number;
  newest: ArticleIndexEntry;
  newestArticles: readonly ArticleIndexEntry[];
}

function newestFirst(left: ArticleIndexEntry, right: ArticleIndexEntry): number {
  return right.publishedAt.localeCompare(left.publishedAt) || left.slug.localeCompare(right.slug);
}

/** One deterministic newest-first reading sequence, including individual series parts. */
export function projectCategoryArticles(
  index: readonly ArticleIndexEntry[],
  categorySlug: string,
): ArticleIndexEntry[] {
  return index.filter((entry) => entry.categorySlug === categorySlug).sort(newestFirst);
}

/** The full category list, ranked by size, independently of the curated navigation. */
export function projectCategoryDirectory(
  index: readonly ArticleIndexEntry[],
): CategoryDirectoryEntry[] {
  const grouped = new Map<string, ArticleIndexEntry[]>();
  for (const article of index) {
    const articles = grouped.get(article.categorySlug) ?? [];
    articles.push(article);
    grouped.set(article.categorySlug, articles);
  }
  return [...grouped.entries()]
    .map(([slug, articles]) => {
      const ordered = articles.sort(newestFirst);
      const newest = ordered[0];
      if (newest === undefined) throw new Error(`Category projection is empty: ${slug}.`);
      return {
        name: newest.category,
        slug,
        count: ordered.length,
        newest,
        newestArticles: ordered,
      };
    })
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, 'en'));
}
