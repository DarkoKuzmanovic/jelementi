import { fileURLToPath } from 'node:url';
import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// The Studio browser acceptance seam (#73) runs the real dev server against
// a separate, fixture-only Wrangler configuration (deterministic fake
// GitHub/probe/identity bindings) instead of the real one — selected ONLY
// when `STUDIO_ACCEPTANCE_MODE` is set, so ordinary `pnpm dev`/production
// builds keep using the real root `wrangler.jsonc` exactly as before.
const acceptancePlatformProxy =
  process.env.STUDIO_ACCEPTANCE_MODE === '1'
    ? { configPath: fileURLToPath(new URL('./wrangler.acceptance.jsonc', import.meta.url)) }
    : undefined;

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ fallback: 'spa', platformProxy: acceptancePlatformProxy }),
    csrf: {
      trustedOrigins: [],
    },
    prerender: {
      // The #98 Reader shell links to the static Categories index, which the
      // #99 slice implements. Until then the crawl hits the expected 404 once;
      // tolerate exactly that path and fail closed on every other prerender
      // error so no real regression can slip through the build.
      handleHttpError: ({ path, message }) => {
        if (path === '/categories') return;
        throw new Error(message);
      },
    },
  },
};

export default config;
