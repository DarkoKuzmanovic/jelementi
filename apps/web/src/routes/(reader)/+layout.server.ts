import type { LayoutServerLoad } from './$types';
import { generatedContent } from '../../lib/generated-content.server';
import { projectCategoryDirectory } from '../../lib/category-projection';

export const load: LayoutServerLoad = ({ url }) => {
  if (url.pathname !== '/') return { topics: [] };
  const categories = projectCategoryDirectory(generatedContent.index);
  return {
    topics: ['science', 'history', 'places', 'nature', 'inventions'].flatMap((slug) =>
      categories
        .filter((category) => category.slug === slug)
        .map(({ name, slug }) => ({ name, slug })),
    ),
  };
};
