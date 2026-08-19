import { expect, test } from '@playwright/test';
import { expectNoBlockingAccessibilityViolations } from './accessibility';

test('ordinary errors use the normal shell and expose Try again only when retry is meaningful', async ({
  page,
}, testInfo) => {
  const retryable = testInfo.project.name.includes('retryable');
  const response = await page.goto('/');

  expect(response?.status()).toBe(retryable ? 503 : 500);
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('contentinfo')).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 1, name: 'The page could not be loaded.' }),
  ).toBeVisible();
  await expect(page.getByText(/ReaderAcceptanceInternalUnbroken/)).toHaveCount(0);

  const recovery = page.getByRole('navigation', { name: 'Error recovery' });
  await expect(recovery.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute(
    'href',
    '/',
  );
  await expect(recovery.getByRole('link', { name: 'Search', exact: true })).toHaveAttribute(
    'href',
    '/search',
  );
  await expect(recovery.getByRole('link', { name: 'Categories', exact: true })).toHaveAttribute(
    'href',
    '/categories',
  );

  const tryAgain = recovery.getByRole('link', { name: 'Try again' });
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await expectNoBlockingAccessibilityViolations(page);
  }

  if (retryable) {
    await expect(tryAgain).toHaveAttribute('href', '/');
    await expect(
      page.getByText('Try again. If the problem continues, use another route.'),
    ).toBeVisible();
  } else {
    await expect(tryAgain).toHaveCount(0);
    await expect(page.getByText('Use another route to continue reading.')).toBeVisible();
  }

  const cdp = await page.context().newCDPSession(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 4 });
  expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(4);
  await expect(page.getByRole('main')).toBeVisible();
  await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });

  await page.setViewportSize({ width: 320, height: 800 });
  await page.addStyleTag({
    content: `
      html { font-size: 200% !important; }
      * { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
    `,
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
