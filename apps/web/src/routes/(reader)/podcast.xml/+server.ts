import type { RequestHandler } from './$types';
import { audioByteLengths, generatedContent } from '../../../lib/generated-content.server';
import { buildPodcastFeed } from '../../../lib/podcast';
import { siteOrigin } from '../../../lib/routes';

export const prerender = true;

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
      // applies to HTML responses.
      'X-Robots-Tag': 'noindex',
    },
  });
