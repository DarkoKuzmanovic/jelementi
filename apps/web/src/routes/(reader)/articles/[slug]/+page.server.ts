import type { EntryGenerator, PageServerLoad } from './$types';
import { articleContentFingerprint } from '@jelementi/article-model';
import { generatedContent } from '../../../../lib/generated-content.server';
import { resolveArticle } from '../../../../lib/routes';
import { articleContinuation } from '../../../../lib/article/continuation';

export const prerender = true;
export const csr = false;
export const entries: EntryGenerator = () =>
  generatedContent.index.map((article) => ({ slug: article.slug }));

export const load: PageServerLoad = async ({ params }) => {
  const article = resolveArticle(generatedContent, params.slug);
  const contentVersion = await articleContentFingerprint(article);
  const continuation = articleContinuation(generatedContent.index, article);
  return { article, contentVersion, continuation };
};
