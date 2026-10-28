import { render } from 'svelte/server';
import { expect, it, vi } from 'vitest';
import HomePage from './(reader)/+page.svelte';

vi.mock('../lib/generated-content.server', async () => {
  const { validateGeneratedContent } = await import('../lib/generated-content');
  const { compileArticle } = await import('@jelementi/content-compiler');
  const { document } = compileArticle({
    sourcePath: 'review.md',
    mediaBaseUrl: 'https://example.org/',
    markdown: `---
title: Review
slug: review
excerpt: Choose option [1] for the experiment.
status: published
publishedAt: 2026-10-19
updatedAt: 2026-10-19
category: Science
tags: []
author: Review
cover:
  src: cover.webp
  alt: Cover
references:
  - title: "[1] Research"
    url: https://example.org/research
---
Choose option [1] for the experiment. Evidence.[[1]](https://example.org/research)
`,
  });
  const {
    blocks: _blocks,
    footnotes: _footnotes,
    references: _references,
    status: _status,
    schemaVersion: _schemaVersion,
    ...metadata
  } = document;
  return {
    generatedContent: validateGeneratedContent(
      [{ ...metadata, categorySlug: 'science', searchText: 'review' }],
      { 'review.json': document },
    ),
  };
});
import { load } from './(reader)/+page.server';
import { load as loadNavigation } from './(reader)/+layout.server';
import { generatedContent } from '../lib/generated-content.server';

it('uses published data for utility metadata on both home and compact pages', async () => {
  const original = generatedContent.index;
  try {
    const first = original[0]!;
    generatedContent.index = [
      { ...first, publishedAt: '2020-01-01', updatedAt: '2030-01-01' },
      { ...first, slug: 'newer', publishedAt: '2026-10-27' },
    ];
    for (const pathname of ['/', '/about']) {
      const data = await loadNavigation({
        url: new URL(`https://example.org${pathname}`),
      } as never);
      expect(data).toMatchObject({ storyCount: 2, newestPublishedAt: '2026-10-27' });
      expect(data?.topics).toEqual([{ name: 'Science', slug: 'science' }]);
    }
  } finally {
    generatedContent.index = original;
  }
});

it('projects only available published topics and leaves an empty index empty', async () => {
  const original = generatedContent.index;
  try {
    const partial = await loadNavigation({ url: new URL('https://example.org/') } as never);
    expect(partial?.topics).toEqual([{ name: 'Science', slug: 'science' }]);
    generatedContent.index = [];
    expect(
      (await loadNavigation({ url: new URL('https://example.org/') } as never))?.topics,
    ).toEqual([]);
  } finally {
    generatedContent.index = original;
  }
});

it('keeps authored prose numbers even when a reference has the same number', async () => {
  const data = await load({} as never);
  if (!data?.catalog.lead) throw new Error('Missing lead fixture');
  const { body } = render(HomePage, {
    props: {
      data: {
        ...data,
        topics: [],
        storyCount: 0,
        newestPublishedAt: undefined,
        catalog: data.catalog,
        leadAudio: data.leadAudio,
        narration: data.narration,
      },
    },
  });
  expect(body).toContain('Choose option [1] for the experiment.');
});
