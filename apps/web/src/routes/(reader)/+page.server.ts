import type { PageServerLoad } from './$types';
import { generatedContent } from '../../lib/generated-content.server';
import { projectHomeCatalog } from '../../lib/home/home-catalog';

export const prerender = true;
export const csr = false;

export const load: PageServerLoad = () => {
  const catalog = projectHomeCatalog(generatedContent.index);
  const lead = catalog.lead ? generatedContent.articles[catalog.lead.slug] : undefined;
  return {
    catalog,
    leadCitationIds: [
      ...(lead?.footnotes.map(({ id }) => id) ?? []),
      ...(lead?.references.flatMap(({ title }) => title.match(/^\[(\d+)\]/)?.[1] ?? []) ?? []),
    ],
    hasLeadAudio: !!lead?.audio,
  };
};
