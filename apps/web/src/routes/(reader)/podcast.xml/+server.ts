import type { RequestHandler } from './$types';
import { audioByteLengths, generatedContent } from '../../../lib/generated-content.server';
import { buildPodcastFeed } from '../../../lib/podcast';

export const prerender = true;

// ponytail: single production origin, like scripts/media.ts productionMediaOrigin.
const siteOrigin = 'https://jelementi.quz.ma';

/**
 * Public, non-hydrated podcast feed. Episodes derive exclusively from the
 * validated published catalog (audio + verified byte length only), so future
 * publishes appear automatically — no hardcoded episode list.
 */
export const GET: RequestHandler = () =>
  new Response(buildPodcastFeed(generatedContent, { siteOrigin, byteLengths: audioByteLengths }), {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      // Defense-in-depth equivalent of the global noindex meta, which only
      // applies to HTML responses (same as /index.json).
      'X-Robots-Tag': 'noindex',
    },
  });
