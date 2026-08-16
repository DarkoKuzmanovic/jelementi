import type { LayoutServerLoad } from './$types';
import { requireStudioAccess } from '$lib/server/studio/request-guard.server';

export const prerender = false;
export const csr = false;

export const load: LayoutServerLoad = async ({ request, platform }) => {
  await requireStudioAccess({ request, platform });
  return {};
};
