import { describe, expect, it } from 'vitest';
import {
  projectCategoryArticles,
  projectCategoryDirectory,
} from '../apps/web/src/lib/category-projection';
import { filterArticles } from '../apps/web/src/lib/generated-content';
import {
  loadReaderAcceptanceContent,
  READER_ACCEPTANCE_EXCLUDED_TITLES,
  READER_ACCEPTANCE_FIXTURE_MARKER,
} from './reader-acceptance-fixtures';

describe('Reader acceptance fixture catalogs', () => {
  it('provides validated sparse, intermediate, and representative published catalogs', () => {
    const sparse = loadReaderAcceptanceContent('sparse');
    const intermediate = loadReaderAcceptanceContent('intermediate');
    const representative = loadReaderAcceptanceContent('representative');

    expect(sparse.index).toHaveLength(1);
    expect(Object.keys(sparse.articles)).toEqual([sparse.index[0]?.slug]);
    expect(projectCategoryDirectory(sparse.index).map(({ name, count }) => [name, count])).toEqual([
      ['Solo', 1],
    ]);
    expect(intermediate.index).toHaveLength(4);
    expect(Object.keys(intermediate.articles)).toHaveLength(intermediate.index.length);
    expect(representative.index).toHaveLength(8);
    expect(Object.keys(representative.articles)).toHaveLength(representative.index.length);
    expect(representative.index.every((entry) => entry.searchText.length > 0)).toBe(true);
    expect(representative.index.map((entry) => entry.title)).not.toEqual(
      expect.arrayContaining([...READER_ACCEPTANCE_EXCLUDED_TITLES]),
    );
    expect(
      Object.values(representative.articles).every((article) => article.status === 'published'),
    ).toBe(true);
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

  it('makes category count ties, newest projections, and one/many listings deterministic', () => {
    const content = loadReaderAcceptanceContent('representative');

    expect(
      projectCategoryDirectory(content.index).map(({ name, count, newest }) => ({
        name,
        count,
        newest: newest.slug,
      })),
    ).toEqual([
      { name: 'Field Notes', count: 3, newest: 'acceptance-rich-column' },
      { name: 'Culture', count: 2, newest: 'acceptance-culture-new' },
      { name: 'Science', count: 2, newest: 'acceptance-science-new' },
      {
        name: 'A Deliberately Long Category Name for Narrow Readers',
        count: 1,
        newest: 'acceptance-long-category',
      },
    ]);
    expect(projectCategoryArticles(content.index, 'field-notes')).toHaveLength(3);
    expect(
      projectCategoryArticles(
        content.index,
        'a-deliberately-long-category-name-for-narrow-readers',
      ),
    ).toHaveLength(1);
  });

  it('keeps continuation and search states deterministic', () => {
    const content = loadReaderAcceptanceContent('representative');
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
