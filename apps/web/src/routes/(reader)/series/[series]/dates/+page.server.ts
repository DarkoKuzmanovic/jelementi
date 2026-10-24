import type { EntryGenerator, PageServerLoad } from './$types';
import { generatedContent } from '../../../../../lib/generated-content.server';
import { resolveSeries } from '../../../../../lib/routes';
import { projectSeries, seriesPartTitle } from '../../../../../lib/series/series-projection';
import { seriesDateParts } from '../../../../../lib/series/study-dates';

export const prerender = true;
export const csr = false;
export const entries: EntryGenerator = () =>
  projectSeries(generatedContent.index)
    .filter((series) => seriesDateParts(generatedContent, series).length > 0)
    .map((series) => ({ series: series.slug }));

export const load: PageServerLoad = ({ params }) => {
  const series = resolveSeries(generatedContent, params.series);
  const parts = seriesDateParts(generatedContent, series).map(({ part, cards }) => ({
    part: part.part,
    slug: part.slug,
    title: seriesPartTitle(series, part),
    cards,
  }));
  return { series: { slug: series.slug, title: series.title }, parts };
};
