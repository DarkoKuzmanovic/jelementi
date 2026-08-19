import { expect, test } from '@playwright/test';
import { expectNoBlockingAccessibilityViolations } from './accessibility';

const LONG_CATEGORY_SLUG = 'a-deliberately-long-category-name-for-narrow-readers';
const TEXT_SPACING_STRESS =
  'html { font-size: 200%; } * { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }';

test('Categories is a deterministic static directory with canonical links', async ({ page }) => {
  await page.goto('/categories');
  await expect(page.getByRole('heading', { level: 1, name: 'Categories' })).toBeVisible();
  await expect(page.locator('main script')).toHaveCount(0);

  const rows = page.locator('.category-index > li');
  await expect(rows).toHaveCount(4);
  await expect(rows.locator('h2')).toHaveText([
    'Field Notes',
    'Culture',
    'Science',
    'A Deliberately Long Category Name for Narrow Readers',
  ]);
  await expect(rows.locator('.category-count')).toHaveText([
    '3 articles',
    '2 articles',
    '2 articles',
    '1 article',
  ]);

  const fieldNotes = rows.first();
  await expect(fieldNotes.getByRole('link', { name: 'Field Notes', exact: true })).toHaveAttribute(
    'href',
    '/categories/field-notes',
  );
  await expect(
    fieldNotes.getByRole('link', { name: 'Čačak Field Notes: Every Reader Structure' }),
  ).toHaveAttribute('href', '/articles/acceptance-rich-column');
  await expect(fieldNotes.getByText('Newest article')).toBeVisible();
  await expect(fieldNotes.locator('time')).toHaveAttribute('datetime', '2026-08-18');
  await expect(fieldNotes.locator('time')).toHaveText('18 August 2026');
});

test('category listings are one newest-first reading sequence with return navigation', async ({
  page,
}) => {
  await page.goto('/categories/field-notes');
  await expect(page.getByRole('heading', { level: 1, name: 'Field Notes' })).toBeVisible();
  await expect(page.getByText('3 articles, newest first.')).toBeVisible();
  await expect(
    page.locator('.page-intro').getByRole('link', { name: 'Categories', exact: true }),
  ).toHaveAttribute('href', '/categories');
  await expect(page.getByRole('link', { name: 'All categories' })).toHaveAttribute(
    'href',
    '/categories',
  );

  const summaries = page.locator('.category-articles > li');
  await expect(summaries).toHaveCount(3);
  await expect(summaries.locator('h2 a')).toHaveText([
    'Čačak Field Notes: Every Reader Structure',
    'The Middle Field Note',
    'The Oldest Field Note',
  ]);
  for (const article of await summaries.all()) {
    await expect(article.locator('.article-summary__excerpt')).toBeVisible();
    await expect(article.locator('.article-summary__category')).toHaveAttribute(
      'href',
      '/categories/field-notes',
    );
    await expect(article.locator('time')).toHaveCount(1);
    await expect(article.getByText('min read')).toBeVisible();
  }

  await page.goto(`/categories/${LONG_CATEGORY_SLUG}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'A Deliberately Long Category Name for Narrow Readers',
  );
  await expect(page.getByText('1 article, newest first.')).toBeVisible();
  await expect(page.locator('.category-articles > li')).toHaveCount(1);
});

test('a missing category keeps the normal shell and HTTP 404 truth', async ({ page }, testInfo) => {
  const response = await page.goto('/categories/missing-reader-acceptance-category');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  for (const name of ['Home', 'Categories', 'Search']) {
    await expect(
      page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name }),
    ).toBeVisible();
  }
  if (!testInfo.project.name.includes('no-js')) {
    await expectNoBlockingAccessibilityViolations(page);
  }
});

test('Categories reflows at 320px with text spacing, visible focus, themes, and no Axe blockers', async ({
  page,
}, testInfo) => {
  if (testInfo.project.name.includes('no-js')) test.skip();

  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/categories');
  await expectNoBlockingAccessibilityViolations(page);
  const lightBackground = await page.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.reload();
  const darkBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(darkBackground).not.toBe(lightBackground);

  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/categories');
  await page.addStyleTag({ content: TEXT_SPACING_STRESS });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(
    await page
      .locator('.category-entry')
      .first()
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length),
  ).toBe(1);

  for (let tab = 0; tab < 7; tab += 1) await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Field Notes', exact: true })).toBeFocused();
  const focusOutline = await page
    .getByRole('link', { name: 'Field Notes', exact: true })
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, width: style.outlineWidth };
    });
  expect(focusOutline.style).not.toBe('none');
  expect(Number.parseFloat(focusOutline.width)).toBeGreaterThan(0);
  await expectNoBlockingAccessibilityViolations(page);
});

test('one and many category listings pass the complete responsive and accessibility matrix', async ({
  page,
}, testInfo) => {
  if (testInfo.project.name.includes('no-js')) test.skip();

  for (const route of ['/categories/field-notes', `/categories/${LONG_CATEGORY_SLUG}`]) {
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto(route);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await expectNoBlockingAccessibilityViolations(page);
    }

    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(route);
    await page.addStyleTag({ content: TEXT_SPACING_STRESS });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await expect(page.locator('.category-articles > li').first()).toBeVisible();
    await expectNoBlockingAccessibilityViolations(page);
  }

  await page.goto('/categories/field-notes');
  for (let tab = 0; tab < 7; tab += 1) await page.keyboard.press('Tab');
  const returnLink = page
    .locator('.page-intro')
    .getByRole('link', { name: 'Categories', exact: true });
  await expect(returnLink).toBeFocused();
  const focusOutline = await returnLink.evaluate((element) => {
    const style = getComputedStyle(element);
    return { style: style.outlineStyle, width: style.outlineWidth };
  });
  expect(focusOutline.style).not.toBe('none');
  expect(Number.parseFloat(focusOutline.width)).toBeGreaterThan(0);
});
