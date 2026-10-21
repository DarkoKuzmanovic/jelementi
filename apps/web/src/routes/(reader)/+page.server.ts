import type { PageServerLoad } from './$types';
import { generatedContent } from '../../lib/generated-content.server';
import { projectSeries } from '../../lib/series/series-projection';
import { projectHomeCatalog } from '../../lib/home/home-catalog';

export const prerender = true;
export const csr = false;

export const load: PageServerLoad = () => {
  const series = projectSeries(generatedContent.index);
  const catalog = projectHomeCatalog(generatedContent.index, series);
  const lead = catalog.lead ? generatedContent.articles[catalog.lead.slug] : undefined;
  return {
    catalog,
    series,
    hasLeadAudio: !!lead?.audio,
  };
};
