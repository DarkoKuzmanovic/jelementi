import type { PageServerLoad } from './$types';
import { generatedContent } from '../../../lib/generated-content.server';
import { searchText } from '../../../lib/generated-search-text.server';
import { projectCategoryDirectory } from '$lib/category-projection';
import { popularTags } from '$lib/reader/search';

export const prerender = true;
export const load: PageServerLoad = () => ({
  index: generatedContent.index,
  searchText,
  tryTags: popularTags(generatedContent.index),
  categories: projectCategoryDirectory(generatedContent.index).map(({ name, slug }) => ({
    name,
    slug,
  })),
});
