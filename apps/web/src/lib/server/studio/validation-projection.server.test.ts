import { describe, expect, it } from 'vitest';
import { serializeArticleSource } from '@jelementi/content-compiler';
import type { StudioCompileIssue, StudioMetadata } from '../../studio/contracts';
import {
  buildEditorInputIssues,
  buildStudioValidationProjection,
} from './validation-projection.server';

const metadata: StudioMetadata = {
  title: 'A Draft Article',
  slug: 'a-draft-article',
  excerpt: 'An article being written in Studio.',
  status: 'draft',
  updatedAt: '2026-08-01',
  category: 'Ideas',
  tags: ['studio'],
  author: 'Jelementi',
  cover: { src: 'articles/a-draft-article/cover.svg', alt: 'A draft cover' },
  references: [],
};

const sourcePath = 'content/articles/a-draft-article.md';

function frontmatterLineCount(meta: StudioMetadata): number {
  const serialized = serializeArticleSource({
    frontmatter: meta as never,
    body: '',
  });
  return serialized.split('\n').length - 1;
}

function issue(overrides: Partial<StudioCompileIssue>): StudioCompileIssue {
  return {
    code: 'UNSUPPORTED_NODE',
    message: 'Unsupported node.',
    sourcePath,
    ...overrides,
  };
}

describe('buildStudioValidationProjection', () => {
  it('returns undefined when there are no issues', () => {
    expect(buildStudioValidationProjection([], { metadata, body: 'Fine body.' })).toBeUndefined();
  });

  it('summarizes count, blocking severity, and phases', () => {
    const projection = buildStudioValidationProjection(
      [
        issue({ code: 'INVALID_FRONTMATTER', message: 'Unsupported frontmatter field "extra"' }),
        issue({ code: 'UNSUPPORTED_NODE', message: 'Unsupported heading level.' }),
      ],
      { metadata, body: '# Bad heading' },
    );

    expect(projection).toBeDefined();
    expect(projection?.count).toBe(2);
    expect(projection?.severity).toBe('blocking');
    expect(projection?.phases).toEqual(['metadata', 'body']);
    expect(projection?.summary).toContain('2 validation issues');
    expect(projection?.summary).toContain('Publish stays blocked');
    expect(projection?.first).toBe(projection?.issues[0]);
    expect(projection?.issues).toHaveLength(2);
  });

  it('uses singular phrasing for a single issue', () => {
    const projection = buildStudioValidationProjection(
      [issue({ code: 'UNSUPPORTED_NODE', message: 'Unsupported heading level.' })],
      { metadata, body: '# Bad heading' },
    );

    expect(projection?.summary).toContain('1 validation issue');
    expect(projection?.summary).not.toContain('1 validation issues');
  });

  it('targets the body textarea with a deterministic selection for body issues', () => {
    const body = 'First paragraph.\n\n# Unsupported acceptance heading\n\nLast paragraph.';
    const fmLines = frontmatterLineCount(metadata);
    // Body line 3 holds the bad heading; source line = frontmatter lines + 3.
    const projection = buildStudioValidationProjection(
      [
        issue({
          code: 'UNSUPPORTED_NODE',
          message: 'Unsupported heading level.',
          line: fmLines + 3,
          column: 1,
        }),
      ],
      { metadata, body },
    );

    const target = projection?.first.target;
    expect(target?.kind).toBe('body');
    if (target?.kind === 'body') {
      expect(target.controlId).toBe('studio-body');
      expect(target.bodyLine).toBe(3);
      expect(target.bodyColumn).toBe(1);
      const lineStart = 'First paragraph.\n\n'.length;
      expect(target.selectionStart).toBe(lineStart);
      expect(target.selectionEnd).toBe(lineStart + '# Unsupported acceptance heading'.length);
      expect(body.slice(target.selectionStart, target.selectionEnd)).toBe(
        '# Unsupported acceptance heading',
      );
    }
  });

  it('starts the selection at the issue column when it is inside the line', () => {
    const body = 'Alpha :::bad directive here';
    const fmLines = frontmatterLineCount(metadata);
    const projection = buildStudioValidationProjection(
      [
        issue({
          code: 'INVALID_DIRECTIVE',
          message: 'Unknown directive.',
          line: fmLines + 1,
          column: 7,
        }),
      ],
      { metadata, body },
    );

    const target = projection?.first.target;
    expect(target?.kind).toBe('body');
    if (target?.kind === 'body') {
      expect(target.selectionStart).toBe(6);
      expect(target.selectionEnd).toBe(body.length);
    }
  });

  it('falls back to a whole-line selection when the column exceeds the line', () => {
    const body = 'Short';
    const fmLines = frontmatterLineCount(metadata);
    const projection = buildStudioValidationProjection(
      [
        issue({
          code: 'UNSUPPORTED_NODE',
          message: 'Bad.',
          line: fmLines + 1,
          column: 99,
        }),
      ],
      { metadata, body },
    );

    const target = projection?.first.target;
    expect(target?.kind).toBe('body');
    if (target?.kind === 'body') {
      expect(target.selectionStart).toBe(0);
      expect(target.selectionEnd).toBe('Short'.length);
    }
  });

  it('announces the source location when a body line is out of bounds', () => {
    const projection = buildStudioValidationProjection(
      [issue({ code: 'UNSUPPORTED_NODE', message: 'Bad.', line: 9999, column: 1 })],
      { metadata, body: 'One line only.' },
    );

    const view = projection?.first;
    expect(view?.target.kind).toBe('source');
    expect(view?.location).toBe(`${sourcePath}:9999:1`);
  });

  it('maps unsupported frontmatter fields named in the message to their controls', () => {
    const projection = buildStudioValidationProjection(
      [
        issue({
          code: 'INVALID_FRONTMATTER',
          message: 'Unsupported frontmatter field "cover"',
          line: 1,
          column: 1,
        }),
      ],
      { metadata, body: 'Body.' },
    );

    const target = projection?.first.target;
    expect(target?.kind).toBe('field');
    if (target?.kind === 'field') {
      expect(target.controlId).toBe('studio-field-coverSrc');
      expect(target.label).toBe('Cover media key');
    }
  });

  it('maps a quoted plain frontmatter field to its own control', () => {
    const projection = buildStudioValidationProjection(
      [
        issue({
          code: 'INVALID_FRONTMATTER',
          message: 'Unsupported frontmatter field "title"',
        }),
      ],
      { metadata, body: 'Body.' },
    );

    const target = projection?.first.target;
    expect(target?.kind).toBe('field');
    if (target?.kind === 'field') {
      expect(target.controlId).toBe('studio-field-title');
      expect(target.label).toBe('Title');
    }
  });

  it('maps the combined required-field message to the first empty control in compiler order', () => {
    const projection = buildStudioValidationProjection(
      [
        issue({
          code: 'INVALID_FRONTMATTER',
          message: 'Frontmatter is missing a required field or contains an invalid value.',
        }),
      ],
      { metadata: { ...metadata, excerpt: '   ' }, body: 'Body.' },
    );

    const target = projection?.first.target;
    expect(target?.kind).toBe('field');
    if (target?.kind === 'field') {
      expect(target.controlId).toBe('studio-field-excerpt');
      expect(target.label).toBe('Excerpt');
    }
  });

  it('maps the required-field message to the cover media key when only cover.src is empty', () => {
    const projection = buildStudioValidationProjection(
      [
        issue({
          code: 'INVALID_FRONTMATTER',
          message: 'Frontmatter is missing a required field or contains an invalid value.',
        }),
      ],
      { metadata: { ...metadata, cover: { src: '', alt: 'Alt kept' } }, body: 'Body.' },
    );

    const target = projection?.first.target;
    expect(target?.kind).toBe('field');
    if (target?.kind === 'field') {
      expect(target.controlId).toBe('studio-field-coverSrc');
    }
  });

  it('falls back to source when the required-field message has no visibly empty control', () => {
    const projection = buildStudioValidationProjection(
      [
        issue({
          code: 'INVALID_FRONTMATTER',
          message: 'Frontmatter is missing a required field or contains an invalid value.',
        }),
      ],
      { metadata, body: 'Body.' },
    );

    expect(projection?.first.target.kind).toBe('source');
  });

  it('maps publishedAt messages to the published date control', () => {
    const projection = buildStudioValidationProjection(
      [
        issue({
          code: 'INVALID_FRONTMATTER',
          message: 'publishedAt is required for published articles.',
        }),
      ],
      { metadata: { ...metadata, status: 'published' }, body: 'Body.' },
    );

    const target = projection?.first.target;
    expect(target?.kind).toBe('field');
    if (target?.kind === 'field') {
      expect(target.controlId).toBe('studio-field-publishedAt');
      expect(target.label).toBe('Published date');
    }
  });

  it('maps reference messages to the references fieldset', () => {
    const projection = buildStudioValidationProjection(
      [
        issue({
          code: 'INVALID_FRONTMATTER',
          message: 'Each reference requires title and url.',
        }),
      ],
      { metadata, body: 'Body.' },
    );

    const target = projection?.first.target;
    expect(target?.kind).toBe('field');
    if (target?.kind === 'field') {
      expect(target.controlId).toBe('studio-field-references');
      expect(target.label).toBe('References');
    }
  });

  it('maps slug filename mismatches to the slug control', () => {
    const projection = buildStudioValidationProjection(
      [
        issue({
          code: 'INVALID_FRONTMATTER',
          message: 'Source filename must match frontmatter slug.',
        }),
      ],
      { metadata, body: 'Body.' },
    );

    const target = projection?.first.target;
    expect(target?.kind).toBe('field');
    if (target?.kind === 'field') {
      expect(target.controlId).toBe('studio-field-slug');
    }
  });

  it('maps metadata-region media issues to the cover media key when it looks invalid', () => {
    const projection = buildStudioValidationProjection(
      [
        issue({
          code: 'INVALID_MEDIA',
          message: 'Media keys must not contain backslashes.',
          line: 1,
          column: 1,
        }),
      ],
      {
        metadata: { ...metadata, cover: { src: 'articles\\bad\\cover.svg', alt: 'Alt' } },
        body: 'Body.',
      },
    );

    const target = projection?.first.target;
    expect(target?.kind).toBe('field');
    if (target?.kind === 'field') {
      expect(target.controlId).toBe('studio-field-coverSrc');
    }
  });

  it('maps metadata-region media issues to the audio media key when only audio looks invalid', () => {
    const projection = buildStudioValidationProjection(
      [
        issue({
          code: 'INVALID_MEDIA',
          message: 'Media keys must not be absolute paths.',
          line: 1,
          column: 1,
        }),
      ],
      {
        metadata: { ...metadata, audio: { src: '/absolute/audio.mp3' } },
        body: 'Body.',
      },
    );

    const target = projection?.first.target;
    expect(target?.kind).toBe('field');
    if (target?.kind === 'field') {
      expect(target.controlId).toBe('studio-field-audioSrc');
    }
  });

  it('keeps body-positioned media issues on the body target', () => {
    const body = '![broken](../escape.png)';
    const fmLines = frontmatterLineCount(metadata);
    const projection = buildStudioValidationProjection(
      [
        issue({
          code: 'INVALID_MEDIA',
          message: 'Media keys must not contain dot segments.',
          line: fmLines + 1,
          column: 1,
        }),
      ],
      { metadata, body },
    );

    expect(projection?.first.target.kind).toBe('body');
  });

  it('assigns phases by issue code', () => {
    const projection = buildStudioValidationProjection(
      [
        issue({ code: 'INVALID_FRONTMATTER', message: 'x' }),
        issue({ code: 'INVALID_MEDIA', message: 'x' }),
        issue({ code: 'INVALID_LIST', message: 'x' }),
        issue({ code: 'FINAL_VALIDATION', message: 'x' }),
        issue({ code: 'COMPILER_FAILURE', message: 'x' }),
      ],
      { metadata, body: 'Body.' },
    );

    expect(projection?.issues.map((view) => view.phase)).toEqual([
      'metadata',
      'media',
      'body',
      'model',
      'compile',
    ]);
    expect(projection?.phases).toEqual(['metadata', 'media', 'body', 'model', 'compile']);
  });

  it('formats locations with 1-based fallbacks for missing positions', () => {
    const projection = buildStudioValidationProjection(
      [issue({ code: 'FINAL_VALIDATION', message: 'Model invalid.' })],
      { metadata, body: 'Body.' },
    );

    expect(projection?.first.location).toBe(`${sourcePath}:1:1`);
    expect(projection?.first.target.kind).toBe('source');
  });

  it('survives unserializable metadata by falling back to source targets', () => {
    const projection = buildStudioValidationProjection(
      [issue({ code: 'UNSUPPORTED_NODE', message: 'Bad.', line: 12, column: 1 })],
      {
        metadata: { ...metadata, title: undefined as unknown as string },
        body: '# Bad heading',
      },
    );

    expect(projection).toBeDefined();
    expect(projection?.first.target.kind).toBe('source');
  });
});

describe('buildEditorInputIssues (#110 form-decode anchoring)', () => {
  it('anchors an oversized title to the Title control with a length requirement', () => {
    const issues = buildEditorInputIssues(['input.metadata.title.max'], metadata.slug);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      code: 'EDITOR_INPUT_TITLE',
      message: 'Title must be at most 500 characters.',
      sourcePath: 'content/articles/a-draft-article.md',
      line: 1,
      column: 1,
    });
  });

  it('anchors a malformed slug to the Slug control with the kebab-case requirement', () => {
    const issues = buildEditorInputIssues(['input.metadata.slug.slug'], metadata.slug);

    expect(issues[0]?.code).toBe('EDITOR_INPUT_SLUG');
    expect(issues[0]?.message).toContain('lowercase letters, digits, and hyphens');
  });

  it('anchors a malformed date to its own field with the accepted format', () => {
    const issues = buildEditorInputIssues(
      ['input.metadata.updatedAt.date', 'input.metadata.publishedAt.date'],
      metadata.slug,
    );

    expect(issues.map((entry) => entry.code)).toEqual([
      'EDITOR_INPUT_UPDATED_AT',
      'EDITOR_INPUT_PUBLISHED_AT',
    ]);
    for (const entry of issues) {
      expect(entry.message).toContain('YYYY-MM-DD');
    }
  });

  it('anchors reference failures to the References fieldset regardless of index', () => {
    const issues = buildEditorInputIssues(
      ['input.metadata.references[2].url.url', 'input.metadata.references.array'],
      metadata.slug,
    );

    for (const entry of issues) expect(entry.code).toBe('EDITOR_INPUT_REFERENCES');
    expect(issues[0]?.message).toContain('https://');
  });

  it('anchors an over-limit body to the body textarea', () => {
    const issues = buildEditorInputIssues(['input.body.max'], metadata.slug);

    expect(issues[0]?.code).toBe('EDITOR_INPUT_BODY');
    expect(issues[0]?.message).toContain('2,000,000');
  });

  it('deduplicates identical anchored requirements from repeated fields', () => {
    const issues = buildEditorInputIssues(
      ['input.metadata.references[0].title.max', 'input.metadata.references[1].title.max'],
      metadata.slug,
    );

    expect(issues).toHaveLength(1);
  });

  it('leaves unmappable decode paths to the caller-provided generic fallback', () => {
    expect(buildEditorInputIssues(['input.concurrency.baseMainSha.sha'], metadata.slug)).toEqual(
      [],
    );
    expect(buildEditorInputIssues([], metadata.slug)).toEqual([]);
  });
});

describe('projection targeting of decode-originated codes (#110)', () => {
  it('targets a decode-originated title issue at the Title control in the metadata phase', () => {
    const projection = buildStudioValidationProjection(
      [issue({ code: 'EDITOR_INPUT_TITLE', message: 'Title must be at most 500 characters.' })],
      { metadata, body: 'Body.' },
    );

    expect(projection?.first.phase).toBe('metadata');
    expect(projection?.first.target).toEqual({
      kind: 'field',
      controlId: 'studio-field-title',
      label: 'Title',
    });
  });

  it('targets a decode-originated date issue at its own date control', () => {
    const projection = buildStudioValidationProjection(
      [
        issue({
          code: 'EDITOR_INPUT_PUBLISHED_AT',
          message: 'Published date must be YYYY-MM-DD or an ISO timestamp.',
        }),
      ],
      { metadata, body: 'Body.' },
    );

    expect(projection?.first.target).toEqual({
      kind: 'field',
      controlId: 'studio-field-publishedAt',
      label: 'Published date',
    });
  });

  it('targets a decode-originated body issue at the body textarea in the body phase', () => {
    const projection = buildStudioValidationProjection(
      [issue({ code: 'EDITOR_INPUT_BODY', message: 'Body must be at most 2,000,000 characters.' })],
      { metadata, body: 'Body.' },
    );

    expect(projection?.first.phase).toBe('body');
    expect(projection?.first.target).toEqual({
      kind: 'field',
      controlId: 'studio-body',
      label: 'Body',
    });
  });
});
