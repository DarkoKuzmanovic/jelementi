import { expect, test, type Page } from '@playwright/test';
import { expectNoBlockingAccessibilityViolations } from './accessibility';

const recoveryDestinations = [
  { name: 'Home', href: '/' },
  { name: 'Search', href: '/search' },
  { name: 'Categories', href: '/categories' },
] as const;

async function expectRecovery(page: Page): Promise<void> {
  const recovery = page.getByRole('navigation', { name: 'Page recovery' });
  await expect(recovery).toBeVisible();
  for (const destination of recoveryDestinations) {
    await expect(
      recovery.getByRole('link', { name: destination.name, exact: true }),
    ).toHaveAttribute('href', destination.href);
  }
  await expect(recovery.getByRole('link')).toHaveCount(3);
  await expect(page.getByRole('link', { name: 'Try again' })).toHaveCount(0);
}

async function expectAccessibleInLightAndDark(page: Page): Promise<void> {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await expectNoBlockingAccessibilityViolations(page);
  }
}

test('About is compact and factual without invented ownership or contact details', async ({
  page,
}, testInfo) => {
  const response = await page.goto('/about');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: 'About Jelementi' })).toBeVisible();
  await expect(page.getByText(/small publication for curious readers/i)).toBeVisible();
  await expect(page.getByText(/carefully edited stories/i)).toBeVisible();
  await expect(page.getByText(/researched, edited for clarity/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Publication details' })).toHaveCount(0);
  await expect(page.locator('a[href^="mailto:"], a[href^="tel:"]')).toHaveCount(0);
  if (!testInfo.project.name.includes('no-js')) await expectAccessibleInLightAndDark(page);
});

test('unknown routes, missing articles, and missing categories return truthful normal-shell 404s', async ({
  page,
}, testInfo) => {
  for (const route of [
    '/unknown-reader-acceptance-route',
    '/articles/missing-reader-acceptance-article',
    '/categories/missing-reader-acceptance-category',
  ]) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(404);
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('contentinfo')).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 1, name: 'This page is not available.' }),
    ).toBeVisible();
    await expect(
      page.getByText('The address may be incorrect, or the page may have moved.'),
    ).toBeVisible();
    await expectRecovery(page);
    if (!testInfo.project.name.includes('no-js')) await expectAccessibleInLightAndDark(page);
  }
});

test('About and recovery reflow under narrow, text-resize, and text-spacing stress', async ({
  page,
}, testInfo) => {
  // addStyleTag requires page scripting; the no-JavaScript project proves the
  // same routes and 320 px layout separately without this synthetic stress.
  if (testInfo.project.name.includes('no-js')) test.skip();
  const cdp = await page.context().newCDPSession(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/articles/missing-reader-acceptance-article');
  await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 4 });
  expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(4);
  await expect(page.getByRole('main')).toBeVisible();
  await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });

  await page.setViewportSize({ width: 320, height: 800 });
  for (const route of ['/about', '/articles/missing-reader-acceptance-article']) {
    await page.goto(route);
    await page.addStyleTag({
      content: `
        html { font-size: 200% !important; }
        * { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
      `,
    });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, route).toBeLessThanOrEqual(1);
    await expect(page.getByRole('main')).toBeVisible();
  }
});
