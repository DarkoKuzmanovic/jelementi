import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertLiveCssJs,
  fingerprintProduction,
  prepareIsolatedWorkspace,
  runStep,
} from './reader-budget';
import { READER_ASSET_BUDGETS, assertReaderAssetBudgets } from './reader-assets';

async function makeFakeRepo(): Promise<{
  root: string;
  fixtureDir: string;
  realArticle: string;
}> {
  const root = await mkdtemp(join(process.env.TMPDIR ?? tmpdir(), 'reader-budget-test-'));
  const fixtureDir = join(root, 'fixtures');
  await mkdir(fixtureDir, { recursive: true });
  await writeFile(join(fixtureDir, 'tristan-da-cunha.md'), '---\nslug: tristan-da-cunha\n---\n');
  const realArticle = 'real catalog body';
  await mkdir(join(root, 'content/articles'), { recursive: true });
  await writeFile(join(root, 'content/articles/real.md'), realArticle);
  await writeFile(join(root, 'package.json'), '{"name":"fake"}');
  return { root, fixtureDir, realArticle };
}

describe('Isolated fixed-catalog Reader benchmark', () => {
  it('pins every frozen ceiling byte-for-byte', () => {
    expect(READER_ASSET_BUDGETS.routes.home.ceiling).toBe(9_520);
    expect(READER_ASSET_BUDGETS.routes.about.ceiling).toBe(9_319);
    expect(READER_ASSET_BUDGETS.routes.category.ceiling).toBe(9_363);
    expect(READER_ASSET_BUDGETS.routes.article.ceiling).toBe(13_203);
    expect(READER_ASSET_BUDGETS.routes.search.ceiling).toBe(11_815);
    expect(READER_ASSET_BUDGETS.routes.notFound.ceiling).toBe(9_473);
    expect(READER_ASSET_BUDGETS.routes.categories.ceiling).toBe(8_192);
    expect(READER_ASSET_BUDGETS.representativeHtml).toBe(70_885);
    expect(READER_ASSET_BUDGETS.uniqueReaderCss).toBe(17_943);
    expect(READER_ASSET_BUDGETS.searchJavaScript).toBe(167_513);
  });

  it('uses the pinned tristan fixture as the only catalog source', async () => {
    const source = await readFile(
      join(process.cwd(), 'scripts/fixtures/reader-budget/tristan-da-cunha.md'),
      'utf8',
    );
    expect(source).toContain('slug: tristan-da-cunha');
  });

  it('copies tracked source but selects a fixture-only catalog, leaving production untouched', async () => {
    const { root, fixtureDir, realArticle } = await makeFakeRepo();
    let workspace = '';
    try {
      const before = await fingerprintProduction(root);
      workspace = await prepareIsolatedWorkspace(root, {
        listFiles: async () => ['package.json', 'content/articles/real.md'],
        fixtureDir,
      });
      expect(await readFile(join(workspace, 'package.json'), 'utf8')).toBe('{"name":"fake"}');
      expect(await readdir(join(workspace, 'content/articles'))).toEqual(['tristan-da-cunha.md']);
      expect(await readFile(join(root, 'content/articles/real.md'), 'utf8')).toBe(realArticle);
      expect(await fingerprintProduction(root)).toBe(before);
    } finally {
      if (workspace !== '') await rm(workspace, { recursive: true, force: true });
      await rm(root, { recursive: true, force: true });
    }
  });

  it('removes the temp directory when preparation fails', async () => {
    const base = process.env.TMPDIR ?? tmpdir();
    const before = (await readdir(base)).filter((name) => name.startsWith('reader-budget-')).sort();
    await expect(
      prepareIsolatedWorkspace('/nonexistent-repo-root', {
        listFiles: async () => {
          throw new Error('tracked list failed');
        },
      }),
    ).rejects.toThrow('tracked list failed');
    const after = (await readdir(base)).filter((name) => name.startsWith('reader-budget-')).sort();
    expect(after).toEqual(before);
  });

  it('throws on any failed subprocess', async () => {
    const root = await mkdtemp(join(process.env.TMPDIR ?? tmpdir(), 'reader-budget-test-'));
    try {
      await expect(runStep('nonexistent-reader-budget-command', [], root)).rejects.toThrow(
        'Benchmark step failed',
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('keeps oversize and missing-budget guards fail-closed while live CSS/JS ignores content HTML', async () => {
    const root = await mkdtemp(join(process.env.TMPDIR ?? tmpdir(), 'reader-budget-test-'));
    try {
      const output = join(root, '.svelte-kit/cloudflare');
      await mkdir(dirname(join(output, 'index.html')), { recursive: true });
      const { loadProductionInput } = await import('./reader-assets');
      await expect(loadProductionInput(root)).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }

    const base = {
      routes: {
        home: 1,
        about: 1,
        category: 1,
        article: 1,
        search: 1,
        notFound: 1,
        categories: 1,
      },
      representativeHtmlBytes: 1,
      uniqueReaderCssBytes: 1,
      searchJavaScriptBytes: 1,
      generatedContentBytes: 1,
      contentOnlyGrowthBytes: 0,
    } as const;
    expect(() =>
      assertReaderAssetBudgets({
        ...base,
        routes: { ...base.routes, article: READER_ASSET_BUDGETS.routes.article.ceiling + 1 },
      }),
    ).toThrow('Reader article HTML');
    expect(() =>
      assertLiveCssJs({
        ...base,
        uniqueReaderCssBytes: READER_ASSET_BUDGETS.uniqueReaderCss + 1,
      }),
    ).toThrow('Reader CSS');
    expect(() =>
      assertLiveCssJs({
        ...base,
        searchJavaScriptBytes: READER_ASSET_BUDGETS.searchJavaScript + 1,
      }),
    ).toThrow('Search JavaScript');
    expect(() =>
      assertLiveCssJs({
        ...base,
        representativeHtmlBytes: READER_ASSET_BUDGETS.representativeHtml + 1,
        routes: { ...base.routes, article: READER_ASSET_BUDGETS.routes.article.ceiling + 1 },
      }),
    ).not.toThrow();
  });
});
