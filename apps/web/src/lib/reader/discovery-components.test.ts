import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { ArticleIndexEntry } from '@jelementi/article-model';
import Card from './Card.svelte';
import SearchResultFixture from './SearchResultFixture.test.svelte';
import ListItem from './ListItem.svelte';

const article: ArticleIndexEntry = {
  slug: 'known-story',
  title: 'A Known Story',
  excerpt: 'A deterministic excerpt.',
  publishedAt: '2026-07-26',
  updatedAt: '2026-07-26',
  category: 'History',
  categorySlug: 'history',
  tags: [],
  author: 'Jelementi',
  cover: { src: 'https://example.org/cover.webp', alt: 'An old map' },
  readingTimeMinutes: 3,
  searchText: 'a known story',
};

describe('Card', () => {
  it('renders the story link, cover alt, category and date with reading time', () => {
    const { body } = render(Card, { props: { article } });
    expect(body).toContain('href="/articles/known-story"');
    expect(body).toContain(article.title);
    expect(body).toContain('src="https://example.org/cover.webp"');
    expect(body).toContain('alt="An old map"');
    expect(body).toContain('History');
    expect(body).toContain('var(--hue-history)');
    expect(body).toContain('datetime="2026-07-26"');
    expect(body).toContain('26 July 2026');
    expect(body).toContain('3 min read');
    expect(body).not.toContain(article.excerpt);
  });

  it('can show the deck and omit the kicker', () => {
    const { body } = render(Card, { props: { article, showDeck: true, showKicker: false } });
    expect(body).toContain(article.excerpt);
    expect(body).not.toContain('History');
  });

  it('crops covers and limits the optional deck while preserving focus', () => {
    const source = readFileSync(new URL('./components.css', import.meta.url), 'utf8');
    expect(source).toContain('aspect-ratio: 3 / 2');
    expect(source).toContain('line-clamp: 3');
    expect(source).toContain('a:focus-visible');
  });
});

describe('ListItem', () => {
  it('renders supplied title and body-match content as text, never raw article markup', () => {
    const { body } = render(SearchResultFixture);
    expect(body).toContain('search-match');
    expect(body).toContain('Vinča');
    expect(body).toContain('In the story');
    expect(body).not.toContain('<script>alert');
  });
  it('renders one accessible linked title, the cover, category, excerpt and metadata', () => {
    const { body } = render(ListItem, { props: { article, headingLevel: 3 } });
    expect(body).toContain('<h3');
    expect(body).toContain('href="/articles/known-story"');
    expect(body).toContain(article.title);
    expect(body).toContain('alt="An old map"');
    expect(body).toContain('src="https://example.org/cover.webp"');
    expect(body).toContain('History');
    expect(body).toContain('3 min');
    expect(body).toContain(article.excerpt);
    expect(body).toContain('datetime="2026-07-26"');
    expect(body).toContain('26 July 2026');
  });
});
