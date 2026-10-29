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

  it('preserves the complete authored excerpt in discovery', () => {
    const { body } = render(ArticleSummary, {
      props: { article },
    });
    expect(body).toContain(article.excerpt);
    expect(article.excerpt).toBe('Evidence matters.[1][22] Still true.');
    expect(body).toContain(`href="/articles/${article.slug}"`);
  });

  it('supports deeper title levels for category shelves without changing the default card heading', () => {
    const compact = render(ArticleSummary, {
      props: { article, headingLevel: 4 },
    }).body;
    const regular = render(ArticleSummary, { props: { article } }).body;

    expect(compact).toContain('<h4 class="article-summary__title">');
    expect(regular).toContain('<h2 class="article-summary__title">');
  });
  it('retains bracketed prose numbers that are not authored citation markers', () => {
    const { body } = render(ArticleSummary, {
      props: {
        article: { ...article, excerpt: 'Year [1940]. Evidence.[1]' },
      },
    });
    expect(body).toContain('Year [1940]. Evidence.[1]');
  });
  it('renders the real cover with stable dimensions and lazy offscreen loading', () => {
    const { body } = render(ArticleSummary, { props: { article } });
    expect(body).toMatch(/<img[^>]*src="https:\/\/example.org\/cover.webp"/);
    expect(body).toContain('alt="A meaningful illustration"');
    expect(body).toContain('loading="lazy"');
    expect(body).toContain('width="1600" height="900"');
  });
});
