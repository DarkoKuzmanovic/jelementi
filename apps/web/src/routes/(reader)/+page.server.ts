import type { PageServerLoad } from './$types';
import { generatedContent } from '../../lib/generated-content.server';
import { projectHomeCatalog } from '../../lib/home/home-catalog';
import { seriesDateParts } from '../../lib/series/study-dates';

export const prerender = true;
export const csr = false;

export const load: PageServerLoad = () => {
  const catalog = projectHomeCatalog(generatedContent.index);
  const lead = catalog.lead ? generatedContent.articles[catalog.lead.slug] : undefined;
  // The lead already offers its own narration: the listen band points past the lead's series
  // and falls back to the lead only when nothing else is narrated.
  const skip = (article: { slug: string; series?: { slug: string } }) =>
    article.slug === lead?.slug ||
    (lead?.series !== undefined && article.series?.slug === lead.series.slug);
  const narrated = [...generatedContent.index]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug))
    .filter((article) => generatedContent.articles[article.slug]?.audio);
  const narration = narrated.find((article) => !skip(article)) ?? narrated[0];
  return {
    catalog,
    leadAudio: lead?.audio,
    datedSeries: catalog.series
      .filter((series) => seriesDateParts(generatedContent, series).length > 0)
      .map((series) => series.slug),
    narration: narration
      ? {
          slug: narration.slug,
          title: narration.title,
          durationSeconds: generatedContent.articles[narration.slug]?.audio?.durationSeconds,
        }
      : undefined,
  };
};
