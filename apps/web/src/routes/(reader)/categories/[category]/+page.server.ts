import type { EntryGenerator, PageServerLoad } from './$types';
import { generatedContent } from '../../../../lib/generated-content.server';
import { resolveCategory } from '../../../../lib/routes';
import { projectCategoryDirectory } from '../../../../lib/category-projection';

export const prerender = true;
export const csr = false;
export const entries: EntryGenerator = () =>
  [...new Set(generatedContent.index.map((article) => article.categorySlug))].map((category) => ({
    category,
  }));

export const load: PageServerLoad = ({ params }) => ({
  ...resolveCategory(generatedContent, params.category),
  otherCategories: projectCategoryDirectory(generatedContent.index)
    .filter(({ slug }) => slug !== params.category)
    .map(({ name, slug, count }) => ({ name, slug, count })),
});
