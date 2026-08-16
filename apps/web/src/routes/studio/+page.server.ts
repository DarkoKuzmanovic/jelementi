import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { GithubReadAdapter } from '../../lib/server/studio/github-adapter';
import { getStudioConfig } from '../../lib/server/studio/config.server';
import { deriveStudioArticleList } from '../../lib/server/studio/lifecycle.server';
import type { StudioArticleListEntry } from '../../lib/studio/contracts';
import { requireStudioAccess } from '$lib/server/studio/request-guard.server';

export const prerender = false;
export const csr = false;

type StudioLocals = { studioGithubAdapter?: GithubReadAdapter };

export const load: PageServerLoad<{ articles: StudioArticleListEntry[] }> = async ({
  request,
  platform,
  locals,
}) => {
  await requireStudioAccess({ request, platform });

  const adapter = (locals as StudioLocals).studioGithubAdapter;
  if (adapter === undefined) error(503, 'Studio article list unavailable.');

  let productionOrigin: string;
  try {
    productionOrigin = getStudioConfig(platform?.env).productionOrigin;
  } catch {
    error(503, 'Studio article list unavailable.');
  }

  const result = await deriveStudioArticleList(adapter, { productionOrigin });
  if (!result.ok) error(503, 'Studio article list unavailable.');
  return { articles: result.value };
};
