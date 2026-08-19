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

  it('places audio directly after the opening and the cover after audio, in one flow', () => {
    const body = strip(render(ArticleRenderer, { props: { document } }).body);
    const opening = body.indexOf('<h1');
    const audio = body.indexOf('<audio');
    const cover = body.indexOf('article-cover');
    const firstBlock = body.indexOf('<p>Locked marks');
    expect(opening).toBeGreaterThanOrEqual(0);
    expect(audio).toBeGreaterThan(opening);
    expect(cover).toBeGreaterThan(audio);
    expect(firstBlock).toBeGreaterThan(cover);
  });

  it('renders all seven block discriminants, inline marks/nodes, wide image caption, sources, footnotes, and backlinks', () => {
    const body = stripClasses(strip(render(ArticleRenderer, { props: { document } }).body));

    expect(body).toContain('<strong>strong</strong>');
    expect(body).toContain('<em>em</em>');
    expect(body).toContain('<code>code</code>');
    expect(body).toContain('<s>struck</s>');
    expect(body).toContain('href="#footnote-quiet-note"');
    expect(body).toContain('<h2 id="quiet-heading">A heading</h2>');
    expect(body).toContain('alt="A wide fixture landscape"');
    expect(body).toContain('A caption with');
    expect(body).toContain('<ol>');
    expect(body).toContain('<blockquote>');
    expect(body).toContain('A quiet invariant.');
    expect(body).toContain('Fixture only');
    expect(body).toContain('<hr');
    expect(body).toContain('Sources');
    expect(body).toContain('Quiet source');
    expect(body).toContain('Footnotes');
    expect(body).toContain('The backlink target.');
    expect(body).toContain('aria-label="Back to footnote reference 1"');
    expect(body).toContain('↩');
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
