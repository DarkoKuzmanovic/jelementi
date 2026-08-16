import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
  loadStudioEditorPage,
  previewStudioEditorAction,
  saveStudioEditorAction,
  type StudioEditorRouteEvent,
} from '../../../../lib/server/studio/editor-route.server';
import type { StudioEditorData } from '../../../../lib/server/studio/editor.server';
import { getStudioConfig } from '../../../../lib/server/studio/config.server';
import { deriveStudioArticleStatus } from '../../../../lib/server/studio/lifecycle.server';
import {
  publishStudioDraft,
  type StudioPublishResult,
} from '../../../../lib/server/studio/publish.server';
import { requireStudioMutation } from '../../../../lib/server/studio/request-guard.server';
import type {
  GithubPublishAdapter,
  GithubReadAdapter,
} from '../../../../lib/server/studio/github-adapter';
import type { StudioLifecycle } from '../../../../lib/studio/contracts';

export const prerender = false;
export const csr = false;

const MAX_SLUG_LENGTH = 100;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA_PATTERN = /^[0-9a-f]{40,64}$/i;

export interface StudioPublishActionData {
  publish: StudioPublishResult;
}

export interface StudioRefreshActionData {
  status: StudioLifecycle;
}

/**
 * Loads the editor AND the article's current lifecycle status. This is an
 * ordinary page load — it re-reads GitHub but never probes production
 * (`includeProbe: false`); only the explicit `refresh` action re-runs
 * probes. Never background polling (spec).
 */
export const load: PageServerLoad<{ editor: StudioEditorData; status: StudioLifecycle }> = async (
  event,
) => {
  const routeEvent = eventForEditorRoute(event);
  const editor = await loadStudioEditorPage(routeEvent, event.params.slug);

  const adapter = routeEvent.locals.studioGithubAdapter as GithubReadAdapter | undefined;
  if (adapter === undefined) error(503, 'Studio status unavailable.');

  const config = loadConfig(event.platform);
  const status = await deriveStudioArticleStatus(adapter, event.params.slug, {
    productionOrigin: config.productionOrigin,
    mediaBaseUrl: config.mediaBaseUrl,
    includeProbe: false,
  });
  if (!status.ok) error(503, 'Studio status unavailable.');

  return { ...editor, status: status.value };
};

export const actions: Actions = {
  preview: (event) => previewStudioEditorAction(eventForEditorRoute(event), event.params.slug),
  save: (event) => saveStudioEditorAction(eventForEditorRoute(event), event.params.slug),

  /**
   * Explicit, head-bound approval (ADR-0004): revalidates the exact
   * committed draft, flips the Draft PR ready, and enables auto-merge only
   * for the head SHA the operator last saw. `expectedHeadSha` is a hidden
   * field the editor itself renders from the loaded status — a malformed
   * value indicates a client bug, not a normal validation failure.
   */
  publish: async (event) => {
    await requireStudioMutation({ request: event.request, platform: event.platform });
    if (!isStudioSlug(event.params.slug)) error(400, 'Invalid article slug.');

    const adapter = (event.locals as { studioGithubAdapter?: GithubPublishAdapter })
      .studioGithubAdapter;
    if (adapter === undefined) error(503, 'Studio publish unavailable.');
    const config = loadConfig(event.platform, 'Studio publish unavailable.');

    const form = await event.request.formData();
    const expectedHeadSha = form.get('expectedHeadSha');
    if (typeof expectedHeadSha !== 'string' || !SHA_PATTERN.test(expectedHeadSha)) {
      error(400, 'Invalid publish request.');
    }

    const publish = await publishStudioDraft(adapter, event.params.slug, expectedHeadSha, {
      mediaBaseUrl: config.mediaBaseUrl,
    });
    const result: StudioPublishActionData = { publish };
    return result;
  },

  /**
   * Refresh re-reads GitHub AND re-runs the production probes — the only
   * path to `live`. There is no background polling; this is the sole
   * trigger for `includeProbe: true` (spec).
   */
  refresh: async (event) => {
    await requireStudioMutation({ request: event.request, platform: event.platform });
    if (!isStudioSlug(event.params.slug)) error(400, 'Invalid article slug.');

    const adapter = (event.locals as { studioGithubAdapter?: GithubReadAdapter })
      .studioGithubAdapter;
    if (adapter === undefined) error(503, 'Studio status unavailable.');
    const config = loadConfig(event.platform);

    const status = await deriveStudioArticleStatus(adapter, event.params.slug, {
      productionOrigin: config.productionOrigin,
      mediaBaseUrl: config.mediaBaseUrl,
      includeProbe: true,
    });
    if (!status.ok) error(503, 'Studio status unavailable.');
    const result: StudioRefreshActionData = { status: status.value };
    return result;
  },
};

function loadConfig(
  platform: App.Platform | undefined,
  unavailableMessage = 'Studio status unavailable.',
): ReturnType<typeof getStudioConfig> {
  try {
    return getStudioConfig(platform?.env);
  } catch {
    error(503, unavailableMessage);
  }
}

function eventForEditorRoute(event: {
  request: Request;
  platform?: App.Platform;
  locals: App.Locals;
}): StudioEditorRouteEvent {
  return {
    request: event.request,
    platform: event.platform,
    locals: event.locals as Record<string, unknown>,
  };
}

function isStudioSlug(value: string): boolean {
  return value.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(value);
}
