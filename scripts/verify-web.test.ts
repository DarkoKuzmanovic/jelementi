import { describe, expect, it } from 'vitest';
import { verifyPublicClientBundles, verifyRenderedPages } from './verify-web';

const bootstrap = '<script>kit.start()</script>';
const noindex = '<meta name="robots" content="noindex">';
const reader = `${noindex}<h1>Reader</h1>`;
const articlePage = `${noindex}A Rock at the Edge of the World Sources Footnotes Tristan da Cunha Government`;
const allReader = {
  '/': reader,
  '/articles/tristan-da-cunha': articlePage,
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

  it('does not demand Sources/Footnotes from a minimal newest article (#47)', () => {
    // A newly published minimal article (references: [], no footnotes) sorts
    // first in the index; the rich-render check must stay pinned to the
    // known rich fixture article instead of blocking the publish.
    const dynamic = {
      '/': reader,
      '/articles/minimal-article': `${noindex}Minimal article`,
      '/articles/tristan-da-cunha': articlePage,
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
