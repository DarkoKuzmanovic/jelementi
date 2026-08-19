import type { PageServerLoad } from './$types';
import { projectCategoryDirectory } from '../../../lib/category-projection';
import { generatedContent } from '../../../lib/generated-content.server';

export const prerender = true;
export const csr = false;

export const load: PageServerLoad = () => ({
  categories: projectCategoryDirectory(generatedContent.index),
});
