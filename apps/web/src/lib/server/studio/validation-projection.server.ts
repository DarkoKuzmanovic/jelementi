import { serializeArticleSource } from '@jelementi/content-compiler';
import { EDITOR_INPUT_LIMITS } from '../../studio/contracts';
import type { StudioCompileIssue, StudioMetadata } from '../../studio/contracts';

/**
 * Validation projection for the Studio publication center.
 *
 * Turns compiler issues into an actionable presentation: a blocking summary
 * (count, phases, Publish consequence) plus one deterministic target per
 * issue — a labelled metadata control, a body-textarea range, or a plain
 * source location when no safe control mapping exists.
 */

export type StudioValidationPhase = 'metadata' | 'media' | 'body' | 'model' | 'compile';

export type StudioValidationTarget =
  | { kind: 'field'; controlId: string; label: string }
  | {
      kind: 'body';
      controlId: 'studio-body';
      bodyLine: number;
      bodyColumn: number;
      selectionStart: number;
      selectionEnd: number;
    }
  | { kind: 'source' };

export interface StudioValidationIssueView {
  issue: StudioCompileIssue;
  phase: StudioValidationPhase;
  location: string;
  target: StudioValidationTarget;
}

export interface StudioValidationProjection {
  count: number;
  severity: 'blocking';
  phases: StudioValidationPhase[];
  summary: string;
  first: StudioValidationIssueView;
  issues: StudioValidationIssueView[];
}

interface StudioValidationCandidate {
  metadata: StudioMetadata;
  body: string;
}

const FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  slug: 'Slug',
  status: 'Status',
  excerpt: 'Excerpt',
  updatedAt: 'Updated date',
  publishedAt: 'Published date',
  category: 'Category',
  tags: 'Tags',
  author: 'Author',
  coverSrc: 'Cover media key',
  coverAlt: 'Cover alt text',
  audioSrc: 'Audio media key',
  audioDurationSeconds: 'Audio duration',
  references: 'References',
};

/** Maps frontmatter field names quoted in compiler messages to editor controls. */
const QUOTED_FIELD_CONTROLS: Record<string, string> = {
  title: 'title',
  slug: 'slug',
  status: 'status',
  excerpt: 'excerpt',
  updatedAt: 'updatedAt',
  publishedAt: 'publishedAt',
  category: 'category',
  tags: 'tags',
  author: 'author',
  cover: 'coverSrc',
  audio: 'audioSrc',
  references: 'references',
};

/**
 * #110 form-decode anchoring. Maps decoder paths (e.g.
 * `input.metadata.title.max`, reference indices stripped) to the stable
 * decode-originated issue code and human-readable requirement for that
 * control. Paths without an entry are genuinely unexpected (hidden
 * concurrency fields, tampered envelopes) and stay on the generic
 * INVALID_EDITOR_INPUT fallback at the route boundary.
 */
const DECODE_FIELD_REQUIREMENTS: Record<string, { code: string; message: string }> = {
  'input.metadata.title': {
    code: 'EDITOR_INPUT_TITLE',
    message: `Title must be at most ${EDITOR_INPUT_LIMITS.titleMax} characters.`,
  },
  'input.metadata.slug': {
    code: 'EDITOR_INPUT_SLUG',
    message: `Slug must use lowercase letters, digits, and hyphens with no leading or trailing hyphen (at most ${EDITOR_INPUT_LIMITS.slugMax} characters).`,
  },
  'input.metadata.excerpt': {
    code: 'EDITOR_INPUT_EXCERPT',
    message: `Excerpt must be at most ${EDITOR_INPUT_LIMITS.excerptMax} characters.`,
  },
  'input.metadata.status': {
    code: 'EDITOR_INPUT_STATUS',
    message: 'Status must be draft, published, or archived.',
  },
  'input.metadata.publishedAt': {
    code: 'EDITOR_INPUT_PUBLISHED_AT',
    message:
      'Published date must be YYYY-MM-DD or a full ISO timestamp such as 2026-08-22T09:30:00Z.',
  },
  'input.metadata.updatedAt': {
    code: 'EDITOR_INPUT_UPDATED_AT',
    message:
      'Updated date must be YYYY-MM-DD or a full ISO timestamp such as 2026-08-22T09:30:00Z.',
  },
  'input.metadata.category': {
    code: 'EDITOR_INPUT_CATEGORY',
    message: `Category must be at most ${EDITOR_INPUT_LIMITS.categoryMax} characters.`,
  },
  'input.metadata.author': {
    code: 'EDITOR_INPUT_AUTHOR',
    message: `Author must be at most ${EDITOR_INPUT_LIMITS.authorMax} characters.`,
  },
  'input.metadata.tags': {
    code: 'EDITOR_INPUT_TAGS',
    message: `Tags must be comma-separated and each 1–${EDITOR_INPUT_LIMITS.tagMax} characters (at most 100 tags).`,
  },
  'input.metadata.cover.src': {
    code: 'EDITOR_INPUT_COVER_SRC',
    message: `Cover media key must be a relative library key such as articles/slug/cover-v1.svg (no spaces or backslashes, at most ${EDITOR_INPUT_LIMITS.mediaKeyMax} characters).`,
  },
  'input.metadata.cover.alt': {
    code: 'EDITOR_INPUT_COVER_ALT',
    message: `Cover alt text is required and must be at most ${EDITOR_INPUT_LIMITS.altMax} characters.`,
  },
  'input.metadata.audio.src': {
    code: 'EDITOR_INPUT_AUDIO_SRC',
    message: `Audio media key must be a relative library key such as articles/slug/audio-v1.mp3 (no spaces or backslashes, at most ${EDITOR_INPUT_LIMITS.mediaKeyMax} characters).`,
  },
  'input.metadata.audio.durationSeconds': {
    code: 'EDITOR_INPUT_AUDIO_DURATION',
    message: 'Audio duration must be a whole number of seconds of at least 1.',
  },
  'input.metadata.references.title': {
    code: 'EDITOR_INPUT_REFERENCES',
    message: `Each reference title must be 1–${EDITOR_INPUT_LIMITS.referenceTitleMax} characters.`,
  },
  'input.metadata.references.url': {
    code: 'EDITOR_INPUT_REFERENCES',
    message: `Each reference URL must start with https:// and be at most ${EDITOR_INPUT_LIMITS.urlMax} characters.`,
  },
  'input.metadata.references.publisher': {
    code: 'EDITOR_INPUT_REFERENCES',
    message: `Each reference publisher must be at most ${EDITOR_INPUT_LIMITS.referencePublisherMax} characters.`,
  },
  'input.metadata.references.accessedAt': {
    code: 'EDITOR_INPUT_REFERENCES',
    message:
      'Accessed dates must be YYYY-MM-DD or a full ISO timestamp such as 2026-08-22T09:30:00Z.',
  },
  'input.metadata.references': {
    code: 'EDITOR_INPUT_REFERENCES',
    message: 'There can be at most 100 references.',
  },
  'input.body': {
    code: 'EDITOR_INPUT_BODY',
    message: `Body must be at most ${EDITOR_INPUT_LIMITS.bodyMax.toLocaleString('en-US')} characters.`,
  },
};

/**
 * Decode-originated codes mapped to their editor control. The body maps to
 * the textarea's own id (`studio-body`), not a `studio-field-*` control.
 */
const DECODE_ISSUE_CONTROLS: Record<string, string> = {
  EDITOR_INPUT_TITLE: 'title',
  EDITOR_INPUT_SLUG: 'slug',
  EDITOR_INPUT_EXCERPT: 'excerpt',
  EDITOR_INPUT_STATUS: 'status',
  EDITOR_INPUT_PUBLISHED_AT: 'publishedAt',
  EDITOR_INPUT_UPDATED_AT: 'updatedAt',
  EDITOR_INPUT_CATEGORY: 'category',
  EDITOR_INPUT_TAGS: 'tags',
  EDITOR_INPUT_AUTHOR: 'author',
  EDITOR_INPUT_COVER_SRC: 'coverSrc',
  EDITOR_INPUT_COVER_ALT: 'coverAlt',
  EDITOR_INPUT_AUDIO_SRC: 'audioSrc',
  EDITOR_INPUT_AUDIO_DURATION: 'audioDurationSeconds',
  EDITOR_INPUT_REFERENCES: 'references',
  EDITOR_INPUT_BODY: 'body',
};

function fieldTarget(control: string): StudioValidationTarget {
  return {
    kind: 'field',
    controlId: `studio-field-${control}`,
    label: FIELD_LABELS[control] ?? control,
  };
}

function decodeIssueTarget(code: string): StudioValidationTarget | undefined {
  const control = DECODE_ISSUE_CONTROLS[code];
  if (control === undefined) return undefined;
  if (control === 'body') {
    return { kind: 'field', controlId: 'studio-body', label: 'Body' };
  }
  return fieldTarget(control);
}

function phaseFor(code: string): StudioValidationPhase {
  if (code === 'EDITOR_INPUT_BODY') {
    return 'body';
  }
  // #110 decode-originated field rejections are metadata-field problems,
  // not compiler failures; anchoring keeps them out of the generic phase.
  if (code.startsWith('EDITOR_INPUT_')) {
    return 'metadata';
  }
  switch (code) {
    case 'INVALID_FRONTMATTER':
    // #109 slug-collision rejections are metadata-field problems, not
    // compiler failures; anchoring keeps them out of the generic phase.
    case 'SLUG_ALREADY_EXISTS':
    case 'SLUG_DRAFT_EXISTS':
      return 'metadata';
    case 'INVALID_MEDIA':
      return 'media';
    case 'UNSUPPORTED_NODE':
    case 'INVALID_LIST':
    case 'INVALID_DIRECTIVE':
    case 'INVALID_FOOTNOTE':
      return 'body';
    case 'FINAL_VALIDATION':
      return 'model';
    default:
      return 'compile';
  }
}

function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === '';
}

/**
 * Resolves the combined required-field compiler message to the first control
 * that is visibly empty, following the compiler's own check order.
 */
function requiredFieldControl(metadata: StudioMetadata): string | undefined {
  const ordered: Array<[string, string | undefined]> = [
    ['title', metadata.title],
    ['slug', metadata.slug],
    ['excerpt', metadata.excerpt],
    ['updatedAt', metadata.updatedAt],
    ['category', metadata.category],
    ['author', metadata.author],
  ];
  for (const [control, value] of ordered) {
    if (isBlank(value)) {
      return control;
    }
  }
  if (metadata.tags.length === 0 || metadata.tags.some((tag) => isBlank(tag))) {
    return 'tags';
  }
  if (isBlank(metadata.cover.src)) {
    return 'coverSrc';
  }
  if (isBlank(metadata.cover.alt)) {
    return 'coverAlt';
  }
  return undefined;
}

function frontmatterFieldTarget(message: string, metadata: StudioMetadata): StudioValidationTarget {
  const quoted = /field "([^"]+)"/.exec(message);
  if (quoted) {
    if (message.includes('Unknown cover field')) {
      return fieldTarget('coverSrc');
    }
    if (message.includes('Unknown audio field')) {
      return fieldTarget('audioSrc');
    }
    if (message.includes('Unknown reference field')) {
      return fieldTarget('references');
    }
    const control = QUOTED_FIELD_CONTROLS[quoted[1] ?? ''];
    if (control) {
      return fieldTarget(control);
    }
    return { kind: 'source' };
  }
  if (message.includes('Each reference') || message.includes('reference.')) {
    return fieldTarget('references');
  }
  if (message.includes('publishedAt')) {
    return fieldTarget('publishedAt');
  }
  if (message.includes('audio must be')) {
    return fieldTarget('audioSrc');
  }
  if (message === 'Source filename must match frontmatter slug.') {
    return fieldTarget('slug');
  }
  if (message.includes('missing a required field')) {
    const control = requiredFieldControl(metadata);
    return control ? fieldTarget(control) : { kind: 'source' };
  }
  return { kind: 'source' };
}

/** Heuristic for media keys the compiler rejects before resolving them. */
function looksLikeInvalidMediaKey(key: string | undefined): boolean {
  if (key === undefined || key.trim() === '') {
    return false;
  }
  return (
    key.includes('\\') ||
    key.includes('%') ||
    /\s/.test(key) ||
    key.startsWith('/') ||
    key.split('/').some((segment) => segment === '.' || segment === '..') ||
    /^[a-z][a-z0-9+.-]*:/i.test(key)
  );
}

function metadataMediaTarget(metadata: StudioMetadata): StudioValidationTarget {
  if (looksLikeInvalidMediaKey(metadata.cover.src)) {
    return fieldTarget('coverSrc');
  }
  if (looksLikeInvalidMediaKey(metadata.audio?.src)) {
    return fieldTarget('audioSrc');
  }
  return { kind: 'source' };
}

interface BodyGeometry {
  /** Number of source lines occupied by the serialized frontmatter block. */
  frontmatterLines: number;
  lines: string[];
  /** Start offset of each body line in the normalized body string. */
  lineStarts: number[];
}

function bodyGeometry(candidate: StudioValidationCandidate): BodyGeometry | undefined {
  let frontmatterLines: number;
  try {
    const serialized = serializeArticleSource({
      frontmatter: candidate.metadata as never,
      body: '',
    });
    frontmatterLines = serialized.split('\n').length - 1;
  } catch {
    return undefined;
  }
  const normalized = candidate.body.replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  const lineStarts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    lineStarts.push(offset);
    offset += line.length + 1;
  }
  return { frontmatterLines, lines, lineStarts };
}

function bodyTarget(
  issue: StudioCompileIssue,
  geometry: BodyGeometry,
): StudioValidationTarget | undefined {
  const line = issue.line;
  if (line === undefined || line <= geometry.frontmatterLines) {
    return undefined;
  }
  const bodyLine = line - geometry.frontmatterLines;
  if (bodyLine < 1 || bodyLine > geometry.lines.length) {
    return undefined;
  }
  const text = geometry.lines[bodyLine - 1];
  const lineStart = geometry.lineStarts[bodyLine - 1];
  if (text === undefined || lineStart === undefined) {
    return undefined;
  }
  const bodyColumn = issue.column ?? 1;
  const selectionEnd = lineStart + text.length;
  let selectionStart = lineStart + Math.min(Math.max(bodyColumn - 1, 0), text.length);
  if (selectionStart >= selectionEnd) {
    selectionStart = lineStart;
  }
  return {
    kind: 'body',
    controlId: 'studio-body',
    bodyLine,
    bodyColumn,
    selectionStart,
    selectionEnd,
  };
}

function targetFor(
  issue: StudioCompileIssue,
  candidate: StudioValidationCandidate,
  geometry: BodyGeometry | undefined,
): StudioValidationTarget {
  if (geometry) {
    const body = bodyTarget(issue, geometry);
    if (body) {
      return body;
    }
  }
  switch (issue.code) {
    case 'INVALID_FRONTMATTER':
      return frontmatterFieldTarget(issue.message, candidate.metadata);
    case 'INVALID_MEDIA':
      return metadataMediaTarget(candidate.metadata);
    // #109 slug-collision rejections link straight to the Slug control.
    case 'SLUG_ALREADY_EXISTS':
    case 'SLUG_DRAFT_EXISTS':
      return fieldTarget('slug');
    default: {
      // #110 decode-originated rejections anchor to the field the decoder
      // named, using the same go-to-field machinery as compiler issues.
      const decode = decodeIssueTarget(issue.code);
      return decode ?? { kind: 'source' };
    }
  }
}

function summaryFor(count: number, phases: StudioValidationPhase[]): string {
  const noun = count === 1 ? 'validation issue' : 'validation issues';
  return `${count} ${noun} (blocking) in ${phases.join(', ')}. Publish stays blocked until every issue is fixed.`;
}

export function buildStudioValidationProjection(
  issues: StudioCompileIssue[],
  candidate: StudioValidationCandidate,
): StudioValidationProjection | undefined {
  if (issues.length === 0) {
    return undefined;
  }
  const geometry = bodyGeometry(candidate);
  const views: StudioValidationIssueView[] = issues.map((issue) => ({
    issue,
    phase: phaseFor(issue.code),
    location: `${issue.sourcePath}:${issue.line ?? 1}:${issue.column ?? 1}`,
    target: targetFor(issue, candidate, geometry),
  }));
  const first = views[0];
  if (first === undefined) {
    return undefined;
  }
  const phases: StudioValidationPhase[] = [];
  for (const view of views) {
    if (!phases.includes(view.phase)) {
      phases.push(view.phase);
    }
  }
  return {
    count: views.length,
    severity: 'blocking',
    phases,
    summary: summaryFor(views.length, phases),
    first,
    issues: views,
  };
}

/**
 * #110: translates form-decode failure paths (e.g. `input.metadata.title.max`)
 * into per-field anchored editor-input issues. Every mapped path becomes a
 * located issue naming its requirement; unmappable paths return nothing so
 * the route boundary can decide on its generic fallback. Identical
 * requirements from repeated fields (e.g. several bad reference titles)
 * collapse to one issue.
 */
export function buildEditorInputIssues(
  decodeIssues: readonly string[],
  slug: string,
): StudioCompileIssue[] {
  const issues: StudioCompileIssue[] = [];
  const seen = new Set<string>();
  for (const decodeIssue of decodeIssues) {
    const entry = decodeFieldRequirement(decodeIssue);
    if (entry === undefined) continue;
    const key = `${entry.code}\n${entry.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    issues.push({
      code: entry.code,
      message: entry.message,
      sourcePath: `content/articles/${slug}.md`,
      line: 1,
      column: 1,
    });
  }
  return issues;
}

function decodeFieldRequirement(
  decodeIssue: string,
): { code: string; message: string } | undefined {
  const cut = decodeIssue.lastIndexOf('.');
  if (cut <= 0) return undefined;
  // Reference indices carry no distinct control: `references[2].url` and
  // `references.array` both anchor to the References fieldset.
  const path = decodeIssue.slice(0, cut).replace(/\[\d+\]/g, '');
  return DECODE_FIELD_REQUIREMENTS[path];
}
