import type { RequestHandler } from './$types';
import { generatedContent } from '../../lib/generated-content.server';
import type { StudioIndexEvidence } from '../../lib/studio/contracts';

export const prerender = true;

/**
 * Public, non-hydrated JSON contract listing the same index metadata that
 * drives the homepage and `/search`. This is the second, independent fact
 * (alongside an article page's own content fingerprint) that Studio's Live
 * probe proves before ever reporting `live` — a matching fingerprint alone
 * only proves the article page itself renders correctly, not that the
 * site's separate build-time index artifact agrees (CONTEXT.md `Live`;
 * spec; ADR-0005). Never hydrated: JSON has no hydration concept, and this
 * route does not touch any existing reader route's `prerender`/`csr` flags.
 */
export const GET: RequestHandler = () => {
  const entries: StudioIndexEvidence[] = generatedContent.index.map((entry) => ({
    slug: entry.slug,
    title: entry.title,
    excerpt: entry.excerpt,
    publishedAt: entry.publishedAt,
    updatedAt: entry.updatedAt,
    category: entry.category,
    categorySlug: entry.categorySlug,
    tags: entry.tags,
    author: entry.author,
    cover: entry.cover,
    readingTimeMinutes: entry.readingTimeMinutes,
  }));

  return new Response(JSON.stringify(entries), {
    headers: {
      'content-type': 'application/json',
      // Defense-in-depth equivalent of app.html's <meta name="robots"
      // content="noindex">, which only applies to HTML responses.
      'X-Robots-Tag': 'noindex',
    },
  });
};
