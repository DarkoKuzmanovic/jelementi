import type { LayoutServerLoad } from './$types';
import { requireStudioAccess } from '$lib/server/studio/request-guard.server';

export const prerender = false;
export const csr = false;

export const load: LayoutServerLoad = async ({ request, platform, url }) => {
  // THROWAWAY PROTOTYPE: locally expose only the inert home mockup route.
  if (import.meta.env.DEV && url?.pathname === '/studio/prototype-home') return {};

  await requireStudioAccess({ request, platform });
  return {};
};
