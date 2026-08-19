import { error } from '@sveltejs/kit';
import type { ArticleDocument, ArticleIndexEntry } from '@jelementi/article-model';
import { projectCategoryArticles } from './category-projection';
import type { GeneratedContent } from './generated-content';

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
