import { access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compileArticle } from '@jelementi/content-compiler';
import { articleContentFingerprint, canonicalizeJson } from '@jelementi/article-model';
import { createHash } from 'node:crypto';

const rootDir = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const localMediaBaseUrl = 'http://localhost:5173/media/';
const cloudMediaBaseUrl = 'https://media.jelementi.quz.ma/';

describe('canonical Tristan da Cunha article', () => {
  it('resolves versioned canonical media keys against both local and cloud bases while retaining local fixtures', async () => {
    const sourcePath = 'content/articles/tristan-da-cunha.md';
    const markdown = await readFile(join(rootDir, sourcePath), 'utf8');
    const localDocument = compileArticle({
      markdown,
      sourcePath,
      mediaBaseUrl: localMediaBaseUrl,
    }).document;
    const cloudDocument = compileArticle({
      markdown,
      sourcePath,
      mediaBaseUrl: cloudMediaBaseUrl,
    }).document;

    expect(localDocument.blocks.map((block) => block.type)).toEqual([
      'paragraph',
      'heading',
      'paragraph',
      'image',
      'list',
      'list',
      'quote',
      'divider',
      'callout',
      'callout',
      'callout',
    ]);
    expect(localDocument.footnotes).toHaveLength(1);
    const localMediaUrls = [
      localDocument.cover.src,
      ...localDocument.blocks.flatMap((block) => (block.type === 'image' ? [block.src] : [])),
    ];
    expect(localMediaUrls).toEqual([
      'http://localhost:5173/media/articles/tristan-da-cunha/cover-v1.svg',
      'http://localhost:5173/media/articles/tristan-da-cunha/map-v1.svg',
    ]);
    expect([
      cloudDocument.cover.src,
      ...cloudDocument.blocks.flatMap((block) => (block.type === 'image' ? [block.src] : [])),
    ]).toEqual([
      'https://media.jelementi.quz.ma/articles/tristan-da-cunha/cover-v1.svg',
      'https://media.jelementi.quz.ma/articles/tristan-da-cunha/map-v1.svg',
    ]);
    await Promise.all(
      localMediaUrls.map((url) => access(join(rootDir, 'apps/web/static', new URL(url).pathname))),
    );
  });

  it('fingerprints the canonical article as stable SHA-256 over canonical JSON bytes', async () => {
    const sourcePath = 'content/articles/tristan-da-cunha.md';
    const markdown = await readFile(join(rootDir, sourcePath), 'utf8');
    const document = compileArticle({
      markdown,
      sourcePath,
      mediaBaseUrl: cloudMediaBaseUrl,
    }).document;

    const canonicalJson = canonicalizeJson(document);
    const expected = createHash('sha256').update(canonicalJson).digest('hex');
    expect(await articleContentFingerprint(document)).toBe(expected);
    expect(await articleContentFingerprint(document)).toBe(expected);
  });
});
