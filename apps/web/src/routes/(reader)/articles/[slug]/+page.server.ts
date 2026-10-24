import type { EntryGenerator, PageServerLoad } from './$types';
import { articleContentFingerprint } from '@jelementi/article-model';
import { generatedContent } from '../../../../lib/generated-content.server';
import { resolveArticle } from '../../../../lib/routes';
import { articleContinuation } from '../../../../lib/article/continuation';
import { projectSeries } from '../../../../lib/series/series-projection';
import { seriesDateParts } from '../../../../lib/series/study-dates';

export const prerender = true;
export const csr = false;
const seriesBySlug = new Map(
  projectSeries(generatedContent.index).map((series) => [series.slug, series]),
);
export const entries: EntryGenerator = () =>
  generatedContent.index.map((article) => ({ slug: article.slug }));

export const load: PageServerLoad = async ({ params }) => {
  const article = resolveArticle(generatedContent, params.slug);
  const contentVersion = await articleContentFingerprint(article);
  const continuation = articleContinuation(generatedContent.index, article);
  const series = article.series ? seriesBySlug.get(article.series.slug) : undefined;
  const seriesHasDates = series ? seriesDateParts(generatedContent, series).length > 0 : false;
  return { article, contentVersion, continuation, series, seriesHasDates };
};
