import { expect, test } from '@playwright/test';

test('loads the representative fixture through the real static Reader routes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Jelementi' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Čačak Field Notes: Every Reader Structure' }),
  ).toBeVisible();

  await page.goto('/categories/field-notes');
  await expect(page.getByRole('heading', { level: 1, name: 'Field Notes' })).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveCount(3);
});

test('renders every rich-content fixture capability without relying on JavaScript', async ({
  page,
}) => {
  await page.goto('/articles/acceptance-rich-column');
  await expect(
    page.getByRole('heading', { level: 1, name: /Every Reader Structure/ }),
  ).toBeVisible();
  await expect(page.locator('audio[aria-label^="Audio for"]')).toBeVisible();
  await expect(
    page.locator('.article-opening').getByRole('link', { name: 'Field Notes' }),
  ).toHaveAttribute('href', '/categories/field-notes');
  await expect(page.getByRole('heading', { name: 'Sources' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Footnotes' })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Back to footnote reference/ })).toHaveCount(2);
  await expect(page.getByRole('link', { name: 'Back to footnote reference 1' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to footnote reference 2' })).toBeVisible();
  await expect(page.locator('blockquote')).toContainText('hard invariant');
  // The cover figure carries no caption; the in-flow image figure has the caption.
  await expect(page.locator('article#article-top figure figcaption')).toContainText(
    'conventional source link',
  );
});

test('keeps Search browseable and missing content fail-closed at wide and 320 CSS px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/search');
  await expect(page.getByRole('heading', { level: 1, name: 'Search' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Every Reader Structure/ })).toBeVisible();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 320);

  const response = await page.goto('/articles/missing-reader-acceptance-article');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
