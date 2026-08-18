import { configDefaults, defineConfig } from 'vitest/config';
import { svelteTestPlugin } from './apps/web/vitest.config';

export default defineConfig({
  plugins: [svelteTestPlugin],
  test: {
    environment: 'node',
    include: [
      'packages/**/*.{test,spec}.ts',
      'apps/**/*.{test,spec}.ts',
      'scripts/**/*.{test,spec}.ts',
    ],
    // Studio's browser acceptance seam runs under the Playwright test
    // runner (`pnpm test:studio:browser`), never vitest — its spec files
    // use `@playwright/test`'s own `test`/`test.beforeEach`, which vitest
    // cannot execute.
    exclude: [...configDefaults.exclude, 'apps/web/tests/studio-acceptance/**'],
  },
});
