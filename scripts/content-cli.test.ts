import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runContentCli } from './content-cli';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('content CLI', () => {
  it('reports missing configuration and author errors concisely without a JavaScript stack', async () => {
    const root = await mkdtemp(join(tmpdir(), 'jelementi-content-cli-'));
    roots.push(root);
    await mkdir(join(root, 'content/articles'), { recursive: true });
    await writeFile(
      join(root, 'content/articles/published.md'),
      `---
title: Published
slug: published
excerpt: Published excerpt.
publishedAt: '2026-07-26'
updatedAt: '2026-07-26'
status: published
category: Remote Places
tags: [islands]
author: Jelementi
cover:
  src: media/articles/published/cover.webp
  alt: Published cover
references:
  - title: Source
    url: https://example.org/source
---

# unsupported heading
`,
    );
    const stderr: string[] = [];

    expect(
      await runContentCli(['validate'], {
        rootDir: root,
        env: {},
        stderr: (line) => stderr.push(line),
      }),
    ).toBe(1);
    expect(stderr).toEqual(['.env: PUBLIC_MEDIA_BASE_URL is required.']);

    stderr.length = 0;
    expect(
      await runContentCli(['validate'], {
        rootDir: root,
        env: { PUBLIC_MEDIA_BASE_URL: 'http://localhost:5173/' },
        stderr: (line) => stderr.push(line),
      }),
    ).toBe(1);
    expect(stderr).toHaveLength(1);
    expect(stderr[0]).toMatch(
      /^content\/articles\/published\.md:\d+:\d+: Only level 2 through 4 headings/,
    );
    expect(stderr[0]).not.toContain('ContentCompileError');
  });
});
