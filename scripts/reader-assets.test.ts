import { describe, expect, it } from 'vitest';
import {
  assertReaderAssetBudgets,
  measureReaderAssets,
  READER_ASSET_BUDGETS,
} from './reader-assets';

const html = (body: string, links = '') =>
  `<!doctype html><html><head>${links}</head><body>${body}</body></html>`;

function minimumPages(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    '/': html('Home', '<link rel="stylesheet" href="/_app/reader.css">'),
    '/about': html('About', '<link rel="stylesheet" href="/_app/reader.css">'),
    '/categories': html('Categories', '<link rel="stylesheet" href="/_app/reader.css">'),
    '/categories/history': html('History', '<link rel="stylesheet" href="/_app/reader.css">'),
    '/articles/example': html('Article', '<link rel="stylesheet" href="/_app/article.css">'),
    '/search': html(
      'Search',
      '<link rel="stylesheet" href="/_app/reader.css"><link rel="modulepreload" href="/_app/shared.js"><script type="module" src="/_app/search.js"></script>',
    ),
    '/404': html('404', '<script type="module" src="/_app/search.js"></script>'),
    ...overrides,
  };
}

const assets = {
  '/_app/reader.css': 'reader css',
  '/_app/article.css': 'article css',
  '/_app/shared.js': 'shared javascript',
  '/_app/search.js': 'search javascript',
};

describe('Reader raw asset measurement', () => {
  it('counts representative raw HTML, unique Reader CSS, and Search-linked JavaScript exactly once', () => {
    const pages = minimumPages();
    const result = measureReaderAssets({
      pages,
      assets,
      representative: { article: '/articles/example', category: '/categories/history' },
      generatedContentBytes: 1_000,
    });

    expect(result.routes.home).toBe(Buffer.byteLength(pages['/'] ?? ''));
    expect(result.routes.categories).toBe(Buffer.byteLength(pages['/categories'] ?? ''));
    expect(result.uniqueReaderCssBytes).toBe(
      Buffer.byteLength(assets['/_app/reader.css']) +
        Buffer.byteLength(assets['/_app/article.css']),
    );
    expect(result.searchJavaScriptBytes).toBe(
      Buffer.byteLength(assets['/_app/shared.js']) + Buffer.byteLength(assets['/_app/search.js']),
    );
    expect(result.contentOnlyGrowthBytes).toBe(
      1_000 - READER_ASSET_BUDGETS.generatedContentBaseline,
    );
  });

  it('uses raw UTF-8 bytes rather than character count', () => {
    const pages = minimumPages({ '/': html('Čačak') });
    const result = measureReaderAssets({
      pages,
      assets,
      representative: { article: '/articles/example', category: '/categories/history' },
      generatedContentBytes: READER_ASSET_BUDGETS.generatedContentBaseline,
    });

    expect(result.routes.home).toBe(Buffer.byteLength(pages['/'] ?? '', 'utf8'));
    expect(result.routes.home).toBeGreaterThan((pages['/'] ?? '').length);
  });

  it('requires the implemented Categories route while preserving its locked ceiling', () => {
    const pages = minimumPages();
    delete pages['/categories'];

    expect(() =>
      measureReaderAssets({
        pages,
        assets,
        representative: { article: '/articles/example', category: '/categories/history' },
        generatedContentBytes: READER_ASSET_BUDGETS.generatedContentBaseline,
      }),
    ).toThrow('Missing representative Reader HTML route: /categories');
    expect(READER_ASSET_BUDGETS.routes.categories.ceiling).toBe(8_192);
  });

  it('fails closed for missing required assets and every frozen ceiling', () => {
    expect(() =>
      measureReaderAssets({
        pages: minimumPages(),
        assets: { ...assets, '/_app/search.js': undefined as never },
        representative: { article: '/articles/example', category: '/categories/history' },
        generatedContentBytes: READER_ASSET_BUDGETS.generatedContentBaseline,
      }),
    ).toThrow('Missing referenced asset');

    const measured = measureReaderAssets({
      pages: minimumPages(),
      assets,
      representative: { article: '/articles/example', category: '/categories/history' },
      generatedContentBytes: READER_ASSET_BUDGETS.generatedContentBaseline,
    });

    expect(() =>
      assertReaderAssetBudgets({
        ...measured,
        representativeHtmlBytes: READER_ASSET_BUDGETS.representativeHtml + 1,
      }),
    ).toThrow('representative HTML');
    expect(() =>
      assertReaderAssetBudgets({
        ...measured,
        uniqueReaderCssBytes: READER_ASSET_BUDGETS.uniqueReaderCss + 1,
      }),
    ).toThrow('Reader CSS');
    expect(() =>
      assertReaderAssetBudgets({
        ...measured,
        searchJavaScriptBytes: READER_ASSET_BUDGETS.searchJavaScript + 1,
      }),
    ).toThrow('Search JavaScript');
  });
});
