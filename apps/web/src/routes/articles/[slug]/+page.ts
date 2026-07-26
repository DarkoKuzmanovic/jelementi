import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { sampleArticle, type ArticleDocument } from '@jelementi/article-model';

const articles: Readonly<Record<string, ArticleDocument>> = {
  [sampleArticle.slug]: sampleArticle,
};

export const prerender = true;

export const load: PageLoad = ({ params }) => {
  const article = articles[params.slug];
  if (!article) {
    error(404, 'Article not found');
  }
  return { article };
};
