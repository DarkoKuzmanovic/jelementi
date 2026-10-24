import { describe, expect, it } from 'vitest';
import type { ArticleDocument } from '@jelementi/article-model';
import { articleHtml } from './article/article-html';
import { crc32, zipStored } from './epub';
import { datesToRemember } from './series/study-dates';

function document(overrides: Partial<ArticleDocument>): ArticleDocument {
  return {
    schemaVersion: 1,
    slug: 'sample',
    title: 'Sample',
    excerpt: 'Sample excerpt.',
    status: 'published',
    publishedAt: '2026-10-05',
    updatedAt: '2026-10-05',
    category: 'History',
    tags: [],
    author: 'Jelementi',
    cover: { src: 'https://media.jelementi.quz.ma/cover.png', alt: 'A "cover"' },
    readingTimeMinutes: 1,
    blocks: [],
    footnotes: [],
    references: [],
    ...overrides,
  };
}

describe('articleHtml', () => {
  const article = document({
    blocks: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'Fish & <chips>', marks: ['strong'] },
          { type: 'link', href: '/articles/other', children: [{ type: 'text', value: 'next' }] },
          { type: 'footnoteReference', id: 'a' },
        ],
      },
      { type: 'image', src: 'https://media.jelementi.quz.ma/map.png', alt: 'Map' },
      { type: 'divider' },
    ],
    footnotes: [{ id: 'a', children: [{ type: 'text', value: 'A note.' }] }],
    references: [{ title: '[1] Source', url: 'https://example.org/source' }],
  });

  it('escapes text, absolutizes site links and numbers footnotes', () => {
    const html = articleHtml(article, { siteOrigin: 'https://jelementi.quz.ma', images: true });
    expect(html).toContain('<strong>Fish &amp; &lt;chips&gt;</strong>');
    expect(html).toContain('<a href="https://jelementi.quz.ma/articles/other">next</a>');
    expect(html).toContain('<sup><a href="#fn-1">1</a></sup>');
    expect(html).toContain('<li id="fn-1">A note.</li>');
    expect(html).toContain('alt="A &quot;cover&quot;"');
    expect(html).toContain('<hr />');
    expect(html).toContain('<a href="https://example.org/source">[1] Source</a>');
  });

  it('drops remote images for offline e-books', () => {
    const html = articleHtml(article, { siteOrigin: 'https://jelementi.quz.ma', images: false });
    expect(html).not.toContain('<img');
  });
});

describe('datesToRemember', () => {
  it('reads "<when>: <what>" items after the heading and skips the rest', () => {
    const article = document({
      blocks: [
        { type: 'list', ordered: false, items: [[{ type: 'text', value: '1: not this list' }]] },
        {
          type: 'heading',
          level: 2,
          id: 'dates',
          children: [{ type: 'text', value: 'Dates to remember' }],
        },
        {
          type: 'list',
          ordered: false,
          items: [
            [{ type: 'text', value: '16 April 878: the first written mention: Belgrade' }],
            [{ type: 'text', value: 'no colon here' }],
          ],
        },
      ],
    });
    expect(datesToRemember(article)).toEqual([
      { when: '16 April 878', what: 'the first written mention: Belgrade' },
    ]);
    expect(datesToRemember(document({}))).toEqual([]);
  });
});

describe('epub zip', () => {
  it('computes the standard CRC-32 check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('writes mimetype first and uncompressed at offset 30', () => {
    const zip = zipStored([{ name: 'mimetype', data: 'application/epub+zip' }]);
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint16(8, true)).toBe(0); // stored
    expect(new TextDecoder().decode(zip.slice(30, 38))).toBe('mimetype');
    expect(new TextDecoder().decode(zip.slice(38, 58))).toBe('application/epub+zip');
    expect(view.getUint32(zip.length - 22, true)).toBe(0x06054b50);
  });
});
