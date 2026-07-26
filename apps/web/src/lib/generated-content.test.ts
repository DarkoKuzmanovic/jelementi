import { describe, expect, it } from 'vitest';
import type { ArticleDocument, ArticleIndexEntry } from '@jelementi/article-model';
import { filterArticles, validateGeneratedContent } from './generated-content';

const document: ArticleDocument = {
  schemaVersion: 1,
  slug: 'cacak-island',
  title: 'Čačak Island',
  excerpt: 'A remote place.',
  status: 'published',
  publishedAt: '2026-07-26',
  updatedAt: '2026-07-26',
  category: 'Remote Čačak',
  tags: ['islands'],
  author: 'Jelementi',
  cover: { src: 'https://media.example.test/cover.webp', alt: 'An island' },
  readingTimeMinutes: 2,
  blocks: [{ type: 'paragraph', children: [{ type: 'text', value: 'Body only term.' }] }],
  footnotes: [],
  references: [],
};

const entry: ArticleIndexEntry = {
  slug: document.slug,
  title: document.title,
  excerpt: document.excerpt,
  publishedAt: '2026-07-26',
  updatedAt: document.updatedAt,
  category: document.category,
  categorySlug: 'remote-cacak',
  tags: document.tags,
  author: document.author,
  cover: document.cover,
  readingTimeMinutes: document.readingTimeMinutes,
  searchText: 'cacak island remote place body only term',
};

describe('generated content boundary', () => {
  it('accepts congruent published index and document artifacts', () => {
    expect(validateGeneratedContent([entry], { 'cacak-island.json': document }).articles).toEqual({
      'cacak-island': document,
    });
  });
  it('rejects duplicate index slugs before building the article map', () => {
    expect(() =>
      validateGeneratedContent([entry, entry], { 'cacak-island.json': document }),
    ).toThrow('duplicate');
  });

  it('rejects orphan, non-published, filename, and card metadata mismatches', () => {
    expect(() =>
      validateGeneratedContent([entry], { 'orphan.json': { ...document, slug: 'orphan' } }),
    ).toThrow('orphan');
    expect(() =>
      validateGeneratedContent([entry], { 'cacak-island.json': { ...document, status: 'draft' } }),
    ).toThrow('published');
    expect(() =>
      validateGeneratedContent([entry], { 'wrong.json': document, 'cacak-island.json': document }),
    ).toThrow('filename');
    expect(() =>
      validateGeneratedContent([{ ...entry, title: 'Different' }], {
        'cacak-island.json': document,
      }),
    ).toThrow('metadata');
  });

  it('rejects an index entry with no corresponding article artifact', () => {
    expect(() => validateGeneratedContent([entry], {})).toThrow('no article artifact');
  });

  it('rejects an article whose category does not match the index entry category', () => {
    expect(() =>
      validateGeneratedContent([entry], {
        'cacak-island.json': { ...document, category: 'Different Category' },
      }),
    ).toThrow('category does not match');
  });

  it('filters normalized metadata and body search text while preserving index order', () => {
    expect(filterArticles([entry], ' ČAČAK  ')).toEqual([entry]);
    expect(filterArticles([entry], 'body term')).toEqual([entry]);
    expect(filterArticles([entry], 'missing')).toEqual([]);
  });
});
