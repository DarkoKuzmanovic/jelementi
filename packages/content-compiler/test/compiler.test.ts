import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ContentCompileError, compileArticle } from '@jelementi/content-compiler';

const frontmatter = `---
title: Remote Island
slug: remote-island
excerpt: A compact article about a remote island.
publishedAt: '2026-07-26'
updatedAt: '2026-07-26'
status: published
category: Remote Places
tags: [islands, history]
author: Jelementi
cover:
  src: articles/remote-island/cover.webp
  alt: Island from above
references:
  - title: Official source
    url: https://example.org/source
---`;

const supportedMarkdown = readFileSync(new URL('./fixtures/supported.md', import.meta.url), 'utf8');

describe('compileArticle', () => {
  it('compiles every supported form into a validated document and normalized search text', () => {
    const result = compileArticle({
      markdown: supportedMarkdown,
      sourcePath: 'content/articles/remote-island.md',
      mediaBaseUrl: 'https://media.example.org/',
    });

    expect(result.document.slug).toBe('remote-island');
    expect(result.document.blocks.map((block) => block.type)).toEqual([
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
    expect(result.document.blocks[0]).toMatchObject({ type: 'heading', id: 'island-life' });
    expect(result.document.blocks[4]).toMatchObject({ type: 'list', ordered: true });
    expect(result.document.blocks[5]).toMatchObject({ type: 'quote', attribution: 'Islander' });
    expect(result.document.blocks[7]).toMatchObject({
      type: 'callout',
      variant: 'fact',
      title: 'A fact',
    });
    expect(result.document.footnotes).toEqual([{ id: 'source', children: expect.any(Array) }]);
    expect(result.document.cover.src).toBe(
      'https://media.example.org/articles/remote-island/cover.webp',
    );
    expect(result.searchText).toContain('remote island');
    expect(result.searchText).toContain('the sea is the only road home');
  });

  it('suffixes duplicate heading IDs in document order and rounds reading time up', () => {
    const words = Array.from({ length: 201 }, () => 'word').join(' ');
    const result = compileArticle({
      markdown: `${frontmatter}\n\n## Same heading\n\n## Same heading\n\n${words}`,
      sourcePath: 'content/articles/remote-island.md',
      mediaBaseUrl: 'https://media.example.org',
    });
    expect(result.document.blocks.slice(0, 2)).toMatchObject([
      { type: 'heading', id: 'same-heading' },
      { type: 'heading', id: 'same-heading-2' },
    ]);
    expect(result.document.readingTimeMinutes).toBe(2);
  });

  it.each([
    ['unsupported node', `${frontmatter}\n\n# Not allowed`, 'UNSUPPORTED_NODE'],
    ['raw HTML', `${frontmatter}\n\n<div>Not allowed</div>`, 'UNSUPPORTED_NODE'],
    ['fenced code', `${frontmatter}\n\n\`\`\`ts\nconst x = 1;\n\`\`\``, 'UNSUPPORTED_NODE'],
    ['table', `${frontmatter}\n\n| one | two |\n| --- | --- |\n| a | b |`, 'UNSUPPORTED_NODE'],
    ['nested list', `${frontmatter}\n\n- one\n  - nested`, 'INVALID_LIST'],
    ['task list', `${frontmatter}\n\n- [ ] task`, 'INVALID_LIST'],
    ['custom ordered start', `${frontmatter}\n\n2. two`, 'INVALID_LIST'],
    ['unknown directive', `${frontmatter}\n\n:::tip\nNo\n:::`, 'INVALID_DIRECTIVE'],
    [
      'invalid directive attribute',
      `${frontmatter}\n\n:::fact{unknown="x"}\nNo\n:::`,
      'INVALID_DIRECTIVE',
    ],
    ['inline image', `${frontmatter}\n\nText ![map](articles/map.webp)`, 'UNSUPPORTED_NODE'],
    [
      'invalid media key',
      `${frontmatter.replace('articles/remote-island/cover.webp', '../cover.webp')}\n\nText`,
      'INVALID_MEDIA',
    ],
    ['missing footnote definition', `${frontmatter}\n\nText[^missing]`, 'INVALID_FOOTNOTE'],
    [
      'duplicate footnote definition',
      `${frontmatter}\n\nText[^source]\n\n[^source]: First.\n[^source]: Second.`,
      'INVALID_FOOTNOTE',
    ],
    [
      'invalid frontmatter',
      `---\ntitle: Missing required fields\n---\n\nText`,
      'INVALID_FRONTMATTER',
    ],
  ])('rejects %s with a source-located stable issue', (_name, markdown, code) => {
    try {
      compileArticle({
        markdown,
        sourcePath: 'content/articles/remote-island.md',
        mediaBaseUrl: 'https://media.example.org',
      });
      throw new Error('Expected compilation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(ContentCompileError);
      const issue = (error as ContentCompileError).issues[0];
      if (!issue) throw new Error('Expected one compile issue');
      expect(issue).toMatchObject({ code, sourcePath: 'content/articles/remote-island.md' });
      expect(issue.line).toEqual(expect.any(Number));
      expect(issue.column).toEqual(expect.any(Number));
    }
  });
});

describe('diagnostic guidance (#113)', () => {
  function firstIssueMessage(markdown: string, mediaBaseUrl = 'https://media.example.org'): string {
    try {
      compileArticle({
        markdown,
        sourcePath: 'content/articles/remote-island.md',
        mediaBaseUrl,
      });
    } catch (error: unknown) {
      if (error instanceof ContentCompileError && error.issues[0]) {
        return error.issues[0].message;
      }
      throw error;
    }
    throw new Error(`Expected compilation to fail for: ${JSON.stringify(markdown)}`);
  }

  it('heading-depth errors state the supported ## to #### range', () => {
    for (const heading of ['# Too shallow', '##### Too deep']) {
      const message = firstIssueMessage(`${frontmatter}\n\n${heading}`);
      expect(message).toContain('Only level 2 through 4 headings');
      expect(message).toContain('(## through ####)');
    }
  });

  it('table rejections suggest a list as the alternative', () => {
    const message = firstIssueMessage(`${frontmatter}\n\n| one | two |\n| --- | --- |\n| a | b |`);
    expect(message).toContain('list');
  });

  it('raw HTML rejections name Markdown formatting as the alternative', () => {
    const message = firstIssueMessage(`${frontmatter}\n\n<div>Not allowed</div>`);
    expect(message).toContain('Markdown');
  });

  it('the generic unsupported-node fallback names the allowed constructs', () => {
    // A leaf directive (::name) has no specific hint, so it exercises the
    // generic fallback listing every allowed block construct.
    const message = firstIssueMessage(`${frontmatter}\n\n::shrug`);
    expect(message).toMatch(/footnotes/i);
    expect(message).toMatch(/callouts/i);
  });

  it('fenced-code rejections point at inline code within a paragraph', () => {
    const message = firstIssueMessage(`${frontmatter}\n\n\`\`\`ts\nconst x = 1;\n\`\`\``);
    expect(message).toMatch(/inline `code`/);
  });

  it('invalid-media errors explain the relative-key rule plainly', () => {
    const markdown = frontmatter.replace('articles/remote-island/cover.webp', '../escape.webp');
    const message = firstIssueMessage(markdown);
    expect(message).toContain('relative paths');
    expect(message).toContain('articles/example/file-v1.ext');
  });
});

describe('media boundary containment', () => {
  const baseWithPrefix = 'https://media.example.org/base/';

  it('rejects encoded dot segments that would escape the base pathname', () => {
    const markdown = frontmatter.replace(
      'articles/remote-island/cover.webp',
      '"%2e%2e/escape.webp"',
    );
    expect(() =>
      compileArticle({
        markdown,
        sourcePath: 'content/articles/remote-island.md',
        mediaBaseUrl: baseWithPrefix,
      }),
    ).toThrow(ContentCompileError);
  });

  it('rejects backslashes in media keys', () => {
    const markdown = frontmatter.replace(
      'articles/remote-island/cover.webp',
      String.raw`foo\bar.webp`,
    );
    expect(() =>
      compileArticle({
        markdown,
        sourcePath: 'content/articles/remote-island.md',
        mediaBaseUrl: baseWithPrefix,
      }),
    ).toThrow(ContentCompileError);
  });

  it('preserves valid nested relative keys under a path-prefixed base', () => {
    const result = compileArticle({
      markdown: frontmatter,
      sourcePath: 'content/articles/remote-island.md',
      mediaBaseUrl: baseWithPrefix,
    });
    expect(result.document.cover.src).toBe(
      'https://media.example.org/base/articles/remote-island/cover.webp',
    );
  });
});

describe('date validation', () => {
  it('rejects non-ISO publishedAt', () => {
    const markdown = frontmatter.replace("publishedAt: '2026-07-26'", 'publishedAt: someday');
    expect(() =>
      compileArticle({
        markdown,
        sourcePath: 'content/articles/remote-island.md',
        mediaBaseUrl: 'https://media.example.org',
      }),
    ).toThrow(ContentCompileError);
  });

  it('rejects non-ISO updatedAt', () => {
    const markdown = frontmatter.replace("updatedAt: '2026-07-26'", 'updatedAt: yesterday');
    expect(() =>
      compileArticle({
        markdown,
        sourcePath: 'content/articles/remote-island.md',
        mediaBaseUrl: 'https://media.example.org',
      }),
    ).toThrow(ContentCompileError);
  });
});

describe('locale independence', () => {
  it('heading IDs are locale-independent', () => {
    const original = String.prototype.toLocaleLowerCase;
    String.prototype.toLocaleLowerCase = function () {
      throw new Error('locale-sensitive method called');
    };
    try {
      const result = compileArticle({
        markdown: `${frontmatter}\n\n## Istanbul`,
        sourcePath: 'content/articles/remote-island.md',
        mediaBaseUrl: 'https://media.example.org',
      });
      expect(result.document.blocks[0]).toMatchObject({ type: 'heading', id: 'istanbul' });
    } finally {
      String.prototype.toLocaleLowerCase = original;
    }
  });
});

describe('strict nested frontmatter', () => {
  it('rejects unknown cover fields', () => {
    const markdown = frontmatter.replace(
      '  alt: Island from above',
      '  alt: Island from above\n  extra: not allowed',
    );
    expect(() =>
      compileArticle({
        markdown,
        sourcePath: 'content/articles/remote-island.md',
        mediaBaseUrl: 'https://media.example.org',
      }),
    ).toThrow(ContentCompileError);
  });

  it('rejects unknown audio fields', () => {
    const markdown = frontmatter.replace(
      'https://example.org/source\n---',
      'https://example.org/source\naudio:\n  src: articles/remote-island/audio.mp3\n  durationSeconds: 1842\n  extra: not allowed\n---',
    );
    expect(() =>
      compileArticle({
        markdown,
        sourcePath: 'content/articles/remote-island.md',
        mediaBaseUrl: 'https://media.example.org',
      }),
    ).toThrow(ContentCompileError);
  });

  it('rejects unknown reference fields', () => {
    const markdown = frontmatter.replace(
      '    url: https://example.org/source',
      '    url: https://example.org/source\n    extra: not allowed',
    );
    expect(() =>
      compileArticle({
        markdown,
        sourcePath: 'content/articles/remote-island.md',
        mediaBaseUrl: 'https://media.example.org',
      }),
    ).toThrow(ContentCompileError);
  });
});

describe('optional field type strictness', () => {
  it('rejects non-string publishedAt in draft frontmatter', () => {
    const markdown = frontmatter
      .replace('status: published', 'status: draft')
      .replace("publishedAt: '2026-07-26'", 'publishedAt: 42');
    expect(() =>
      compileArticle({
        markdown,
        sourcePath: 'content/articles/remote-island.md',
        mediaBaseUrl: 'https://media.example.org',
      }),
    ).toThrow(ContentCompileError);
  });

  it('rejects non-string publisher in references', () => {
    const markdown = frontmatter.replace(
      '    url: https://example.org/source',
      '    url: https://example.org/source\n    publisher: 42',
    );
    expect(() =>
      compileArticle({
        markdown,
        sourcePath: 'content/articles/remote-island.md',
        mediaBaseUrl: 'https://media.example.org',
      }),
    ).toThrow(ContentCompileError);
  });

  it('rejects non-string accessedAt in references', () => {
    const markdown = frontmatter.replace(
      '    url: https://example.org/source',
      '    url: https://example.org/source\n    accessedAt: 42',
    );
    expect(() =>
      compileArticle({
        markdown,
        sourcePath: 'content/articles/remote-island.md',
        mediaBaseUrl: 'https://media.example.org',
      }),
    ).toThrow(ContentCompileError);
  });
});
