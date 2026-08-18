import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const rootPackageJson = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
) as { scripts?: Record<string, string> };

const browserGate = rootPackageJson.scripts?.['test:studio:browser'] ?? '';
const verifyDeploy = rootPackageJson.scripts?.['verify:deploy'] ?? '';

/**
 * Studio browser acceptance seam (#73) — provisioning contract.
 *
 * Regression lock for the Workers Builds failure where the 10 acceptance
 * tests died before execution because no Chromium revision existed in the
 * build cache (`chromium_headless_shell-1234` missing). GitHub CI only
 * survived because its workflow runs `playwright install --with-deps
 * chromium` as a one-off step; Workers Builds runs `pnpm verify:deploy`
 * alone, and @playwright/test ships no postinstall for pnpm to run (the
 * dependency-build allowlist can only unblock scripts that exist).
 *
 * The owning boundary is the browser gate itself: the command that
 * consumes the browser must provision it first, aligned to the installed
 * @playwright/test version by construction (`playwright install chromium`
 * downloads exactly the revision pinned in playwright-core's
 * browsers.json). If this chain is ever reverted, reordered, or weakened
 * to a non-short-circuiting separator, the gate regresses to failing in
 * clean environments — this test goes red first.
 */
describe('Studio browser acceptance provisioning seam', () => {
  it('keeps the required browser gate inside the canonical verify:deploy chain', () => {
    // Exact && -segment so a non-executing mention (e.g. `echo
    // test:studio:browser`) cannot satisfy the check.
    expect(verifyDeploy.split(' && ')).toContain('pnpm test:studio:browser');
  });

  it('provisions the version-aligned Chromium before launching the tests', () => {
    // `&&` chaining is load-bearing: `;` or `||` would let the tests launch
    // after a failed download and reproduce the missing-browser failure.
    const segments = browserGate.split(' && ');
    expect(segments[0]).toBe('playwright install chromium');
    expect(segments.slice(1)).toContain('playwright test -c apps/web/playwright.config.ts');
  });
});
