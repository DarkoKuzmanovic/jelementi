import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { GithubReadAdapter } from '../../lib/server/studio/github-adapter';
import { getStudioConfig } from '../../lib/server/studio/config.server';
import {
  deriveStudioArticleList,
  deriveStudioArticleStatus,
} from '../../lib/server/studio/lifecycle.server';
import {
  isStudioAcceptanceMode,
  STUDIO_ACCEPTANCE_FLOWBOARD_HEADER,
} from '../../lib/server/studio/acceptance-bootstrap.server';
import {
  requireStudioAccess,
  requireStudioMutation,
} from '../../lib/server/studio/request-guard.server';
import {
  buildStudioFlowboard,
  type StudioFlowboardProjection,
} from '../../lib/studio/flowboard-projection';
import type { StudioLifecycle } from '../../lib/studio/contracts';

export const prerender = false;
export const csr = true;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
type StudioLocals = { studioGithubAdapter?: GithubReadAdapter };

function loadConfig(platform: App.Platform | undefined) {
  try {
    return getStudioConfig(platform?.env);
  } catch {
    error(503, 'Studio article list unavailable.');
  }
}

async function deriveFlowboard(
  adapter: GithubReadAdapter,
  platform: App.Platform | undefined,
  checked?: StudioLifecycle,
): Promise<StudioFlowboardProjection> {
  const config = loadConfig(platform);
  const result = await deriveStudioArticleList(adapter, {
    productionOrigin: config.productionOrigin,
    mediaBaseUrl: config.mediaBaseUrl,
  });
  if (!result.ok) error(503, 'Studio article list unavailable.');
  return buildStudioFlowboard(result.value, checked);
}

export const load: PageServerLoad<{ flowboard: StudioFlowboardProjection }> = async ({
  request,
  platform,
  locals,
}) => {
  await requireStudioAccess({ request, platform });

  const adapter = (locals as StudioLocals).studioGithubAdapter;
  if (adapter === undefined) error(503, 'Studio article list unavailable.');

  if (
    isStudioAcceptanceMode(platform?.env) &&
    request.headers.get(STUDIO_ACCEPTANCE_FLOWBOARD_HEADER) === 'empty'
  ) {
    return { flowboard: buildStudioFlowboard([]) };
  }

  return { flowboard: await deriveFlowboard(adapter, platform) };
};

export const actions: Actions = {
  check: async (event) => {
    await requireStudioMutation({ request: event.request, platform: event.platform });
    const form = await event.request.formData();
    const slug = form.get('slug');
    if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug)) {
      error(400, 'Invalid Check status request.');
    }

    const adapter = (event.locals as StudioLocals).studioGithubAdapter;
    if (adapter === undefined) error(503, 'Studio status unavailable.');
    const config = loadConfig(event.platform);
    const self = (event.platform?.env as { SELF?: { fetch: typeof globalThis.fetch } } | undefined)
      ?.SELF;
    if (self === undefined || typeof self.fetch !== 'function') {
      error(503, 'Studio status unavailable.');
    }

    const status = await deriveStudioArticleStatus(adapter, slug, {
      productionOrigin: config.productionOrigin,
      mediaBaseUrl: config.mediaBaseUrl,
      includeProbe: true,
      probeOptions: { fetch: self.fetch.bind(self) as typeof globalThis.fetch },
    });
    const flowboard = await deriveFlowboard(
      adapter,
      event.platform,
      status.ok ? status.value : undefined,
    );
    return { flowboard, checkedSlug: slug };
  },
};
