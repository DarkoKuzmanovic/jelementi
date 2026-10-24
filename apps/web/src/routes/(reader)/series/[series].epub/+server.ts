import type { EntryGenerator, RequestHandler } from './$types';
import { articleHtml } from '../../../../lib/article/article-html';
import { buildEpub } from '../../../../lib/epub';
import { generatedContent } from '../../../../lib/generated-content.server';
import { publishedArticle, resolveSeries, siteOrigin } from '../../../../lib/routes';
import { projectSeries, seriesPartTitle } from '../../../../lib/series/series-projection';

export const prerender = true;
export const entries: EntryGenerator = () =>
  projectSeries(generatedContent.index).map((series) => ({ series: series.slug }));

/** The whole series as one text-only EPUB, one chapter per part. */
export const GET: RequestHandler = ({ params }) => {
  const series = resolveSeries(generatedContent, params.series);
  const articles = series.parts.map((part) => publishedArticle(generatedContent, part.slug));
  const modified = articles
    .map((article) => article.updatedAt.slice(0, 10))
    .sort()
    .at(-1);
  const book = buildEpub({
    id: `${siteOrigin}/series/${series.slug}`,
    title: series.title,
    author: articles[0]?.author ?? 'Jelementi',
    language: 'en',
    modified: `${modified}T00:00:00Z`,
    chapters: series.parts.map((part) => ({
      title: `${part.part}. ${seriesPartTitle(series, part)}`,
      body: articleHtml(publishedArticle(generatedContent, part.slug), {
        siteOrigin,
        images: false,
      }),
    })),
  });
  // Prerendered: the static asset's type comes from the .epub extension, not this header.
  return new Response(book, { headers: { 'content-type': 'application/epub+zip' } });
};
