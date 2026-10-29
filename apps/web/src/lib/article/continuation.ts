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
  stories: ArticleIndexEntry[];
}

/**
 * Continue through the canonical newest-first category sequence without wrapping.
 * Keep the first next-older entry for series endings and up to three for cards.
 */
export function articleContinuation(
  index: ArticleIndex,
  article: { slug: string; category: string },
): ArticleContinuation {
  const sequence = newestFirst(
    index.filter((entry) => entry.categorySlug === categorySlug(article.category)),
  );
  const position = sequence.findIndex((entry) => entry.slug === article.slug);
  if (position === -1) return { nextOlder: null, stories: [] };
  return {
    nextOlder: sequence[position + 1] ?? null,
    stories: sequence.slice(position + 1, position + 4),
  };
}
