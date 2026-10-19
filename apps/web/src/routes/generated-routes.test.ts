import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import { articleContentFingerprint } from '@jelementi/article-model';
import type { ArticleDocument, ArticleIndexEntry } from '@jelementi/article-model';
import { resolveArticle, resolveCategory } from '../lib/routes';
import type { GeneratedContent } from '../lib/generated-content';

// Resolve the route aliases to the real components for complete SSR assertions.
vi.mock(
  '$lib/article/ArticleRenderer.svelte',
  async () => import('../lib/article/ArticleRenderer.svelte'),
);
vi.mock(
  '$lib/article/ArticleContinuation.svelte',
  async () => import('../lib/article/ArticleContinuation.svelte'),
);

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
  it('renders reader contents targeting authored heading IDs without nested links or repeated footnote IDs', () => {
    const article = {
      ...resolveArticle(content, 'known'),
      blocks: [
        {
          type: 'heading' as const,
          level: 2 as const,
          id: 'same-heading',
          children: [{ type: 'text' as const, value: 'Same heading' }],
        },
        {
          type: 'heading' as const,
          level: 2 as const,
          id: 'same-heading-2',
          children: [
            {
              type: 'link' as const,
              href: 'https://example.org/source',
              children: [{ type: 'text' as const, value: 'Same heading' }],
            },
            { type: 'footnoteReference' as const, id: 'one' },
          ],
        },
        {
          type: 'heading' as const,
          level: 3 as const,
          id: 'long-unusual-č-heading',
          children: [{ type: 'text' as const, value: 'Č ' + 'long heading '.repeat(20) }],
        },
      ],
      footnotes: [{ id: 'one', children: [{ type: 'text' as const, value: 'Note' }] }],
    };
    const { body } = render(ArticlePage, {
      props: { data: { article, contentVersion: 'version', continuation: { nextOlder: null } } },
    });
    expect(body).toContain('aria-label="In this article"');
    for (const id of ['same-heading', 'same-heading-2', 'long-unusual-č-heading']) {
      expect(body).toContain(`href="#${id}"`);
      expect(body.match(new RegExp(`id="${id}"`, 'g'))).toHaveLength(1);
    }
    const toc = body.match(/<nav[^>]*aria-label="In this article"[\s\S]*?<\/nav>/)?.[0] ?? '';
    expect(toc).not.toContain('<sup');
    expect(toc).not.toContain('https://example.org/source');
    expect(toc).not.toMatch(/<a[^>]*>[^<]*<a/);
  });

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

    const { head } = render(ArticlePage, {
      props: { data: { article, contentVersion, continuation: { nextOlder: null } } },
    });
    const metas = head.match(/<meta\b[^>]*\bname="jelementi-content-version"[^>]*>/g) ?? [];
    expect(metas).toHaveLength(1);
    const meta = metas[0];
    if (meta === undefined) throw new Error('content-version meta missing from rendered head.');
    expect(meta).toContain(`content="${contentVersion}"`);
    expect(meta).not.toContain('content="' + '0'.repeat(64) + '"');
    const { body } = render(ArticlePage, {
      props: { data: { article, contentVersion, continuation: { nextOlder: null } } },
    });
    expect(body).not.toContain('aria-label="In this article"');
  });
});
