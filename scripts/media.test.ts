import { describe, expect, it } from 'vitest';
import type { ArticleDocument } from '@jelementi/article-model';
import type { ContentBatch } from './content';
import {
  collectMediaUrls,
  uploadMedia,
  validateMediaKey,
  verifyMediaUrl,
  verifyPublishedMedia,
  type MediaFetch,
  type MediaProcessRunner,
  type MediaResponse,
} from './media';

const mediaBaseUrl = 'https://media.jelementi.quz.ma/';
const key = 'articles/tristan-da-cunha/cover-v1.svg';

function response(
  status: number,
  headers: Record<string, string> = {},
  url?: string,
  body?: ReadableStream<Uint8Array> | null,
): {
  status: number;
  headers: Headers;
  url?: string;
  body?: ReadableStream<Uint8Array> | null;
} {
  return {
    status,
    headers: new Headers(headers),
    ...(url === undefined ? {} : { url }),
    ...(body === undefined ? {} : { body }),
  };
}

function imageHeaders(): Record<string, string> {
  return {
    'cache-control': 'public, max-age=31536000, immutable',
    'content-length': '128',
    'content-type': 'image/svg+xml',
  };
}

const document: ArticleDocument = {
  schemaVersion: 1,
  slug: 'tristan-da-cunha',
  title: 'The 250 People at the End of the World',
  excerpt: 'A remote settlement.',
  status: 'published',
  publishedAt: '2026-07-26',
  updatedAt: '2026-07-26',
  category: 'History',
  tags: ['islands'],
  author: 'Jelementi',
  cover: { src: `${mediaBaseUrl}${key}`, alt: 'Island' },
  audio: { src: `${mediaBaseUrl}articles/tristan-da-cunha/audio-v1.m4a`, durationSeconds: 12 },
  readingTimeMinutes: 1,
  blocks: [
    { type: 'image', src: `${mediaBaseUrl}articles/tristan-da-cunha/map-v1.svg`, alt: 'Map' },
    { type: 'image', src: `${mediaBaseUrl}${key}`, alt: 'Duplicate cover' },
  ],
  footnotes: [],
  references: [],
};

const batch: ContentBatch = {
  all: [
    { sourcePath: 'content/articles/tristan-da-cunha.md', compiled: { document, searchText: '' } },
  ],
  published: [
    { sourcePath: 'content/articles/tristan-da-cunha.md', compiled: { document, searchText: '' } },
  ],
  index: [],
};

describe('media lifecycle guards', () => {
  it('accepts every supported MIME extension only with its explicit MIME type', () => {
    const supported = [
      ['svg', 'image/svg+xml'],
      ['webp', 'image/webp'],
      ['png', 'image/png'],
      ['jpg', 'image/jpeg'],
      ['jpeg', 'image/jpeg'],
      ['mp3', 'audio/mpeg'],
      ['m4a', 'audio/mp4'],
    ] as const;

    for (const [extension, contentType] of supported) {
      const candidate = `articles/tristan-da-cunha/asset-v1.${extension}`;
      expect(validateMediaKey(candidate, contentType)).toMatchObject({
        extension,
        mimeType: contentType,
      });
    }
    expect(() => validateMediaKey('media/articles/tristan/cover-v1.svg', 'image/svg+xml')).toThrow(
      'versioned canonical media key',
    );
    expect(() => validateMediaKey('articles/tristan/cover-v1.svg', 'image/webp')).toThrow(
      'does not match',
    );
    expect(() => validateMediaKey('articles/tristan/cover-v0.svg', 'image/svg+xml')).toThrow(
      'versioned canonical media key',
    );
  });

  it('rejects a non-regular or empty source before any remote operation', async () => {
    const fetch: MediaFetch = async () => {
      throw new Error('fetch must not run');
    };
    const run: MediaProcessRunner = async () => {
      throw new Error('runner must not run');
    };

    await expect(
      uploadMedia({
        file: '/tmp/empty.svg',
        key,
        contentType: 'image/svg+xml',
        mediaBaseUrl,
        fetch,
        run,
        statFile: async () => ({ isFile: () => true, size: 0 }),
      }),
    ).rejects.toThrow('non-empty regular file');
  });

  it('uses a cache-busted missing-object check and safe Wrangler argument arrays', async () => {
    const requests: Array<{ url: string; method?: string }> = [];
    const fetch: MediaFetch = async (url, init) => {
      requests.push({ url, method: init?.method });
      return requests.length === 1 ? response(404) : response(200, imageHeaders());
    };
    const calls: Array<{ command: string; args: string[] }> = [];
    const run: MediaProcessRunner = async (command, args) => {
      calls.push({ command, args });
      return { exitCode: 0, stdout: '', stderr: '' };
    };

    await expect(
      uploadMedia({
        file: '/tmp/cover.svg',
        key,
        contentType: 'image/svg+xml',
        mediaBaseUrl,
        fetch,
        run,
        statFile: async () => ({ isFile: () => true, size: 128 }),
        cacheBust: () => 'test-cache-bust',
      }),
    ).resolves.toBe(`${mediaBaseUrl}${key}`);

    expect(requests[0]).toMatchObject({
      url: `${mediaBaseUrl}${key}?media-guard=test-cache-bust`,
      method: 'HEAD',
    });
    expect(calls).toEqual([
      {
        command: 'pnpm',
        args: [
          'exec',
          'wrangler',
          'r2',
          'object',
          'put',
          `jelementi-media/${key}`,
          '--file',
          '/tmp/cover.svg',
          '--content-type',
          'image/svg+xml',
          '--cache-control',
          'public, max-age=31536000, immutable',
          '--remote',
        ],
      },
    ]);
  });

  it('stops before upload when the immutable key is already reachable and preserves Wrangler stderr', async () => {
    const existing: MediaFetch = async () => response(200, imageHeaders());
    const run: MediaProcessRunner = async () => ({
      exitCode: 1,
      stdout: '',
      stderr: 'denied by Wrangler',
    });

    await expect(
      uploadMedia({
        file: '/tmp/cover.svg',
        key,
        contentType: 'image/svg+xml',
        mediaBaseUrl,
        fetch: existing,
        run,
        statFile: async () => ({ isFile: () => true, size: 128 }),
      }),
    ).rejects.toThrow('must return 404 before upload');

    const missingThenFailure: MediaFetch = async () => response(404);
    await expect(
      uploadMedia({
        file: '/tmp/cover.svg',
        key,
        contentType: 'image/svg+xml',
        mediaBaseUrl,
        fetch: missingThenFailure,
        run,
        statFile: async () => ({ isFile: () => true, size: 128 }),
      }),
    ).rejects.toThrow('denied by Wrangler');
  });

  it('verifies immutable image headers and byte-range audio playback', async () => {
    const imageFetch: MediaFetch = async () => response(200, imageHeaders());
    await expect(
      verifyMediaUrl(`${mediaBaseUrl}${key}`, { fetch: imageFetch }),
    ).resolves.toBeUndefined();

    const audioUrl = `${mediaBaseUrl}articles/tristan-da-cunha/audio-v1.m4a`;
    const audioBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(Uint8Array.of(0));
        controller.close();
      },
    });
    const audioFetch: MediaFetch = async (_url, init) => {
      if (init?.method === 'HEAD') {
        return response(200, {
          'accept-ranges': 'bytes',
          'cache-control': 'public, max-age=31536000, immutable',
          'content-length': '100',
          'content-type': 'audio/mp4',
        });
      }
      return response(
        206,
        {
          'accept-ranges': 'bytes',
          'content-range': 'bytes 0-0/100',
          'content-length': '1',
          'content-type': 'audio/mp4',
        },
        undefined,
        audioBody,
      );
    };
    await expect(verifyMediaUrl(audioUrl, { fetch: audioFetch })).resolves.toBeUndefined();

    const malformedRange: MediaFetch = async (_url, init) =>
      init?.method === 'HEAD'
        ? response(200, {
            'accept-ranges': 'bytes',
            'cache-control': 'public, max-age=31536000, immutable',
            'content-length': '100',
            'content-type': 'audio/mp4',
          })
        : response(206, { 'accept-ranges': 'bytes', 'content-range': 'bytes 0-1/100' });
    await expect(verifyMediaUrl(audioUrl, { fetch: malformedRange })).rejects.toThrow(
      'Content-Range',
    );
  });

  it('rejects Cache-Control lookalikes and conflicting directives', async () => {
    const invalidPolicies = [
      'notpublic, max-age=31536000, immutable',
      'public, x-max-age=31536000, immutable',
      'public, max-age=31536000, notimmutable',
      'public, max-age=31536000, immutable, private',
      'public, max-age=31536000, immutable, no-store',
      'public, max-age=31536000, immutable, no-cache',
    ];

    for (const cacheControl of invalidPolicies) {
      const invalidFetch: MediaFetch = async () =>
        response(200, { ...imageHeaders(), 'cache-control': cacheControl });
      await expect(
        verifyMediaUrl(`${mediaBaseUrl}${key}`, { fetch: invalidFetch }),
      ).rejects.toThrow('requires public, one-year immutable Cache-Control');
    }
  });

  it('confirms a non-audio asset whose HEAD omits Content-Length via a byte-range probe', async () => {
    // The production media edge zstd-compresses text assets and serves them chunked, so
    // the HEAD carries no Content-Length; non-emptiness must come from the range probe.
    const chunkedBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(Uint8Array.of(0));
        controller.close();
      },
    });
    const chunkedEdge: MediaFetch = async (_url, init) =>
      init?.method === 'HEAD'
        ? response(200, {
            'cache-control': 'public, max-age=31536000, immutable',
            'content-encoding': 'zstd',
            'content-type': 'image/svg+xml',
          })
        : response(
            206,
            {
              'content-length': '1',
              'content-range': 'bytes 0-0/378',
              'content-type': 'image/svg+xml',
            },
            undefined,
            chunkedBody,
          );
    await expect(
      verifyMediaUrl(`${mediaBaseUrl}${key}`, { fetch: chunkedEdge }),
    ).resolves.toBeUndefined();
  });

  it('rejects an empty range body and cancels an oversized range body', async () => {
    const head = response(200, {
      'cache-control': 'public, max-age=31536000, immutable',
      'content-type': 'image/svg+xml',
    });
    const emptyBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });
    const emptyFetch: MediaFetch = async (_url, init) =>
      init.method === 'HEAD'
        ? head
        : response(
            206,
            { 'content-range': 'bytes 0-0/378', 'content-type': 'image/svg+xml' },
            undefined,
            emptyBody,
          );

    await expect(verifyMediaUrl(`${mediaBaseUrl}${key}`, { fetch: emptyFetch })).rejects.toThrow(
      'non-empty body',
    );

    let oversizedCancelled = false;
    const oversizedBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(Uint8Array.of(0, 1));
      },
      cancel() {
        oversizedCancelled = true;
      },
    });
    const oversizedFetch: MediaFetch = async (_url, init) =>
      init.method === 'HEAD'
        ? head
        : response(
            206,
            { 'content-range': 'bytes 0-0/378', 'content-type': 'image/svg+xml' },
            undefined,
            oversizedBody,
          );

    await expect(
      verifyMediaUrl(`${mediaBaseUrl}${key}`, { fetch: oversizedFetch }),
    ).rejects.toThrow('exactly one byte');
    expect(oversizedCancelled).toBe(true);

    let splitOversizedCancelled = false;
    const splitOversizedBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(Uint8Array.of(0));
        controller.enqueue(Uint8Array.of(1));
      },
      cancel() {
        splitOversizedCancelled = true;
      },
    });
    const splitOversizedFetch: MediaFetch = async (_url, init) =>
      init.method === 'HEAD'
        ? head
        : response(
            206,
            { 'content-range': 'bytes 0-0/378', 'content-type': 'image/svg+xml' },
            undefined,
            splitOversizedBody,
          );

    await expect(
      verifyMediaUrl(`${mediaBaseUrl}${key}`, { fetch: splitOversizedFetch }),
    ).rejects.toThrow('exactly one byte');
    expect(splitOversizedCancelled).toBe(true);
  });

  it('contextualizes range-body read and cancellation failures without losing validation errors', async () => {
    const url = `${mediaBaseUrl}${key}`;
    const head = response(200, {
      'cache-control': 'public, max-age=31536000, immutable',
      'content-type': 'image/svg+xml',
    });
    const readFailureBody = {
      getReader() {
        return {
          async read() {
            throw new Error('synthetic body failure');
          },
          async cancel() {},
        };
      },
    } as unknown as ReadableStream<Uint8Array>;
    const readFailureFetch: MediaFetch = async (_url, init) =>
      init.method === 'HEAD'
        ? head
        : response(
            206,
            { 'content-range': 'bytes 0-0/378', 'content-type': 'image/svg+xml' },
            undefined,
            readFailureBody,
          );

    await expect(verifyMediaUrl(url, { fetch: readFailureFetch })).rejects.toThrow(
      `Media verification failed for ${url}: byte-range response body read failed: synthetic body failure`,
    );

    const cancellationFailureBody = {
      getReader() {
        return {
          async read() {
            return { done: false, value: Uint8Array.of(0, 1) };
          },
          async cancel() {
            throw new Error('synthetic cancellation failure');
          },
        };
      },
    } as unknown as ReadableStream<Uint8Array>;
    const cancellationFailureFetch: MediaFetch = async (_url, init) =>
      init.method === 'HEAD'
        ? head
        : response(
            206,
            { 'content-range': 'bytes 0-0/378', 'content-type': 'image/svg+xml' },
            undefined,
            cancellationFailureBody,
          );

    await expect(verifyMediaUrl(url, { fetch: cancellationFailureFetch })).rejects.toThrow(
      `Media verification failed for ${url}: byte-range response body must contain exactly one byte; additionally, byte-range response body cancellation failed: synthetic cancellation failure`,
    );
  });

  it('rejects a byte-range probe whose Content-Range is missing, malformed, or zero', async () => {
    const headWithoutLength = (): MediaResponse =>
      response(200, {
        'cache-control': 'public, max-age=31536000, immutable',
        'content-type': 'image/svg+xml',
      });

    const missingRange: MediaFetch = async (_url, init) =>
      init?.method === 'HEAD'
        ? headWithoutLength()
        : response(206, { 'content-length': '1', 'content-type': 'image/svg+xml' });
    await expect(verifyMediaUrl(`${mediaBaseUrl}${key}`, { fetch: missingRange })).rejects.toThrow(
      'Content-Range',
    );

    const malformedRange: MediaFetch = async (_url, init) =>
      init?.method === 'HEAD'
        ? headWithoutLength()
        : response(206, {
            'content-length': '1',
            'content-range': 'bytes 0-1/378',
            'content-type': 'image/svg+xml',
          });
    await expect(
      verifyMediaUrl(`${mediaBaseUrl}${key}`, { fetch: malformedRange }),
    ).rejects.toThrow('Content-Range');

    const zeroTotal: MediaFetch = async (_url, init) =>
      init?.method === 'HEAD'
        ? headWithoutLength()
        : response(206, {
            'content-length': '0',
            'content-range': 'bytes 0-0/0',
            'content-type': 'image/svg+xml',
          });
    await expect(verifyMediaUrl(`${mediaBaseUrl}${key}`, { fetch: zeroTotal })).rejects.toThrow(
      'Content-Range',
    );
  });

  it('rejects a byte-range probe that the edge does not honour with 206', async () => {
    const rangeIgnored: MediaFetch = async (_url, init) =>
      init?.method === 'HEAD'
        ? response(200, {
            'cache-control': 'public, max-age=31536000, immutable',
            'content-type': 'image/svg+xml',
          })
        : response(200, {
            'cache-control': 'public, max-age=31536000, immutable',
            'content-length': '378',
            'content-type': 'image/svg+xml',
          });
    await expect(verifyMediaUrl(`${mediaBaseUrl}${key}`, { fetch: rangeIgnored })).rejects.toThrow(
      '206',
    );
  });

  it('collects unique published document URLs and rejects bad origins or redirects', async () => {
    expect(collectMediaUrls(batch)).toEqual([
      document.cover.src,
      'https://media.jelementi.quz.ma/articles/tristan-da-cunha/map-v1.svg',
      'https://media.jelementi.quz.ma/articles/tristan-da-cunha/audio-v1.m4a',
    ]);
    expect(() =>
      collectMediaUrls({
        ...batch,
        published: [
          {
            sourcePath: 'content/articles/tristan-da-cunha.md',
            compiled: {
              document: { ...document, cover: { ...document.cover, src: 'http://localhost/x' } },
              searchText: '',
            },
          },
        ],
      }),
    ).toThrow('HTTPS production media URL');

    const redirected: MediaFetch = async () =>
      response(200, imageHeaders(), 'https://other.example/cover-v1.svg');
    await expect(
      verifyPublishedMedia({
        batch: {
          ...batch,
          published: [
            {
              sourcePath: 'x',
              compiled: { document: { ...document, audio: undefined, blocks: [] }, searchText: '' },
            },
          ],
        },
        fetch: redirected,
      }),
    ).rejects.toThrow('cross-host redirect');
  });
});
