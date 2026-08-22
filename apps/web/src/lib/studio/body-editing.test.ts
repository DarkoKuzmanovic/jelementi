import { describe, expect, it } from 'vitest';
import {
  indentStudioBodySelection,
  outdentStudioBodySelection,
  resolveStudioBodyKeyIntent,
  studioWordCount,
  type StudioBodyKeyboardEventLike,
} from './body-editing';
import type { SnippetTextArea } from './markdown-dialect';

/**
 * #114 write–check loop ergonomics, unit level.
 *
 * The browser behavior (Ctrl/Cmd+Enter submitting, Tab editing, live word
 * count) is exercised end-to-end by the Studio acceptance suite; these tests
 * pin the pure decision/editing contracts that the hydrated editor composes,
 * following the repo's structural-interface testing style (no DOM needed).
 */

function keyEvent(
  overrides: Partial<StudioBodyKeyboardEventLike> = {},
): StudioBodyKeyboardEventLike {
  return {
    key: 'Enter',
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    isComposing: false,
    ...overrides,
  };
}

describe('resolveStudioBodyKeyIntent (#114 preview shortcut)', () => {
  it('submits the preview intent for Cmd+Enter (macOS) and Ctrl+Enter (others)', () => {
    expect(resolveStudioBodyKeyIntent(keyEvent({ metaKey: true }))).toBe('preview-submit');
    expect(resolveStudioBodyKeyIntent(keyEvent({ ctrlKey: true }))).toBe('preview-submit');
  });

  it('leaves a plain Enter alone so it stays a normal newline', () => {
    expect(resolveStudioBodyKeyIntent(keyEvent())).toBeUndefined();
    expect(resolveStudioBodyKeyIntent(keyEvent({ altKey: true }))).toBeUndefined();
  });

  it('never fires while IME composition is active', () => {
    expect(
      resolveStudioBodyKeyIntent(keyEvent({ ctrlKey: true, isComposing: true })),
    ).toBeUndefined();
    expect(resolveStudioBodyKeyIntent(keyEvent({ key: 'Tab', isComposing: true }))).toBeUndefined();
  });

  it('ignores non-Enter keys for the submit intent', () => {
    expect(resolveStudioBodyKeyIntent(keyEvent({ key: 'a', ctrlKey: true }))).toBeUndefined();
  });
});

describe('resolveStudioBodyKeyIntent (#114 tab indent/outdent)', () => {
  it('indents on bare Tab and outdents on Shift+Tab', () => {
    expect(resolveStudioBodyKeyIntent(keyEvent({ key: 'Tab' }))).toBe('indent');
    expect(resolveStudioBodyKeyIntent(keyEvent({ key: 'Tab', shiftKey: true }))).toBe('outdent');
  });

  it('keeps modifier chords (standard shortcuts) on their default behavior', () => {
    expect(resolveStudioBodyKeyIntent(keyEvent({ key: 'Tab', ctrlKey: true }))).toBeUndefined();
    expect(resolveStudioBodyKeyIntent(keyEvent({ key: 'Tab', metaKey: true }))).toBeUndefined();
    expect(resolveStudioBodyKeyIntent(keyEvent({ key: 'Tab', altKey: true }))).toBeUndefined();
  });

  it('is undefined for ordinary typing keys', () => {
    expect(resolveStudioBodyKeyIntent(keyEvent({ key: 'Tab' }))).toBeDefined();
    expect(resolveStudioBodyKeyIntent(keyEvent({ key: 'x' }))).toBeUndefined();
  });
});

/** Emulates the browser's setRangeText selection semantics for assertions. */
class FakeTextArea implements SnippetTextArea {
  value: string;
  selectionStart: number | null;
  selectionEnd: number | null;
  setRangeTextCalls = 0;

  constructor(value = '', selectionStart = 0, selectionEnd = selectionStart) {
    this.value = value;
    this.selectionStart = selectionStart;
    this.selectionEnd = selectionEnd;
  }

  setRangeText(
    text: string,
    start: number,
    end: number,
    selectionMode: 'end' | 'select' | 'start' | 'preserve' = 'preserve',
  ): void {
    this.setRangeTextCalls += 1;
    const length = this.value.length;
    const safeStart = Math.max(0, Math.min(start, length));
    const safeEnd = Math.max(safeStart, Math.min(end, length));
    const delta = text.length - (safeEnd - safeStart);
    this.value = this.value.slice(0, safeStart) + text + this.value.slice(safeEnd);
    const previousStart = this.selectionStart ?? safeEnd;
    const previousEnd = this.selectionEnd ?? safeEnd;
    if (selectionMode === 'end') {
      this.selectionStart = safeStart + text.length;
      this.selectionEnd = safeStart + text.length;
      return;
    }
    if (selectionMode === 'select') {
      this.selectionStart = safeStart;
      this.selectionEnd = safeStart + text.length;
      return;
    }
    if (selectionMode === 'start') {
      this.selectionStart = safeStart;
      this.selectionEnd = safeStart;
      return;
    }
    // preserve: shift positions after the replaced range by the delta.
    const mapPosition = (position: number): number => {
      if (position <= safeStart) return position;
      if (position >= safeEnd) return position + delta;
      return safeEnd + delta;
    };
    this.selectionStart = mapPosition(previousStart);
    this.selectionEnd = mapPosition(previousEnd);
  }
}

describe('indentStudioBodySelection (#114)', () => {
  it('inserts exactly two spaces at the caret on an empty body and parks the caret after them', () => {
    const area = new FakeTextArea('');
    indentStudioBodySelection(area);
    expect(area.value).toBe('  ');
    expect(area.selectionStart).toBe(2);
    expect(area.selectionEnd).toBe(2);
  });

  it('replaces a same-line selection with two spaces', () => {
    const area = new FakeTextArea('hello world', 6, 11);
    indentStudioBodySelection(area);
    // 'world' (5 chars) is replaced by two spaces after the existing gap.
    expect(area.value).toBe('hello   ');
    expect(area.selectionStart).toBe(8);
    expect(area.selectionEnd).toBe(8);
  });

  it('indents every partially selected line with one edit and keeps the block selected', () => {
    const area = new FakeTextArea('one\ntwo\nthree', 4, 9);
    indentStudioBodySelection(area);
    expect(area.value).toBe('one\n  two\n  three');
    expect(area.selectionStart).toBe(4);
    expect(area.selectionEnd).toBe(4 + '  two\n  three'.length);
    // One undoable edit, not one per line.
    expect(area.setRangeTextCalls).toBe(1);
  });

  it('excludes the final line when the selection ends exactly on its newline', () => {
    const area = new FakeTextArea('one\ntwo\nthree', 4, 8);
    indentStudioBodySelection(area);
    expect(area.value).toBe('one\n  two\nthree');
  });

  it('skips blank lines inside a multi-line selection', () => {
    const area = new FakeTextArea('a\n\nb', 0, 4);
    indentStudioBodySelection(area);
    expect(area.value).toBe('  a\n\n  b');
  });
});

describe('outdentStudioBodySelection (#114)', () => {
  it('removes up to two preceding spaces on the current line', () => {
    const area = new FakeTextArea('  list item', 0, 0);
    outdentStudioBodySelection(area);
    expect(area.value).toBe('list item');
    expect(area.selectionStart).toBe(0);
    expect(area.selectionEnd).toBe(0);
  });

  it('removes at most two spaces even when four are present', () => {
    const area = new FakeTextArea('    deep', 0, 0);
    outdentStudioBodySelection(area);
    expect(area.value).toBe('  deep');
  });

  it('outdents every selected line with one edit and keeps the block selected', () => {
    const area = new FakeTextArea('  one\n  two', 0, 11);
    outdentStudioBodySelection(area);
    expect(area.value).toBe('one\ntwo');
    expect(area.selectionStart).toBe(0);
    expect(area.selectionEnd).toBe('one\ntwo'.length);
    expect(area.setRangeTextCalls).toBe(1);
  });

  it('is a no-op that never edits when no line carries removable spaces', () => {
    const area = new FakeTextArea('\tcode\nplain', 0, 11);
    outdentStudioBodySelection(area);
    expect(area.value).toBe('\tcode\nplain');
    expect(area.setRangeTextCalls).toBe(0);
  });

  it('outdents a partial selection spanning the affected line', () => {
    const area = new FakeTextArea('  keep  two', 2, 6);
    outdentStudioBodySelection(area);
    expect(area.value).toBe('keep  two');
  });
});

describe('studioWordCount (#114)', () => {
  it('counts whitespace-collapsing words', () => {
    expect(studioWordCount('')).toBe(0);
    expect(studioWordCount('   \n\t  ')).toBe(0);
    expect(studioWordCount('hello world')).toBe(2);
    expect(studioWordCount('one  two\n\nthree\tfour')).toBe(4);
  });
});
