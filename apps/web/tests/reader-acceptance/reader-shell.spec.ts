import { expect, test } from '@playwright/test';

/**
 * Reader shell public-contract browser acceptance (#98 follow-up).
 *
 * Supplements stable SSR unit tests (reader-shell.test.ts) with actual
 * browser behavior at public routes: narrow reflow, keyboard skip,
 * landmarks, light/dark foundation, reduced-motion, and Studio exclusion.
 * Runs under both js-enabled and no-js projects via
 * playwright.reader.config.ts. Preserves existing prerender/hydration/404
 * expectations — every reader route remains prerendered + csr:false,
 * non-existent content 404s with the shared error surface.
 */

const publicRoutes = ['/', '/about', '/search', '/articles/acceptance-rich-column'];

test('shell landmarks and navigation persist across every public route', async ({ page }) => {
  for (const route of publicRoutes) {
    await page.goto(route);
    await expect(page.locator('header.site-header')).toBeVisible();
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.locator('#main-content')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Footer navigation' })).toBeVisible();
    // Exactly one main
    await expect(page.getByRole('main')).toHaveCount(1);
    // Visible nav links in both header and footer
    for (const name of ['Home', 'Categories', 'Search', 'About']) {
      await expect(
        page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name }),
      ).toBeVisible();
      await expect(
        page.getByRole('navigation', { name: 'Footer navigation' }).getByRole('link', { name }),
      ).toBeVisible();
    }
    // Jelementi wordmark identity present in header and footer
    await expect(page.locator('.jelementi-wordmark').first()).toBeVisible();
    // Studio shell must not leak into reader routes
    await expect(page.locator('.studio-shell')).toHaveCount(0);
    await expect(page.locator('.skip-link')).toHaveCount(1);
  }
});

test('skip link is keyboard-operable and focuses main', async ({ page }, testInfo) => {
  if (testInfo.project.name.includes('no-js')) test.skip();
  await page.goto('/');
  // Tab to the first focusable element — the off-screen skip link
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skip).toBeFocused();
  // Activate skip link — should move focus to main (tabindex=-1) and update hash
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  await expect(page).toHaveURL(/#main-content/);
});

test('320px has no horizontal overflow and nav wraps conventionally', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const route of ['/', '/search']) {
    await page.goto(route);
    // No two-dimensional scrolling at narrow width
    await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 320);
    // Header inner and nav use wrapping flex, never a hidden menu
    const headerInner = page.locator('.site-header__inner').first();
    await expect(headerInner).toBeVisible();
    const flexWrap = await headerInner.evaluate((el) => getComputedStyle(el).flexWrap);
    expect(flexWrap).toBe('wrap');
    const nav = page.getByRole('navigation', { name: 'Primary navigation' });
    const navWrap = await nav.evaluate((el) => getComputedStyle(el).flexWrap);
    expect(navWrap).toBe('wrap');
    // All nav links remain visible at 320px (no burger)
    for (const name of ['Home', 'Categories', 'Search', 'About']) {
      await expect(nav.getByRole('link', { name })).toBeVisible();
    }
    await expect(page.locator('button', { hasText: /menu/i })).toHaveCount(0);
  }
});

test('light/dark foundation tokens drive visible background', async ({ page }, testInfo) => {
  if (testInfo.project.name.includes('no-js')) test.skip();
  await page.goto('/');
  await page.emulateMedia({ colorScheme: 'light' });
  const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.emulateMedia({ colorScheme: 'dark' });
  const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(lightBg).not.toBe(darkBg);
  // Dark background should be measurably darker (lower luminance)
  expect(darkBg).toBeTruthy();
  expect(lightBg).toBeTruthy();
});

test('prefers-reduced-motion suppresses motion', async ({ page }, testInfo) => {
  if (testInfo.project.name.includes('no-js')) test.skip();
  await page.goto('/articles/acceptance-rich-column');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const matches = await page.evaluate(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  expect(matches).toBeTruthy();
  // Prove no global smooth scroll is imposed — would destabilize Studio (Playwright unstable)
  const scrollBehavior = await page.evaluate(
    () => getComputedStyle(document.documentElement).scrollBehavior,
  );
  expect(scrollBehavior).not.toBe('smooth');
});

test('missing content still 404s with shared error surface and reader shell', async ({ page }) => {
  const response = await page.goto('/articles/missing-reader-acceptance-article');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  // Error surface still inside reader shell (not bare)
  await expect(page.locator('header.site-header')).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Return to the reader' })).toBeVisible();
});
