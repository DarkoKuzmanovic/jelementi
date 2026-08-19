import { categorySlug, type ArticleIndex, type ArticleIndexEntry } from '@jelementi/article-model';

function newestFirst(entries: readonly ArticleIndexEntry[]): ArticleIndexEntry[] {
  return [...entries].sort((left, right) => {
    const order = right.publishedAt.localeCompare(left.publishedAt);
    return order !== 0 ? order : left.slug.localeCompare(right.slug);
  });
}

export interface ArticleContinuation {
  /** The oldest article in its category has no wrapped continuation. */
  nextOlder: ArticleIndexEntry | null;
}

/**
 * Reader-only continuation projection (#101): exactly one next-older article
 * from the canonical newest-first category sequence, or none for the oldest
 * article. Studio preview must never receive this projection — the shared
 * ArticleRenderer stays content-only.
 */
export function articleContinuation(
  index: ArticleIndex,
  article: { slug: string; category: string },
): ArticleContinuation {
  const sequence = newestFirst(
    index.filter((entry) => entry.categorySlug === categorySlug(article.category)),
  );
  const position = sequence.findIndex((entry) => entry.slug === article.slug);
  if (position === -1) return { nextOlder: null };
  return { nextOlder: sequence[position + 1] ?? null };
}
