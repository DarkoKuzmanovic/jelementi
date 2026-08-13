import { describe, expect, it } from 'vitest';
import { articleContentFingerprint } from '@jelementi/article-model';
import type { ArticleDocument, ArticleIndexEntry } from '@jelementi/article-model';
import { resolveArticle, resolveCategory } from '../lib/routes';
import type { GeneratedContent } from '../lib/generated-content';

const empty: GeneratedContent = { index: [], articles: {} };

const entry: ArticleIndexEntry = {
  slug: 'known',
  title: 'Known',
  excerpt: 'Excerpt',
  publishedAt: '2026-07-26',
  updatedAt: '2026-07-26',
  category: 'History',
  categorySlug: 'history',
  tags: [],
  author: 'Jelementi',
  cover: { src: 'https://example.org/c.webp', alt: 'Cover' },
  readingTimeMinutes: 1,
  searchText: 'known',
};

const content: GeneratedContent = {
  index: [entry],
  articles: {
    known: {
      schemaVersion: 1,
      slug: 'known',
      title: 'Known',
      excerpt: 'Excerpt',
      status: 'published',
      publishedAt: '2026-07-26',
      updatedAt: '2026-07-26',
      category: 'History',
      tags: [],
      author: 'Jelementi',
      cover: { src: 'https://example.org/c.webp', alt: 'Cover' },
      readingTimeMinutes: 1,
      blocks: [],
      footnotes: [],
      references: [],
    },
  },
};

function expectHttpError(fn: () => unknown, status: number, message: string): void {
  try {
    fn();
    throw new Error('Expected an error to be thrown.');
  } catch (error: unknown) {
    expect(error).toMatchObject({ status, body: { message } });
  }
}

describe('generated reader routes', () => {
  it('returns the custom 404 contract for unknown article and category values', () => {
    expectHttpError(() => resolveArticle(empty, 'unknown'), 404, 'Article not found');
    expectHttpError(() => resolveCategory(empty, 'unknown'), 404, 'Category not found');
  });

  it('resolves known article and category without error', () => {
    expect(resolveArticle(content, 'known').slug).toBe('known');
    expect(resolveCategory(content, 'history').category).toBe('History');
  });

  it('fingerprints route-resolved article documents deterministically regardless of key order', async () => {
    const article = resolveArticle(content, 'known');
    const first = await articleContentFingerprint(article);
    const second = await articleContentFingerprint(article);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toBe(first);

    const reordered = Object.fromEntries(Object.entries(article).reverse()) as ArticleDocument;
    expect(await articleContentFingerprint(reordered)).toBe(first);
  });
});
