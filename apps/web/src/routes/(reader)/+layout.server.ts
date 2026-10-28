import type { LayoutServerLoad } from './$types';
import { generatedContent } from '../../lib/generated-content.server';
import { projectCategoryDirectory } from '../../lib/category-projection';

export const load: LayoutServerLoad = () => {
  const categories = projectCategoryDirectory(generatedContent.index);
  return {
    topics: ['history', 'places', 'science', 'inventions', 'nature'].flatMap((slug) =>
      categories
        .filter((category) => category.slug === slug)
        .map(({ name, slug }) => ({ name, slug })),
    ),
    storyCount: generatedContent.index.length,
    categoryCount: categories.length,
    newestPublishedAt: generatedContent.index.reduce<string | undefined>(
      (newest, article) => (!newest || article.publishedAt > newest ? article.publishedAt : newest),
      undefined,
    ),
  };
};
