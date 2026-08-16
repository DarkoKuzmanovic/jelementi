import {
  compileArticle,
  ContentCompileError,
  parseArticleSource,
  parseArticleSourceDraft,
  serializeArticleSource,
} from '@jelementi/content-compiler';
import { decodeStudioEditorInput } from '../../studio/contracts';
import type {
  DecodeResult,
  StudioCompileIssue,
  StudioConcurrencyEvidence,
  StudioEditorInput,
  StudioMetadata,
  StudioPreviewResult,
} from '../../studio/contracts';
import type { GithubReadAdapter } from './github-adapter';

const MAX_EDITOR_BODY_DISPLAY = 2_000_000;
const MAX_EDITOR_REFERENCES_DISPLAY = 100;
const MAX_EDITOR_SLUG = 100;
const MAX_EDITOR_TITLE = 500;
const MAX_EDITOR_EXCERPT = 2_000;
const MAX_EDITOR_CATEGORY = 200;
const MAX_EDITOR_AUTHOR = 200;
const MAX_EDITOR_TAG = 200;
const MAX_EDITOR_MEDIA = 500;
const MAX_EDITOR_ALT = 2_000;
const MAX_EDITOR_URL = 2_048;
const MAX_EDITOR_DATE = 40;
const MAX_EDITOR_REFERENCE_TITLE = 500;
const MAX_EDITOR_REFERENCE_PUBLISHER = 500;

export interface StudioPreviewInput {
  metadata: StudioMetadata;
  body: string;
}

export interface StudioPreviewOptions {
  mediaBaseUrl: string;
  sourcePath?: string;
}

export interface StudioEditorData {
  metadata: StudioMetadata;
  body: string;
  concurrency: StudioConcurrencyEvidence;
  slugEditable: boolean;
}

export interface StudioEditorLoadOptions {
  now?: () => string;
}

export type StudioEditorLoadResult =
  | { ok: true; value: StudioEditorData }
  | {
      ok: false;
      failure: {
        phase: 'main' | 'article' | 'draft';
        reason: 'github' | 'invalid-source' | 'not-found';
      };
    };

/** Loads the canonical source or the sole active branch source for editing. */
export async function loadStudioEditor(
  adapter: GithubReadAdapter,
  slug: string,
  options: StudioEditorLoadOptions = {},
): Promise<StudioEditorLoadResult> {
  const main = await adapter.getMainRef();
  if (!main.ok) return { ok: false, failure: { phase: 'main', reason: 'github' } };
  const path = `content/articles/${slug}.md`;
  const branch = await adapter.getBranch(`studio/article/${slug}`);
  if (!branch.ok && branch.failure.reason !== 'not-found') {
    return { ok: false, failure: { phase: 'draft', reason: 'github' } };
  }

  const activeBranch = branch.ok ? branch.value : undefined;
  if (activeBranch !== undefined) {
    const draftFile = await adapter.getFileContent(activeBranch.sha, path);
    if (draftFile.ok) {
      return parsedEditorData(
        draftFile.value.content,
        path,
        {
          baseMainSha: main.value.sha,
          draftHeadSha: activeBranch.sha,
          expectedBlobSha: draftFile.value.blobSha,
        },
        options.now,
      );
    }
    if (draftFile.failure.reason !== 'not-found') {
      return { ok: false, failure: { phase: 'draft', reason: 'github' } };
    }
    // Deliberate, not a topology failure: an active branch with no committed
    // article file is the recoverable in-between state of an interrupted
    // future Save (branch created, file commit not yet landed, #16). Resuming
    // as a blank, slug-locked editor lets the operator continue rather than
    // dead-ending on retry; there is no persisted content to lose or hide.
    return {
      ok: true,
      value: {
        metadata: defaultStudioMetadata(slug, options.now),
        body: '',
        concurrency: { baseMainSha: main.value.sha, draftHeadSha: activeBranch.sha },
        slugEditable: false,
      },
    };
  }

  const canonicalFile = await adapter.getFileContent(main.value.sha, path);
  if (canonicalFile.ok) {
    return parsedEditorData(
      canonicalFile.value.content,
      path,
      {
        baseMainSha: main.value.sha,
        expectedBlobSha: canonicalFile.value.blobSha,
      },
      options.now,
    );
  }
  if (canonicalFile.failure.reason !== 'not-found') {
    return { ok: false, failure: { phase: 'article', reason: 'github' } };
  }
  return {
    ok: false,
    failure: { phase: 'article', reason: 'not-found' },
  };
}

/** Always starts from blank defaults, independent of any canonical or draft slug. */
export async function loadNewStudioEditor(
  adapter: GithubReadAdapter,
  options: StudioEditorLoadOptions = {},
): Promise<StudioEditorLoadResult> {
  const main = await adapter.getMainRef();
  if (!main.ok) return { ok: false, failure: { phase: 'main', reason: 'github' } };
  return {
    ok: true,
    value: {
      metadata: defaultStudioMetadata('new-article', options.now),
      body: '',
      concurrency: { baseMainSha: main.value.sha },
      slugEditable: true,
    },
  };
}

/** Decode ordinary form controls into the existing bounded editor contract. */
export function decodeStudioFormData(form: FormData): DecodeResult<StudioEditorInput> {
  return decodeStudioEditorInput(rawStudioForm(form));
}

/** Rebuilds visible fields even when validation rejects the submitted input. */
export function reconstructStudioPreviewInput(form: FormData): StudioPreviewInput {
  const raw = rawStudioForm(form);
  const metadata = isRecord(raw.metadata) ? raw.metadata : {};
  return {
    metadata: boundedEditorMetadata(metadata, 'new-article'),
    body: raw.body.slice(0, MAX_EDITOR_BODY_DISPLAY),
  };
}

function rawStudioForm(form: FormData): {
  metadata: unknown;
  body: string;
  concurrency: unknown;
} {
  const audioSrc = formText(form, 'audioSrc').trim();
  const duration = formText(form, 'audioDurationSeconds').trim();
  const referenceTitles = formValues(form, 'referenceTitle');
  const referenceUrls = formValues(form, 'referenceUrl');
  const referencePublishers = formValues(form, 'referencePublisher');
  const referenceAccessedAt = formValues(form, 'referenceAccessedAt');
  const references: unknown[] = [];
  const referenceCount = Math.max(
    referenceTitles.length,
    referenceUrls.length,
    referencePublishers.length,
    referenceAccessedAt.length,
  );
  for (let index = 0; index < referenceCount; index += 1) {
    const title = referenceTitles[index] ?? '';
    const url = referenceUrls[index] ?? '';
    const publisher = referencePublishers[index] ?? '';
    const accessedAt = referenceAccessedAt[index] ?? '';
    if (title === '' && url === '' && publisher === '' && accessedAt === '') continue;
    references.push({
      title,
      url,
      ...(publisher === '' ? {} : { publisher }),
      ...(accessedAt === '' ? {} : { accessedAt }),
    });
  }
  return {
    metadata: {
      title: formText(form, 'title'),
      slug: formText(form, 'slug'),
      excerpt: formText(form, 'excerpt'),
      ...(formText(form, 'publishedAt').trim() === ''
        ? {}
        : { publishedAt: formText(form, 'publishedAt') }),
      updatedAt: formText(form, 'updatedAt'),
      status: formText(form, 'status'),
      category: formText(form, 'category'),
      tags: formText(form, 'tags')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      author: formText(form, 'author'),
      cover: {
        src: formText(form, 'coverSrc'),
        alt: formText(form, 'coverAlt'),
      },
      ...(audioSrc === ''
        ? {}
        : {
            audio: {
              src: audioSrc,
              ...(duration === '' ? {} : { durationSeconds: Number(duration) }),
            },
          }),
      references,
    },
    body: formText(form, 'body'),
    concurrency: {
      baseMainSha: formText(form, 'baseMainSha'),
      ...(formText(form, 'draftHeadSha') === ''
        ? {}
        : { draftHeadSha: formText(form, 'draftHeadSha') }),
      ...(formText(form, 'expectedBlobSha') === ''
        ? {}
        : { expectedBlobSha: formText(form, 'expectedBlobSha') }),
    },
  };
}

/**
 * Compiles only the current editor input. It has no filesystem, GitHub, or
 * generated-output boundary, so preview cannot create a public artifact.
 */
export function previewStudioArticle(
  input: StudioPreviewInput,
  options: StudioPreviewOptions,
): StudioPreviewResult {
  const sourcePath = options.sourcePath ?? `content/articles/${input.metadata.slug}.md`;
  try {
    const markdown = serializeArticleSource({ frontmatter: input.metadata, body: input.body });
    const compiled = compileArticle({
      markdown,
      sourcePath,
      mediaBaseUrl: options.mediaBaseUrl,
    });
    return { kind: 'preview_ok', document: compiled.document, compileIssues: [] };
  } catch (cause) {
    if (cause instanceof ContentCompileError) {
      return { kind: 'preview_issues', compileIssues: cause.issues };
    }
    return {
      kind: 'preview_issues',
      compileIssues: [compilerFailure(sourcePath)],
    };
  }
}

/** A saved branch head or blob is the immutable-slug boundary. */
export function isStudioSlugEditable(evidence: StudioConcurrencyEvidence): boolean {
  return evidence.draftHeadSha === undefined && evidence.expectedBlobSha === undefined;
}

/**
 * Keeps the editor's public input shape explicit at the server boundary. The
 * concurrency evidence is intentionally not passed to preview compilation.
 */
export function previewFromEditorInput(
  input: Pick<StudioEditorInput, 'metadata' | 'body'>,
  options: StudioPreviewOptions,
): StudioPreviewResult {
  return previewStudioArticle(input, options);
}

function formText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

function formValues(form: FormData, name: string): string[] {
  return form.getAll(name).map((value) => (typeof value === 'string' ? value : ''));
}

function parsedEditorData(
  source: string,
  sourcePath: string,
  concurrency: StudioConcurrencyEvidence,
  now?: () => string,
): StudioEditorLoadResult {
  try {
    const parsed = parseArticleSource(source, sourcePath);
    return {
      ok: true,
      value: {
        metadata: boundedEditorMetadata(
          parsed.frontmatter as unknown as Record<string, unknown>,
          parsed.frontmatter.slug,
          now,
        ),
        body: parsed.body,
        concurrency,
        slugEditable: isStudioSlugEditable(concurrency),
      },
    };
  } catch {
    let raw: { frontmatter: Record<string, unknown>; body: string };
    try {
      raw = parseArticleSourceDraft(source, sourcePath);
    } catch {
      raw = { frontmatter: {}, body: sourceBodyFallback(source) };
    }
    return {
      ok: true,
      value: {
        metadata: recoveryMetadata(raw.frontmatter, sourcePath, now),
        body: raw.body,
        concurrency,
        slugEditable: isStudioSlugEditable(concurrency),
      },
    };
  }
}

// A recovered invalid draft intentionally shows bounded metadata, not
// compile issues, until the operator explicitly submits Preview: matching
// the "explicit action, no autosave" boundary, one Preview click recompiles
// this exact reconstructed input and returns the real structured issues.
function recoveryMetadata(
  record: Record<string, unknown>,
  sourcePath: string,
  now?: () => string,
): StudioMetadata {
  // The source path, not the (possibly mismatched) raw frontmatter slug, is
  // the only trustworthy identity for an invalid draft being recovered.
  const slug = sourcePath.split('/').pop()?.replace(/\.md$/, '') ?? 'new-article';
  return { ...boundedEditorMetadata(record, slug, now), slug };
}

function boundedEditorMetadata(
  record: Record<string, unknown>,
  fallbackSlug: string,
  now?: () => string,
): StudioMetadata {
  const slug = boundedString(record.slug, fallbackSlug, MAX_EDITOR_SLUG) || fallbackSlug;
  const defaults = defaultStudioMetadata(slug, now);
  const cover = isRecord(record.cover) ? record.cover : undefined;
  const audio = isRecord(record.audio) ? record.audio : undefined;
  const references = Array.isArray(record.references)
    ? record.references.slice(0, MAX_EDITOR_REFERENCES_DISPLAY).map((value) => {
        const reference = isRecord(value) ? value : {};
        return {
          title: boundedString(reference.title, '', MAX_EDITOR_REFERENCE_TITLE),
          url: boundedString(reference.url, '', MAX_EDITOR_URL),
          ...(reference.publisher === undefined
            ? {}
            : {
                publisher: boundedString(reference.publisher, '', MAX_EDITOR_REFERENCE_PUBLISHER),
              }),
          ...(reference.accessedAt === undefined
            ? {}
            : { accessedAt: boundedString(reference.accessedAt, '', MAX_EDITOR_DATE) }),
        };
      })
    : [];
  return {
    ...defaults,
    title: boundedString(record.title, defaults.title, MAX_EDITOR_TITLE),
    slug,
    excerpt: boundedString(record.excerpt, defaults.excerpt, MAX_EDITOR_EXCERPT),
    ...(record.publishedAt === undefined
      ? {}
      : { publishedAt: boundedString(record.publishedAt, '', MAX_EDITOR_DATE) }),
    updatedAt: boundedString(record.updatedAt, defaults.updatedAt, MAX_EDITOR_DATE),
    status:
      record.status === 'draft' || record.status === 'published' || record.status === 'archived'
        ? record.status
        : defaults.status,
    category: boundedString(record.category, defaults.category, MAX_EDITOR_CATEGORY),
    tags: Array.isArray(record.tags)
      ? record.tags
          .slice(0, MAX_EDITOR_REFERENCES_DISPLAY)
          .map((tag) => boundedString(tag, '', MAX_EDITOR_TAG))
      : defaults.tags,
    author: boundedString(record.author, defaults.author, MAX_EDITOR_AUTHOR),
    cover: {
      src: boundedString(cover?.src, defaults.cover.src, MAX_EDITOR_MEDIA),
      alt: boundedString(cover?.alt, '', MAX_EDITOR_ALT),
    },
    ...(typeof audio?.src === 'string'
      ? {
          audio: {
            src: boundedString(audio.src, '', MAX_EDITOR_MEDIA),
            ...(typeof audio.durationSeconds === 'number' && Number.isFinite(audio.durationSeconds)
              ? { durationSeconds: audio.durationSeconds }
              : {}),
          },
        }
      : {}),
    references,
  };
}

function sourceBodyFallback(source: string): string {
  return source.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)([\s\S]*)$/)?.[1] ?? source;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, fallback: string, maximum: number): string {
  if (typeof value !== 'string') return fallback;
  return value.slice(0, maximum);
}

function defaultStudioMetadata(slug: string, now?: () => string): StudioMetadata {
  const updatedAt = now?.() ?? new Date().toISOString().slice(0, 10);
  return {
    title: 'Untitled article',
    slug,
    excerpt: 'Write an excerpt.',
    status: 'draft',
    updatedAt,
    category: 'Uncategorized',
    tags: [],
    author: 'Jelementi',
    cover: { src: `articles/${slug}/cover.svg`, alt: '' },
    references: [],
  };
}

function compilerFailure(sourcePath: string): StudioCompileIssue {
  return {
    code: 'COMPILER_FAILURE',
    message: 'The article could not be compiled.',
    sourcePath,
    line: 1,
    column: 1,
  };
}
