import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireStudioAccess } from '$lib/server/studio/request-guard.server';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const prerender = false;
export const csr = false;

export const load: PageServerLoad = async ({ params, request, platform }) => {
  await requireStudioAccess({ request, platform });

  const slug = params.slug;
  if (!SLUG_PATTERN.test(slug)) {
    error(400, 'Invalid article slug.');
  }
  return { slug };
};
