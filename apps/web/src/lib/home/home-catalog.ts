import type { ArticleIndexEntry } from '@jelementi/article-model';
import { projectCategoryDirectory } from '../category-projection';
import { projectSeries, type SeriesProjection } from '../series/series-projection';

export interface HomeCategoryShelf {
  category: string;
  categorySlug: string;
  total: number;
  compact: boolean;
  entries: readonly ArticleIndexEntry[];
}

export interface HomeCatalog {
  lead: ArticleIndexEntry | undefined;
  recent: readonly ArticleIndexEntry[];
  series: SeriesProjection | undefined;
  shelves: readonly HomeCategoryShelf[];
}

/** Publication date ranks stories; category totals decide the three full shelves. */
export function projectHomeCatalog(
  index: readonly ArticleIndexEntry[],
  series: readonly SeriesProjection[] = projectSeries(index),
): HomeCatalog {
  const ordered = [...index].sort(
    (left, right) =>
      right.publishedAt.localeCompare(left.publishedAt) || left.slug.localeCompare(right.slug),
  );
  const lead = ordered[0];
  const recent = ordered.slice(1, 8);
  const featuredSeries = series[0];
  const shown = new Set(
    [...ordered.slice(0, 8), ...(featuredSeries?.parts ?? [])].map((a) => a.slug),
  );
  const remaining = ordered.filter((article) => !shown.has(article.slug));
  const shelves = projectCategoryDirectory(index).flatMap((category, rank) => {
    const compact = rank >= 3;
    const entries = remaining
      .filter((article) => article.categorySlug === category.slug)
      .slice(0, compact ? 2 : 3);
    return entries.length
      ? [
          {
            category: category.name,
            categorySlug: category.slug,
            total: category.count,
            compact,
            entries,
          },
        ]
      : [];
  });
  return { lead, recent, series: featuredSeries, shelves };
}
