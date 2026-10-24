import { error } from '@sveltejs/kit';
import type { ArticleDocument, ArticleIndexEntry } from '@jelementi/article-model';
import { projectCategoryArticles } from './category-projection';
import type { GeneratedContent } from './generated-content';
import { projectSeries, type SeriesProjection } from './series/series-projection';

// ponytail: single production origin, like scripts/media.ts productionMediaOrigin.
export const siteOrigin = 'https://jelementi.quz.ma';

export function resolveArticle(content: GeneratedContent, slug: string): ArticleDocument {
  const article = content.articles[slug];
  if (!article) error(404, 'Article not found');
  return article;
}

export interface CategoryListing {
  articles: ArticleIndexEntry[];
  category: string;
}

export function resolveCategory(content: GeneratedContent, categorySlug: string): CategoryListing {
  const articles = projectCategoryArticles(content.index, categorySlug);
  const first = articles[0];
  if (!first) error(404, 'Category not found');
  return { articles, category: first.category };
}

export function resolveSeries(content: GeneratedContent, slug: string): SeriesProjection {
  const series = projectSeries(content.index).find((item) => item.slug === slug);
  if (!series) error(404, 'Series not found');
  return series;
}

/** The published article for an index-derived slug; a miss means generated data is inconsistent. */
export function publishedArticle(content: GeneratedContent, slug: string): ArticleDocument {
  const article = content.articles[slug];
  if (!article) throw new Error(`Generated article is missing for indexed slug: ${slug}.`);
  return article;
}
