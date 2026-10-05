import { describe, expect, it, vi } from 'vitest';
import type { ArticleDocument, ArticleIndexEntry } from '@jelementi/article-model';
import type { GeneratedContent } from '../../../lib/generated-content';

// Same hermetic pattern as the /index.json route test: the route statically
// imports the real generated artifacts via generated-content.server.ts, so the
// validated snapshot and the enclosure-length manifest are both mocked here.
const entry: ArticleIndexEntry = {
  slug: 'known',
  title: 'Known & <heard>',
  excerpt: 'Excerpt',
  publishedAt: '2026-10-05',
  updatedAt: '2026-10-05',
  category: 'History',
  categorySlug: 'history',
  tags: [],
  author: 'Jelementi',
  cover: { src: 'https://example.org/c.webp', alt: 'Cover' },
  readingTimeMinutes: 1,
  searchText: 'known excerpt',
};

const article: ArticleDocument = {
  schemaVersion: 1,
  slug: 'known',
  title: 'Known & <heard>',
  excerpt: 'Excerpt',
  status: 'published',
  publishedAt: '2026-10-05',
  updatedAt: '2026-10-05',
  category: 'History',
  tags: [],
  author: 'Jelementi',
  cover: { src: 'https://example.org/c.webp', alt: 'Cover' },
  audio: {
    src: 'https://media.jelementi.quz.ma/articles/known/audio-v1.mp3',
    durationSeconds: 60,
  },
  readingTimeMinutes: 1,
  blocks: [],
  footnotes: [],
  references: [],
};

const generatedContent: GeneratedContent = { index: [entry], articles: { known: article } };
const audioByteLengths = { 'https://media.jelementi.quz.ma/articles/known/audio-v1.mp3': 12345 };

vi.mock('../../../lib/generated-content.server', () => ({ generatedContent, audioByteLengths }));

const { GET, prerender } = await import('./+server');

describe('/podcast.xml', () => {
  it('is prerendered', () => {
    expect(prerender).toBe(true);
  });

  it('serves an RSS feed with a stable guid and a verified enclosure', async () => {
    const response = GET({} as unknown as Parameters<typeof GET>[0]) as Response;

    expect(response.headers.get('content-type')).toContain('application/rss+xml');
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex');

    const body = await response.text();
    expect(body).toContain('<rss version="2.0"');
    expect(body).toContain(
      '<guid isPermaLink="true">https://jelementi.quz.ma/articles/known</guid>',
    );
    expect(body).toContain(
      '<enclosure url="https://media.jelementi.quz.ma/articles/known/audio-v1.mp3" length="12345" type="audio/mpeg" />',
    );
    expect(body).toContain('Known &amp; &lt;heard&gt;');
    expect(body).not.toContain('length="0"');
  });
});
