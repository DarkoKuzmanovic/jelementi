import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// The `yaml` package's `node` export condition resolves to its CJS build,
// which the Worker bundle cannot load (workerd is not Node). Alias it to the
// browser ESM build, which is correct for both the client and workerd.
// `yaml` is a dependency of @jelementi/content-compiler, so resolve it from
// that package's context (pnpm's strict layout hides it from this app).
const require = createRequire(import.meta.url);
const compilerRequire = createRequire(require.resolve('@jelementi/content-compiler'));
const yamlBrowserBuild = join(
  dirname(compilerRequire.resolve('yaml/package.json')),
  'browser/index.js',
);

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    alias: { yaml: yamlBrowserBuild },
  },
});
