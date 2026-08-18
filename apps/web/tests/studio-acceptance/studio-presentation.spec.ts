import { expect, test } from '@playwright/test';
import {
  STUDIO_ACCEPTANCE_IDENTITY_HEADER,
  STUDIO_ACCEPTANCE_IDENTITY_TOKEN,
} from '../../src/lib/server/studio/request-guard.server';

/**
 * Studio browser acceptance seam (#73).
 *
 * Every test here runs under both Playwright projects declared in
 * playwright.config.ts — one bundled headless Chromium project with
 * ordinary JS enabled, and a second with JS disabled. Every Studio route
 * has `csr = false` today (no client JS at all), so both projects are
 * expected to behave identically; running the same assertions under both
 * is itself part of the proof that ordinary no-JS navigation and form
 * submission work, not just the JS-enabled path.
 *
 * Locators are semantic only (role/label/text) — never CSS classes, pixel
 * positions, or screenshots.
 */

// Mirrors `acceptance-bootstrap.server.ts`'s `STUDIO_ACCEPTANCE_ARTICLE_SLUG`
// / `STUDIO_ACCEPTANCE_ARTICLE_TITLE`. Kept as plain literals here rather
// than imported directly: that module's import chain pulls in
// `@jelementi/content-compiler`, unnecessary weight/risk for this
// Node-based (non-Vite) Playwright process. Keep in sync if either changes.
const ARTICLE_SLUG = 'lighthouse-watch';
const ARTICLE_TITLE = 'The Lighthouse Watch';

test.beforeEach(async ({ page }) => {
  // Every request — including the initial navigation — must carry the
  // bounded acceptance identity so `requireStudioAccess`/`requireStudioMutation`
  // (request-guard.server.ts) grant access without exercising the real
  // Cloudflare Access flow.
  await page.setExtraHTTPHeaders({
    [STUDIO_ACCEPTANCE_IDENTITY_HEADER]: STUDIO_ACCEPTANCE_IDENTITY_TOKEN,
  });
});

test.describe('representative saved-and-ready article route', () => {
  test('renders the real protected route with both lifecycle axes', async ({ page }) => {
    const response = await page.goto(`/studio/articles/${ARTICLE_SLUG}`);
    expect(response?.status()).toBe(200);

    await expect(page.getByRole('heading', { name: ARTICLE_TITLE, level: 2 })).toBeVisible();

    // Published version and Working change stay editorially separate
    // (two-axis lifecycle model) — both plain-language facts are present
    // at once for this representative draft.
    await expect(page.getByText('Published version')).toBeVisible();
    await expect(page.getByText('Not published')).toBeVisible();
    await expect(page.getByText('Working change')).toBeVisible();
    await expect(page.getByText('Ready to publish', { exact: true })).toBeVisible();
  });

  test('opens the Evidence disclosure and shows sanitized evidence rows', async ({ page }) => {
    await page.goto(`/studio/articles/${ARTICLE_SLUG}`);

    // Native <details>/<summary> — no JS required to open it.
    await page.getByText('Evidence', { exact: true }).click();
    await expect(page.getByText('Studio branch')).toBeVisible();
    await expect(page.getByText('Base version')).toBeVisible();
  });

  test('shows visible keyboard focus on an interactive control', async ({ page }) => {
    await page.goto(`/studio/articles/${ARTICLE_SLUG}`);

    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
    const outlineStyle = await focused.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outlineStyle).not.toBe('none');
  });
});

test.describe('ordinary form submission', () => {
  test('saves the draft through a plain full-navigation form POST', async ({ page }) => {
    await page.goto(`/studio/articles/${ARTICLE_SLUG}`);

    await page.getByLabel('Body').fill('An updated deterministic paragraph of acceptance copy.');
    await page.getByRole('button', { name: 'Save draft' }).click();

    await expect(page.getByRole('heading', { name: 'Studio draft saved' })).toBeVisible();
  });
});

test.describe('deterministic fake probe transport', () => {
  // Production probe construction still requires the SELF service binding
  // and fails closed (503) when absent (ADR-0007); that path is proven by
  // the existing unit test 'refresh fails closed when the SELF probe
  // binding is absent'. This test proves the OTHER half of that same AC
  // bullet: the acceptance harness supplies a working deterministic fake
  // SELF, so Refresh (Check status) does not 503 here either.
  test('Refresh completes through the fake probe transport instead of failing closed', async ({
    page,
  }) => {
    await page.goto(`/studio/articles/${ARTICLE_SLUG}`);

    // Wait for the POST response itself rather than a navigation event:
    // since #77 opted this route into CSR, SvelteKit's hydrated router
    // emits a same-document history update that `waitForNavigation` would
    // resolve on with no response at all.
    const responsePromise = page.waitForResponse(
      (candidate) => candidate.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Refresh' }).click();
    const response = await responsePromise;

    expect(response.status()).toBe(200);
    await expect(page.getByRole('heading', { name: ARTICLE_TITLE, level: 2 })).toBeVisible();
  });
});
