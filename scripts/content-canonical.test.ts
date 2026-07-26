import { access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compileArticle } from '@jelementi/content-compiler';

const rootDir = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const mediaBaseUrl = 'http://localhost:5173/';

describe('canonical Tristan da Cunha article', () => {
  it('compiles every practical approved form and references real local static media', async () => {
    const sourcePath = 'content/articles/tristan-da-cunha.md';
    const markdown = await readFile(join(rootDir, sourcePath), 'utf8');
    const { document } = compileArticle({ markdown, sourcePath, mediaBaseUrl });

    expect(document.blocks.map((block) => block.type)).toEqual([
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
    expect(document.footnotes).toHaveLength(1);
    const mediaUrls = [
      document.cover.src,
      ...document.blocks.flatMap((block) => (block.type === 'image' ? [block.src] : [])),
    ];
    await Promise.all(
      mediaUrls.map((url) => access(join(rootDir, 'apps/web/static', new URL(url).pathname))),
    );
  });
});
