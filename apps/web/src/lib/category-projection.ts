import type { ArticleIndexEntry } from '@jelementi/article-model';
import { collapseSeriesEntries, projectSeries, type SeriesAwareCatalogEntry, type SeriesProjection } from './series/series-projection';

export interface CategoryDirectoryEntry {
  name: string;
  slug: string;
  count: number;
  newest: ArticleIndexEntry;
  newestArticles: readonly SeriesAwareCatalogEntry[];
}

function newestFirst(left: ArticleIndexEntry, right: ArticleIndexEntry): number {
  return right.publishedAt.localeCompare(left.publishedAt) || left.slug.localeCompare(right.slug);
}

/** Projects one deterministic newest-first reading sequence from the validated published index. */
export function projectCategoryArticles(
  index: readonly ArticleIndexEntry[],
  categorySlug: string,
): ArticleIndexEntry[] {
  return index.filter((entry) => entry.categorySlug === categorySlug).sort(newestFirst);
}

/** Projects the restrained Categories directory without introducing category state. */
export function projectCategoryDirectory(
  index: readonly ArticleIndexEntry[],
  series: readonly SeriesProjection[] = projectSeries(index),
): CategoryDirectoryEntry[] {
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
      return {
        name: newest.category,
        slug,
        count: ordered.length,
        newest,
        newestArticles: collapseSeriesEntries(ordered, series).slice(0, 3),
      };
    })
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, 'en'));
}
