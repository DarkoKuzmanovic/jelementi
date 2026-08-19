import { expect, test } from '@playwright/test';

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
  if (retryable) {
    await expect(tryAgain).toHaveAttribute('href', '/');
    await expect(
      page.getByText('Try again. If the problem continues, use another route.'),
    ).toBeVisible();
  } else {
    await expect(tryAgain).toHaveCount(0);
    await expect(page.getByText('Use another route to continue reading.')).toBeVisible();
  }
});
