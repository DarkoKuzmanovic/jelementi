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
