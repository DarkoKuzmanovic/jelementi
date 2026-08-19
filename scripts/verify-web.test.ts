import { describe, expect, it } from 'vitest';
import {
  verifyNoReaderAcceptanceCapability,
  verifyPublicClientBundles,
  verifyReaderProductionConfig,
  verifyRenderedPages,
} from './verify-web';

const bootstrap = '<script>kit.start()</script>';
const noindex = '<meta name="robots" content="noindex">';
const reader = `${noindex}<h1>Reader</h1>`;
const articlePage = `${noindex}A Rock at the Edge of the World Sources Footnotes Tristan da Cunha Government`;
const allReader = {
  '/': reader,
  '/articles/tristan-da-cunha': articlePage,
  '/categories': reader,
  '/categories/history': reader,
  '/about': reader,
};
const complete = {
  ...allReader,
  '/search': `${noindex}${bootstrap}`,
  '/404': `${noindex}${bootstrap}`,
};

describe('web smoke assertions', () => {
  it('accepts a complete correct page set', () => {
    expect(() => verifyRenderedPages(complete)).not.toThrow();
  });

  it('requires the static Categories directory', () => {
    const { '/categories': _categories, ...withoutCategories } = complete;
    expect(() => verifyRenderedPages(withoutCategories)).toThrow('/categories');
  });

  it('rejects missing /404 fallback artifact', () => {
    expect(() =>
      verifyRenderedPages({ ...allReader, '/search': `${noindex}${bootstrap}` }),
    ).toThrow('Missing');
  });

  it('rejects hydration on a reader route', () => {
    expect(() => verifyRenderedPages({ ...complete, '/': `${reader}${bootstrap}` })).toThrow(
      'hydration',
    );
  });

  it('requires search and 404 bootstrap', () => {
    expect(() => verifyRenderedPages({ ...complete, '/search': `${noindex}` })).toThrow('/search');

    expect(() => verifyRenderedPages({ ...complete, '/404': `${noindex}` })).toThrow('/404');
  });

  it('rejects bootstrap on any discovered non-hydrated route, not just known ones', () => {
    expect(() =>
      verifyRenderedPages({
        ...complete,
        '/articles/second-article': `${reader}${bootstrap}`,
      }),
    ).toThrow('hydration');
  });

  it.each([
    ['GitHub client', 'const endpoint = "api.github.com"'],
    ['private key', 'const secret = "GITHUB_APP_PRIVATE_KEY"'],
    ['Access secret', 'const assertion = "Cf-Access-Jwt-Assertion"'],
    ['content compiler dependency', 'const compiler = "@jelementi/content-compiler"'],
    ['Studio server module', 'import("../server/studio/lifecycle.server.js")'],
    ['Studio acceptance fixture', 'const flag = "STUDIO_ACCEPTANCE_MODE"'],
    ['Studio acceptance fixture', 'const header = "x-studio-acceptance-identity"'],
  ])('rejects %s from public reader client bundles', (capability, source) => {
    expect(() =>
      verifyPublicClientBundles([{ path: '_app/immutable/chunks/search.js', source }]),
    ).toThrow(capability);
  });

  it('accepts reader-only client bundles', () => {
    expect(() =>
      verifyPublicClientBundles([
        { path: '_app/immutable/entry/start.js', source: 'kit.start()' },
        { path: '_app/immutable/chunks/search.js', source: 'const search = true' },
      ]),
    ).not.toThrow();
  });

  it.each([
    ['fixture module path', 'scripts/reader-acceptance-fixtures.ts'],
    ['fixture marker', 'jelementi-reader-acceptance-fixture-v1'],
    ['fixture article', 'acceptance-rich-column'],
    ['acceptance scenario binding', 'READER_ACCEPTANCE_SCENARIO'],
  ])('rejects Reader acceptance capability from any production output: %s', (_label, source) => {
    expect(() => verifyNoReaderAcceptanceCapability([{ path: '_worker.js', source }])).toThrow(
      'Reader acceptance capability',
    );
  });

  it.each([
    ['acceptance selector', "const mode = 'READER_ACCEPTANCE_SCENARIO'"],
    ['fixture import', "import '../../scripts/reader-acceptance-fixtures'"],
    ['fixture marker', "define: { fixture: 'jelementi-reader-acceptance-fixture-v1' }"],
    ['fixture slug', "define: { slug: 'acceptance-rich-column' }"],
  ])('rejects Reader %s from production-only configuration', (_label, source) => {
    expect(() => verifyReaderProductionConfig([{ path: 'vite.config.ts', source }])).toThrow(
      'production configuration',
    );
  });

  it('accepts production configuration without Reader acceptance capability', () => {
    expect(() =>
      verifyReaderProductionConfig([
        { path: 'vite.config.ts', source: 'export default defineConfig({})' },
        { path: 'svelte.config.js', source: 'export default config' },
        { path: 'wrangler.jsonc', source: '{ "workers_dev": false }' },
      ]),
    ).not.toThrow();
  });

  it('does not demand Sources/Footnotes from a minimal newest article (#47)', () => {
    // A newly published minimal article (references: [], no footnotes) sorts
    // first in the index; the rich-render check must stay pinned to the
    // known rich fixture article instead of blocking the publish.
    const dynamic = {
      '/': reader,
      '/articles/minimal-article': `${noindex}Minimal article`,
      '/articles/tristan-da-cunha': articlePage,
      '/categories': reader,
      '/categories/history': reader,
      '/search': `${noindex}${bootstrap}`,
      '/about': reader,
      '/404': `${noindex}${bootstrap}`,
    };

    expect(() =>
      verifyRenderedPages(dynamic, {
        articles: [
          { slug: 'minimal-article', title: 'Minimal article' },
          { slug: 'tristan-da-cunha', title: 'A Rock at the Edge of the World' },
        ],
        categories: ['history'],
      }),
    ).not.toThrow();
  });

  it('still requires the rich fixture article to render Sources and Footnotes', () => {
    expect(() =>
      verifyRenderedPages(
        { ...complete, '/articles/tristan-da-cunha': `${noindex}A Rock at the Edge of the World` },
        {
          articles: [{ slug: 'tristan-da-cunha', title: 'A Rock at the Edge of the World' }],
          categories: ['history'],
        },
      ),
    ).toThrow('Sources');
  });

  it('requires every article page to render its own title', () => {
    const dynamic = {
      '/': reader,
      '/articles/tristan-da-cunha': articlePage,
      '/articles/untitled-article': `${noindex}Some other words entirely`,
      '/categories': reader,
      '/categories/history': reader,
      '/search': `${noindex}${bootstrap}`,
      '/about': reader,
      '/404': `${noindex}${bootstrap}`,
    };

    expect(() =>
      verifyRenderedPages(dynamic, {
        articles: [
          { slug: 'tristan-da-cunha', title: 'A Rock at the Edge of the World' },
          { slug: 'untitled-article', title: 'An Absent Title' },
        ],
        categories: ['history'],
      }),
    ).toThrow('/articles/untitled-article');
  });

  it('derives article and category coverage from generated expectations', () => {
    const dynamic = {
      '/': reader,
      '/articles/second-article': `${noindex}Second article Sources Footnotes`,
      '/categories': reader,
      '/categories/science': `${noindex}Science`,
      '/search': `${noindex}${bootstrap}`,
      '/about': reader,
      '/404': `${noindex}${bootstrap}`,
    };

    expect(() =>
      verifyRenderedPages(dynamic, {
        articles: [{ slug: 'second-article', title: 'Second article' }],
        categories: ['science'],
      }),
    ).not.toThrow();
  });
});
