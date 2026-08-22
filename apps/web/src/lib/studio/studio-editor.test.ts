import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import StudioEditor from './StudioEditor.svelte';
import type { StudioMetadata } from './contracts';
import type { StudioEditorData } from '../server/studio/editor.server';

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
  body: '',
  concurrency: { baseMainSha: 'a'.repeat(40) },
  slugEditable: true,
};

/** Extracts the serialized opening tags of one element kind for attr asserts. */
function inputTags(html: string): string[] {
  return html.match(/<(input|textarea)\b[^>]*>/g) ?? [];
}

function tagWithId(tags: string[], id: string): string {
  const tag = tags.find((candidate) => candidate.includes(`id="${id}"`));
  if (tag === undefined) throw new Error(`No control with id "${id}" rendered.`);
  return tag;
}

function renderEditorHtml(): string {
  return render(StudioEditor, { props: { editor } }).body;
}

describe('StudioEditor constrained inputs (#110)', () => {
  it('enforces the server-side length limit on the title input', () => {
    const html = renderEditorHtml();
    expect(tagWithId(inputTags(html), 'studio-field-title')).toContain('maxlength="500"');
  });

  it('enforces the server-side length limit on the slug input', () => {
    const html = renderEditorHtml();
    expect(tagWithId(inputTags(html), 'studio-field-slug')).toContain('maxlength="100"');
  });

  it('enforces the server-side length limit on the excerpt textarea', () => {
    const html = renderEditorHtml();
    expect(tagWithId(inputTags(html), 'studio-field-excerpt')).toContain('maxlength="2000"');
  });

  it('enforces the server-side media-key and alt-text limits on cover controls', () => {
    const html = renderEditorHtml();
    expect(tagWithId(inputTags(html), 'studio-field-coverSrc')).toContain('maxlength="500"');
    expect(tagWithId(inputTags(html), 'studio-field-coverAlt')).toContain('maxlength="2000"');
  });

  it('enforces the server-side media-key limit on the audio control', () => {
    const html = renderEditorHtml();
    expect(tagWithId(inputTags(html), 'studio-field-audioSrc')).toContain('maxlength="500"');
  });

  it('enforces the server-side limits on category and author inputs', () => {
    const html = renderEditorHtml();
    expect(tagWithId(inputTags(html), 'studio-field-category')).toContain('maxlength="200"');
    expect(tagWithId(inputTags(html), 'studio-field-author')).toContain('maxlength="200"');
  });

  it('enforces the server-side URL limit on every reference URL input', () => {
    const html = renderEditorHtml();
    const urlInputs = inputTags(html).filter((tag) => tag.includes('name="referenceUrl"'));
    expect(urlInputs.length).toBeGreaterThan(0);
    for (const tag of urlInputs) expect(tag).toContain('maxlength="2048"');
  });

  it('enforces reference title and publisher length limits', () => {
    const html = renderEditorHtml();
    const titles = inputTags(html).filter((tag) => tag.includes('name="referenceTitle"'));
    const publishers = inputTags(html).filter((tag) => tag.includes('name="referencePublisher"'));
    expect(titles.length).toBeGreaterThan(0);
    for (const tag of titles) expect(tag).toContain('maxlength="500"');
    for (const tag of publishers) expect(tag).toContain('maxlength="500"');
  });
});

describe('StudioEditor date inputs (#110)', () => {
  it('gives the updated-date input an unavoidable YYYY-MM-DD placeholder and pattern', () => {
    const html = renderEditorHtml();
    const tag = tagWithId(inputTags(html), 'studio-field-updatedAt');
    expect(tag).toContain('placeholder="YYYY-MM-DD"');
    expect(tag).toMatch(/pattern="[^"]*d\{4\}[^"]*"/);
  });

  it('gives the published-date input the same placeholder and pattern', () => {
    const html = renderEditorHtml();
    const tag = tagWithId(inputTags(html), 'studio-field-publishedAt');
    expect(tag).toContain('placeholder="YYYY-MM-DD"');
    expect(tag).toMatch(/pattern="[^"]*d\{4\}[^"]*"/);
  });

  it('gives reference accessed-date inputs the same placeholder and pattern', () => {
    const html = renderEditorHtml();
    const accessed = inputTags(html).filter((tag) => tag.includes('name="referenceAccessedAt"'));
    expect(accessed.length).toBeGreaterThan(0);
    for (const tag of accessed) {
      expect(tag).toContain('placeholder="YYYY-MM-DD"');
      expect(tag).toMatch(/pattern="[^"]*d\{4\}[^"]*"/);
    }
  });

  it('accepts a full ISO timestamp value in the date pattern so no valid format is client-blocked', async () => {
    // The decoder (contracts.ts ISO grammar) accepts "YYYY-MM-DD" plus an
    // optional full ISO timestamp; whatever the markup pattern rejects
    // client-side must be exactly the grammar the server rejects.
    const { STUDIO_ISO_DATE_PATTERN } = await import('./contracts');
    // Calendar impossibles (2026-13-01) stay pattern-permitted on purpose:
    // the browser cannot validate calendars, so those arrive server-side and
    // get the date-field-anchored issue instead of silent rejection.
    const accepted = ['2026-08-22', '2026-08-22T09:30:00Z', '2026-08-22T09:30:00.123+02:00'];
    const rejected = ['Aug 22, 2026', '2026-8-22', '22-08-2026'];
    const anchored = new RegExp(`^(?:${STUDIO_ISO_DATE_PATTERN})$`);
    for (const value of accepted) expect(anchored.test(value)).toBe(true);
    for (const value of rejected) expect(anchored.test(value)).toBe(false);
  });
});

describe('StudioEditor allowed-markdown reference (#113)', () => {
  it('renders a collapsible reference beside the body field', () => {
    const html = renderEditorHtml();
    expect(html).toMatch(/<details[^>]*id="studio-markdown-dialect"/);
    expect(html).toContain('Allowed Markdown</summary>');
    const bodyIndex = html.indexOf('id="studio-body"');
    const dialectIndex = html.indexOf('studio-markdown-dialect');
    expect(bodyIndex).toBeGreaterThan(-1);
    expect(dialectIndex).toBeGreaterThan(bodyIndex);
  });

  it('renders every documented rule and example from the shared reference', async () => {
    const { MARKDOWN_DIALECT_REFERENCE } = await import('./markdown-dialect');
    const html = renderEditorHtml();
    for (const entry of MARKDOWN_DIALECT_REFERENCE) {
      expect(html, `rule for ${entry.id}`).toContain(entry.rule);
      for (const example of entry.examples ?? []) {
        expect(html, `example for ${entry.id}`).toContain(example);
      }
    }
  });
});

describe('StudioEditor media-key helper text (#113)', () => {
  /** Svelte escapes "<" in interpolated text; unescape for string asserts. */
  function unescapeAngleBrackets(html: string): string {
    return html.replaceAll('&lt;', '<');
  }

  it('describes the exact relative key pattern next to the cover key', async () => {
    const { COVER_MEDIA_KEY_HINT } = await import('./markdown-dialect');
    const html = renderEditorHtml();
    expect(tagWithId(inputTags(html), 'studio-field-coverSrc')).toContain(
      'aria-describedby="studio-field-coverSrc-help"',
    );
    expect(html).toContain('id="studio-field-coverSrc-help"');
    expect(unescapeAngleBrackets(html)).toContain(COVER_MEDIA_KEY_HINT);
  });

  it('describes the exact relative key pattern next to the audio key', async () => {
    const { AUDIO_MEDIA_KEY_HINT } = await import('./markdown-dialect');
    const html = renderEditorHtml();
    expect(tagWithId(inputTags(html), 'studio-field-audioSrc')).toContain(
      'aria-describedby="studio-field-audioSrc-help"',
    );
    expect(html).toContain('id="studio-field-audioSrc-help"');
    expect(unescapeAngleBrackets(html)).toContain(AUDIO_MEDIA_KEY_HINT);
  });
});

describe('StudioEditor insert-image affordance (#113)', () => {
  it('offers a plain button that can never submit the form', () => {
    const html = renderEditorHtml();
    const button = html.match(/<button[^>]*id="studio-insert-image"[^>]*>/)?.[0];
    expect(button).toBeDefined();
    expect(button).toContain('type="button"');
    expect(button).not.toContain('formaction');
    expect(html).toContain('>Insert image</button>');
  });

  it('labels the affordance with its effect on the body field', () => {
    const html = renderEditorHtml();
    const buttonIndex = html.indexOf('id="studio-insert-image"');
    const bodyLabelIndex = html.indexOf('id="studio-body"');
    expect(buttonIndex).toBeGreaterThan(-1);
    // The affordance sits with the body field it edits.
    expect(Math.abs(buttonIndex - bodyLabelIndex)).toBeLessThan(500);
  });
});

describe('StudioEditor read-only lifecycle status (#111)', () => {
  it('renders status as a non-editable output with a plain-language label, never as a select', () => {
    const html = renderEditorHtml();

    expect(html).toContain('<output id="studio-field-status"');
    expect(html).not.toMatch(/<select[^>]*name="status"/);
    // The loaded draft state is what the field presents.
    expect(html).toMatch(/>\s*Draft\s*<\/output>/);
    // No writable binding: the element carries no form name at all.
    const outputTag = html.match(/<output id="studio-field-status"[^>]*>/)?.[0] ?? '';
    expect(outputTag).not.toContain('name=');
  });

  it('shows the loaded published state and points to the sanctioned mutation paths', () => {
    const html = render(StudioEditor, {
      props: { editor: { ...editor, metadata: { ...metadata, status: 'published' } } },
    }).body;

    expect(html).toMatch(/>\s*Published\s*<\/output>/);
    expect(html).toContain('publication panel');
  });
});
