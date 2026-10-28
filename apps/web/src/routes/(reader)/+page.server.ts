import type { PageServerLoad } from './$types';
import { generatedContent } from '../../lib/generated-content.server';
import { projectHomeCatalog } from '../../lib/home/home-catalog';

export const prerender = true;
export const csr = false;

export const load: PageServerLoad = () => {
  const catalog = projectHomeCatalog(generatedContent.index);
  const lead = catalog.lead ? generatedContent.articles[catalog.lead.slug] : undefined;
  const narration = [...generatedContent.index]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug))
    .find((article) => generatedContent.articles[article.slug]?.audio);
  return {
    catalog,
    leadAudio: lead?.audio,
    narration: narration
      ? {
          slug: narration.slug,
          title: narration.title,
          durationSeconds: generatedContent.articles[narration.slug]?.audio?.durationSeconds,
        }
      : undefined,
  };
};
