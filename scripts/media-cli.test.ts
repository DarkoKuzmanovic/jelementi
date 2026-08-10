import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runMediaCli } from './media-cli';
import type { MediaFetch, MediaProcessRunner } from './media';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const environment = { PUBLIC_MEDIA_BASE_URL: 'https://media.jelementi.quz.ma/' };

function response(status: number, headers: Record<string, string> = {}) {
  return { status, headers: new Headers(headers) };
}

function imageHeaders() {
  return {
    'cache-control': 'public, max-age=31536000, immutable',
    'content-length': '128',
    'content-type': 'image/svg+xml',
  };
}

describe('media CLI routing', () => {
  it('routes package-script upload arguments through injected filesystem, process, and HTTP boundaries', async () => {
    const calls: string[][] = [];
    const fetch: MediaFetch = async (_url, options) =>
      options.method === 'HEAD' && calls.length === 0
        ? response(404)
        : response(200, imageHeaders());
    const run: MediaProcessRunner = async (_command, args) => {
      calls.push(args);
      return { exitCode: 0, stdout: '', stderr: '' };
    };
    const output: string[] = [];

    await expect(
      runMediaCli(
        [
          'upload',
          '--',
          '--file',
          '/tmp/cover.svg',
          '--key',
          'articles/tristan-da-cunha/cover-v1.svg',
          '--content-type',
          'image/svg+xml',
        ],
        {
          rootDir,
          env: environment,
          fetch,
          run,
          statFile: async () => ({ isFile: () => true, size: 128 }),
          stdout: (line) => output.push(line),
        },
      ),
    ).resolves.toBe(0);

    expect(calls).toEqual([
      expect.arrayContaining([
        'wrangler',
        'r2',
        'object',
        'put',
        'jelementi-media/articles/tristan-da-cunha/cover-v1.svg',
      ]),
    ]);
    expect(output).toEqual([
      'https://media.jelementi.quz.ma/articles/tristan-da-cunha/cover-v1.svg',
    ]);
  });

  it('routes read-only verification through the injected HTTP boundary and rejects malformed arguments', async () => {
    const messages: string[] = [];
    const fetch: MediaFetch = async () => response(200, imageHeaders());

    await expect(
      runMediaCli(['verify'], {
        rootDir,
        env: environment,
        fetch,
        stderr: (line) => messages.push(line),
      }),
    ).resolves.toBe(0);
    await expect(
      runMediaCli(['upload', '--file', '/tmp/cover.svg'], {
        rootDir,
        env: environment,
        fetch,
        stderr: (line) => messages.push(line),
      }),
    ).resolves.toBe(1);

    expect(messages.at(-1)).toContain('Usage: media-cli upload');
  });

  it('keeps live media verification in the canonical deployment gate', async () => {
    const manifest = JSON.parse(
      await readFile(new URL('../package.json', import.meta.url), 'utf8'),
    ) as {
      scripts?: Record<string, string>;
    };

    expect(manifest.scripts?.['verify:deploy']).toMatch(/&& pnpm media:verify$/);
  });

  it('locks production custom domain with Access-protected previews and route-less branch uploads', async () => {
    const parseConfig = (source: string): Record<string, unknown> =>
      JSON.parse(source.replace(/,\s*([}\]])/g, '$1')) as Record<string, unknown>;
    const [productionConfig, previewConfig] = await Promise.all([
      readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8').then(parseConfig),
      readFile(new URL('../wrangler.m2.jsonc', import.meta.url), 'utf8').then(parseConfig),
    ]);

    // Production stays off workers.dev; preview URLs stay on so branch/version previews
    // survive main deploys (preview_urls:false on deploy disables Worker-level previews).
    expect(productionConfig.workers_dev).toBe(false);
    expect(productionConfig.preview_urls).toBe(true);
    expect(productionConfig.routes).toEqual([{ pattern: 'jelementi.quz.ma', custom_domain: true }]);
    expect(previewConfig.workers_dev).toBe(false);
    expect(previewConfig.preview_urls).toBe(true);
    expect(previewConfig).not.toHaveProperty('routes');

    for (const key of [
      'name',
      'main',
      'compatibility_date',
      'compatibility_flags',
      'assets',
      'r2_buckets',
    ]) {
      expect(previewConfig[key]).toEqual(productionConfig[key]);
    }
  });
});
