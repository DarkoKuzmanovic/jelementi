import type { RequestHandler } from './$types';
import { buildArticleFeed } from '../../../lib/article-feed';
import { generatedContent } from '../../../lib/generated-content.server';
import { siteOrigin } from '../../../lib/routes';

export const prerender = true;

/** Full-text article feed for feed readers (e.g. KOReader's news downloader). */
export const GET: RequestHandler = () =>
  new Response(buildArticleFeed(generatedContent, siteOrigin), {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'X-Robots-Tag': 'noindex',
    },
  });
