import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { ArticleIndexEntry } from '@jelementi/article-model';
import ArticleSummary from './ArticleSummary.svelte';

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
  it('renders the real cover with stable dimensions and lazy offscreen loading', () => {
    const { body } = render(ArticleSummary, { props: { article } });
    expect(body).toMatch(/<img[^>]*src="https:\/\/example.org\/cover.webp"/);
    expect(body).toContain('alt="A meaningful illustration"');
    expect(body).toContain('loading="lazy"');
    expect(body).toContain('width="1600" height="900"');
  });
});
