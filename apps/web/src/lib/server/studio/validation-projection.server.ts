import { serializeArticleSource } from '@jelementi/content-compiler';
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

function fieldTarget(control: string): StudioValidationTarget {
  return {
    kind: 'field',
    controlId: `studio-field-${control}`,
    label: FIELD_LABELS[control] ?? control,
  };
}

function phaseFor(code: string): StudioValidationPhase {
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
    default:
      return { kind: 'source' };
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
