import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import { articleContentFingerprint } from '@jelementi/article-model';
import type { ArticleDocument, ArticleIndexEntry } from '@jelementi/article-model';
import { resolveArticle, resolveCategory } from '../lib/routes';
import type { GeneratedContent } from '../lib/generated-content';

// The article page imports its body renderer through the `$lib` alias, which the
// vitest environment cannot resolve. The meta-element contract under test lives
// in the real page component's svelte:head, so only the body subcomponent is
// shimmed; the rendered head output is entirely produced by the page itself.
vi.mock('$lib/article/ArticleRenderer.svelte', () => ({
  default: (): { body: string; head: string; css: { code: string } } => ({
    body: '',
    head: '',
    css: { code: '' },
  }),
}));

import ArticlePage from './(reader)/articles/[slug]/+page.svelte';

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

  it('resolves known article and category with a deterministic newest-first listing', () => {
    expect(resolveArticle(content, 'known').slug).toBe('known');
    const older = {
      ...entry,
      slug: 'older',
      title: 'Older',
      publishedAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };
    const category = resolveCategory({ ...content, index: [older, entry] }, 'history');
    expect(category.category).toBe('History');
    expect(category.articles.map(({ slug }) => slug)).toEqual(['known', 'older']);
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

  it('SSR-renders exactly one jelementi-content-version meta equal to the computed digest', async () => {
    const article = resolveArticle(content, 'known');
    const contentVersion = await articleContentFingerprint(article);
    expect(contentVersion).toMatch(/^[0-9a-f]{64}$/);

    const { head } = render(ArticlePage, { props: { data: { article, contentVersion } } });
    const metas = head.match(/<meta\b[^>]*\bname="jelementi-content-version"[^>]*>/g) ?? [];
    expect(metas).toHaveLength(1);
    const meta = metas[0];
    if (meta === undefined) throw new Error('content-version meta missing from rendered head.');
    expect(meta).toContain(`content="${contentVersion}"`);
    expect(meta).not.toContain('content="' + '0'.repeat(64) + '"');
  });
});
