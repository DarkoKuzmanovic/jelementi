import { expect, test } from '@playwright/test';
import { expectNoBlockingAccessibilityViolations } from './accessibility';

const LONG_CATEGORY_SLUG = 'a-deliberately-long-category-name-for-narrow-readers';
const TEXT_SPACING_STRESS =
  'html { font-size: 200%; } * { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }';
const titles = [
  'Čačak Field Notes: Every Reader Structure',
  'The Middle Field Note',
  'Field Notes, part 3: The final tower',
  'Field Notes, part 2: The middle tower',
  'Field Notes, part 1: The first tower',
  'The Oldest Field Note',
];

test('section cover links name the destination and preserve illustration alt text', async ({
  page,
}) => {
  await page.goto('/categories');
  for (const section of await page.locator('.sec-block').all()) {
    const name = await section.locator('h2').innerText();
    const cover = section.locator('.sec-cover');
    await expect(cover).toHaveAccessibleName(`Browse ${name}`);
    await expect(cover).toHaveAttribute('href', `/categories/${await section.getAttribute('id')}`);
    await expect(cover.locator('img')).toHaveAttribute('alt', /.+/);
  }
});

test('Sections counts every category and its jump strip reaches the matching section', async ({
  page,
}) => {
  await page.goto('/categories');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sections');
  await expect(page.locator('.sec-intro')).toContainText('12 stories in five sections');
  await expect(page.locator('main script')).toHaveCount(0);
  const jumps = page.getByRole('navigation', { name: 'Jump to section' }).getByRole('link');
  await expect(jumps).toHaveCount(5);
  for (const link of await jumps.all()) {
    const href = await link.getAttribute('href');
    expect(href).toMatch(/^#/);
    const target = page.locator(`[id="${href!.slice(1)}"]`);
    await expect(target).toHaveCount(1);
    await expect(target.locator('h2')).toContainText(
      (await link.locator('.jump-name').textContent())!,
    );
    await link.click();
    expect(new URL(page.url()).hash).toBe(href);
  }
  await expect(page.locator('.sec-wide')).toHaveCount(3);
  const rows = page.locator('.sec-index > li');
  await expect(rows.locator('h2')).toHaveText([
    'Field Notes',
    'Culture',
    'Science',
    'A Deliberately Long Category Name for Narrow Readers',
    'Solo',
  ]);
  await expect(rows.locator('.sec-meta')).toContainText([
    '6 stories',
    '2 stories',
    '2 stories',
    '1 story',
    '1 story',
  ]);
  const fieldNotes = rows.first();
  await expect(fieldNotes.locator('.sec-titles a')).toHaveText(titles.slice(0, 4));
  await expect(fieldNotes.locator('time')).toHaveAttribute('datetime', '2026-08-18');
  await expect(
    fieldNotes.getByRole('link', { name: 'All 6 Field Notes stories →' }),
  ).toHaveAttribute('href', '/categories/field-notes');
  await expect(fieldNotes.locator('h2 a')).toHaveCSS(
    'color',
    await page.locator('.sec-intro .kicker').evaluate((el) => getComputedStyle(el).color),
  );
  await fieldNotes.locator('.sec-titles a').first().hover();
  await expect(fieldNotes.locator('.sec-titles a').first()).toHaveCSS(
    'text-decoration-line',
    'underline',
  );
});

for (const width of [1440, 390]) {
  test(`section typography follows the board corrections at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/categories');
    for (const heading of await page.locator('.sec-block h2').all()) {
      const fontSize = await heading.evaluate((el) => getComputedStyle(el).fontSize);
      await expect(heading).toHaveCSS('line-height', fontSize);
    }
    await expect(page.locator('.sections .kicker')).toHaveCSS(
      'font-weight',
      width === 390 ? '500' : '600',
    );
    if (width === 390) {
      await page.goto('/categories/field-notes');
      await expect(page.locator('.sec-cards .reader-kicker').first()).toHaveCSS(
        'font-weight',
        '500',
      );
    }
  });

  test(`section pages list every story once, newest first at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/categories/field-notes');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Field Notes');
    await expect(page.getByText('6 stories, newest first.')).toBeVisible();
    const stories = page.locator('[data-section-story]');
    await expect(stories).toHaveCount(6);
    await expect(stories.locator('h2 a')).toHaveText(titles);
    for (const story of await stories.all()) {
      await expect(story.locator('h2 a')).toBeVisible();
      await expect(story.locator('img')).toBeVisible();
      await expect(story.locator('img')).toHaveAttribute('alt', /.+/);
    }
    if (width === 1440) {
      await expect(page.locator('.sec-cards .reader-kicker').first()).toBeHidden();
      await expect(stories.nth(1).locator('img')).toHaveCSS('margin-bottom', '12px');
    } else {
      await expect(page.locator('.sec-cards .reader-kicker').first()).toBeVisible();
      await expect(page.locator('.sec-cards .reader-kicker').first()).toContainText('3 min');
    }
    await expect(page.locator('.sec-nav a')).toHaveCount(4);
    if (width === 390) await expect(stories.nth(1).locator('img')).toHaveCSS('width', '96px');
    await page.goto(`/categories/${LONG_CATEGORY_SLUG}`);
    await expect(page.getByText('1 story, newest first.')).toBeVisible();
    await expect(page.locator('[data-section-story]')).toHaveCount(1);
    await expect(page.locator('.sec-cards')).toHaveCount(0);
    if (width === 390) {
      await page.goto('/categories');
      const first = page.locator('.sec-block').first();
      await expect(first.locator('.sec-titles li:visible')).toHaveCount(3);
      for (const image of await page.locator('.sec-cover img').all()) {
        await expect(image).toHaveCSS('width', '350px');
      }
      const heading = await first.locator('h2').boundingBox();
      const cover = await first.locator('img').boundingBox();
      const rows = await first.locator('.sec-titles').boundingBox();
      expect(heading!.y + heading!.height).toBeLessThanOrEqual(cover!.y);
      expect(cover!.y + cover!.height).toBeLessThanOrEqual(rows!.y);
    }
  });
}

test('known section navigation keeps aria-current and its hue underline', async ({ page }) => {
  await page.goto('/categories/science');
  const current = page
    .getByRole('navigation', { name: 'Primary navigation' })
    .getByRole('link', { name: 'Science', exact: true });
  await expect(current).toHaveAttribute('aria-current', 'page');
  await expect(current).toHaveCSS('text-decoration-line', 'underline');
});

test('a missing category keeps the normal shell and HTTP 404 truth', async ({ page }, testInfo) => {
  const response = await page.goto('/categories/missing-reader-acceptance-category');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'This page is not available.' })).toBeVisible();
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  for (const name of ['Home', 'Sections', 'Search']) {
    await expect(
      page
        .getByRole('navigation', { name: 'Footer navigation' })
        .getByRole('link', { name, exact: true }),
    ).toBeVisible();
  }
  if (!testInfo.project.name.includes('no-js')) await expectNoBlockingAccessibilityViolations(page);
});

test('Sections and one/many story pages reflow with text spacing, focus and accessible themes', async ({
  page,
}, testInfo) => {
  if (testInfo.project.name.includes('no-js')) test.skip();
  for (const route of [
    '/categories',
    '/categories/field-notes',
    `/categories/${LONG_CATEGORY_SLUG}`,
  ]) {
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto(route);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await expectNoBlockingAccessibilityViolations(page);
    }
    await page.setViewportSize({ width: 320, height: 800 });
    await page.addStyleTag({ content: TEXT_SPACING_STRESS });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expectNoBlockingAccessibilityViolations(page);
  }
  await page.goto('/categories');
  const jump = page.getByRole('navigation', { name: 'Jump to section' }).getByRole('link').first();
  await jump.focus();
  await expect(jump).toBeFocused();
  await expect(jump).toHaveCSS('outline-width', '2px');
  await expect(jump).toHaveCSS('outline-offset', '2px');
});
