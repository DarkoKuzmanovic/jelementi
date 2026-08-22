import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import StudioEditor from './StudioEditor.svelte';
import StudioRecoveryPanel from './StudioRecoveryPanel.svelte';
import StudioValidationSummary from './StudioValidationSummary.svelte';
import type { StudioEditorData, StudioSaveResult } from '../server/studio/editor.server';
import type { StudioValidationProjection } from '../server/studio/validation-projection.server';
import type { StudioMetadata } from './contracts';
import { buildStudioSaveRecovery } from './recovery-projection';
import type { StudioRecoveryProjection } from './recovery-projection';

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

const sourcePath = 'content/articles/a-draft-article.md';

const validation: StudioValidationProjection = {
  count: 2,
  severity: 'blocking',
  phases: ['metadata', 'body'],
  summary:
    '2 validation issues (blocking) in metadata, body. Publish stays blocked until every issue is fixed.',
  first: {
    issue: {
      code: 'INVALID_FRONTMATTER',
      message: 'Frontmatter is missing a required field or contains an invalid value.',
      sourcePath,
      line: 1,
      column: 1,
    },
    phase: 'metadata',
    location: `${sourcePath}:1:1`,
    target: { kind: 'field', controlId: 'studio-field-excerpt', label: 'Excerpt' },
  },
  issues: [
    {
      issue: {
        code: 'INVALID_FRONTMATTER',
        message: 'Frontmatter is missing a required field or contains an invalid value.',
        sourcePath,
        line: 1,
        column: 1,
      },
      phase: 'metadata',
      location: `${sourcePath}:1:1`,
      target: { kind: 'field', controlId: 'studio-field-excerpt', label: 'Excerpt' },
    },
    {
      issue: {
        code: 'UNSUPPORTED_NODE',
        message: 'Unsupported heading level.',
        sourcePath,
        line: 18,
        column: 1,
      },
      phase: 'body',
      location: `${sourcePath}:18:1`,
      target: {
        kind: 'body',
        controlId: 'studio-body',
        bodyLine: 3,
        bodyColumn: 1,
        selectionStart: 10,
        selectionEnd: 42,
      },
    },
  ],
};

describe('StudioValidationSummary', () => {
  it('renders nothing without a projection', () => {
    const { body } = render(StudioValidationSummary, { props: {} });
    expect(body.replace(/<!--.*?-->/g, '').trim()).toBe('');
  });

  it('presents count, severity, phases, and the first actionable issue', () => {
    const { body } = render(StudioValidationSummary, { props: { validation } });
    expect(body).toContain('2 validation issues');
    expect(body).toContain('blocking');
    expect(body).toContain('metadata, body');
    expect(body).toContain('Publish stays blocked');
    expect(body).toContain('First issue');
    expect(body).toContain('Frontmatter is missing a required field');
  });

  it('links field targets to their labelled control', () => {
    const { body } = render(StudioValidationSummary, { props: { validation } });
    expect(body).toContain('href="#studio-field-excerpt"');
    expect(body).toContain('Excerpt');
  });

  it('links body targets to the textarea and announces the body position', () => {
    const { body } = render(StudioValidationSummary, { props: { validation } });
    expect(body).toContain('href="#studio-body"');
    expect(body).toContain('line 3, column 1');
  });

  it('shows plain source locations for untargetable issues', () => {
    const sourceOnly: StudioValidationProjection = {
      ...validation,
      count: 1,
      phases: ['model'],
      first: {
        issue: { code: 'FINAL_VALIDATION', message: 'Model invalid.', sourcePath },
        phase: 'model',
        location: `${sourcePath}:1:1`,
        target: { kind: 'source' },
      },
      issues: [
        {
          issue: { code: 'FINAL_VALIDATION', message: 'Model invalid.', sourcePath },
          phase: 'model',
          location: `${sourcePath}:1:1`,
          target: { kind: 'source' },
        },
      ],
    };
    const { body } = render(StudioValidationSummary, { props: { validation: sourceOnly } });
    expect(body).toContain(`${sourcePath}:1:1`);
    expect(body).not.toContain('href="#studio-body"');
  });
});

const conflictRecovery: StudioRecoveryProjection = {
  operation: 'save',
  tone: 'conflict',
  heading: 'Save blocked: this draft moved on GitHub',
  whatHappened: 'The draft moved on GitHub after this editor loaded.',
  workSafety: 'Your submitted candidate is preserved in the form above.',
  readerEffect: 'Readers saw no change; the published site was not touched.',
  nextAction: 'Open the draft in a new tab to review what changed.',
  offerReplacement: false,
  comparison: [
    { label: 'Main', loaded: 'a'.repeat(40), current: 'd'.repeat(40) },
    { label: 'Draft head', loaded: 'b'.repeat(40), current: 'none' },
  ],
  evidence: [],
};

describe('StudioRecoveryPanel', () => {
  it('renders nothing without a projection', () => {
    const { body } = render(StudioRecoveryPanel, { props: {} });
    expect(body.replace(/<!--.*?-->/g, '').trim()).toBe('');
  });

  it('answers what happened, work safety, reader effect, and next action in order', () => {
    const { body } = render(StudioRecoveryPanel, { props: { recovery: conflictRecovery } });
    const order = [
      'Save blocked: this draft moved on GitHub',
      'The draft moved on GitHub after this editor loaded.',
      'Your submitted candidate is preserved in the form above.',
      'Readers saw no change; the published site was not touched.',
      'Open the draft in a new tab to review what changed.',
    ].map((text) => body.indexOf(text));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('renders loaded-versus-current comparison rows', () => {
    const { body } = render(StudioRecoveryPanel, { props: { recovery: conflictRecovery } });
    expect(body).toContain('Main');
    expect(body).toContain('a'.repeat(40));
    expect(body).toContain('d'.repeat(40));
    expect(body).toContain('Loaded');
    expect(body).toContain('Current');
  });

  it('renders a replacement submit button bound to the editor form when offered', () => {
    const offer: StudioRecoveryProjection = {
      ...conflictRecovery,
      offerReplacement: true,
      nextAction: 'Replace the stale Studio draft.',
    };
    const { body } = render(StudioRecoveryPanel, { props: { recovery: offer } });
    expect(body).toContain('formaction="?/replace"');
    expect(body).toContain('form="studio-article-form"');
    expect(body).toContain('Replace stale Studio draft');
  });

  it('omits the replacement button when not offered', () => {
    const { body } = render(StudioRecoveryPanel, { props: { recovery: conflictRecovery } });
    expect(body).not.toContain('formaction="?/replace"');
  });

  it('shows the server-read article blob comparison whenever replacement is offered', () => {
    const recovery = buildStudioSaveRecovery({
      kind: 'save_conflict',
      loaded: editor.concurrency,
      current: { baseMainSha: 'd'.repeat(40), draftHeadSha: 'b'.repeat(40) },
      replacementAvailable: {
        target: {
          path: 'content/articles/a-draft-article.md',
          loadedBlobSha: '1'.repeat(40),
          freshBlobSha: '1'.repeat(40),
        },
      },
    });
    const { body } = render(StudioRecoveryPanel, { props: { recovery } });
    expect(body).toContain('formaction="?/replace"');
    expect(body).toContain('Article on main');
    expect(body).toContain('1'.repeat(40));
    expect(body).toContain('content/articles/a-draft-article.md');
    expect(body).not.toContain('not read');
  });

  it('renders evidence rows with links', () => {
    const withEvidence: StudioRecoveryProjection = {
      ...conflictRecovery,
      comparison: undefined,
      evidence: [
        { label: 'Fresh main', value: 'd'.repeat(40) },
        {
          label: 'Pull request',
          value: '#4 (closed, ready)',
          url: 'https://github.com/x/pull/4',
        },
      ],
    };
    const { body } = render(StudioRecoveryPanel, { props: { recovery: withEvidence } });
    expect(body).toContain('Fresh main');
    expect(body).toContain('href="https://github.com/x/pull/4"');
    expect(body).toContain('#4 (closed, ready)');
  });
});

describe('StudioEditor recovery presentation modes', () => {
  const saveConflict: StudioSaveResult = {
    kind: 'save_conflict',
    loaded: editor.concurrency,
    current: { baseMainSha: 'd'.repeat(40), draftHeadSha: 'b'.repeat(40) },
    replacementAvailable: {
      target: {
        path: 'content/articles/example.md',
        loadedBlobSha: '1'.repeat(40),
        freshBlobSha: '1'.repeat(40),
      },
    },
  };

  it('gives every labelled control a stable studio-field id', () => {
    const { body } = render(StudioEditor, { props: { editor } });
    for (const id of [
      'studio-field-title',
      'studio-field-slug',
      'studio-field-status',
      'studio-field-excerpt',
      'studio-field-updatedAt',
      'studio-field-publishedAt',
      'studio-field-category',
      'studio-field-tags',
      'studio-field-author',
      'studio-field-coverSrc',
      'studio-field-coverAlt',
      'studio-field-audioSrc',
      'studio-field-audioDurationSeconds',
      'studio-field-references',
    ]) {
      expect(body).toContain(`id="${id}"`);
    }
  });

  it('documents the allowed slug pattern inline next to the slug control', () => {
    const { body } = render(StudioEditor, { props: { editor } });

    expect(body).toContain('Lowercase letters, numbers, and hyphens.');
    expect(body).toContain('id="studio-field-slug-help"');
    expect(body).toContain('aria-describedby="studio-field-slug-help"');
    expect(body).toContain('pattern="[a-z0-9]+(?:-[a-z0-9]+)*"');
  });

  it('keeps inline conflict presentation and replace button by default', () => {
    const { body } = render(StudioEditor, { props: { editor, save: saveConflict } });
    expect(body).toContain('Save blocked: this draft moved on GitHub');
    expect(body).toContain('formaction="?/replace"');
  });

  it('presents a draft-already-exists conflict with its own truthful copy', () => {
    const draftExistsConflict: StudioSaveResult = {
      kind: 'save_conflict',
      loaded: { baseMainSha: 'a'.repeat(40) },
      current: { baseMainSha: 'a'.repeat(40), draftHeadSha: 'e'.repeat(40) },
      draftExists: { pullRequestNumber: 11 },
    };

    const { body } = render(StudioEditor, { props: { editor, save: draftExistsConflict } });

    expect(body).toContain('Save blocked: a Studio draft for this slug already exists');
    expect(body).toContain('#11');
    expect(body).not.toContain('this draft moved on GitHub');
  });

  it('renders slug-collision rejections with their messages in the rejected-save list', () => {
    const rejected: StudioSaveResult = {
      kind: 'save_rejected',
      compileIssues: [
        {
          code: 'SLUG_DRAFT_EXISTS',
          message:
            'A Studio draft for this slug already exists (PR #7). Open it, pick a different slug, or discard the existing draft.',
          sourcePath: 'content/articles/taken.md',
          line: 1,
          column: 1,
        },
      ],
    };

    const { body } = render(StudioEditor, { props: { editor, save: rejected } });

    expect(body).toContain('Save could not read this form');
    expect(body).toContain('SLUG_DRAFT_EXISTS');
    expect(body).toContain('(PR #7)');
  });

  it('hides inline conflict, failure, and replacement sections in external mode', () => {
    const { body } = render(StudioEditor, {
      props: { editor, save: saveConflict, recoveryPresentation: 'external' },
    });
    expect(body).not.toContain('Save blocked: this draft moved on GitHub');
    expect(body).not.toContain('formaction="?/replace"');
  });

  it('keeps the saved confirmation in external mode', () => {
    const saved: StudioSaveResult = {
      kind: 'saved',
      concurrency: editor.concurrency,
      pullRequest: { number: 7, url: 'https://github.com/x/pull/7' },
      compileIssues: [],
    };
    const { body } = render(StudioEditor, {
      props: { editor, save: saved, recoveryPresentation: 'external' },
    });
    expect(body).toContain('Studio draft saved');
  });

  it('labels an invalid save as “Saved — needs fixes”, matching the workspace lifecycle label', () => {
    const saved: StudioSaveResult = {
      kind: 'saved',
      concurrency: editor.concurrency,
      pullRequest: { number: 7, url: 'https://github.com/x/pull/7' },
      compileIssues: [
        {
          code: 'UNSUPPORTED_NODE',
          message: 'Unsupported heading level.',
          sourcePath: 'content/articles/a-draft-article.md',
        },
      ],
    };
    const { body } = render(StudioEditor, { props: { editor, save: saved } });
    expect(body).toContain('Saved — needs fixes');
    expect(body).not.toContain('Studio draft saved');
    expect(body).toContain('saved but not yet valid');
  });

  it('hides the inline replacement result in external mode', () => {
    const { body } = render(StudioEditor, {
      props: {
        editor,
        replacement: {
          kind: 'replacement_failed',
          candidate: { metadata, body: 'Body.' },
          phase: 'delete-branch',
          reason: 'github',
          mutation: 'partial',
          evidence: {},
        },
        recoveryPresentation: 'external',
      },
    });
    expect(body).not.toContain('Draft replacement stopped');
  });
});
