import { mkdtemp, mkdir, readFile, readdir, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { compileArticle } from '@jelementi/content-compiler';
import {
  buildContent,
  defaultDebounce,
  formatContentError,
  loadMediaBaseUrl,
  validateCompiledBatch,
  validateContent,
  watchContent,
} from './content';

const tempRoots: string[] = [];

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'jelementi-content-'));
  tempRoots.push(root);
  await mkdir(join(root, 'content/articles'), { recursive: true });
  return root;
}

function article({
  slug,
  status = 'published',
  category = 'Remote Places',
  publishedAt = '2026-07-26',
  body = 'A valid article body.',
}: {
  slug: string;
  status?: 'published' | 'draft' | 'archived';
  category?: string;
  publishedAt?: string;
  body?: string;
}): string {
  return `---
title: ${slug}
slug: ${slug}
excerpt: ${slug} excerpt.
${status === 'published' ? `publishedAt: '${publishedAt}'\n` : ''}updatedAt: '2026-07-26'
status: ${status}
category: ${category}
tags: [islands]
author: Jelementi
cover:
  src: media/articles/${slug}/cover.webp
  alt: ${slug} cover
references:
  - title: Source
    url: https://example.org/source
---

${body}
`;
}

async function writeArticle(root: string, filename: string, markdown: string): Promise<void> {
  await writeFile(join(root, 'content/articles', filename), markdown);
}

function articleWithAudio({ slug }: { slug: string }): string {
  return `---
title: ${slug}
slug: ${slug}
excerpt: ${slug} excerpt.
publishedAt: '2026-07-26'
updatedAt: '2026-07-26'
status: published
category: History
tags: [islands]
author: Jelementi
cover:
  src: media/articles/${slug}/cover.webp
  alt: ${slug} cover
audio:
  src: media/articles/${slug}/audio.mp3
references:
  - title: Source
    url: https://example.org/source
---

A valid article body.
`;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const mediaBaseUrl = 'http://localhost:5173/';

describe('content batch validation', () => {
  it('validates in memory without creating generated output', async () => {
    const root = await makeRoot();
    await writeArticle(root, 'published.md', article({ slug: 'published' }));

    await expect(validateContent({ rootDir: root, mediaBaseUrl })).resolves.toMatchObject({
      published: [{ compiled: { document: { slug: 'published' } } }],
    });
    await expect(readFile(join(root, 'generated/index.json'), 'utf8')).rejects.toThrow();
  });

  it('excludes valid draft and archived documents but lets an invalid draft block the batch', async () => {
    const root = await makeRoot();
    await writeArticle(root, 'published.md', article({ slug: 'published' }));
    await writeArticle(root, 'draft.md', article({ slug: 'draft', status: 'draft' }));
    await writeArticle(root, 'archived.md', article({ slug: 'archived', status: 'archived' }));

    await expect(validateContent({ rootDir: root, mediaBaseUrl })).resolves.toMatchObject({
      published: [{ compiled: { document: { slug: 'published' } } }],
    });

    await writeArticle(
      root,
      'draft.md',
      article({ slug: 'draft', status: 'draft', body: '# invalid' }),
    );
    await expect(validateContent({ rootDir: root, mediaBaseUrl })).rejects.toThrow('draft.md');
  });

  it('rejects duplicate document slugs before producing an output batch', () => {
    const compiled = compileArticle({
      markdown: article({ slug: 'same' }),
      sourcePath: 'content/articles/same.md',
      mediaBaseUrl,
    });

    expect(() =>
      validateCompiledBatch([
        { sourcePath: 'content/articles/one.md', compiled },
        { sourcePath: 'content/articles/two.md', compiled },
      ]),
    ).toThrow('Duplicate slug');
  });

  it('rejects distinct category names that normalize to the same category slug', async () => {
    const root = await makeRoot();
    await writeArticle(root, 'one.md', article({ slug: 'one', category: 'Čačak' }));
    await writeArticle(root, 'two.md', article({ slug: 'two', category: 'Cacak' }));

    await expect(validateContent({ rootDir: root, mediaBaseUrl })).rejects.toThrow('category slug');
  });

  describe('content build output', () => {
    it('orders the published index deterministically and writes stable JSON', async () => {
      const root = await makeRoot();
      await writeArticle(root, 'z.md', article({ slug: 'z', publishedAt: '2026-07-27' }));
      await writeArticle(root, 'b.md', article({ slug: 'b' }));
      await writeArticle(root, 'a.md', article({ slug: 'a' }));

      await buildContent({ rootDir: root, mediaBaseUrl });

      const indexText = await readFile(join(root, 'generated/index.json'), 'utf8');
      expect(JSON.parse(indexText).map((entry: { slug: string }) => entry.slug)).toEqual([
        'z',
        'a',
        'b',
      ]);
      expect(indexText).toMatch(/^\[\n  \{/);
      expect(indexText.endsWith('\n')).toBe(true);
    });

    it('preserves previous output after compile failure and an injected install rename failure', async () => {
      const root = await makeRoot();
      await writeArticle(root, 'published.md', article({ slug: 'published' }));
      await buildContent({ rootDir: root, mediaBaseUrl });
      const previousIndex = await readFile(join(root, 'generated/index.json'), 'utf8');

      await writeArticle(root, 'published.md', article({ slug: 'published', body: '# invalid' }));
      await expect(buildContent({ rootDir: root, mediaBaseUrl })).rejects.toThrow('published.md');
      expect(await readFile(join(root, 'generated/index.json'), 'utf8')).toBe(previousIndex);

      await writeArticle(
        root,
        'published.md',
        article({ slug: 'published', body: 'Valid again.' }),
      );
      await expect(
        buildContent({
          rootDir: root,
          mediaBaseUrl,
          renameDirectory: async (from, to) => {
            if (from.includes('.tmp-') && to.endsWith('generated'))
              throw new Error('injected install failure');
            await rename(from, to);
          },
        }),
      ).rejects.toThrow('injected install failure');
      expect(await readFile(join(root, 'generated/index.json'), 'utf8')).toBe(previousIndex);
      expect(
        (await readdir(root)).some(
          (name) => name.includes('generated.tmp-') || name.includes('generated.backup-'),
        ),
      ).toBe(false);
    });

    it('removes stale generated article files only after a successful replacement', async () => {
      const root = await makeRoot();
      await writeArticle(root, 'one.md', article({ slug: 'one' }));
      await writeArticle(root, 'two.md', article({ slug: 'two' }));
      await buildContent({ rootDir: root, mediaBaseUrl });

      await unlink(join(root, 'content/articles/two.md'));
      await buildContent({ rootDir: root, mediaBaseUrl });

      await expect(readFile(join(root, 'generated/articles/two.json'), 'utf8')).rejects.toThrow();
      expect(await readFile(join(root, 'generated/articles/one.json'), 'utf8')).toContain(
        '"slug": "one"',
      );
    });
  });
});

describe('podcast enclosure lengths', () => {
  interface StubHead {
    status: number;
    headers: Headers;
    url?: string;
  }

  function headResponse(
    contentLength: string | null,
    options: { status?: number; contentType?: string; url?: string } = {},
  ): StubHead {
    const headers = new Headers();
    if (contentLength !== null) headers.set('content-length', contentLength);
    headers.set('content-type', options.contentType ?? 'audio/mpeg');
    return { status: options.status ?? 200, headers, url: options.url };
  }

  function stubFetchAudioHead(
    response: StubHead | Error,
    seen: string[] = [],
  ): (url: string, options: { method: 'HEAD'; redirect: 'manual' }) => Promise<StubHead> {
    return async (url) => {
      seen.push(url);
      if (response instanceof Error) throw response;
      return response;
    };
  }

  it('keeps validateContent offline: published audio validates without a manifest or network', async () => {
    const root = await makeRoot();
    await writeArticle(root, 'heard.md', articleWithAudio({ slug: 'heard' }));

    await expect(validateContent({ rootDir: root, mediaBaseUrl })).resolves.toMatchObject({
      published: [{ compiled: { document: { slug: 'heard' } } }],
    });
    await expect(readFile(join(root, 'generated/index.json'), 'utf8')).rejects.toThrow();
  });

  it('bounds real audio HEAD requests with a timeout signal', async () => {
    const root = await makeRoot();
    await writeArticle(root, 'heard.md', articleWithAudio({ slug: 'heard' }));
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { 'content-type': 'audio/mpeg', 'content-length': '12345' },
      }),
    );
    try {
      await buildContent({ rootDir: root, mediaBaseUrl });
      expect(fetchSpy.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('resolves lengths over injected HEAD keyed by the exact compiled audio URL', async () => {
    const root = await makeRoot();
    const nonrootBase = 'https://media.example.org/subpath/';
    await writeArticle(root, 'heard.md', articleWithAudio({ slug: 'heard' }));
    const seen: string[] = [];
    const audioUrl = 'https://media.example.org/subpath/media/articles/heard/audio.mp3';

    await buildContent({
      rootDir: root,
      mediaBaseUrl: nonrootBase,
      fetchAudioHead: stubFetchAudioHead(headResponse('12345'), seen),
    });

    expect(seen).toEqual([audioUrl]);
    expect(await readFile(join(root, 'generated/audio-byte-lengths.json'), 'utf8')).toBe(
      `${JSON.stringify({ [audioUrl]: 12345 }, null, 2)}\n`,
    );
  });

  it.each([
    ['HTTP error', headResponse('12345', { status: 404 })],
    ['redirect', headResponse('12345', { status: 301 })],
    [
      'cross-host response origin',
      headResponse('12345', { url: 'https://elsewhere.example.org/audio.mp3' }),
    ],
    ['missing Content-Length', headResponse(null)],
    ['zero Content-Length', headResponse('0')],
    ['non-numeric Content-Length', headResponse('lots')],
    ['unsafe Content-Length', headResponse('9007199254740993')],
    ['unexpected Content-Type', headResponse('12345', { contentType: 'text/html' })],
    ['missing Content-Type', { status: 200, headers: new Headers({ 'content-length': '12345' }) }],
    ['failed request', new Error('socket hangup')],
  ])('rejects published audio with %s and preserves previous output', async (_label, response) => {
    const root = await makeRoot();
    await writeArticle(root, 'heard.md', articleWithAudio({ slug: 'heard' }));
    await mkdir(join(root, 'generated'), { recursive: true });
    await writeFile(join(root, 'generated/index.json'), '[sentinel]\n');

    await expect(
      buildContent({
        rootDir: root,
        mediaBaseUrl,
        fetchAudioHead: stubFetchAudioHead(response as StubHead | Error),
      }),
    ).rejects.toThrow(/audio/i);
    expect(await readFile(join(root, 'generated/index.json'), 'utf8')).toBe('[sentinel]\n');
    expect(
      (await readdir(root)).some(
        (name) => name.includes('generated.tmp-') || name.includes('generated.backup-'),
      ),
    ).toBe(false);
  });

  it('performs no HEAD lookup for drafts or articles without audio', async () => {
    const root = await makeRoot();
    await writeArticle(root, 'published.md', article({ slug: 'published' }));
    await writeArticle(
      root,
      'draft.md',
      articleWithAudio({ slug: 'draft' }).replace('status: published', 'status: draft'),
    );
    const seen: string[] = [];

    await buildContent({
      rootDir: root,
      mediaBaseUrl,
      fetchAudioHead: stubFetchAudioHead(headResponse('1'), seen),
    });

    expect(seen).toEqual([]);
    expect(await readFile(join(root, 'generated/audio-byte-lengths.json'), 'utf8')).toBe('{}\n');
  });

  it('sorts the generated manifest by audio URL deterministically', async () => {
    const root = await makeRoot();
    await writeArticle(root, 'b-side.md', articleWithAudio({ slug: 'b-side' }));
    await writeArticle(root, 'a-side.md', articleWithAudio({ slug: 'a-side' }));

    await buildContent({
      rootDir: root,
      mediaBaseUrl,
      fetchAudioHead: async (url: string) => headResponse(url.includes('a-side') ? '2' : '1'),
    });

    const manifest = JSON.parse(
      await readFile(join(root, 'generated/audio-byte-lengths.json'), 'utf8'),
    ) as Record<string, number>;
    expect(Object.keys(manifest)).toEqual([...Object.keys(manifest)].sort());
    expect(manifest).toEqual({
      'http://localhost:5173/media/articles/a-side/audio.mp3': 2,
      'http://localhost:5173/media/articles/b-side/audio.mp3': 1,
    });
  });
});

describe('empty source guard', () => {
  it('preserves existing output when the source directory is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'jelementi-content-missing-'));
    tempRoots.push(root);
    await mkdir(join(root, 'generated'), { recursive: true });
    await writeFile(join(root, 'generated/index.json'), '[sentinel]\n');

    await expect(buildContent({ rootDir: root, mediaBaseUrl })).rejects.toThrow();
    expect(await readFile(join(root, 'generated/index.json'), 'utf8')).toBe('[sentinel]\n');
    expect(
      (await readdir(root)).some(
        (name) => name.includes('generated.tmp-') || name.includes('generated.backup-'),
      ),
    ).toBe(false);
  });

  it('preserves existing output when zero Markdown files are discovered', async () => {
    const root = await makeRoot();
    await mkdir(join(root, 'generated'), { recursive: true });
    await writeFile(join(root, 'generated/index.json'), '[sentinel]\n');

    await expect(buildContent({ rootDir: root, mediaBaseUrl })).rejects.toThrow();
    expect(await readFile(join(root, 'generated/index.json'), 'utf8')).toBe('[sentinel]\n');
    expect(
      (await readdir(root)).some(
        (name) => name.includes('generated.tmp-') || name.includes('generated.backup-'),
      ),
    ).toBe(false);
  });

  it('allows an intentional empty published set when a draft source exists', async () => {
    const root = await makeRoot();
    await writeArticle(root, 'draft.md', article({ slug: 'draft', status: 'draft' }));

    const batch = await buildContent({ rootDir: root, mediaBaseUrl });
    expect(batch.index).toHaveLength(0);
    expect(await readFile(join(root, 'generated/index.json'), 'utf8')).toBe('[]\n');
  });
});

describe('content environment and watch mode', () => {
  it('loads an optional root env file explicitly and formats expected failures without a stack', async () => {
    const root = await makeRoot();
    await writeFile(join(root, '.env'), 'PUBLIC_MEDIA_BASE_URL=http://localhost:5173/\n');
    const env: NodeJS.ProcessEnv = {};
    const loaded: string[] = [];

    expect(
      loadMediaBaseUrl({
        rootDir: root,
        env,
        loadEnvFile: (path) => {
          loaded.push(path);
          env.PUBLIC_MEDIA_BASE_URL = 'http://localhost:5173/';
        },
      }),
    ).toBe(mediaBaseUrl);
    expect(loaded).toEqual([join(root, '.env')]);
    expect(() => loadMediaBaseUrl({ rootDir: root, env: {} })).toThrow(
      'PUBLIC_MEDIA_BASE_URL is required',
    );
    expect(formatContentError(new Error('ordinary failure'))).toBe('ordinary failure');
  });

  it('debounces injected watch events, preserves output after an error, and retries on the next change', async () => {
    const root = await makeRoot();
    await writeArticle(root, 'published.md', article({ slug: 'published' }));
    const errors: unknown[] = [];
    let listener: (() => void) | undefined;
    let scheduled: (() => Promise<void>) | undefined;
    let triggerCount = 0;
    let closed = false;
    const watcher = await watchContent({
      rootDir: root,
      mediaBaseUrl,
      onError: (error) => errors.push(error),
      watchDirectory: (_path, onChange) => {
        listener = onChange;
        return { close: () => (closed = true) };
      },
      debounce: (callback) => {
        scheduled = callback;
        const trigger = () => {
          triggerCount += 1;
        };
        trigger.cancel = () => undefined;
        return trigger;
      },
    });
    const previousIndex = await readFile(join(root, 'generated/index.json'), 'utf8');

    await writeArticle(root, 'published.md', article({ slug: 'published', body: '# invalid' }));
    listener?.();
    await scheduled?.();
    expect(triggerCount).toBe(1);
    expect(errors).toHaveLength(1);
    expect(await readFile(join(root, 'generated/index.json'), 'utf8')).toBe(previousIndex);

    await writeArticle(
      root,
      'published.md',
      article({ slug: 'published', body: 'Recovered body.' }),
    );
    listener?.();
    await scheduled?.();
    expect(triggerCount).toBe(2);
    expect(errors).toHaveLength(1);
    expect(await readFile(join(root, 'generated/index.json'), 'utf8')).not.toBe(previousIndex);

    watcher.close();
    expect(closed).toBe(true);
  });
});

describe('default debounce coalescing', () => {
  it('coalesces multiple rapid events into one rebuild and cancels pending work on close', () => {
    vi.useFakeTimers();
    try {
      let calls = 0;
      const trigger = defaultDebounce(async () => {
        calls++;
      });

      trigger();
      trigger();
      trigger();
      expect(calls).toBe(0);

      vi.advanceTimersByTime(100);
      expect(calls).toBe(1);

      calls = 0;
      trigger();
      trigger.cancel();
      vi.advanceTimersByTime(200);
      expect(calls).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('single-flight watch rebuilds', () => {
  it('runs at most one build at a time with one trailing rebuild for multiple events', async () => {
    const root = await makeRoot();
    await writeArticle(root, 'published.md', article({ slug: 'published' }));

    let buildCount = 0;
    let maxConcurrent = 0;
    let currentConcurrent = 0;
    const resolvers: Array<() => void> = [];

    let listener: (() => void) | undefined;
    let closed = false;

    const watcherPromise = watchContent({
      rootDir: root,
      mediaBaseUrl,
      onError: () => {},
      watchDirectory: (_path, onChange) => {
        listener = onChange;
        return {
          close: () => {
            closed = true;
          },
        };
      },
      debounce: (callback) => {
        const trigger = () => {
          void callback();
        };
        trigger.cancel = () => {};
        return trigger;
      },
      build: async () => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        buildCount++;
        await new Promise<void>((resolve) => {
          resolvers.push(resolve);
        });
        currentConcurrent--;
        return { all: [], published: [], index: [] };
      },
    });

    resolvers[0]?.();
    const watcher = await watcherPromise;
    expect(buildCount).toBe(1);

    listener?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(buildCount).toBe(2);
    expect(maxConcurrent).toBe(1);

    listener?.();
    listener?.();
    listener?.();
    expect(maxConcurrent).toBe(1);

    resolvers[1]?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(buildCount).toBe(3);

    resolvers[2]?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(buildCount).toBe(3);
    expect(maxConcurrent).toBe(1);

    watcher.close();
    expect(closed).toBe(true);
  });

  it('close cancels queued trailing work but does not corrupt a running build', async () => {
    const root = await makeRoot();
    await writeArticle(root, 'published.md', article({ slug: 'published' }));

    let buildCount = 0;
    const resolvers: Array<() => void> = [];

    let listener: (() => void) | undefined;
    let closed = false;

    const watcherPromise = watchContent({
      rootDir: root,
      mediaBaseUrl,
      onError: () => {},
      watchDirectory: (_path, onChange) => {
        listener = onChange;
        return {
          close: () => {
            closed = true;
          },
        };
      },
      debounce: (callback) => {
        const trigger = () => {
          void callback();
        };
        trigger.cancel = () => {};
        return trigger;
      },
      build: async () => {
        buildCount++;
        await new Promise<void>((resolve) => {
          resolvers.push(resolve);
        });
        return { all: [], published: [], index: [] };
      },
    });

    resolvers[0]?.();
    const watcher = await watcherPromise;
    expect(buildCount).toBe(1);

    listener?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(buildCount).toBe(2);

    listener?.();
    watcher.close();
    expect(closed).toBe(true);

    resolvers[1]?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(buildCount).toBe(2);
  });
});

describe('lock rollback fault injection', () => {
  it('preserves generated output when moving old target to backup fails', async () => {
    const root = await makeRoot();
    await writeArticle(root, 'published.md', article({ slug: 'published' }));
    await buildContent({ rootDir: root, mediaBaseUrl });
    const previousIndex = await readFile(join(root, 'generated/index.json'), 'utf8');

    await expect(
      buildContent({
        rootDir: root,
        mediaBaseUrl,
        renameDirectory: async (from, to) => {
          if (to.includes('backup')) throw new Error('old-target rename failure');
          await rename(from, to);
        },
      }),
    ).rejects.toThrow('old-target rename failure');

    expect(await readFile(join(root, 'generated/index.json'), 'utf8')).toBe(previousIndex);
    expect(
      (await readdir(root)).some(
        (name) => name.includes('generated.tmp-') || name.includes('generated.backup-'),
      ),
    ).toBe(false);
  });

  it('surfaces AggregateError when install and restore both fail, preserving backup', async () => {
    const root = await makeRoot();
    await writeArticle(root, 'published.md', article({ slug: 'published' }));
    await buildContent({ rootDir: root, mediaBaseUrl });
    const previousIndex = await readFile(join(root, 'generated/index.json'), 'utf8');

    let caught: unknown;
    try {
      await buildContent({
        rootDir: root,
        mediaBaseUrl,
        renameDirectory: async (from, to) => {
          if (from.includes('.tmp-') && to.endsWith('generated'))
            throw new Error('install failure');
          if (from.includes('backup') && to.endsWith('generated'))
            throw new Error('restore failure');
          await rename(from, to);
        },
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AggregateError);
    await expect(readFile(join(root, 'generated/index.json'), 'utf8')).rejects.toThrow();
    const entries = await readdir(root);
    const backupName = entries.find((name) => name.includes('generated.backup-'));
    expect(backupName).toBeDefined();
    if (backupName) {
      expect(await readFile(join(root, backupName, 'index.json'), 'utf8')).toBe(previousIndex);
    }
    expect(entries.some((name) => name.includes('generated.tmp-'))).toBe(false);
  });
});
