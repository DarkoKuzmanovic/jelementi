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
  },
};

export default config;
