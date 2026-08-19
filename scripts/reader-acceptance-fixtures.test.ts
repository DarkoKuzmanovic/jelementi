import { describe, expect, it } from 'vitest';
import { filterArticles } from '../apps/web/src/lib/generated-content';
import {
  loadReaderAcceptanceContent,
  READER_ACCEPTANCE_FIXTURE_MARKER,
} from './reader-acceptance-fixtures';

describe('Reader acceptance fixture catalogs', () => {
  it('provides validated sparse and representative published catalogs', () => {
    const sparse = loadReaderAcceptanceContent('sparse');
    const representative = loadReaderAcceptanceContent('representative');

    expect(sparse.index).toHaveLength(1);
    expect(Object.keys(sparse.articles)).toEqual([sparse.index[0]?.slug]);
    expect(representative.index.length).toBeGreaterThanOrEqual(6);
    expect(Object.keys(representative.articles)).toHaveLength(representative.index.length);
    expect(representative.index.every((entry) => entry.searchText.length > 0)).toBe(true);
    expect(READER_ACCEPTANCE_FIXTURE_MARKER).toMatch(/reader-acceptance/i);
  });

  it('contains all locked article structures and inline behavior in one rich article', () => {
    const content = loadReaderAcceptanceContent('representative');
    const rich = content.articles['acceptance-rich-column'];
    if (rich === undefined) throw new Error('Representative rich fixture is missing.');

    expect(new Set(rich.blocks.map((block) => block.type))).toEqual(
      new Set(['paragraph', 'heading', 'image', 'list', 'quote', 'callout', 'divider']),
    );
    expect(rich.audio).toBeDefined();
    expect(rich.references).toHaveLength(1);
    expect(rich.footnotes).toHaveLength(1);
    expect(JSON.stringify(rich.blocks).match(/footnoteReference/g)).toHaveLength(2);
    expect(JSON.stringify(rich.blocks)).toContain('https://example.com/reader-acceptance');
    expect(JSON.stringify(rich.blocks)).toContain('strikethrough');
  });

  it('makes ordering ties, continuation, no-continuation, and search states deterministic', () => {
    const content = loadReaderAcceptanceContent('representative');
    const counts = new Map<string, number>();
    for (const entry of content.index) {
      counts.set(entry.categorySlug, (counts.get(entry.categorySlug) ?? 0) + 1);
    }

    expect([...counts.values()].filter((count) => count === 2).length).toBeGreaterThanOrEqual(2);
    expect(content.index.filter((entry) => entry.categorySlug === 'field-notes')).toHaveLength(3);
    expect(filterArticles(content.index, '')).toHaveLength(content.index.length);
    expect(filterArticles(content.index, 'ČAČAK').map((entry) => entry.slug)).toEqual([
      'acceptance-rich-column',
    ]);
    expect(filterArticles(content.index, 'no such acceptance article')).toEqual([]);
  });

  it('offers an explicit ordinary-error scenario that fails instead of falling back to real data', () => {
    expect(() => loadReaderAcceptanceContent('ordinary-error')).toThrow(
      'Reader acceptance ordinary error',
    );
    expect(() => loadReaderAcceptanceContent('unknown' as never)).toThrow('Unknown Reader');
  });
});
