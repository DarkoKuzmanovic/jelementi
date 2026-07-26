import { describe, expect, it } from 'vitest';
import { verifyRenderedPages } from './verify-web';

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
