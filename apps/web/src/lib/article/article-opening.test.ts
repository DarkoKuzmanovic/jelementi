import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { ArticleDocument } from '@jelementi/article-model';
import { ArticleAudio, ArticleRenderer } from './index';

const document: ArticleDocument = {
  schemaVersion: 1,
  slug: 'quiet-column',
  title: 'The Quiet Column',
  excerpt: 'A deterministic opening excerpt.',
  status: 'published',
  publishedAt: '2026-07-26',
  updatedAt: '2026-07-26',
  category: 'History',
  tags: ['remote places', 'islands'],
  author: 'Jelementi',
  cover: {
    src: 'https://media.jelementi.quz.ma/articles/quiet-column/cover-v1.svg',
    alt: 'A quiet cover',
  },
  audio: {
    src: 'https://media.jelementi.quz.ma/articles/quiet-column/audio-v1.m4a',
    durationSeconds: 12,
  },
  readingTimeMinutes: 4,
  blocks: [
    {
      type: 'paragraph',
      children: [
        { type: 'text', value: 'Locked marks stay observable: ' },
        { type: 'text', value: 'strong', marks: ['strong'] },
        { type: 'text', value: ', ' },
        { type: 'text', value: 'em', marks: ['emphasis'] },
        { type: 'text', value: ', ' },
        { type: 'text', value: 'code', marks: ['code'] },
        { type: 'text', value: ', ' },
        { type: 'text', value: 'struck', marks: ['strikethrough'] },
        { type: 'text', value: '. ' },
        { type: 'footnoteReference', id: 'quiet-note' },
      ],
    },
    {
      type: 'heading',
      level: 2,
      id: 'quiet-heading',
      children: [{ type: 'text', value: 'A heading' }],
    },
    {
      type: 'image',
      src: 'https://media.jelementi.quz.ma/articles/quiet-column/wide.webp',
      alt: 'A wide fixture landscape',
      caption: [
        { type: 'text', value: 'A caption with ' },
        {
          type: 'link',
          href: 'https://example.com/quiet',
          children: [{ type: 'text', value: 'a conventional link' }],
        },
      ],
      width: 1600,
      height: 900,
    },
    {
      type: 'list',
      ordered: true,
      items: [[{ type: 'text', value: 'First' }], [{ type: 'text', value: 'Second' }]],
    },
    {
      type: 'quote',
      children: [{ type: 'text', value: 'A quiet invariant.' }],
      attribution: 'Acceptance harness',
    },
    {
      type: 'callout',
      variant: 'warning',
      title: 'Fixture only',
      children: [{ type: 'text', value: 'Contained.' }],
    },
    { type: 'divider' },
  ],
  footnotes: [{ id: 'quiet-note', children: [{ type: 'text', value: 'The backlink target.' }] }],
  references: [
    {
      title: 'Quiet source',
      url: 'https://example.com/quiet-source',
      publisher: 'Jelementi fixtures',
    },
  ],
};

function strip(html: string): string {
  return html.replace(/<!--[^>]*-->/g, '');
}

function stripClasses(html: string): string {
  return html.replace(/\sclass="[^"]*"/g, '');
}

describe('authoritative article renderer (#101 Quiet Column)', () => {
  it('renders the compact opening hierarchy: category link, title, excerpt, author, date, reading time, tags', () => {
    const body = stripClasses(strip(render(ArticleRenderer, { props: { document } }).body));

    expect(body).toContain('<a href="/categories/history">History</a>');
    expect(body).toContain('<h1>The Quiet Column</h1>');
    expect(body).toContain('A deterministic opening excerpt.');
    expect(body).toContain('By <strong>Jelementi</strong>');
    expect(body).toContain('<time datetime="2026-07-26">26 July 2026</time>');
    expect(body).toContain('4 min read');
    expect(body).toContain('remote places');
    expect(body).toContain('islands');
    expect(body).toContain('aria-label="Tags"');
  });

  it('places the illustration before optional native audio and the complete body', () => {
    const body = strip(render(ArticleRenderer, { props: { document } }).body);
    const opening = body.indexOf('<h1');
    const audio = body.indexOf('<audio');
    const cover = body.indexOf('article-cover');
    const firstBlock = body.indexOf('<p>Locked marks');
    expect(opening).toBeGreaterThanOrEqual(0);
    expect(cover).toBeGreaterThan(opening);
    expect(audio).toBeGreaterThan(cover);
    expect(firstBlock).toBeGreaterThan(audio);
  });

  it('renders all seven block discriminants, inline marks/nodes, wide image caption, sources, footnotes, and backlinks', () => {
    const renderedBody = strip(render(ArticleRenderer, { props: { document } }).body);
    const body = stripClasses(renderedBody);

    expect(body).toContain('<strong>strong</strong>');
    expect(body).toContain('<em>em</em>');
    expect(body).toContain('<code>code</code>');
    expect(body).toContain('<s>struck</s>');
    expect(body).toContain('href="#reader:footnote:quiet-note"');
    expect(body).toContain('<h2 id="quiet-heading">A heading</h2>');
    expect(body).toContain('alt="A wide fixture landscape"');
    expect(body).toContain('A caption with');
    expect(body).toContain('<ol>');
    expect(body).toContain('<blockquote>');
    expect(body).toContain('A quiet invariant.');
    expect(body).toContain('Fixture only');
    expect(body).toContain('<hr');
    expect(renderedBody).toContain('<ol class="article-sources">');
    expect(renderedBody).toContain('<span class="article-source__number">1</span>');
    expect(body).toContain('Quiet source');
    expect(body).toContain('<ol>');
    expect(body).not.toContain('<details');
    expect(body).toContain('Footnotes');
    expect(body).toContain('The backlink target.');
    expect(body).toContain('aria-label="Back to footnote reference 1"');
    expect(body).toContain('↩');
  });

  it('numbers and scans sources, strips citation prefixes, and collapses references after ten', () => {
    const references = Array.from({ length: 11 }, (_, index) => ({
      title:
        index === 0
          ? '[42] First source'
          : index === 10
            ? '[17] Final source'
            : `Source ${index + 1}`,
      url: `https://www.example.com/source-${index + 1}`,
      ...(index === 0 ? { publisher: 'Example publisher', accessedAt: '2026-10-20' } : {}),
    }));
    const body = render(ArticleRenderer, {
      props: { document: { ...document, references } },
    }).body;
    const initialSources = body.match(/<ol class="article-sources">([\s\S]*?)<\/ol>/)?.[1];
    const expandedSources = body.match(
      /<details class="article-sources__details">[\s\S]*?<ol class="article-sources" start="9">([\s\S]*?)<\/ol>/,
    )?.[1];

    expect(body).toContain('<summary>Show all 11 sources</summary>');
    expect(initialSources?.match(/class="article-source"/g)).toHaveLength(8);
    expect(expandedSources?.match(/class="article-source"/g)).toHaveLength(3);
    expect(body).toContain('<span class="article-source__number">42</span>');
    expect(body).toContain(
      '<a class="article-source__title" href="https://www.example.com/source-1" aria-label="First source">First source</a>',
    );
    expect(body).toContain('<span class="article-source__number">9</span>');
    expect(body).toContain('<span class="article-source__number">17</span>');
    expect(body).toContain('<span>example.com</span>');
    expect(body).toContain('Example publisher');
    expect(body).toContain('accessed 2026-10-20');
    expect(body).not.toContain('[42] First source</a>');
    expect(body).not.toContain('[17] Final source</a>');
  });
  it('omits audio markup when audio is absent, leaving no empty treatment', () => {
    const noAudio = render(ArticleRenderer, {
      props: { document: { ...document, audio: undefined } },
    });
    expect(noAudio.body).not.toContain('<audio');
    expect(noAudio.body).not.toContain('Listen to the audio');
    expect(noAudio.body).toContain('article-cover');
  });

  it('keeps the shared audio primitive accessible with controls and no autoplay', () => {
    const { body } = render(ArticleAudio, { props: { article: document } });
    expect(body).toContain('controls');
    expect(body).toContain('preload="metadata"');
    expect(body).not.toContain('autoplay');
  });
});
