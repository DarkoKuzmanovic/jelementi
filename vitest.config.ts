import { defineConfig } from 'vitest/config';
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
  },
});
