import { describe, expect, it } from 'vitest';
import {
  ContentCompileError,
  compileArticle,
  parseArticleSource,
  serializeArticleSource,
  type ArticleSourceFrontmatter,
} from '@jelementi/content-compiler';

const fullFrontmatter: ArticleSourceFrontmatter = {
  title: 'The 250 People at the End of the World',
  slug: 'tristan-da-cunha',
  excerpt: "The story of the world's most remote permanent settlement.",
  publishedAt: '2026-07-26',
  updatedAt: '2026-07-26',
  status: 'published',
  category: 'History',
  tags: ['remote places', 'islands', 'communities'],
  author: 'Jelementi',
  cover: {
    src: 'articles/tristan-da-cunha/cover-v1.webp',
    alt: 'The volcanic island of Tristan da Cunha',
  },
  audio: {
    src: 'articles/tristan-da-cunha/audio-v1.mp3',
    durationSeconds: 1842,
  },
  references: [
    {
      title: 'Tristan da Cunha — Government and history',
      url: 'https://example.org/source',
      publisher: 'Example Org',
      accessedAt: '2026-07-26',
    },
  ],
};

const draftFrontmatter: ArticleSourceFrontmatter = {
  title: 'Draft Notes',
  slug: 'draft-notes',
  excerpt: 'A draft in progress.',
  updatedAt: '2026-08-01',
  status: 'draft',
  category: 'Ideas',
  tags: ['draft'],
  author: 'Jelementi',
  cover: { src: 'articles/draft-notes/cover-v1.webp', alt: 'Draft cover' },
  references: [{ title: 'Source', url: 'https://example.org/draft' }],
};

const fullBody = 'Pull up a map. Find *South America* on the left and **Africa** on the right.';

const expectedFullSource = `---
title: The 250 People at the End of the World
slug: tristan-da-cunha
excerpt: The story of the world's most remote permanent settlement.
publishedAt: 2026-07-26
updatedAt: 2026-07-26
status: published
category: History
tags:
  - remote places
  - islands
  - communities
author: Jelementi
cover:
  src: articles/tristan-da-cunha/cover-v1.webp
  alt: The volcanic island of Tristan da Cunha
audio:
  src: articles/tristan-da-cunha/audio-v1.mp3
  durationSeconds: 1842
references:
  - title: Tristan da Cunha — Government and history
    url: https://example.org/source
    publisher: Example Org
    accessedAt: 2026-07-26
---
${fullBody}`;

const expectedDraftSource = `---
title: Draft Notes
slug: draft-notes
excerpt: A draft in progress.
updatedAt: 2026-08-01
status: draft
category: Ideas
tags:
  - draft
author: Jelementi
cover:
  src: articles/draft-notes/cover-v1.webp
  alt: Draft cover
references:
  - title: Source
    url: https://example.org/draft
---
`;

describe('serializeArticleSource', () => {
  it('serializes every frontmatter field into one deterministic canonical source', () => {
    expect(serializeArticleSource({ frontmatter: fullFrontmatter, body: fullBody })).toBe(
      expectedFullSource,
    );
    // Repeated calls produce byte-identical output.
    expect(serializeArticleSource({ frontmatter: fullFrontmatter, body: fullBody })).toBe(
      expectedFullSource,
    );
  });

  it('locks field order, one frontmatter/body separator, and final newline behavior', () => {
    // Empty body still yields a source ending exactly with the closing delimiter newline.
    expect(serializeArticleSource({ frontmatter: draftFrontmatter, body: '' })).toBe(
      expectedDraftSource,
    );

    // The frontmatter block is always delimited by exactly two `---` lines.
    const source = serializeArticleSource({ frontmatter: draftFrontmatter, body: 'Body.' });
    expect(source.startsWith('---\n')).toBe(true);
    expect(source.indexOf('\n---\n')).toBe(source.lastIndexOf('\n---\n'));

    // Key order inside the YAML block is locked: title, slug, excerpt, updatedAt,
    // status, category, tags, author, cover, references.
    const yamlBlock = source.slice(4, source.indexOf('\n---\n'));
    const lines = yamlBlock.split('\n').map((line) => line.split(':')[0]);
    expect(
      lines.filter(
        (line): line is string => line !== undefined && line !== '' && !line.startsWith(' '),
      ),
    ).toEqual([
      'title',
      'slug',
      'excerpt',
      'updatedAt',
      'status',
      'category',
      'tags',
      'author',
      'cover',
      'references',
    ]);
  });

  it('normalizes CRLF body line endings to LF', () => {
    const lf = serializeArticleSource({
      frontmatter: draftFrontmatter,
      body: 'Line one\nLine two',
    });
    const crlf = serializeArticleSource({
      frontmatter: draftFrontmatter,
      body: 'Line one\r\nLine two',
    });
    expect(crlf).toBe(lf);
    expect(crlf).toContain('Line one\nLine two');
    expect(crlf).not.toContain('\r');
  });

  it('round-trips every field through compileArticle', () => {
    const source = serializeArticleSource({ frontmatter: fullFrontmatter, body: fullBody });
    const result = compileArticle({
      markdown: source,
      sourcePath: 'content/articles/tristan-da-cunha.md',
      mediaBaseUrl: 'https://media.example.org/',
    });

    expect(result.document).toMatchObject({
      schemaVersion: 1,
      title: 'The 250 People at the End of the World',
      slug: 'tristan-da-cunha',
      excerpt: "The story of the world's most remote permanent settlement.",
      publishedAt: '2026-07-26',
      updatedAt: '2026-07-26',
      status: 'published',
      category: 'History',
      tags: ['remote places', 'islands', 'communities'],
      author: 'Jelementi',
      cover: {
        src: 'https://media.example.org/articles/tristan-da-cunha/cover-v1.webp',
        alt: 'The volcanic island of Tristan da Cunha',
      },
      audio: {
        src: 'https://media.example.org/articles/tristan-da-cunha/audio-v1.mp3',
        durationSeconds: 1842,
      },
      references: [
        {
          title: 'Tristan da Cunha — Government and history',
          url: 'https://example.org/source',
          publisher: 'Example Org',
          accessedAt: '2026-07-26',
        },
      ],
    });
    expect(result.document.readingTimeMinutes).toBe(1);
  });

  it('round-trips a draft without optional fields and with an empty body', () => {
    const source = serializeArticleSource({ frontmatter: draftFrontmatter, body: '' });
    const result = compileArticle({
      markdown: source,
      sourcePath: 'content/articles/draft-notes.md',
      mediaBaseUrl: 'https://media.example.org/',
    });

    expect(result.document).toMatchObject({
      status: 'draft',
      title: 'Draft Notes',
      slug: 'draft-notes',
      category: 'Ideas',
      tags: ['draft'],
      references: [{ title: 'Source', url: 'https://example.org/draft' }],
    });
    expect(result.document.publishedAt).toBeUndefined();
    expect(result.document.audio).toBeUndefined();
    expect(result.document.blocks).toEqual([]);
    expect(result.document.readingTimeMinutes).toBe(1);
  });

  it('does not weaken compileArticle validation for unsupported body syntax', () => {
    const source = serializeArticleSource({ frontmatter: draftFrontmatter, body: '# Not allowed' });

    let captured: unknown;
    try {
      compileArticle({
        markdown: source,
        sourcePath: 'content/articles/draft-notes.md',
        mediaBaseUrl: 'https://media.example.org/',
      });
    } catch (error: unknown) {
      captured = error;
    }

    expect(captured).toBeInstanceOf(ContentCompileError);
    const issues = (captured as ContentCompileError).issues;
    expect(issues[0]).toMatchObject({
      code: 'UNSUPPORTED_NODE',
      sourcePath: 'content/articles/draft-notes.md',
    });
    expect(issues[0]?.line).toBeTypeOf('number');
  });
});

describe('parseArticleSource', () => {
  const sourcePath = 'content/articles/draft-notes.md';

  it('parses the full canonical source back into identical frontmatter and body', () => {
    const source = serializeArticleSource({ frontmatter: fullFrontmatter, body: fullBody });
    expect(parseArticleSource(source, 'content/articles/tristan-da-cunha.md')).toEqual({
      frontmatter: fullFrontmatter,
      body: fullBody,
    });
  });

  it('parses a draft with an empty body', () => {
    const source = serializeArticleSource({ frontmatter: draftFrontmatter, body: '' });
    expect(parseArticleSource(source, sourcePath)).toEqual({
      frontmatter: draftFrontmatter,
      body: '',
    });
  });

  it('round-trips serialize -> parse -> serialize with byte equality', () => {
    const fullSource = serializeArticleSource({ frontmatter: fullFrontmatter, body: fullBody });
    const draftSource = serializeArticleSource({ frontmatter: draftFrontmatter, body: '' });
    const fullRound = serializeArticleSource(
      parseArticleSource(fullSource, 'content/articles/tristan-da-cunha.md'),
    );
    const draftRound = serializeArticleSource(parseArticleSource(draftSource, sourcePath));
    expect(fullRound).toBe(fullSource);
    expect(fullRound).toBe(serializeArticleSource(parseArticleSource(fullSource, 'content/articles/tristan-da-cunha.md')));
    expect(draftRound).toBe(draftSource);
  });

  it('preserves the body verbatim, including trailing newlines and leading dividers', () => {
    const trailing = serializeArticleSource({ frontmatter: draftFrontmatter, body: 'Body.\n' });
    expect(parseArticleSource(trailing, sourcePath).body).toBe('Body.\n');

    // A body starting with a thematic break must not be confused with a delimiter.
    const leadingDivider = serializeArticleSource({
      frontmatter: draftFrontmatter,
      body: '---\nNot frontmatter\n',
    });
    expect(parseArticleSource(leadingDivider, sourcePath).body).toBe('---\nNot frontmatter\n');

    // CRLF bodies are LF-normalized by the serializer and parsed back as LF bytes.
    const crlf = serializeArticleSource({
      frontmatter: draftFrontmatter,
      body: 'Line one\r\nLine two\r\n',
    });
    expect(parseArticleSource(crlf, sourcePath).body).toBe('Line one\nLine two\n');
    expect(serializeArticleSource(parseArticleSource(crlf, sourcePath))).toBe(crlf);
  });

  it('rejects body-only Markdown and missing closing delimiters', () => {
    for (const [markdown, sourcePathForCase] of [
      ['Just some text without frontmatter.\n', sourcePath],
      [serializeArticleSource({ frontmatter: draftFrontmatter, body: '' }).replace(/\n---\n$/, ''), sourcePath],
    ] as const) {
      let captured: unknown;
      try {
        parseArticleSource(markdown, sourcePathForCase);
      } catch (error: unknown) {
        captured = error;
      }
      expect(captured).toBeInstanceOf(ContentCompileError);
      expect((captured as ContentCompileError).issues[0]).toMatchObject({
        code: 'INVALID_FRONTMATTER',
        sourcePath: sourcePathForCase,
      });
      expect((captured as ContentCompileError).issues[0]?.line).toBeTypeOf('number');
      expect((captured as ContentCompileError).issues[0]?.column).toBeTypeOf('number');
    }
  });

  it('rejects malformed YAML and duplicate frontmatter keys with source locations', () => {
    const malformed = yamlSource('Body', 'title: [unclosed\n');
    const duplicated = yamlSource('Body', 'title: Duplicate\n');
    for (const markdown of [malformed, duplicated]) {
      let captured: unknown;
      try {
        parseArticleSource(markdown, sourcePath);
      } catch (error: unknown) {
        captured = error;
      }
      expect(captured).toBeInstanceOf(ContentCompileError);
      expect((captured as ContentCompileError).issues[0]).toMatchObject({
        code: 'INVALID_FRONTMATTER',
        sourcePath,
      });
      expect((captured as ContentCompileError).issues[0]?.line).toBeTypeOf('number');
    }
  });

  it('rejects unknown frontmatter, cover, audio, and reference keys', () => {
    const cases = [
      yamlSource('Body', 'bogus: true\n'),
      serializeArticleSource({ frontmatter: draftFrontmatter, body: 'Body' }).replace(
        'alt: Draft cover',
        'alt: Draft cover\n  caption: Extra',
      ),
      serializeArticleSource({ frontmatter: fullFrontmatter, body: 'Body' }).replace(
        'durationSeconds: 1842',
        'durationSeconds: 1842\n  bitrate: 128',
      ),
      serializeArticleSource({ frontmatter: draftFrontmatter, body: 'Body' }).replace(
        'url: https://example.org/draft',
        'url: https://example.org/draft\n  language: en',
      ),
    ];
    for (const markdown of cases) {
      let captured: unknown;
      try {
        parseArticleSource(markdown, sourcePath);
      } catch (error: unknown) {
        captured = error;
      }
      expect(captured).toBeInstanceOf(ContentCompileError);
      expect((captured as ContentCompileError).issues[0]).toMatchObject({
        code: 'INVALID_FRONTMATTER',
        sourcePath,
      });
    }
  });

  it('rejects invalid field shapes instead of silently normalizing them', () => {
    const draftSource = serializeArticleSource({ frontmatter: draftFrontmatter, body: 'Body' });
    const fullSource = serializeArticleSource({ frontmatter: fullFrontmatter, body: 'Body' });
    const cases = [
      draftSource.replace('title: Draft Notes\n', ''),
      draftSource.replace('tags:\n  - draft', 'tags: not-an-array'),
      draftSource.replace('  src: articles/draft-notes/cover-v1.webp\n', ''),
      draftSource.replace('status: draft', 'status: scheduled'),
      fullSource.replace('publishedAt: 2026-07-26\n', ''),
      fullSource.replace('durationSeconds: 1842', 'durationSeconds: 0'),
      draftSource.replace('url: https://example.org/draft\n', ''),
    ];
    for (const markdown of cases) {
      let captured: unknown;
      try {
        parseArticleSource(markdown, sourcePath);
      } catch (error: unknown) {
        captured = error;
      }
      expect(captured).toBeInstanceOf(ContentCompileError);
      expect((captured as ContentCompileError).issues[0]).toMatchObject({
        code: 'INVALID_FRONTMATTER',
        sourcePath,
      });
    }
  });

  it('rejects a slug that does not match the source filename', () => {
    let captured: unknown;
    try {
      parseArticleSource(
        serializeArticleSource({ frontmatter: draftFrontmatter, body: 'Body' }),
        'content/articles/other-name.md',
      );
    } catch (error: unknown) {
      captured = error;
    }
    expect(captured).toBeInstanceOf(ContentCompileError);
    expect((captured as ContentCompileError).issues[0]).toMatchObject({
      code: 'INVALID_FRONTMATTER',
      sourcePath: 'content/articles/other-name.md',
    });
  });

  it('keeps compileArticle the owner of body validation after parsing', () => {
    const parsed = parseArticleSource(
      serializeArticleSource({ frontmatter: draftFrontmatter, body: '# Not allowed' }),
      sourcePath,
    );
    expect(parsed.body).toBe('# Not allowed');

    let captured: unknown;
    try {
      compileArticle({
        markdown: serializeArticleSource(parsed),
        sourcePath,
        mediaBaseUrl: 'https://media.example.org/',
      });
    } catch (error: unknown) {
      captured = error;
    }
    expect(captured).toBeInstanceOf(ContentCompileError);
    expect((captured as ContentCompileError).issues[0]).toMatchObject({
      code: 'UNSUPPORTED_NODE',
      sourcePath,
    });
  });
});

function yamlSource(body: string, extraLines: string): string {
  const base = serializeArticleSource({ frontmatter: draftFrontmatter, body });
  const closeIndex = base.lastIndexOf('\n---\n');
  if (closeIndex < 0) throw new Error('closing delimiter missing from fixture');
  return `${base.slice(0, closeIndex)}\n${extraLines}${base.slice(closeIndex)}`;
}
