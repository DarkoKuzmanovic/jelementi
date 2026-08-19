import type { ArticleIndexEntry } from '@jelementi/article-model';

export interface HomeCatalog {
  lead: ArticleIndexEntry | undefined;
  recent: readonly ArticleIndexEntry[];
  more: readonly ArticleIndexEntry[];
}

function compareSlug(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * Projects the validated published index into the fixed Editorial-front tiers.
 * Publication date is the only ranking signal; slug provides a deterministic
 * tie-break for articles published on the same calendar date.
 */
export function projectHomeCatalog(index: readonly ArticleIndexEntry[]): HomeCatalog {
  const ordered = [...index].sort(
    (left, right) =>
      right.publishedAt.localeCompare(left.publishedAt) || compareSlug(left.slug, right.slug),
  );

  return {
    lead: ordered[0],
    recent: ordered.slice(1, 4),
    more: ordered.slice(4),
  };
}
