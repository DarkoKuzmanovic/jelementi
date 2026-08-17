import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type UserConfig } from 'vite';

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

/**
 * The Studio browser acceptance seam (#73) needs `PRODUCTION_ORIGIN` origin
 * matching (`checkStudioOrigin`, request-guard.server.ts) to succeed for its
 * loopback dev server, and `getStudioConfig` requires `PRODUCTION_ORIGIN` to
 * be a real `https:` URL — a plain http loopback origin can never satisfy
 * both at once. Rather than weaken that production validator for test
 * convenience, the acceptance dev server itself serves over HTTPS using a
 * throwaway self-signed loopback certificate generated fresh per run (never
 * committed, never reused across runs). Playwright's browser contexts
 * accept it via `ignoreHTTPSErrors`. Only active when `STUDIO_ACCEPTANCE_MODE`
 * is set — ordinary `pnpm dev`/production builds never take this path.
 */
function studioAcceptanceServerOptions(): UserConfig['server'] {
  if (process.env.STUDIO_ACCEPTANCE_MODE !== '1') return undefined;
  const dir = mkdtempSync(join(tmpdir(), 'studio-acceptance-cert-'));
  const keyPath = join(dir, 'key.pem');
  const certPath = join(dir, 'cert.pem');
  execFileSync('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-keyout',
    keyPath,
    '-out',
    certPath,
    '-days',
    '1',
    '-subj',
    '/CN=127.0.0.1',
    '-addext',
    'subjectAltName=IP:127.0.0.1',
  ]);
  return { https: { cert: readFileSync(certPath), key: readFileSync(keyPath) } };
}

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    alias: { yaml: yamlBrowserBuild },
  },
  server: studioAcceptanceServerOptions(),
});
