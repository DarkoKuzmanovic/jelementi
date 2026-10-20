import type { ArticleIndexEntry } from '@jelementi/article-model';
import { projectCategoryDirectory } from '../category-projection';

export interface HomeCategoryShelf {
  category: string;
  categorySlug: string;
  total: number;
  entries: readonly ArticleIndexEntry[];
}

export interface HomeCatalog {
  lead: ArticleIndexEntry | undefined;
  recent: readonly ArticleIndexEntry[];
  shelves: readonly HomeCategoryShelf[];
}

function compareSlug(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * Projects the validated published index into the fixed editorial tiers and
 * category shelves. Publication date is the only ranking signal; slug provides
 * a deterministic tie-break for articles published on the same calendar date.
 */
export function projectHomeCatalog(index: readonly ArticleIndexEntry[]): HomeCatalog {
  const ordered = [...index].sort(
    (left, right) =>
      right.publishedAt.localeCompare(left.publishedAt) || compareSlug(left.slug, right.slug),
  );
  const lead = ordered[0];
  const recent = ordered.slice(1, 4);
  const remaining = ordered.slice(4);
  const remainingByCategory = new Map<string, ArticleIndexEntry[]>();
  for (const article of remaining) {
    const entries = remainingByCategory.get(article.categorySlug) ?? [];
    entries.push(article);
    remainingByCategory.set(article.categorySlug, entries);
  }
  const shelves = projectCategoryDirectory(index).flatMap((category) => {
    const entries = remainingByCategory.get(category.slug);
    if (!entries || entries.length === 0) return [];
    return [
      {
        category: category.name,
        categorySlug: category.slug,
        total: category.count,
        entries: entries.slice(0, 3),
      },
    ];
  });

  return { lead, recent, shelves };
}
