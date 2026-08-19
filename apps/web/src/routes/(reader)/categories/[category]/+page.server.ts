import type { EntryGenerator, PageServerLoad } from './$types';
import { generatedContent } from '../../../../lib/generated-content.server';
import { resolveCategory } from '../../../../lib/routes';

export const prerender = true;
export const csr = false;
export const entries: EntryGenerator = () =>
  [...new Set(generatedContent.index.map((article) => article.categorySlug))].map((category) => ({
    category,
  }));

export const load: PageServerLoad = ({ params }) =>
  resolveCategory(generatedContent, params.category);
