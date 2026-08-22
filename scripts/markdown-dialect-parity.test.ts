/**
 * Compile-parity gate for the Studio editor's Markdown dialect reference
 * (#113).
 *
 * The web app must never import `@jelementi/content-compiler` (ownership
 * boundary), so the dialect reference travels as plain data and THIS root-level
 * test is the only place the two sides meet: every documented acceptance or
 * rejection claim is compiled through the real compiler so the editor copy can
 * never drift from actual compiler behavior.
 */
import { describe, expect, it } from 'vitest';
import { ContentCompileError, compileArticle } from '@jelementi/content-compiler';
import {
  MARKDOWN_DIALECT_REFERENCE,
  buildStandaloneImageSnippet,
} from '../apps/web/src/lib/studio/markdown-dialect';

const PARITY_SLUG = 'parity-article';
const PARITY_FRONTMATTER = `---
title: Parity Article
slug: ${PARITY_SLUG}
excerpt: Verifies documented Markdown claims against the compiler.
updatedAt: '2026-08-22'
status: draft
category: Meta
tags: [parity]
author: Jelementi
cover:
  src: articles/${PARITY_SLUG}/cover-v1.webp
  alt: A cover image
references:
  - title: Source
    url: https://example.org/source
---`;

function compileBody(body: string): ReturnType<typeof compileArticle> {
  return compileArticle({
    markdown: `${PARITY_FRONTMATTER}\n\n${body}`,
    sourcePath: `content/articles/${PARITY_SLUG}.md`,
    mediaBaseUrl: 'https://media.example.org/',
  });
}

function firstIssueCode(body: string): string {
  try {
    compileBody(body);
  } catch (error: unknown) {
    if (error instanceof ContentCompileError && error.issues[0]) {
      return error.issues[0].code;
    }
    throw error;
  }
  throw new Error(`Expected compilation to fail for: ${JSON.stringify(body)}`);
}

describe('markdown dialect parity (#113)', () => {
  it('compiles every documented accepted example successfully', () => {
    for (const entry of MARKDOWN_DIALECT_REFERENCE) {
      for (const markdown of entry.acceptedExamples ?? []) {
        expect(
          () => compileBody(markdown),
          `${entry.id}: ${JSON.stringify(markdown)}`,
        ).not.toThrow();
      }
    }
  });

  it('rejects every documented rejected example with the recorded stable code', () => {
    for (const entry of MARKDOWN_DIALECT_REFERENCE) {
      for (const rejected of entry.rejectedExamples ?? []) {
        expect(
          firstIssueCode(rejected.markdown),
          `${entry.id}: ${JSON.stringify(rejected.markdown)}`,
        ).toBe(rejected.issueCode);
      }
    }
  });

  it('compiles the insert-image snippet into a standalone image block keyed to the current slug', () => {
    const snippet = buildStandaloneImageSnippet(PARITY_SLUG);
    // Surrounding text proves the padded snippet stays its own standalone
    // paragraph even when inserted between existing content.
    const result = compileBody(`An intro paragraph.${snippet}
A closing paragraph.`);

    const images = result.document.blocks.filter(
      (block): block is Extract<(typeof result.document.blocks)[number], { type: 'image' }> =>
        block.type === 'image',
    );
    expect(images).toHaveLength(1);
    const image = images[0];
    if (!image) throw new Error('Expected exactly one image block');
    expect(image.src).toBe(`https://media.example.org/articles/${PARITY_SLUG}/image-01-v1.webp`);
    expect(image.alt.length).toBeGreaterThan(0);
    expect(image.caption).toBeDefined();
    expect(result.document.blocks.map((block) => block.type)).toEqual([
      'paragraph',
      'image',
      'paragraph',
    ]);
  });
});
