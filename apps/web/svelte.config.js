import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ fallback: 'spa' }),
    csrf: {
      trustedOrigins: [],
    },
    prerender: {
      // Series routes legitimately have no entries in a catalog without series.
      handleUnseenRoutes: ({ routes, message }) => {
        if (routes.some((route) => !route.startsWith('/(reader)/series/')))
          throw new Error(message);
      },
    },
  },
};

export default config;
