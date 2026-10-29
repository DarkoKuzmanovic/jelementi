import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { loadReaderAcceptanceContent } from '../../../../../scripts/reader-acceptance-fixtures';
import ArticleRenderer from './ArticleRenderer.svelte';

const article = loadReaderAcceptanceContent('representative').articles['acceptance-rich-column']!;

describe('second edition article', () => {
  it('links a timed listen pill to native audio, omitting it without audio', () => {
    const html = render(ArticleRenderer, { props: { document: article } }).body;
    expect(html).toMatch(/href="#reader:audio"[^>]*>[\s\S]*?Listen to this story/);
    expect(html).toContain('1:23');
    expect(html).toContain('Sources: 11');
    const sparse = render(ArticleRenderer, {
      props: { document: { ...article, audio: undefined, blocks: [] } },
    }).body;
    expect(sparse).not.toContain('Listen to this story');
    expect(sparse).not.toContain('<blockquote');
  });
  it('collapses after four sources and gives every source a reader-owned fragment', () => {
    const html = render(ArticleRenderer, { props: { document: article } }).body;
    const first = html.match(/<ol class="article-sources" role="list">([\s\S]*?)<\/ol>/)?.[1];
    expect(first?.match(/class="article-source"/g)).toHaveLength(4);
    expect(html).toContain('id="reader:source:5"');
    expect(html).toContain('start="5"');
  });
  it('groups adjacent citation links while retaining each numbered destination', () => {
    const document = {
      ...article,
      blocks: [
        {
          type: 'paragraph' as const,
          children: [
            { type: 'text' as const, value: 'Evidence. ' },
            ...[5, 6].map((n) => ({
              type: 'link' as const,
              href: article.references[n - 1]!.url,
              children: [{ type: 'text' as const, value: `[${n}]` }],
            })),
          ],
        },
      ],
    };
    const html = render(ArticleRenderer, { props: { document } }).body.replace(/<!--.*?-->/g, '');
    expect(html.match(/class="article-citation"/g)).toHaveLength(1);
    expect(html.replace(/<[^>]*>/g, '')).toContain('Evidence.\u20095,');
    expect(html).toContain('href="#reader:source:5"');
    expect(html).toMatch(/>5<\/a>,\s<a[^>]*>6<\/a>/);
  });
});

it('preserves bracketed ordinary links even when their URL also appears in sources', () => {
  const document = {
    ...article,
    blocks: [
      {
        type: 'paragraph' as const,
        children: [
          {
            type: 'link' as const,
            href: article.references[0]!.url,
            children: [{ type: 'text' as const, value: '[1940]' }],
          },
        ],
      },
    ],
  };
  const html = render(ArticleRenderer, { props: { document } }).body.replace(/<!--.*?-->/g, '');
  expect(html).toContain('>[1940]</a>');
  expect(html).not.toContain('class="article-citation"');
});
