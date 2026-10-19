import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { ArticleIndexEntry } from '@jelementi/article-model';
import ArticleSummary from './ArticleSummary.svelte';
import ArticleContinuation from './ArticleContinuation.svelte';

const article: ArticleIndexEntry = {
  slug: 'illustrated-story',
  title: 'An illustrated story',
  excerpt: 'Evidence matters.[1][22] Still true.',
  publishedAt: '2026-10-15',
  updatedAt: '2026-10-15',
  category: 'Science',
  categorySlug: 'science',
  tags: [],
  author: 'Jelementi',
  cover: { src: 'https://example.org/cover.webp', alt: 'A meaningful illustration' },
  readingTimeMinutes: 9,
  searchText: 'evidence matters',
};

describe('illustrated discovery', () => {
  it('continues to the existing next older illustration, date and category without inventing a recommendation', () => {
    const document = {
      ...article,
      schemaVersion: 1 as const,
      status: 'published' as const,
      blocks: [],
      references: [],
      footnotes: [],
    };
    const { body } = render(ArticleContinuation, {
      props: { article: document, nextOlder: article },
    });
    expect(body).toContain('src="https://example.org/cover.webp"');
    expect(body).toContain('loading="lazy"');
    expect(body).toContain('datetime="2026-10-15"');
    expect(body).toContain('9 min read');
    expect(body).toContain('href="/categories/science"');
    expect(body).toContain('href="/articles/illustrated-story"');
    const oldest = render(ArticleContinuation, {
      props: { article: document, nextOlder: null },
    }).body;
    expect(oldest).not.toContain('<img');
    expect(oldest).not.toContain('/articles/illustrated-story');
    expect(oldest).toContain('href="/categories/science"');
  });

  it('prioritizes the lead illustration and suppresses only preview citation markers', () => {
    const { body } = render(ArticleSummary, { props: { article, lead: true } });
    expect(body).toContain('loading="eager"');
    expect(body).toContain('fetchpriority="high"');
    expect(body).toContain('Evidence matters. Still true.');
    expect(body).not.toContain('[22]');
    expect(article.excerpt).toBe('Evidence matters.[1][22] Still true.');
    expect(body).toContain('Read article');
    expect(body).toContain(`href="/articles/${article.slug}"`);
  });
  it('offers listening only when the caller has validated audio for the lead', () => {
    const withAudio = render(ArticleSummary, {
      props: { article, lead: true, audioAvailable: true },
    }).body;
    expect(withAudio).toContain('href="/articles/illustrated-story#article-audio"');
    const withoutAudio = render(ArticleSummary, { props: { article, lead: true } }).body;
    expect(withoutAudio).not.toContain('#article-audio');
  });
  it('renders the real cover with stable dimensions and lazy offscreen loading', () => {
    const { body } = render(ArticleSummary, { props: { article } });
    expect(body).toMatch(/<img[^>]*src="https:\/\/example.org\/cover.webp"/);
    expect(body).toContain('alt="A meaningful illustration"');
    expect(body).toContain('loading="lazy"');
    expect(body).toContain('width="1600" height="900"');
  });
});
