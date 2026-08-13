import { describe, expect, it } from 'vitest';
import {
  ContentCompileError,
  compileArticle,
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
