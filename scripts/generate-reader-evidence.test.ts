import { describe, expect, it } from 'vitest';
import {
  EVIDENCE_ROUTES,
  evidenceRouteToFilename,
  buildContactSheetMarkdown,
} from './generate-reader-evidence';

describe('generate-reader-evidence', () => {
  it('covers every required route/state theme/width combination as deterministic list', () => {
    const ids = EVIDENCE_ROUTES.map((r) => r.id);
    expect(ids).toContain('home');
    expect(ids).toContain('categories');
    expect(ids).toContain('category-field-notes');
    expect(ids).toContain('article-rich');
    expect(ids).toContain('search');
    expect(ids).toContain('about');
    expect(ids).toContain('404');
    // Light/dark and wide/320 are dimensions, not separate routes
    expect(EVIDENCE_ROUTES.length).toBeGreaterThanOrEqual(7);
  });

  it('produces deterministic filenames per route/theme/width', () => {
    expect(evidenceRouteToFilename({ id: 'home', path: '/', label: 'Home' }, 'light', 1280)).toBe(
      'home--light--1280.png',
    );
    expect(evidenceRouteToFilename({ id: 'home', path: '/', label: 'Home' }, 'dark', 320)).toBe(
      'home--dark--320.png',
    );
  });

  it('builds a contact sheet that is review evidence, not a pixel-diff gate', () => {
    const md = buildContactSheetMarkdown({
      generatedAt: '2026-08-19T00:00:00.000Z',
      commit: '54e2e8f',
      measurements: {
        representativeHtmlBytes: 26369,
        uniqueReaderCssBytes: 17942,
        searchJavaScriptBytes: 165878,
      },
      assetsCeilings: {
        representativeHtml: 70885,
        uniqueReaderCss: 17943,
        searchJavaScript: 167513,
      },
      routes: EVIDENCE_ROUTES,
    });
    expect(md).toContain('70885');
    expect(md).toContain('17943');
    expect(md).toContain('167513');
    expect(md).toContain('26369');
    expect(md).toContain('Deterministic curated evidence — review, not gate');
    expect(md).toContain('home--light--1280.png');
  });

  it('fails to claim WebKit/Firefox/touch coverage as automated chromium evidence', () => {
    const md = buildContactSheetMarkdown({
      generatedAt: '2026-08-19T00:00:00.000Z',
      commit: '54e2e8f',
      measurements: {
        representativeHtmlBytes: 26369,
        uniqueReaderCssBytes: 17942,
        searchJavaScriptBytes: 165878,
      },
      assetsCeilings: {
        representativeHtml: 70885,
        uniqueReaderCss: 17943,
        searchJavaScript: 167513,
      },
      routes: EVIDENCE_ROUTES,
    });
    expect(md).toContain('Chromium automated');
    expect(md).toContain('Firefox');
    expect(md).toContain('BLOCKED_PENDING_HUMAN');
  });
});
