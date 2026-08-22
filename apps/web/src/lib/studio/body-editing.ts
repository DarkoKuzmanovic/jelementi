/**
 * Body-textarea editing ergonomics for the write–check loop (#114).
 *
 * Pure decision and edit helpers over a structural textarea subset (the
 * same `SnippetTextArea` shape the #113 snippet insertion uses), so the
 * hydrated editor composes them without this module ever needing a DOM.
 *
 * Every edit goes through `setRangeText` — never `execCommand` (deprecated)
 * and never direct `value` assignment. Known engine trade-off, verified by
 * probe on Chromium while building #114: Blink does not record setRangeText
 * edits in the native undo stack (Firefox does), so undoing an indent costs
 * a manual re-edit there. This matches the existing #113 insert-image
 * affordance, which ships on the same mechanism; copy/paste behavior is
 * unaffected everywhere.
 */

import type { SnippetTextArea } from './markdown-dialect';

/** What the body keydown handler should do instead of the browser default. */
export type StudioBodyKeyIntent = 'preview-submit' | 'indent' | 'outdent';

/**
 * Structural subset of the keyboard event the body handler decides on.
 * A real `KeyboardEvent` satisfies this via structural typing.
 */
export interface StudioBodyKeyboardEventLike {
  key: string;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  isComposing: boolean;
}

const INDENT_UNIT = '  ';

/**
 * Resolves one body-textarea keydown into an editor intent:
 * - Cmd/Ctrl+Enter submits the Preview intent (both platforms; Shift/Alt
 *   are ignored alongside the command modifier).
 * - Bare Tab indents, Shift+Tab outdents; every modifier chord (Ctrl+Tab,
 *   Cmd+Tab, Alt+Tab) stays on the browser's default behavior so standard
 *   shortcuts and focus order outside the textarea are untouched.
 * - An active IME composition always wins: during composition these keys
 *   belong to the input method, so the intent is undefined.
 * - Everything else (including a plain Enter newline) is undefined.
 */
export function resolveStudioBodyKeyIntent(
  event: StudioBodyKeyboardEventLike,
): StudioBodyKeyIntent | undefined {
  if (event.isComposing) return undefined;
  if (event.key === 'Enter') {
    if (event.metaKey || event.ctrlKey) return 'preview-submit';
    return undefined;
  }
  if (event.key === 'Tab') {
    if (event.metaKey || event.ctrlKey || event.altKey) return undefined;
    return event.shiftKey ? 'outdent' : 'indent';
  }
  return undefined;
}

/** Offset of the first character of the line containing `position`. */
function lineStartOf(value: string, position: number): number {
  if (position <= 0) return 0;
  const newline = value.lastIndexOf('\n', position - 1);
  return newline === -1 ? 0 : newline + 1;
}

/** Offset just past the last character of the line containing `position`. */
function lineEndOf(value: string, position: number): number {
  const newline = value.indexOf('\n', position);
  return newline === -1 ? value.length : newline;
}

interface SelectedLineRange {
  /** Offset of the first affected line's first character. */
  start: number;
  /** Offset just past the last affected line's last character. */
  end: number;
}

/**
 * The block of lines a selection touches. A selection ending exactly on a
 * newline excludes the line after it (the trailing newline is a boundary,
 * not a selection of that line); an empty selection means the caret's own
 * current line.
 */
function selectedLineRange(textarea: SnippetTextArea): SelectedLineRange {
  const length = textarea.value.length;
  const rawStart = textarea.selectionStart ?? length;
  const rawEnd = textarea.selectionEnd ?? rawStart;
  const start = Math.min(Math.max(rawStart, 0), length);
  const end = Math.min(Math.max(rawEnd, start), length);
  if (start === end) {
    return {
      start: lineStartOf(textarea.value, start),
      end: lineEndOf(textarea.value, Math.max(start - 1, 0)),
    };
  }
  let scanEnd = end;
  if (textarea.value[scanEnd - 1] === '\n') scanEnd -= 1;
  return {
    start: lineStartOf(textarea.value, start),
    end: lineEndOf(textarea.value, scanEnd - 1),
  };
}

function clampedSelection(textarea: SnippetTextArea): { start: number; end: number } {
  const length = textarea.value.length;
  const rawStart = textarea.selectionStart ?? length;
  const rawEnd = textarea.selectionEnd ?? rawStart;
  const start = Math.min(Math.max(rawStart, 0), length);
  return { start, end: Math.min(Math.max(rawEnd, start), length) };
}

/**
 * Indents every line the selection touches by two spaces (blank lines stay
 * blank) as ONE setRangeText edit, keeping the resulting block selected so
 * repeated Tab presses compound. A single-line or empty selection simply
 * inserts two spaces at the caret.
 */
export function indentStudioBodySelection(textarea: SnippetTextArea): void {
  const { start, end } = clampedSelection(textarea);
  if (start === end || !textarea.value.slice(start, end).includes('\n')) {
    textarea.setRangeText(INDENT_UNIT, start, end, 'end');
    return;
  }
  const range = selectedLineRange(textarea);
  const block = textarea.value.slice(range.start, range.end);
  const indented = block
    .split('\n')
    .map((line) => (line.length === 0 ? line : INDENT_UNIT + line))
    .join('\n');
  if (indented !== block) {
    textarea.setRangeText(indented, range.start, range.end, 'select');
  }
}

/**
 * Removes up to two leading spaces from every line the selection touches as
 * ONE setRangeText edit. Lines with nothing removable (tabs included) are
 * left alone; when no line changes, the textarea is not edited at all so no
 * undo step is wasted. A bare-caret outdent collapses the caret to the line
 * start; a real selection keeps the resulting block selected.
 */
export function outdentStudioBodySelection(textarea: SnippetTextArea): void {
  const { start, end } = clampedSelection(textarea);
  const range = selectedLineRange(textarea);
  const block = textarea.value.slice(range.start, range.end);
  const outdented = block
    .split('\n')
    .map((line) => line.replace(/^ {1,2}/, ''))
    .join('\n');
  if (outdented !== block) {
    textarea.setRangeText(outdented, range.start, range.end, start === end ? 'start' : 'select');
  }
}

/**
 * The whitespace-collapsing word count shown beside the reading-time note:
 * every run of non-whitespace characters counts as one word.
 */
export function studioWordCount(body: string): number {
  return body.match(/\S+/g)?.length ?? 0;
}
