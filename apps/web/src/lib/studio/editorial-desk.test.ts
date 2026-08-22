import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import StudioEditorialDesk from './StudioEditorialDesk.svelte';
import StudioNewArticlePublicationCenter from './StudioNewArticlePublicationCenter.svelte';
import StudioEditor from './StudioEditor.svelte';
import StudioPreviewPane from './StudioPreviewPane.svelte';
import StudioPublishPanel from './StudioPublishPanel.svelte';
import type { StudioEditorData } from '../server/studio/editor.server';
import type { StudioLifecycle, StudioMetadata } from './contracts';

const metadata: StudioMetadata = {
  title: 'A Draft Article',
  slug: 'a-draft-article',
  excerpt: 'An article being written in Studio.',
  status: 'draft',
  updatedAt: '2026-08-01',
  category: 'Ideas',
  tags: ['studio'],
  author: 'Jelementi',
  cover: { src: 'articles/a-draft-article/cover-v1.svg', alt: 'A draft cover' },
  references: [],
};

const editor: StudioEditorData = {
  metadata,
  body: 'Draft body.',
  concurrency: {
    baseMainSha: 'a'.repeat(40),
    draftHeadSha: 'b'.repeat(40),
    expectedBlobSha: 'c'.repeat(64),
  },
  slugEditable: false,
};

const lifecycle: StudioLifecycle = {
  kind: 'draft_valid',
  article: {
    slug: metadata.slug,
    title: metadata.title,
    status: metadata.status,
    updatedAt: metadata.updatedAt,
  },
  branch: {
    name: `studio/article/${metadata.slug}`,
    url: `https://github.com/example/example/tree/studio/article/${metadata.slug}`,
    headSha: 'b'.repeat(40),
  },
};

describe('StudioEditorialDesk', () => {
  it('keeps editor, preview, then publication in semantic DOM order', () => {
    const editorSnippet = createRawSnippet(() => ({ render: () => '<h2>Editor region</h2>' }));
    const previewSnippet = createRawSnippet(() => ({ render: () => '<h2>Preview region</h2>' }));
    const publicationSnippet = createRawSnippet(() => ({
      render: () => '<h2>Publication region</h2>',
    }));

    const { body } = render(StudioEditorialDesk, {
      props: {
        editor: editorSnippet,
        preview: previewSnippet,
        publication: publicationSnippet,
      },
    });

    expect(body.indexOf('Editor region')).toBeLessThan(body.indexOf('Preview region'));
    expect(body.indexOf('Preview region')).toBeLessThan(body.indexOf('Publication region'));
  });

  it('places the editor in the centre column while DOM order stays editor-first', () => {
    const desk = readFileSync(new URL('./StudioEditorialDesk.svelte', import.meta.url), 'utf8');

    // Visual centre for the editor, reading column for the preview. DOM order
    // is asserted above and deliberately unchanged, so the stacked small-screen
    // order stays editor-first.
    expect(desk).toMatch(/\.studio-editorial-desk__editor\s*\{[^}]*grid-column:\s*2/);
    expect(desk).toMatch(/\.studio-editorial-desk__preview\s*\{[^}]*grid-column:\s*1/);
    expect(desk).toMatch(/\.studio-editorial-desk__publication\s*\{[^}]*grid-column:\s*3/);
  });
});

describe('Publication center caption', () => {
  it('captions the column like the editor and preview eyebrows, not as a page heading', () => {
    const { body } = render(StudioNewArticlePublicationCenter, {
      props: { concurrency: { baseMainSha: 'a'.repeat(40), draftHeadSha: 'b'.repeat(40) } },
    });

    // Still an h2 with its labelling id — only the presentation changes.
    expect(body).toContain('id="studio-publication-center-heading"');
    expect(body).toContain('Publication center');
    expect(body).toContain('studio-column-caption');
  });

  it('defines the shared caption to match the muted, compact column eyebrows', () => {
    const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
    const start = tokens.indexOf('.studio-column-caption {');
    const rule = tokens.slice(start, tokens.indexOf('}', start));

    expect(rule).toMatch(/color:\s*var\(--studio-text-muted\)/);
    expect(rule).toMatch(/font-size:\s*var\(--studio-text-compact\)/);
    // The interface face, not the editorial serif a Studio h2 would inherit.
    expect(rule).toMatch(/font-family:\s*var\(--studio-font-interface\)/);
  });
});

describe('StudioEditor', () => {
  it('renders essentials first, secondary metadata in native disclosure, and a native no-autosave body textarea', () => {
    const { body } = render(StudioEditor, { props: { editor } });

    expect(body).toContain('Essentials');
    expect(body).toContain('<details');
    expect(body).toContain('More metadata');
    expect(body).toContain('Dates, category, tags, author, media, audio, and references');
    expect(body).toContain('name="body"');
    expect(body).toContain('No autosave');
    expect(body).toContain('Save draft is the only commit action');
    expect(body).toContain('id="studio-article-form"');
  });
});

describe('StudioPreviewPane', () => {
  it('identifies the explicit form snapshot and says Preview never saved or changed GitHub', () => {
    const { body } = render(StudioPreviewPane, {
      props: {
        preview: {
          kind: 'preview_issues',
          compileIssues: [
            {
              code: 'UNSUPPORTED_NODE',
              message: 'Unsupported Markdown.',
              sourcePath: 'content/articles/a-draft-article.md',
              line: 1,
              column: 1,
            },
          ],
        },
      },
    });

    expect(body).toContain('Explicit preview');
    expect(body).toContain('current form snapshot');
    expect(body).toContain('Nothing was saved or changed in');
    expect(body).toContain('GitHub.');
    expect(body).toContain('UNSUPPORTED_NODE');
  });

  it('mounts the authoritative renderer with Reader tokens at a selected width and no Reader chrome', () => {
    const { body } = render(StudioPreviewPane, {
      props: {
        preview: {
          kind: 'preview_ok',
          document: {
            schemaVersion: 1,
            slug: 'preview-draft',
            title: 'A Draft Preview',
            excerpt: 'Preview excerpt.',
            status: 'draft',
            updatedAt: '2026-08-01',
            category: 'Ideas',
            tags: ['preview'],
            author: 'Studio Operator',
            cover: { src: 'articles/preview-draft/cover.svg', alt: 'A preview cover' },
            audio: {
              src: 'articles/preview-draft/audio.m4a',
              durationSeconds: 12,
            },
            readingTimeMinutes: 3,
            blocks: [
              {
                type: 'paragraph',
                children: [{ type: 'text', value: 'Preview body.' }],
              },
            ],
            footnotes: [],
            references: [],
          },
          compileIssues: [],
        },
      },
    });

    // Width selection controls default to the wide Reader measure.
    expect(body).toContain('Wide (52rem)');
    expect(body).toContain('Narrow (320px)');
    expect(body).toContain('value="wide" checked');
    expect(body).toContain('article-preview--wide');
    expect(body).not.toContain('article-preview--narrow');

    // The exact authoritative renderer mounts the complete content hierarchy.
    expect(body).toContain('A Draft Preview');
    expect(body).toContain('Preview body.');
    expect(body).toContain('<audio');
    expect(body).toContain('article-cover');

    // No Reader shell chrome, header, footer, or navigation inside the preview.
    expect(body).not.toContain('site-header');
    expect(body).not.toContain('site-footer');
    expect(body).not.toContain('Primary navigation');
    expect(body).not.toContain('Continue reading');
    expect(body).not.toContain('Return to');
  });
});

describe('StudioPublishPanel', () => {
  it('submits Publish saved version through the editor form and exposes its reason plus Check status', () => {
    const { body } = render(StudioPublishPanel, {
      props: { status: lifecycle, editorFormId: 'studio-article-form' },
    });

    expect(body).toContain('Publish saved version');
    expect(body).toContain('form="studio-article-form"');
    expect(body).toContain('name="expectedHeadSha"');
    expect(body).toContain('Check status');
    expect(body).toContain('Publish eligibility');
  });

  it('disables Publish with an associated save-first reason for a newer submitted candidate', () => {
    const { body } = render(StudioPublishPanel, {
      props: {
        status: lifecycle,
        editorFormId: 'studio-article-form',
        candidateDirty: true,
      },
    });

    expect(body).toContain('disabled=""');
    expect(body).toContain('Save the current form before publishing.');
    expect(body).toContain('aria-describedby="studio-publish-eligibility"');
  });

  it('keeps destructive actions in a native Danger zone disclosure', () => {
    const invalid: StudioLifecycle = {
      ...lifecycle,
      kind: 'draft_invalid',
      issues: [
        {
          code: 'UNSUPPORTED_NODE',
          message: 'Unsupported Markdown.',
          sourcePath: 'content/articles/a-draft-article.md',
        },
      ],
    };
    const { body } = render(StudioPublishPanel, {
      props: { status: invalid, editorFormId: 'studio-article-form' },
    });

    expect(body).toContain('<details');
    expect(body).toContain('Danger zone');
    expect(body).toContain('Discard draft');
    expect(body).toContain('Fix the reported issues before publishing');
  });
});
