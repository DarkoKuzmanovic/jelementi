import type { ArticleIndexEntry } from '@jelementi/article-model';
import { projectCategoryDirectory } from '../category-projection';
import { projectSeries, type SeriesProjection } from '../series/series-projection';

export interface HomeCategoryShelf {
  category: string;
  categorySlug: string;
  total: number;
  compact: boolean;
  /** Newest story in the section, for its cover when every story is shown above. */
  newest: ArticleIndexEntry;
  entries: readonly ArticleIndexEntry[];
}

export interface HomeCatalog {
  lead: ArticleIndexEntry | undefined;
  recent: readonly ArticleIndexEntry[];
  /** Every series, newest first; the first is featured. */
  series: readonly SeriesProjection[];
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
  // Series parts appear once, in the Series section, never in Latest stories.
  const seriesParts = new Set(series.flatMap((entry) => entry.parts.map((part) => part.slug)));
  const recent = ordered
    .slice(1)
    .filter((article) => !seriesParts.has(article.slug))
    .slice(0, 7);
  const shown = new Set([
    ...(lead ? [lead.slug] : []),
    ...recent.map((a) => a.slug),
    ...seriesParts,
  ]);
  const remaining = ordered.filter((article) => !shown.has(article.slug));
  const shelves = projectCategoryDirectory(index).flatMap((category, rank) => {
    const compact = rank >= 3;
    const entries = remaining
      .filter((article) => article.categorySlug === category.slug)
      .slice(0, compact ? 2 : 3);
    // Once shelves exist, no section is dropped: one shown in full above keeps its label and link.
    return entries.length || remaining.length
      ? [
          {
            category: category.name,
            categorySlug: category.slug,
            total: category.count,
            compact,
            newest: category.newest,
            entries,
          },
        ]
      : [];
  });
  return { lead, recent, series, shelves };
}
