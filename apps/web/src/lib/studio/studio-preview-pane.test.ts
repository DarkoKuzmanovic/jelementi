import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import StudioPreviewPane from './StudioPreviewPane.svelte';
import type { StudioPreviewResult } from './contracts';
import type { StudioCompileIssue } from './contracts';

const issue: StudioCompileIssue = {
  code: 'UNSUPPORTED_NODE',
  message: 'Unsupported heading level.',
  sourcePath: 'content/articles/a-draft-article.md',
  line: 4,
  column: 1,
};

const issuesPreview: StudioPreviewResult = {
  kind: 'preview_issues',
  compileIssues: [issue],
};

function renderPane(props: { preview?: StudioPreviewResult; stale?: boolean }): string {
  return render(StudioPreviewPane, { props }).body;
}

describe('StudioPreviewPane focusable result heading (#114)', () => {
  it('makes the preview region heading programmatically focusable', () => {
    const html = renderPane({ preview: undefined });
    expect(html).toMatch(/<h2[^>]*id="studio-preview-heading"[^>]*tabindex="-1"/);
  });
});

describe('StudioPreviewPane out-of-date indicator (#114)', () => {
  it('renders nothing while there is no preview to be out of date about', () => {
    expect(renderPane({ preview: undefined, stale: true })).not.toContain(
      'data-studio-preview-stale',
    );
    expect(renderPane({ preview: undefined })).not.toContain('data-studio-preview-stale');
  });

  it('renders no indicator for a freshly rendered snapshot', () => {
    expect(renderPane({ preview: issuesPreview, stale: false })).not.toContain(
      'data-studio-preview-stale',
    );
  });

  it('marks the pane out of date once the form changed after the rendered snapshot', () => {
    const html = renderPane({ preview: issuesPreview, stale: true });
    expect(html).toContain('data-studio-preview-stale="true"');
    // The copy states both halves of the contract: staleness and the remedy.
    expect(html).toContain('Out of date');
    expect(html).toContain('Run Preview again');
  });
});
