/**
 * Single source of truth for the Studio editor's Markdown guidance (#113).
 *
 * Every claim below mirrors `@jelementi/content-compiler` behavior exactly.
 * The web app never imports the compiler (ownership boundary), so the
 * machine-checkable claims travel as plain data:
 * `scripts/markdown-dialect-parity.test.ts` compiles every accepted/rejected
 * example through the real compiler, so this reference can never drift from
 * what the compiler actually accepts or rejects.
 */

/** The exact relative media-key shape the cover/audio helper text states. */
export const MEDIA_KEY_PATTERN_HINT = 'articles/<slug>/<file>-v1.ext';

export const COVER_MEDIA_KEY_HINT =
  'articles/<slug>/<file>-v1.ext, for example articles/my-article/cover-v1.jpg. No leading slash.';

export const AUDIO_MEDIA_KEY_HINT =
  'articles/<slug>/<file>-v1.ext, for example articles/my-article/audio-v1.mp3. No leading slash.';

export interface RejectedDialectExample {
  /** Markdown snippet as the writer would type it. */
  markdown: string;
  /** Stable compiler issue code this snippet fails with. */
  issueCode: string;
}

export interface MarkdownDialectEntry {
  id: string;
  /**
   * Writer-facing rule sentence rendered in the collapsible reference.
   * Kept free of `&`, `<`, `>` so Svelte text-node escaping stays a no-op.
   */
  rule: string;
  /** Syntax examples shown verbatim under the rule. */
  examples?: string[];
  /** Machine-checkable claims: these snippets must compile. */
  acceptedExamples?: string[];
  /** Machine-checkable claims: these snippets must fail with issueCode. */
  rejectedExamples?: RejectedDialectExample[];
}

export const MARKDOWN_DIALECT_REFERENCE: MarkdownDialectEntry[] = [
  {
    id: 'headings',
    rule: 'Headings use ## through #### only (levels 2–4). The article title lives in the Title field; never start the body with #.',
    examples: ['## Section', '### Subsection'],
    acceptedExamples: ['## Section', '### Subsection', '#### Sub-subsection'],
    rejectedExamples: [
      { markdown: '# Top-level title', issueCode: 'UNSUPPORTED_NODE' },
      { markdown: '##### Too deep', issueCode: 'UNSUPPORTED_NODE' },
    ],
  },
  {
    id: 'inline',
    rule: 'Inline formatting: **bold**, *italic*, ~~strikethrough~~, and `code`.',
    acceptedExamples: ['A paragraph with **bold**, *italic*, ~~strike~~, and `code` text.'],
  },
  {
    id: 'links',
    rule: 'Links use square-bracket text and an HTTPS URL in parentheses; plain http:// links are rejected.',
    examples: ['[the source](https://example.org/article)'],
    acceptedExamples: ['[the source](https://example.org/article)'],
    rejectedExamples: [
      { markdown: '[text](http://example.org/page)', issueCode: 'UNSUPPORTED_NODE' },
    ],
  },
  {
    id: 'images',
    rule: 'Images stand alone in their own paragraph: alt text in brackets, a relative media key, then an optional caption in double quotes. Use the media-key pattern shown next to Cover and Audio.',
    examples: ['![Map](articles/your-article/map-v1.webp "A map caption")'],
    acceptedExamples: ['![Map](articles/your-article/map-v1.webp "A map caption")'],
    rejectedExamples: [
      {
        markdown: 'Text ![inline](articles/your-article/map-v1.webp)',
        issueCode: 'UNSUPPORTED_NODE',
      },
    ],
  },
  {
    id: 'lists',
    rule: 'Lists are flat lines starting with - or 1.; each item is one paragraph, checkboxes are not allowed, and numbered lists start at 1.',
    examples: ['- First item\n- Second item', '1. First item\n2. Second item'],
    acceptedExamples: ['- First item\n- Second item', '1. First item\n2. Second item'],
    rejectedExamples: [
      { markdown: '- one\n  - nested', issueCode: 'INVALID_LIST' },
      { markdown: '- [ ] Task', issueCode: 'INVALID_LIST' },
      { markdown: '2. Two', issueCode: 'INVALID_LIST' },
    ],
  },
  {
    id: 'quotes',
    rule: 'Quotes hold exactly one paragraph. Finish with an em dash on a new line to attribute the quote.',
    examples: ['> The sea is the only road home.\n> — Islander'],
    acceptedExamples: ['> The sea is the only road home.\n> — Islander'],
    rejectedExamples: [{ markdown: '> First.\n>\n> Second.', issueCode: 'UNSUPPORTED_NODE' }],
  },
  {
    id: 'divider',
    rule: 'Three dashes on their own line draw a divider.',
    examples: ['---'],
    acceptedExamples: ['---'],
  },
  {
    id: 'callouts',
    rule: 'Callouts wrap exactly one paragraph with :::fact, :::note, or :::warning — optionally titled — closed by :::. Other directive names are rejected.',
    examples: [
      ':::fact{title="Did you know?"}\nThe harbor is reached by ship.\n:::',
      ':::note\nBring supplies.\n:::',
    ],
    acceptedExamples: [
      ':::fact{title="Did you know?"}\nThe harbor is reached by ship.\n:::',
      ':::note\nBring supplies.\n:::',
    ],
    rejectedExamples: [{ markdown: ':::tip\nNo\n:::', issueCode: 'INVALID_DIRECTIVE' }],
  },
  {
    id: 'footnotes',
    rule: 'Footnotes pair [^id] markers in the text with a single [^id]: definition line each; ids stay unique and definitions hold one paragraph.',
    examples: ['A claim worth noting.[^src]\n\n[^src]: The note text.'],
    acceptedExamples: ['A claim worth noting.[^src]\n\n[^src]: The note text.'],
    rejectedExamples: [
      { markdown: 'Undefined notes fail.[^missing]', issueCode: 'INVALID_FOOTNOTE' },
      {
        markdown: 'Referenced twice.[^d]\n\n[^d]: A.\n[^d]: B.',
        issueCode: 'INVALID_FOOTNOTE',
      },
    ],
  },
  {
    id: 'unsupported',
    rule: 'Not supported: tables, raw HTML, and fenced code blocks. Present tabular information as a list instead, and use Markdown formatting instead of HTML.',
    rejectedExamples: [
      {
        markdown: '| one | two |\n| --- | --- |\n| a | b |',
        issueCode: 'UNSUPPORTED_NODE',
      },
      { markdown: '<div>Not allowed</div>', issueCode: 'UNSUPPORTED_NODE' },
      { markdown: '```ts\nconst x = 1;\n```', issueCode: 'UNSUPPORTED_NODE' },
    ],
  },
];

/**
 * Builds the standalone image paragraph the insert-image affordance inserts,
 * keyed to the current article slug. Blank-line padding guarantees the image
 * is alone in its paragraph no matter where the caret sits, which is what the
 * compiler requires of image blocks. Alt text and caption are editable
 * placeholders following the versioned media-key convention.
 */
export function buildStandaloneImageSnippet(slug: string): string {
  const directory = slug.trim() === '' ? 'your-article' : slug.trim();
  return `\n\n![Describe the image](articles/${directory}/image-01-v1.webp "Optional caption")\n\n`;
}

/**
 * Structural subset of HTMLTextAreaElement used by the insertion helper so it
 * stays unit-testable without a DOM.
 */
export interface SnippetTextArea {
  value: string;
  selectionStart: number | null;
  selectionEnd: number | null;
  setRangeText(
    text: string,
    start: number,
    end: number,
    selectionMode?: 'end' | 'select' | 'start' | 'preserve',
  ): void;
}

/**
 * Replaces the current selection with the snippet and parks the caret after
 * it ('end'), so a writer can keep typing immediately after the inserted
 * syntax.
 */
export function insertSnippetAtCursor(textarea: SnippetTextArea, snippet: string): void {
  const length = textarea.value.length;
  const rawStart = textarea.selectionStart ?? length;
  const rawEnd = textarea.selectionEnd ?? rawStart;
  const start = Math.min(Math.max(rawStart, 0), length);
  const end = Math.min(Math.max(rawEnd, start), length);
  textarea.setRangeText(snippet, start, end, 'end');
}
