import type { ArticleIndexEntry } from '@jelementi/article-model';

export interface SeriesPart extends Pick<
  ArticleIndexEntry,
  'slug' | 'title' | 'excerpt' | 'publishedAt' | 'cover' | 'readingTimeMinutes'
> {
  part: number;
}

export interface SeriesProjection {
  slug: string;
  title: string;
  category: string;
  categorySlug: string;
  parts: readonly SeriesPart[];
  totalMinutes: number;
}

function newestPart(series: SeriesProjection): SeriesPart {
  const newest = series.parts.reduce<SeriesPart | undefined>(
    (current, part) =>
      current === undefined || part.publishedAt > current.publishedAt ? part : current,
    undefined,
  );
  if (newest === undefined) throw new Error(`Series projection is empty: ${series.slug}.`);
  return newest;
}

/** Projects the published index into deterministic, part-ordered series. */
export function projectSeries(index: readonly ArticleIndexEntry[]): SeriesProjection[] {
  const grouped = new Map<string, ArticleIndexEntry[]>();
  for (const article of index) {
    if (article.series === undefined) continue;
    const parts = grouped.get(article.series.slug) ?? [];
    parts.push(article);
    grouped.set(article.series.slug, parts);
  }

  return [...grouped.entries()]
    .filter(([, articles]) => articles.length >= 2)
    .map(([slug, articles]) => {
      const first = articles[0];
      if (first?.series === undefined) throw new Error(`Series projection is empty: ${slug}.`);
      const parts = articles
        .map((article): SeriesPart => {
          const membership = article.series;
          if (membership === undefined) {
            throw new Error(`Series part metadata is missing: ${article.slug}.`);
          }
          return {
            part: membership.part,
            slug: article.slug,
            title: article.title,
            excerpt: article.excerpt,
            publishedAt: article.publishedAt,
            cover: article.cover,
            readingTimeMinutes: article.readingTimeMinutes,
          };
        })
        .sort((left, right) => left.part - right.part);
      return {
        slug,
        title: first.series.title,
        category: first.category,
        categorySlug: first.categorySlug,
        parts,
        totalMinutes: parts.reduce((total, part) => total + part.readingTimeMinutes, 0),
      };
    })
    .sort((left, right) => {
      const dateDifference = newestPart(right).publishedAt.localeCompare(
        newestPart(left).publishedAt,
      );
      return dateDifference || left.slug.localeCompare(right.slug);
    });
}

/** Removes only the matching series title and part prefix, ignoring case. */
export function seriesPartTitle(series: SeriesProjection, part: SeriesPart): string {
  const prefix = `${series.title}, part ${part.part}: `;
  return part.title.toLowerCase().startsWith(prefix.toLowerCase())
    ? part.title.slice(prefix.length)
    : part.title;
}
