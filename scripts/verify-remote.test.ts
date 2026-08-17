import { describe, expect, it } from 'vitest';
import {
  parseRemoteBaseUrl,
  type RemoteHttpResponse,
  type RemoteRoutes,
  verifyRemote,
} from './verify-remote';

const noindex = '<meta name="robots" content="noindex">';
const bootstrap = '<script>kit.start()</script>';
const assetPath = '/_app/immutable/assets/0.CaVLUDTh.css';
const relativeAssetHref = './_app/immutable/assets/0.CaVLUDTh.css';

const routes: RemoteRoutes = {
  articles: [
    {
      path: '/articles/tristan-da-cunha',
      title: 'The 250 People at the End of the World',
      rich: true,
    },
  ],
  categories: [{ path: '/categories/history', name: 'History' }],
};

function counter(step: number): () => number {
  let value = 0;
  return () => (value += step);
}

function readerFetch(baseHost = 'jelementi.quz.ma'): {
  fetch: (url: string) => Promise<RemoteHttpResponse>;
  requested: string[];
} {
  let homeRequests = 0;
  const requested: string[] = [];
  return {
    requested,
    fetch: async (url) => {
      const parsed = new URL(url);
      const path = parsed.pathname + parsed.search;
      requested.push(path);
      if (parsed.host !== baseHost) {
        throw new Error(`Unexpected host: ${parsed.host}`);
      }
      if (path === '/' && homeRequests++ === 0) {
        return {
          status: 503,
          body: '',
          finalUrl: url,
          headers: new Headers(),
        };
      }
      if (path === '/') {
        return {
          status: 200,
          body: `${noindex}<h1>Jelementi</h1><link href="${relativeAssetHref}" rel="stylesheet">`,
          finalUrl: url,
          headers: new Headers({ 'content-type': 'text/html' }),
        };
      }
      if (path === '/articles/tristan-da-cunha') {
        return {
          status: 200,
          body: `${noindex}<h1>The 250 People at the End of the World</h1>Sources Footnotes`,
          finalUrl: url,
          headers: new Headers({ 'content-type': 'text/html' }),
        };
      }
      if (path === '/categories/history') {
        return {
          status: 200,
          body: `${noindex}<h1>History</h1>`,
          finalUrl: url,
          headers: new Headers({ 'content-type': 'text/html' }),
        };
      }
      if (path === '/search' || path === '/search?query=tristan') {
        return {
          status: 200,
          body: `${noindex}${bootstrap}<h1>Search</h1>`,
          finalUrl: url,
          headers: new Headers({ 'content-type': 'text/html' }),
        };
      }
      if (path === '/about') {
        return {
          status: 200,
          body: `${noindex}<h1>About</h1>`,
          finalUrl: url,
          headers: new Headers({ 'content-type': 'text/html' }),
        };
      }
      if (path === assetPath) {
        return {
          status: 200,
          body: 'client',
          finalUrl: url,
          headers: new Headers({ 'content-type': 'text/javascript' }),
        };
      }
      if (path === '/not-found') {
        return {
          status: 404,
          body: `${noindex}${bootstrap}<h1>Page not found</h1>The page you requested is not available.`,
          finalUrl: url,
          headers: new Headers({ 'content-type': 'text/html' }),
        };
      }
      throw new Error(`Unexpected request: ${path}`);
    },
  };
}

describe('parseRemoteBaseUrl', () => {
  it('requires --base-url with an absolute https origin', () => {
    expect(() => parseRemoteBaseUrl([])).toThrow(/--base-url/);
    expect(() => parseRemoteBaseUrl(['--base-url'])).toThrow(/--base-url/);
    expect(() => parseRemoteBaseUrl(['--base-url', 'http://example.com'])).toThrow(/https/);
    expect(() => parseRemoteBaseUrl(['--base-url', 'not-a-url'])).toThrow(/absolute/);
    expect(parseRemoteBaseUrl(['--base-url', 'https://jelementi.quz.ma/'])).toBe(
      'https://jelementi.quz.ma',
    );
  });
});

describe('remote production probe', () => {
  it('polls readiness and validates reader, hydration, media, and 404 boundaries', async () => {
    const { fetch, requested } = readerFetch();
    let mediaChecked = false;

    await expect(
      verifyRemote({
        baseUrl: 'https://jelementi.quz.ma',
        routes,
        fetch,
        sleep: async () => undefined,
        now: counter(10),
        timeoutMs: 100,
        verifyMedia: async () => {
          mediaChecked = true;
        },
      }),
    ).resolves.toBeUndefined();

    expect(requested).toContain('/');
    expect(requested).toContain('/articles/tristan-da-cunha');
    expect(requested).toContain('/categories/history');
    expect(requested).toContain('/search?query=tristan');
    expect(requested).toContain('/not-found');
    expect(requested).toContain(assetPath);
    expect(mediaChecked).toBe(true);
  });

  it('does not demand Sources/Footnotes from a non-rich article page (#47)', async () => {
    const { fetch } = readerFetch();
    const withMinimal = async (url: string) => {
      if (new URL(url).pathname === '/articles/canary-minimal') {
        return {
          status: 200,
          body: `${noindex}<h1>Canary minimal</h1>`,
          finalUrl: url,
          headers: new Headers({ 'content-type': 'text/html' }),
        };
      }
      return fetch(url);
    };

    await expect(
      verifyRemote({
        baseUrl: 'https://jelementi.quz.ma',
        routes: {
          ...routes,
          articles: [
            { path: '/articles/canary-minimal', title: 'Canary minimal' },
            ...routes.articles,
          ],
        },
        fetch: withMinimal,
        sleep: async () => undefined,
        now: counter(10),
        timeoutMs: 100,
        verifyMedia: async () => undefined,
      }),
    ).resolves.toBeUndefined();
  });

  it('still requires Sources/Footnotes on the rich fixture article page', async () => {
    const { fetch } = readerFetch();
    const withoutSections = async (url: string) => {
      if (new URL(url).pathname === '/articles/tristan-da-cunha') {
        return {
          status: 200,
          body: `${noindex}<h1>The 250 People at the End of the World</h1>`,
          finalUrl: url,
          headers: new Headers({ 'content-type': 'text/html' }),
        };
      }
      return fetch(url);
    };

    await expect(
      verifyRemote({
        baseUrl: 'https://jelementi.quz.ma',
        routes,
        fetch: withoutSections,
        sleep: async () => undefined,
        now: counter(10),
        timeoutMs: 100,
        verifyMedia: async () => undefined,
      }),
    ).rejects.toThrow('Sources');
  });

  it('fails closed when readiness never returns HTTP 200', async () => {
    await expect(
      verifyRemote({
        baseUrl: 'https://jelementi.quz.ma',
        routes,
        fetch: async () => ({
          status: 503,
          body: '',
          finalUrl: 'https://jelementi.quz.ma/',
          headers: new Headers(),
        }),
        sleep: async () => undefined,
        now: counter(50),
        timeoutMs: 100,
        verifyMedia: async () => undefined,
      }),
    ).rejects.toThrow(/did not become ready/i);
  });

  it('fails closed when a response redirects to an unexpected origin', async () => {
    await expect(
      verifyRemote({
        baseUrl: 'https://jelementi.quz.ma',
        routes,
        fetch: async () => ({
          status: 302,
          body: '',
          finalUrl: 'https://quzma.cloudflareaccess.com/login',
          headers: new Headers({
            location: 'https://quzma.cloudflareaccess.com/login',
          }),
        }),
        sleep: async () => undefined,
        now: counter(50),
        timeoutMs: 100,
        verifyMedia: async () => undefined,
      }),
    ).rejects.toThrow(/unexpected origin|redirect/i);
  });

  it('fails closed when HTML lacks noindex', async () => {
    const { fetch } = readerFetch();
    await expect(
      verifyRemote({
        baseUrl: 'https://jelementi.quz.ma',
        routes,
        fetch: async (url) => {
          const response = await fetch(url);
          if (new URL(url).pathname === '/about') {
            return { ...response, body: '<h1>About</h1>' };
          }
          return response;
        },
        sleep: async () => undefined,
        now: counter(10),
        timeoutMs: 100,
        verifyMedia: async () => undefined,
      }),
    ).rejects.toThrow(/noindex/i);
  });

  it('fails closed when media verification fails', async () => {
    const { fetch } = readerFetch();
    await expect(
      verifyRemote({
        baseUrl: 'https://jelementi.quz.ma',
        routes,
        fetch,
        sleep: async () => undefined,
        now: counter(10),
        timeoutMs: 100,
        verifyMedia: async () => {
          throw new Error('media contract failed');
        },
      }),
    ).rejects.toThrow(/media contract failed/);
  });

  it('fails closed on network errors', async () => {
    await expect(
      verifyRemote({
        baseUrl: 'https://jelementi.quz.ma',
        routes,
        fetch: async () => {
          throw new Error('getaddrinfo ENOTFOUND');
        },
        sleep: async () => undefined,
        now: counter(50),
        timeoutMs: 100,
        verifyMedia: async () => undefined,
      }),
    ).rejects.toThrow(/ENOTFOUND|did not become ready/i);
  });
});
