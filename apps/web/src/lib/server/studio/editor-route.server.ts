import { error } from '@sveltejs/kit';
import {
  decodeStudioFormData,
  loadNewStudioEditor,
  loadStudioEditor,
  previewFromEditorInput,
  reconstructStudioPreviewInput,
} from './editor.server';
import { getStudioConfig } from './config.server';
import type { GithubReadAdapter } from './github-adapter';
import { requireStudioAccess, requireStudioMutation } from './request-guard.server';
import type { StudioEditorData, StudioPreviewInput } from './editor.server';
import type { StudioPreviewResult } from '../../studio/contracts';

const MAX_SLUG_LENGTH = 100;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface StudioEditorRouteEvent {
  request: Request;
  platform: App.Platform | undefined;
  locals: Record<string, unknown>;
}

export interface StudioPreviewActionData {
  preview: StudioPreviewResult;
  editor?: StudioPreviewInput;
}

export async function loadNewStudioEditorPage(
  event: StudioEditorRouteEvent,
): Promise<{ editor: StudioEditorData }> {
  await requireStudioAccess(event);
  const adapter = event.locals.studioGithubAdapter as GithubReadAdapter | undefined;
  if (adapter === undefined) error(503, 'Studio editor unavailable.');
  const loaded = await loadNewStudioEditor(adapter);
  if (!loaded.ok) error(503, 'Studio editor unavailable.');
  return { editor: loaded.value };
}

export async function loadStudioEditorPage(
  event: StudioEditorRouteEvent,
  slug: string,
): Promise<{ editor: StudioEditorData }> {
  await requireStudioAccess(event);
  if (!isStudioSlug(slug)) error(400, 'Invalid article slug.');

  const adapter = event.locals.studioGithubAdapter as GithubReadAdapter | undefined;
  if (adapter === undefined) error(503, 'Studio editor unavailable.');

  const loaded = await loadStudioEditor(adapter, slug);
  if (!loaded.ok) {
    if (loaded.failure.reason === 'not-found') error(404, 'Studio article not found.');
    error(503, 'Studio editor unavailable.');
  }
  return { editor: loaded.value };
}

export async function previewStudioEditorAction(
  event: StudioEditorRouteEvent,
  expectedSlug?: string,
): Promise<StudioPreviewActionData> {
  await requireStudioMutation(event);
  if (expectedSlug !== undefined && !isStudioSlug(expectedSlug)) {
    error(400, 'Invalid article slug.');
  }
  let mediaBaseUrl: string;
  try {
    mediaBaseUrl = getStudioConfig(event.platform?.env).mediaBaseUrl;
  } catch {
    error(503, 'Studio preview unavailable.');
  }

  const form = await event.request.formData();
  const decoded = decodeStudioFormData(form);
  if (!decoded.ok) {
    return invalidFormPreview(form, expectedSlug);
  }
  if (expectedSlug !== undefined && decoded.value.metadata.slug !== expectedSlug) {
    const submitted = reconstructStudioPreviewInput(form);
    return {
      preview: immutableSlugPreview(expectedSlug),
      editor: {
        metadata: { ...submitted.metadata, slug: expectedSlug },
        body: submitted.body,
      },
    };
  }
  return {
    preview: previewFromEditorInput(decoded.value, { mediaBaseUrl }),
    editor: { metadata: decoded.value.metadata, body: decoded.value.body },
  };
}

function invalidFormPreview(form: FormData, expectedSlug?: string): StudioPreviewActionData {
  const submitted = reconstructStudioPreviewInput(form);
  const submittedSlug = form.get('slug');
  const slug =
    expectedSlug ??
    (typeof submittedSlug === 'string' && isStudioSlug(submittedSlug)
      ? submittedSlug
      : 'new-article');
  if (expectedSlug !== undefined) submitted.metadata.slug = expectedSlug;
  return {
    preview: {
      kind: 'preview_issues',
      compileIssues: [
        {
          code: 'INVALID_EDITOR_INPUT',
          message: 'Review the article fields and try again.',
          sourcePath: `content/articles/${slug}.md`,
          line: 1,
          column: 1,
        },
      ],
    },
    editor: submitted,
  };
}

function isStudioSlug(value: string): boolean {
  return value.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(value);
}

function immutableSlugPreview(expectedSlug: string): StudioPreviewResult {
  return {
    kind: 'preview_issues',
    compileIssues: [
      {
        code: 'SLUG_IMMUTABLE',
        message: 'The slug cannot change after the first saved draft.',
        sourcePath: `content/articles/${expectedSlug}.md`,
        line: 1,
        column: 1,
      },
    ],
  };
}
