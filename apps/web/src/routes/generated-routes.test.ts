import { render } from 'svelte/server';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { articleContentFingerprint } from '@jelementi/article-model';
import { compileArticle } from '@jelementi/content-compiler';
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

vi.mock('$app/state', () => ({ page: { url: new URL('https://example.org/articles/fragments') } }));
import ReaderShell from './(reader)/ReaderShell.svelte';
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

function compileFragmentArticle(markdown: string): ArticleDocument {
  return compileArticle({
    sourcePath: 'fragments.md',
    mediaBaseUrl: 'https://example.org/',
    markdown: `---
title: Fragment targets
slug: fragments
excerpt: Authored headings keep their IDs.
status: published
publishedAt: 2026-10-19
updatedAt: 2026-10-19
category: Science
tags: []
author: Jelementi
cover:
  src: cover.webp
  alt: Cover
references:
  - title: "[7] Research"
    url: https://www.example.org/research
---
${markdown}`,
  }).document;
}

function renderFragmentArticle(article: ArticleDocument): string {
  return render(ArticlePage, {
    props: {
      data: {
        topics: [],
        storyCount: 0,
        categoryCount: 0,
        newestPublishedAt: undefined,
        article,
        contentVersion: 'version',
        seriesHasDates: false,
        continuation: { nextOlder: null, stories: [] },
        series: undefined,
      },
    },
  }).body;
}

describe('generated reader routes', () => {
  it('keeps compiled article-top contents targets on authored headings', () => {
    const article = compileFragmentArticle('## Article top\n## Article top\n## Article top-2');
    const body = renderFragmentArticle(article);
    for (const heading of article.blocks) {
      if (heading.type !== 'heading') continue;
      expect(body).toContain(`href="#${heading.id}"`);
      const targets = [...body.matchAll(/<([a-z0-9]+)\b[^>]*\bid="([^"]+)"[^>]*>/g)]
        .filter((match) => match[2] === heading.id)
        .map((match) => match[1]);
      expect(targets).toEqual(['h2']);
    }
  });
  it('renders scannable source numbering and cleaned domains in the generated article route', () => {
    const body = renderFragmentArticle(compileFragmentArticle('A source-backed passage.'));

    expect(body).toContain('<span class="article-source__number">7</span>');
    expect(body).toContain(
      '<a class="article-source__title" href="https://www.example.org/research" aria-label="Research">Research</a>',
    );
    expect(body).toContain('<span>example.org</span>');
    expect(body).not.toContain('[7] Research</a>');
  });
  it.each(['sources', 'footnotes'])(
    'isolates the %s accessible endmatter label from headings',
    (name) => {
      const article = compileFragmentArticle(
        `## ${name} heading\n\nText[^note].\n\n[^note]: Note.`,
      );
      const body = renderFragmentArticle(article);
      const label = body.match(
        new RegExp(
          `<section class="article-endmatter" aria-labelledby="([^"]+)">\\s*<h2[^>]*>\\s*${name === 'sources' ? 'Sources' : 'Footnotes'}`,
          'i',
        ),
      )?.[1];
      expect(label).toBeTruthy();
      expect(
        article.blocks.filter((block) => block.type === 'heading').map((heading) => heading.id),
      ).not.toContain(label);
      expect(body.match(new RegExp(`id="${label}"`, 'g'))).toHaveLength(1);
      expect(body).toContain(`id="${name}-heading"`);
      if (name === 'sources') expect(body).toContain(`href="#${label}"`);
    },
  );
  it('keeps the shell skip target distinct from compiled Main content headings', () => {
    const articleBody = renderFragmentArticle(
      compileFragmentArticle('## Main content\n## Reader main\n## Reader main'),
    );
    const body = render(ReaderShell, {
      props: { children: createRawSnippet(() => ({ render: () => articleBody })) },
    }).body;
    const mainId = body.match(/<main id="([^"]+)" tabindex="-1"/)?.[1];
    expect(mainId).toBeTruthy();
    expect(body).toContain(`href="#${mainId}"`);
    expect(body.match(new RegExp(`id="${mainId}"`, 'g'))).toHaveLength(1);
    expect(body).toMatch(/<h2 id="main-content">(?:<!--[\s\S]*?-->)*Main content/);
  });
  it('separates compiled footnote definitions, references, and heading targets', () => {
    const article =
      compileFragmentArticle(`Text[^note] repeated[^note] and another[^ref-note-block-0-1].

## Footnote note
## Footnote ref note block 0 1
## Footnote ref note block 0 1
## Reader footnote note
## Reader footnote ref note block 0 1

- List[^note]

[^note]: The original note.
[^ref-note-block-0-1]: A definition whose old ID matches a reference.
`);
    const body = renderFragmentArticle(article);
    const ids = [...body.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    expect(ids).toHaveLength(new Set(ids).size);
    const definitions = [...body.matchAll(/<li id="([^"]+)">/g)].map((match) => match[1]);
    const references = [...body.matchAll(/<sup id="([^"]+)"><a href="#([^"]+)"/g)];
    expect(definitions).toHaveLength(2);
    expect(references).toHaveLength(4);
    for (const reference of references) {
      expect(definitions).toContain(reference[2]);
      expect(body).toContain(`href="#${reference[1]}" aria-label="Back to footnote reference`);
    }
  });
  it('names contents entries whose heading contains only a footnote', () => {
    const article = {
      ...resolveArticle(content, 'known'),
      blocks: [
        {
          type: 'heading' as const,
          level: 2 as const,
          id: 'note-only',
          children: [{ type: 'footnoteReference' as const, id: 'one' }],
        },
      ],
      footnotes: [{ id: 'one', children: [{ type: 'text' as const, value: 'Note' }] }],
    };
    const { body } = render(ArticlePage, {
      props: {
        data: {
          topics: [],
          storyCount: 0,
          categoryCount: 0,
          newestPublishedAt: undefined,
          article,
          contentVersion: 'version',
          seriesHasDates: false,
          continuation: { nextOlder: null, stories: [] },
          series: undefined,
        },
      },
    });
    expect(body).toContain('Section 1');
    expect(body).toContain('href="#note-only"');
  });
  it('renders reader contents targeting authored heading IDs without nested links or repeated footnote IDs', () => {
    const article = {
      ...resolveArticle(content, 'known'),
      audio: { src: 'https://example.org/audio.mp3' },
      blocks: [
        {
          type: 'heading' as const,
          level: 2 as const,
          id: 'article-audio',
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
      props: {
        data: {
          topics: [],
          storyCount: 0,
          categoryCount: 0,
          newestPublishedAt: undefined,
          article,
          contentVersion: 'version',
          seriesHasDates: false,
          continuation: { nextOlder: null, stories: [] },
          series: undefined,
        },
      },
    });
    expect(body).toContain('aria-label="In this story"');
    for (const id of ['article-audio', 'same-heading-2', 'long-unusual-č-heading']) {
      if (id !== 'long-unusual-č-heading') expect(body).toContain(`href="#${id}"`);
      else expect(body).not.toContain(`href="#${id}"`);
      expect(body.match(new RegExp(`id="${id}"`, 'g'))).toHaveLength(1);
    }
    const toc = body.match(/<nav[^>]*aria-label="In this story"[\s\S]*?<\/nav>/)?.[0] ?? '';
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
      props: {
        data: {
          topics: [],
          storyCount: 0,
          categoryCount: 0,
          newestPublishedAt: undefined,
          article,
          contentVersion,
          seriesHasDates: false,
          continuation: { nextOlder: null, stories: [] },
          series: undefined,
        },
      },
    });
    const metas = head.match(/<meta\b[^>]*\bname="jelementi-content-version"[^>]*>/g) ?? [];
    expect(metas).toHaveLength(1);
    const meta = metas[0];
    if (meta === undefined) throw new Error('content-version meta missing from rendered head.');
    expect(meta).toContain(`content="${contentVersion}"`);
    expect(meta).not.toContain('content="' + '0'.repeat(64) + '"');
    const { body } = render(ArticlePage, {
      props: {
        data: {
          topics: [],
          storyCount: 0,
          categoryCount: 0,
          newestPublishedAt: undefined,
          article,
          contentVersion,
          seriesHasDates: false,
          continuation: { nextOlder: null, stories: [] },
          series: undefined,
        },
      },
    });
    expect(body).not.toContain('aria-label="In this story"');
  });
});
