import { describe, expect, it } from 'vitest';
import { type WorkerChild, type WorkerHttpResponse, verifyWorker } from './verify-worker';

const noindex = '<meta name="robots" content="noindex">';
const bootstrap = '<script>kit.start()</script>';

const routes = {
  articlePath: '/articles/tristan-da-cunha',
  categoryPath: '/categories/history',
  articleTitle: 'A Rock at the Edge of the World',
  categoryName: 'History',
};

function html(body: string): WorkerHttpResponse {
  return { status: 200, body, headers: new Headers({ 'content-type': 'text/html' }) };
}

function counter(step: number): () => number {
  let value = 0;
  return () => (value += step);
}

const notReady = (): Promise<WorkerHttpResponse> =>
  Promise.resolve({ status: 503, body: '', headers: new Headers() });

interface FakeChild extends WorkerChild {
  signals: string[];
}

function createFakeChild(
  options: {
    exitOnTerm?: boolean;
    exitOnKill?: boolean;
    alreadyExited?: boolean;
  } = {},
): FakeChild {
  let resolveExit!: () => void;
  const exited = new Promise<void>((resolve) => {
    resolveExit = resolve;
  });
  const signals: string[] = [];
  if (options.alreadyExited) resolveExit();
  return {
    signals,
    exited,
    kill(signal = 'SIGTERM') {
      signals.push(signal);
      if (signal === 'SIGTERM' && options.exitOnTerm) resolveExit();
      if (signal === 'SIGKILL' && options.exitOnKill) resolveExit();
      return true;
    },
  };
}

function readerFetch(): {
  fetch: (url: string) => Promise<WorkerHttpResponse>;
  requested: string[];
} {
  let homeRequests = 0;
  const requested: string[] = [];
  return {
    requested,
    fetch: async (url) => {
      const path = new URL(url).pathname + new URL(url).search;
      requested.push(path);
      if (path === '/' && homeRequests++ === 0)
        return { status: 503, body: '', headers: new Headers() };
      if (path === '/') return html(`${noindex}<h1>Jelementi</h1>`);
      if (path === '/articles/tristan-da-cunha')
        return html(`${noindex}<h1>A Rock at the Edge of the World</h1>Sources Footnotes`);
      if (path === '/categories/history') return html(`${noindex}<h1>History</h1>`);
      if (path === '/search' || path === '/search?query=tristan')
        return html(`${noindex}${bootstrap}<h1>Search</h1>`);
      if (path === '/about') return html(`${noindex}<h1>About</h1>`);
      if (path === '/_app/immutable/entry/start.js')
        return {
          status: 200,
          body: 'client',
          headers: new Headers({ 'content-type': 'text/javascript' }),
        };
      if (path === '/not-found')
        return {
          status: 404,
          body: `${noindex}${bootstrap}<h1>Page not found</h1>The page you requested is not available.`,
          headers: new Headers({ 'content-type': 'text/html' }),
        };
      throw new Error(`Unexpected request: ${path}`);
    },
  };
}

describe('local Worker smoke verifier', () => {
  it('polls the local Worker, validates reader and 404 behavior, then reaps it', async () => {
    const child = createFakeChild({ exitOnTerm: true });
    const { fetch, requested } = readerFetch();

    await expect(
      verifyWorker({
        rootDir: '/repo',
        port: 8787,
        routes,
        spawn: () => child,
        fetch,
        sleep: async () => undefined,
        now: counter(10),
        timeoutMs: 100,
        staticAssetPath: '/_app/immutable/entry/start.js',
      }),
    ).resolves.toBeUndefined();

    expect(requested).toContain('/search?query=tristan');
    expect(requested).toContain('/not-found');
    expect(child.signals).toEqual(['SIGTERM']);
  });

  it('reaps the local Worker when readiness times out', async () => {
    const child = createFakeChild({ exitOnTerm: true });

    await expect(
      verifyWorker({
        rootDir: '/repo',
        routes,
        spawn: () => child,
        fetch: notReady,
        sleep: async () => undefined,
        now: counter(50),
        timeoutMs: 75,
      }),
    ).rejects.toThrow('did not become ready');

    expect(child.signals).toEqual(['SIGTERM']);
  });

  it('reaps immediately when the child already exited before cleanup', async () => {
    const child = createFakeChild({ alreadyExited: true });

    await expect(
      verifyWorker({
        rootDir: '/repo',
        routes,
        spawn: () => child,
        fetch: notReady,
        sleep: async () => undefined,
        now: counter(50),
        timeoutMs: 75,
      }),
    ).rejects.toThrow('did not become ready');

    expect(child.signals).toEqual(['SIGTERM']);
  });

  it('cleans up when the child exits early and fetch fails', async () => {
    const child = createFakeChild({ alreadyExited: true });

    await expect(
      verifyWorker({
        rootDir: '/repo',
        routes,
        spawn: () => child,
        fetch: async () => {
          throw new Error('ECONNREFUSED');
        },
        sleep: async () => undefined,
        now: counter(50),
        timeoutMs: 75,
      }),
    ).rejects.toThrow('did not become ready');

    expect(child.signals).toEqual(['SIGTERM']);
  });

  it('escalates to SIGKILL when SIGTERM does not exit the child', async () => {
    const child = createFakeChild({ exitOnKill: true });

    await expect(
      verifyWorker({
        rootDir: '/repo',
        routes,
        spawn: () => child,
        fetch: notReady,
        sleep: async () => undefined,
        now: counter(50),
        timeoutMs: 75,
        reapTermTimeoutMs: 100,
        reapKillTimeoutMs: 100,
      }),
    ).rejects.toThrow('did not become ready');

    expect(child.signals).toEqual(['SIGTERM', 'SIGKILL']);
  });

  it('fails explicitly rather than hanging when the child does not exit after SIGKILL', async () => {
    const child = createFakeChild({});

    await expect(
      verifyWorker({
        rootDir: '/repo',
        routes,
        spawn: () => child,
        fetch: notReady,
        sleep: async () => undefined,
        now: counter(50),
        timeoutMs: 75,
        reapTermTimeoutMs: 100,
        reapKillTimeoutMs: 100,
      }),
    ).rejects.toThrow('did not exit');

    expect(child.signals).toEqual(['SIGTERM', 'SIGKILL']);
  });

  it('rejects application source that accesses the reserved R2 binding', async () => {
    const { assertNoR2MediaBinding } = await import('./verify-worker');

    expect(() =>
      assertNoR2MediaBinding([
        { path: 'apps/web/src/routes/+page.server.ts', source: 'env.R2_MEDIA.get("key")' },
      ]),
    ).toThrow('R2_MEDIA');
  });
});
