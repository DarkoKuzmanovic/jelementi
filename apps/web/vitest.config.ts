import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export const svelteTestPlugin = svelte({
  configFile: fileURLToPath(new URL('./svelte.config.js', import.meta.url)),
});

export default defineConfig({
  plugins: [svelteTestPlugin],
});
