import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
  loadStudioEditorPage,
  previewStudioEditorAction,
  replaceStudioEditorAction,
  saveStudioEditorAction,
  type StudioEditorRouteEvent,
} from '../../../../lib/server/studio/editor-route.server';
import {
  decodeStudioFormData,
  reconstructStudioPreviewInput,
  verifyStudioPublishCandidate,
  type StudioEditorData,
  type StudioPreviewInput,
} from '../../../../lib/server/studio/editor.server';
import { getStudioConfig } from '../../../../lib/server/studio/config.server';
import { isStudioAcceptanceMode } from '../../../../lib/server/studio/acceptance-bootstrap.server';
import { studioEditorialAcceptanceMediaFetch } from '../../../../lib/server/studio/editorial-acceptance-media.server';
import { deriveStudioArticleStatus } from '../../../../lib/server/studio/lifecycle.server';
import {
  publishStudioDraft,
  type StudioPublishResult,
} from '../../../../lib/server/studio/publish.server';
import {
  unpublishStudioArticle,
  type StudioUnpublishResult,
} from '../../../../lib/server/studio/unpublish.server';
import {
  discardStudioDraft,
  type StudioDiscardResult,
} from '../../../../lib/server/studio/discard.server';
import { requireStudioMutation } from '../../../../lib/server/studio/request-guard.server';
import type {
  GithubAdapter,
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
  editor?: StudioPreviewInput;
}

export interface StudioRefreshActionData {
  status: StudioLifecycle;
}

export interface StudioUnpublishActionData {
  unpublish: StudioUnpublishResult;
}

export interface StudioDiscardActionData {
  discard: StudioDiscardResult;
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
  replace: (event) => replaceStudioEditorAction(eventForEditorRoute(event), event.params.slug),

  /**
   * Publish saved version submits the complete bounded editor candidate as
   * an ordinary form. Before the unchanged exact-head Publish service runs,
   * this route proves that candidate serializes byte-for-byte to the draft
   * committed at `expectedHeadSha`. Malformed or newer form content is
   * preserved for correction and rejected without a GitHub mutation.
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

    const decoded = decodeStudioFormData(form);
    const submitted = decoded.ok
      ? { metadata: decoded.value.metadata, body: decoded.value.body }
      : reconstructStudioPreviewInput(form);
    submitted.metadata.slug = event.params.slug;
    if (!decoded.ok || decoded.value.metadata.slug !== event.params.slug) {
      return { publish: unsavedEditorChanges(event.params.slug), editor: submitted };
    }

    const verification = await verifyStudioPublishCandidate(
      adapter,
      event.params.slug,
      expectedHeadSha,
      submitted,
    );
    if (verification.kind === 'candidate_rejected') {
      return { publish: unsavedEditorChanges(event.params.slug), editor: submitted };
    }
    if (verification.kind === 'candidate_conflict') {
      return {
        publish: {
          kind: 'publish_conflict',
          expectedHeadSha,
          currentHeadSha: verification.currentHeadSha,
        },
        editor: submitted,
      };
    }
    if (verification.kind === 'candidate_failed') {
      return {
        publish: { kind: 'publish_failed', phase: 'revalidate', reason: 'github' },
        editor: submitted,
      };
    }

    const publish = await publishStudioDraft(adapter, event.params.slug, expectedHeadSha, {
      mediaBaseUrl: config.mediaBaseUrl,
      ...(isStudioAcceptanceMode(event.platform?.env)
        ? { fetch: studioEditorialAcceptanceMediaFetch }
        : {}),
    });
    const result: StudioPublishActionData = { publish, editor: submitted };
    return result;
  },

  /**
   * Refresh re-reads GitHub AND re-runs the production probes — the only
   * path to `live` and to proven `archived` absence. There is no background
   * polling; this is the sole trigger for `includeProbe: true` (spec).
   */
  refresh: async (event) => {
    await requireStudioMutation({ request: event.request, platform: event.platform });
    if (!isStudioSlug(event.params.slug)) error(400, 'Invalid article slug.');

    const adapter = (event.locals as { studioGithubAdapter?: GithubReadAdapter })
      .studioGithubAdapter;
    if (adapter === undefined) error(503, 'Studio status unavailable.');
    const config = loadConfig(event.platform);

    // Production probes MUST go through the Worker's self service binding
    // (issue #56): a plain fetch of the production origin from inside the
    // production Worker is a same-zone subrequest, which Cloudflare routes
    // past the worker route to the (nonexistent) zone origin — the probe
    // would never observe the deployed site. The binding proves the current
    // deployment's full worker+assets serving path. Absent binding fails
    // closed: falling back to a zone fetch would silently report
    // pending_deployment forever.
    const self = (event.platform?.env as { SELF?: { fetch: typeof globalThis.fetch } } | undefined)
      ?.SELF;
    if (self === undefined || typeof self.fetch !== 'function') {
      error(503, 'Studio status unavailable.');
    }
    const probeFetch = self.fetch.bind(self) as typeof globalThis.fetch;

    const status = await deriveStudioArticleStatus(adapter, event.params.slug, {
      productionOrigin: config.productionOrigin,
      mediaBaseUrl: config.mediaBaseUrl,
      includeProbe: true,
      probeOptions: { fetch: probeFetch },
    });
    if (!status.ok) error(503, 'Studio status unavailable.');
    const result: StudioRefreshActionData = { status: status.value };
    return result;
  },

  /**
   * Unpublish archives the currently published canonical article: an archive
   * commit changing only the frontmatter `status` to `archived` is carried
   * through the same one-draft topology as Publish, then the sole Draft PR
   * is flipped ready and auto-merge is enabled bound to that exact archive
   * head. The operator must type the exact slug — anything else fails closed
   * before any GitHub access. Production absence is only ever proven later
   * by an explicit Refresh.
   */
  unpublish: async (event) => {
    await requireStudioMutation({ request: event.request, platform: event.platform });
    if (!isStudioSlug(event.params.slug)) error(400, 'Invalid article slug.');

    const form = await event.request.formData();
    if (form.get('confirmation') !== event.params.slug) {
      error(400, 'Invalid unpublish request.');
    }

    const adapter = (event.locals as { studioGithubAdapter?: GithubPublishAdapter })
      .studioGithubAdapter;
    if (adapter === undefined) error(503, 'Studio unpublish unavailable.');
    const config = loadConfig(event.platform, 'Studio unpublish unavailable.');

    const unpublish = await unpublishStudioArticle(adapter, event.params.slug, {
      mediaBaseUrl: config.mediaBaseUrl,
    });
    const result: StudioUnpublishActionData = { unpublish };
    return result;
  },

  /**
   * Discard closes the article's sole open Draft PR — including a ready,
   * checking, or check_failed approval — and deletes only its Studio branch
   * after the operator types the exact slug and submits the branch head they
   * last saw. The branch is deleted only while its head still equals that
   * expected head; `main` is never touched.
   */
  discard: async (event) => {
    await requireStudioMutation({ request: event.request, platform: event.platform });
    if (!isStudioSlug(event.params.slug)) error(400, 'Invalid article slug.');

    const form = await event.request.formData();
    if (form.get('confirmation') !== event.params.slug) {
      error(400, 'Invalid discard request.');
    }
    const expectedHeadSha = form.get('expectedHeadSha');
    if (typeof expectedHeadSha !== 'string' || !SHA_PATTERN.test(expectedHeadSha)) {
      error(400, 'Invalid discard request.');
    }

    const adapter = (event.locals as { studioGithubAdapter?: GithubAdapter }).studioGithubAdapter;
    if (adapter === undefined) error(503, 'Studio discard unavailable.');

    const discard = await discardStudioDraft(adapter, event.params.slug, expectedHeadSha);
    const result: StudioDiscardActionData = { discard };
    return result;
  },
};

function unsavedEditorChanges(slug: string): StudioPublishResult {
  return {
    kind: 'publish_rejected',
    compileIssues: [
      {
        code: 'UNSAVED_EDITOR_CHANGES',
        message: 'Save the current form before publishing.',
        sourcePath: `content/articles/${slug}.md`,
      },
    ],
  };
}

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
