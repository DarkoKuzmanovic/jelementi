import { describe, expect, it } from 'vitest';
import {
  AUDIO_MEDIA_KEY_HINT,
  COVER_MEDIA_KEY_HINT,
  MARKDOWN_DIALECT_REFERENCE,
  MEDIA_KEY_PATTERN_HINT,
  buildStandaloneImageSnippet,
  insertSnippetAtCursor,
} from './markdown-dialect';

describe('markdown dialect reference (#113)', () => {
  it('covers every restriction the dialect actually has', () => {
    const ids = MARKDOWN_DIALECT_REFERENCE.map((entry) => entry.id);
    expect(ids).toEqual([
      'headings',
      'inline',
      'links',
      'images',
      'lists',
      'quotes',
      'divider',
      'callouts',
      'footnotes',
      'unsupported',
    ]);
  });

  it('gives every entry writer-facing rule text and at least one machine-checkable claim', () => {
    for (const entry of MARKDOWN_DIALECT_REFERENCE) {
      expect(entry.rule.trim().length).toBeGreaterThan(0);
      const claims = (entry.acceptedExamples?.length ?? 0) + (entry.rejectedExamples?.length ?? 0);
      expect(claims, `entry ${entry.id} carries parity claims`).toBeGreaterThan(0);
    }
  });

  it('keeps rendered copy free of escaping-sensitive characters', () => {
    // The reference interpolates rule/example strings into Svelte text nodes;
    // keeping them free of & and < keeps the SSR assertion exact. A lone ">"
    // is never escaped by Svelte text rendering, so it is allowed.
    for (const entry of MARKDOWN_DIALECT_REFERENCE) {
      expect(entry.rule).not.toMatch(/[&<]/);
      for (const example of entry.examples ?? []) {
        expect(example).not.toMatch(/[&<]/);
      }
    }
  });
});

describe('media-key helper texts (#113)', () => {
  it('states the exact relative key pattern on the cover hint', () => {
    expect(COVER_MEDIA_KEY_HINT).toContain(MEDIA_KEY_PATTERN_HINT);
    expect(COVER_MEDIA_KEY_HINT).toContain('No leading slash');
  });

  it('states the exact relative key pattern on the audio hint', () => {
    expect(AUDIO_MEDIA_KEY_HINT).toContain(MEDIA_KEY_PATTERN_HINT);
    expect(AUDIO_MEDIA_KEY_HINT).toContain('No leading slash');
  });

  it('pins the shared pattern constant itself', () => {
    expect(MEDIA_KEY_PATTERN_HINT).toBe('articles/<slug>/<file>-v1.ext');
  });
});

describe('buildStandaloneImageSnippet (#113)', () => {
  it('keys the media key to the given slug with the versioned convention', () => {
    const snippet = buildStandaloneImageSnippet('my-article');
    expect(snippet.trim()).toBe(
      '![Describe the image](articles/my-article/image-01-v1.webp "Optional caption")',
    );
  });

  it('pads the snippet with blank lines so the image always stands alone', () => {
    const snippet = buildStandaloneImageSnippet('my-article');
    expect(snippet.startsWith('\n\n')).toBe(true);
    expect(snippet.endsWith('\n\n')).toBe(true);
  });

  it('falls back to a clearly-editable directory when the slug is blank', () => {
    const snippet = buildStandaloneImageSnippet('  ');
    expect(snippet).toContain('(articles/your-article/');
  });
});

describe('insertSnippetAtCursor (#113)', () => {
  interface StubTextArea {
    value: string;
    selectionStart: number | null;
    selectionEnd: number | null;
    calls: Array<{ text: string; start: number; end: number; mode: string }>;
    setRangeText(
      text: string,
      start: number,
      end: number,
      selectionMode?: 'end' | 'select' | 'start' | 'preserve',
    ): void;
  }

  function stub(
    value: string,
    selectionStart: number | null,
    selectionEnd: number | null,
  ): StubTextArea {
    const area: StubTextArea = {
      value,
      selectionStart,
      selectionEnd,
      calls: [],
      setRangeText(text, start, end, selectionMode = 'preserve') {
        area.calls.push({ text, start, end, mode: selectionMode });
        area.value = area.value.slice(0, start) + text + area.value.slice(end);
      },
    };
    return area;
  }

  it('inserts at the caret and leaves the caret after the inserted text', () => {
    const area = stub('Line one', 8, 8);
    insertSnippetAtCursor(area, '\n\nSNIPPET\n\n');
    expect(area.calls).toEqual([{ text: '\n\nSNIPPET\n\n', start: 8, end: 8, mode: 'end' }]);
    expect(area.value).toBe('Line one\n\nSNIPPET\n\n');
  });

  it('replaces the selected range when text is highlighted', () => {
    const area = stub('before SELECTED after', 7, 15);
    insertSnippetAtCursor(area, 'X');
    expect(area.value).toBe('before X after');
    expect(area.calls[0]).toMatchObject({ start: 7, end: 15, mode: 'end' });
  });

  it('treats absent caret information as the end of the value', () => {
    const area = stub('Tail.', null, null);
    insertSnippetAtCursor(area, '+');
    expect(area.value).toBe('Tail.+');
  });
});
