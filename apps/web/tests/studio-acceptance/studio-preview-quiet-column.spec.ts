import { expect, test } from '@playwright/test';
import {
  STUDIO_ACCEPTANCE_IDENTITY_HEADER,
  STUDIO_ACCEPTANCE_IDENTITY_TOKEN,
} from '../../src/lib/server/studio/request-guard.server';
import { expectNoBlockingAccessibilityViolations } from '../reader-acceptance/accessibility';

const ARTICLE_SLUG = 'lighthouse-watch';

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({
    [STUDIO_ACCEPTANCE_IDENTITY_HEADER]: STUDIO_ACCEPTANCE_IDENTITY_TOKEN,
  });
});

/**
 * #101: Studio preview mounts the authoritative Reader content renderer with
 * exact Reader content tokens/typography at the selected responsive width,
 * without Reader shell chrome, route navigation, or any lifecycle meaning
 * change. Runs under both Studio projects (JS-enabled and no-JS) so the
 * default wide preview is proven without client enhancement.
 */
test('preview renders the full authoritative content hierarchy with no Reader chrome', async ({
  page,
}) => {
  await page.goto(`/studio/articles/${ARTICLE_SLUG}`);
  await page
    .getByRole('textbox', { name: 'Body', exact: true })
    .fill('An explicit preview paragraph.');
  await page.getByRole('button', { name: 'Preview', exact: true }).click();

  const preview = page.getByRole('article', { name: 'Reader preview' });
  await expect(preview).toBeVisible();
  await expect(preview.getByRole('heading', { name: 'The Lighthouse Watch' })).toBeVisible();
  await expect(preview.getByText('By Studio Acceptance')).toBeVisible();
  await expect(
    preview.getByText('A deterministic acceptance fixture article, saved and ready to publish.'),
  ).toBeVisible();
  await expect(preview.getByText('An explicit preview paragraph.')).toBeVisible();
  await expect(preview.locator('figure')).toBeVisible();
  // The seeded fixture article has no audio: absence leaves no empty treatment.
  await expect(preview.locator('audio')).toHaveCount(0);

  // No Reader shell chrome, navigation, or continuation inside the preview.
  await expect(preview.locator('header')).toHaveCount(1); // the article opening only
  await expect(preview.getByRole('navigation')).toHaveCount(0);
  await expect(preview.getByText('Continue reading')).toHaveCount(0);
  await expect(preview.getByText('Return to')).toHaveCount(0);
});

test('preview width selection is contained and the narrow canvas is 320px', async ({
  page,
}, testInfo) => {
  await page.goto(`/studio/articles/${ARTICLE_SLUG}`);
  await page.getByRole('button', { name: 'Preview', exact: true }).click();

  const preview = page.getByRole('article', { name: 'Reader preview' });
  const canvas = preview.locator('.article-preview');
  await expect(preview.locator('input[value="wide"]')).toBeChecked();
  const wideDimensions = await canvas.evaluate((element) => ({
    width: element.getBoundingClientRect().width,
    rootFontSize: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
  }));
  expect(wideDimensions.width).toBe(52 * wideDimensions.rootFontSize);

  const typography = await preview.locator('article#article-top h1').evaluate((heading) => {
    const probe = document.createElement('span');
    probe.style.fontFamily = 'var(--font-serif)';
    probe.style.fontSize = 'var(--text-h1)';
    probe.style.lineHeight = 'var(--leading-heading)';
    document.body.appendChild(probe);
    const actual = getComputedStyle(heading);
    const expected = getComputedStyle(probe);
    const result = {
      actual: [actual.fontFamily, actual.fontSize, actual.lineHeight],
      expected: [expected.fontFamily, expected.fontSize, expected.lineHeight],
    };
    probe.remove();
    return result;
  });
  expect(typography.actual).toEqual(typography.expected);

  if (testInfo.project.name.includes('no-js')) {
    // Width switching is progressive enhancement; unavailable controls are
    // hidden while the default wide Reader measure remains contained.
    await expect(preview.locator('.preview-width-controls')).toBeHidden();
    await expect(canvas).toHaveClass(/article-preview--wide/);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    return;
  }

  await expect(preview.getByRole('radio', { name: 'Wide (52rem)' })).toBeVisible();
  await preview.getByRole('radio', { name: 'Narrow (320px)' }).check();
  await expect(canvas).toHaveClass(/article-preview--narrow/);
  const width = await canvas.evaluate((el) => el.getBoundingClientRect().width);
  expect(width).toBe(320);
  // The Studio page itself never widens: no page-level horizontal overflow.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('preview has zero serious or critical accessibility findings', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name.includes('no-js'),
    'Axe scan is a JS-enabled Studio project concern.',
  );
  await page.goto(`/studio/articles/${ARTICLE_SLUG}`);
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Reader preview' })).toBeVisible();
  await expectNoBlockingAccessibilityViolations(page);
});
