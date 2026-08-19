import { expect, test } from '@playwright/test';

test('smokes the complete canonical generated Reader inventory independently of fixtures', async ({
  page,
}) => {
  await page.goto('/');
  const firstArticle = page.locator('.article-list a[href^="/articles/"]').first();
  await expect(firstArticle).toBeVisible();
  const title = (await firstArticle.textContent())?.trim();
  if (!title) throw new Error('Canonical Home has no first article title.');
  expect(title).not.toContain('Every Reader Structure');

  await page.goto('/categories');
  await expect(page.getByRole('heading', { level: 1, name: 'Categories' })).toBeVisible();
  await expect(
    page.getByRole('main').getByRole('link', { name: 'History', exact: true }),
  ).toHaveAttribute('href', '/categories/history');
  await expect(page.getByRole('main').getByRole('link', { name: title })).toHaveAttribute(
    'href',
    '/articles/tristan-da-cunha',
  );

  await page.goto('/categories/history');
  await expect(page.getByRole('heading', { level: 1, name: 'History' })).toBeVisible();
  await expect(page.getByRole('link', { name: title })).toBeVisible();

  await page.goto('/articles/tristan-da-cunha');
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sources' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Footnotes' })).toBeVisible();
  await expect(page.locator('meta[name="jelementi-content-version"]')).toHaveCount(1);

  await page.goto('/search');
  await expect(page.getByRole('heading', { level: 1, name: 'Search' })).toBeVisible();
  await expect(page.getByRole('link', { name: title })).toBeVisible();

  await page.goto('/about');
  await expect(page.getByRole('heading', { level: 1, name: 'About Jelementi' })).toBeVisible();

  const notFound = await page.goto('/missing-real-catalog-route');
  expect(notFound?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
