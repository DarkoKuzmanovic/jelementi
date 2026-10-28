import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';
import { svelteTestPlugin } from './apps/web/vitest.config';

export default defineConfig({
  plugins: [svelteTestPlugin],
  resolve: { alias: { $lib: fileURLToPath(new URL('./apps/web/src/lib', import.meta.url)) } },
  test: {
    environment: 'node',
    include: [
      'packages/**/*.{test,spec}.ts',
      'apps/**/*.{test,spec}.ts',
      'scripts/**/*.{test,spec}.ts',
    ],
    // Browser acceptance seams run under Playwright, never Vitest. Their
    // spec files use @playwright/test's own runner and browser fixtures.
    exclude: [...configDefaults.exclude, 'apps/web/tests/reader-acceptance/**'],
  },
});
