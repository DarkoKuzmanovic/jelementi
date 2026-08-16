import { describe, expect, it } from 'vitest';
import { probeAll, probeIndexJson, probeUrl } from './probe.server';
import type { StudioIndexEvidence } from '../../studio/contracts';

const indexEntry: StudioIndexEvidence = {
  slug: 'hello-world',
  title: 'Hello world',
  excerpt: 'An excerpt.',
  publishedAt: '2026-01-01',
  updatedAt: '2026-01-02',
  category: 'Nature',
  categorySlug: 'nature',
  tags: ['tag-one'],
  author: 'Jelementi',
  cover: { src: 'articles/hello-world/cover.svg', alt: '' },
  readingTimeMinutes: 4,
};

const now = () => 1_700_000_000_000;
const sleep = async () => undefined;

function fetchWith(
  calls: Array<{ url: string; options: RequestInit | undefined }>,
  handler: (index: number) => Promise<Response> | Response,
) {
  return async (url: string | URL | Request, options?: RequestInit): Promise<Response> => {
    calls.push({ url: String(url), options });
    return handler(calls.length - 1);
  };
}

describe('probeUrl', () => {
  it('returns a bounded result with no-cache headers and a cache-bust query', async () => {
    const calls: Array<{ url: string; options: RequestInit | undefined }> = [];
    const fetch = fetchWith(
      calls,
      () =>
        new Response('<html>ok</html>', {
          status: 200,
          headers: { 'CF-Cache-Status': 'HIT', 'Set-Cookie': 'secret' },
        }),
    );
    const result = await probeUrl(
      { name: 'page', target: { url: 'https://jelementi.quz.ma/articles/hello' } },
      { fetch, now, sleep, cacheBust: () => 'test-cache-bust' },
    );
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.fingerprint).toBeNull();
    expect(result.headers).toMatchObject({ 'cf-cache-status': 'HIT' });
    expect(result.headers).not.toHaveProperty('set-cookie');
    expect(result.url).toBe('https://jelementi.quz.ma/articles/hello?probe=test-cache-bust');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain('?probe=test-cache-bust');
    expect(calls[0]?.options?.headers).toMatchObject({
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    });
  });

  it('keeps cache-control headers non-cacheable even when callers override them', async () => {
    const calls: Array<{ url: string; options: RequestInit | undefined }> = [];
    const fetch = fetchWith(calls, () => new Response('ok', { status: 200 }));
    await probeUrl(
      { name: 'page', target: { url: 'https://jelementi.quz.ma/articles/hello' } },
      {
        fetch,
        now,
        sleep,
        cacheBust: () => 'header-test',
        headers: { 'Cache-Control': 'max-age=3600', pragma: 'public', 'X-Test': 'yes' },
      },
    );
    expect(calls[0]?.options?.headers).toEqual({
      'X-Test': 'yes',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    });
  });

  it('retries bounded attempts with backoff and reports the final status', async () => {
    const calls: Array<{ url: string; options: RequestInit | undefined }> = [];
    const status = 503;
    const fetch = fetchWith(calls, () => new Response('unavailable', { status }));
    const result = await probeUrl(
      { name: 'page', target: { url: 'https://jelementi.quz.ma/articles/hello' } },
      { fetch, now, sleep, maxAttempts: 3, baseDelayMs: 100 },
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('non-2xx');
    expect(calls).toHaveLength(3);
  });

  it('rejects non-https URLs without fetching', async () => {
    const calls: Array<{ url: string; options: RequestInit | undefined }> = [];
    const fetch = fetchWith(calls, () => new Response('ok'));
    const result = await probeUrl(
      { name: 'page', target: { url: 'http://jelementi.quz.ma/articles/hello' } },
      { fetch, now, sleep },
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('non-http');
    expect(calls).toHaveLength(0);
  });

  it('yields timeout (never live) when the deadline is exhausted', async () => {
    const calls: Array<{ url: string; options: RequestInit | undefined }> = [];
    // A real clock: each attempt consumes more than the whole deadline, so
    // retries must stop and the probe must report timeout rather than success.
    let current = now();
    const advancingNow = () => current;
    const fetch = fetchWith(calls, () => {
      current += 1_000;
      throw new Error('network down');
    });
    const result = await probeUrl(
      { name: 'page', target: { url: 'https://jelementi.quz.ma/articles/hello' } },
      { fetch, now: advancingNow, sleep, timeoutMs: 100, maxAttempts: 5, baseDelayMs: 0 },
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('timeout');
    expect(calls).toHaveLength(1);
  });

  it('bounds a hanging fetch by the total deadline', async () => {
    const calls: Array<{ url: string; options: RequestInit | undefined }> = [];
    const fetch = fetchWith(calls, () => new Promise<Response>(() => undefined));
    const result = await probeUrl(
      { name: 'page', target: { url: 'https://jelementi.quz.ma/articles/hello' } },
      { fetch, maxAttempts: 3, timeoutMs: 10, baseDelayMs: 0 },
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('timeout');
    expect(calls.length).toBeLessThanOrEqual(2);
  });

  it('yields network failure when fetch throws', async () => {
    const calls: Array<{ url: string; options: RequestInit | undefined }> = [];
    const fetch = fetchWith(calls, () => {
      throw new Error('network down');
    });
    const result = await probeUrl(
      { name: 'page', target: { url: 'https://jelementi.quz.ma/articles/hello' } },
      { fetch, now, sleep, maxAttempts: 2, baseDelayMs: 0 },
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('network');
  });
});

describe('probeAll', () => {
  it('extracts the fingerprint meta from the article page body', async () => {
    const calls: Array<{ url: string; options: RequestInit | undefined }> = [];
    const fetch = fetchWith(calls, (index) => {
      if (index === 0) {
        return new Response('<meta name="jelementi-content-version" content="abc123" />', {
          status: 200,
        });
      }
      return new Response('{}', { status: 200 });
    });
    const outcomes = await probeAll(
      [
        { name: 'article', target: { url: 'https://jelementi.quz.ma/articles/hello' } },
        { name: 'index', target: { url: 'https://jelementi.quz.ma/index.json' } },
      ],
      { fetch, now, sleep, cacheBust: () => 'bust' },
    );
    expect(outcomes[0]).toMatchObject({ name: 'article', ok: true, fingerprint: 'abc123' });
    expect(outcomes[1]).toMatchObject({ name: 'index', ok: true, fingerprint: null });
  });

  it('bounds upstream bodies internally and reports sanitized evidence', async () => {
    const calls: Array<{ url: string; options: RequestInit | undefined }> = [];
    const longBody = 'x'.repeat(10_000);
    let canceled = false;
    const fetch = fetchWith(calls, (index) => {
      if (index === 0) {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(longBody));
          },
          cancel() {
            canceled = true;
          },
        });
        return new Response(stream, { status: 200 });
      }
      return new Response('nope', { status: 500 });
    });
    const outcomes = await probeAll(
      [
        { name: 'article', target: { url: 'https://jelementi.quz.ma/articles/hello' } },
        { name: 'index', target: { url: 'https://jelementi.quz.ma/index.json' } },
      ],
      { fetch, now, sleep, maxAttempts: 1 },
    );
    expect(outcomes[0]?.ok).toBe(true);
    expect(outcomes[0]).not.toHaveProperty('body');
    expect(canceled).toBe(true);
    expect(outcomes[1]).toMatchObject({ ok: false, reason: 'non-2xx' });
  });
});

describe('probeIndexJson', () => {
  it('decodes a bounded StudioIndexEvidence array with no-cache headers and a cache-bust query', async () => {
    const calls: Array<{ url: string; options: RequestInit | undefined }> = [];
    const fetch = fetchWith(
      calls,
      () => new Response(JSON.stringify([indexEntry]), { status: 200 }),
    );
    const result = await probeIndexJson(
      { name: 'index', target: { url: 'https://jelementi.quz.ma/index.json' } },
      { fetch, now, sleep, cacheBust: () => 'test-cache-bust' },
    );
    expect(result).toMatchObject({ ok: true, status: 200, entries: [indexEntry] });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain('?probe=test-cache-bust');
    expect(calls[0]?.options?.headers).toMatchObject({
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    });
  });

  it('retries bounded attempts with backoff on a non-2xx response', async () => {
    const calls: Array<{ url: string; options: RequestInit | undefined }> = [];
    const fetch = fetchWith(calls, () => new Response('unavailable', { status: 503 }));
    const result = await probeIndexJson(
      { name: 'index', target: { url: 'https://jelementi.quz.ma/index.json' } },
      { fetch, now, sleep, maxAttempts: 3, baseDelayMs: 100 },
    );
    expect(result).toMatchObject({ ok: false, reason: 'non-2xx', entries: [] });
    expect(calls).toHaveLength(3);
  });

  it('never fabricates an entry from a 2xx response with an undecodable body', async () => {
    const calls: Array<{ url: string; options: RequestInit | undefined }> = [];
    const fetch = fetchWith(calls, () => new Response('not json', { status: 200 }));
    const result = await probeIndexJson(
      { name: 'index', target: { url: 'https://jelementi.quz.ma/index.json' } },
      { fetch, now, sleep, maxAttempts: 2, baseDelayMs: 0 },
    );
    expect(result).toEqual({
      ok: false,
      url: expect.stringContaining('https://jelementi.quz.ma/index.json'),
      status: 200,
      entries: [],
      elapsedMs: expect.any(Number),
      attempts: 2,
      reason: 'invalid-body',
    });
  });

  it('rejects a malformed entry (missing required field) rather than passing it through', async () => {
    const calls: Array<{ url: string; options: RequestInit | undefined }> = [];
    const malformed = { ...indexEntry, readingTimeMinutes: undefined };
    const fetch = fetchWith(
      calls,
      () => new Response(JSON.stringify([malformed]), { status: 200 }),
    );
    const result = await probeIndexJson(
      { name: 'index', target: { url: 'https://jelementi.quz.ma/index.json' } },
      { fetch, now, sleep, maxAttempts: 1 },
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('invalid-body');
    expect(result.entries).toEqual([]);
  });

  it('rejects non-https URLs without fetching', async () => {
    const calls: Array<{ url: string; options: RequestInit | undefined }> = [];
    const fetch = fetchWith(calls, () => new Response('[]'));
    const result = await probeIndexJson(
      { name: 'index', target: { url: 'http://jelementi.quz.ma/index.json' } },
      { fetch, now, sleep },
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('non-http');
    expect(calls).toHaveLength(0);
  });

  it('yields timeout (never a fabricated entry) when the deadline is exhausted', async () => {
    const calls: Array<{ url: string; options: RequestInit | undefined }> = [];
    let current = now();
    const advancingNow = () => current;
    const fetch = fetchWith(calls, () => {
      current += 1_000;
      throw new Error('network down');
    });
    const result = await probeIndexJson(
      { name: 'index', target: { url: 'https://jelementi.quz.ma/index.json' } },
      { fetch, now: advancingNow, sleep, timeoutMs: 100, maxAttempts: 5, baseDelayMs: 0 },
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('timeout');
    expect(result.entries).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it('bounds oversized upstream bodies internally and cancels the stream', async () => {
    const calls: Array<{ url: string; options: RequestInit | undefined }> = [];
    let canceled = false;
    const hugeArray = `[${Array.from({ length: 20_000 }, () => JSON.stringify(indexEntry)).join(',')}]`;
    const fetch = fetchWith(calls, () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(hugeArray));
        },
        cancel() {
          canceled = true;
        },
      });
      return new Response(stream, { status: 200 });
    });
    const result = await probeIndexJson(
      { name: 'index', target: { url: 'https://jelementi.quz.ma/index.json' } },
      { fetch, now, sleep, maxAttempts: 1 },
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('invalid-body');
    expect(canceled).toBe(true);
  });
});
