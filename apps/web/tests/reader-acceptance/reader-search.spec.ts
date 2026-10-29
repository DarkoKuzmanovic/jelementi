import { expect, test } from '@playwright/test';
import { expectNoBlockingAccessibilityViolations } from './accessibility';

const representativeCatalogSize = 12;

test('URL query pre-fills and filters after enhancement, with the full no-JS catalog intact', async ({
  page,
}, testInfo) => {
  await page.goto('/search?query=ČAČAK');
  if (testInfo.project.name.includes('no-js')) {
    await expect(page.getByRole('article')).toHaveCount(representativeCatalogSize);
  } else {
    await expect(page.getByRole('searchbox', { name: 'Search published articles' })).toHaveValue(
      'ČAČAK',
    );
    await expect(page.getByRole('article')).toHaveCount(1);
    await expect(page.getByRole('status')).toHaveText('1 stories mention “ČAČAK”');
  }
});

test('Search has no serious or critical accessibility violations with or without enhancement', async ({
  browser,
  page,
}, testInfo) => {
  await page.goto('/search');

  if (testInfo.project.name === 'reader-no-js') {
    await expect(page.getByRole('article')).toHaveCount(representativeCatalogSize);
    const scanContext = await browser.newContext({ javaScriptEnabled: true });
    const staticPage = await scanContext.newPage();
    await staticPage.route('**/*', async (route) => {
      if (route.request().resourceType() === 'script') await route.abort();
      else await route.continue();
    });
    await staticPage.goto(page.url());
    await expect(staticPage.locator('[data-search-enhanced]')).toHaveCount(0);
    await expectNoBlockingAccessibilityViolations(staticPage);
    await scanContext.close();
    return;
  }

  await expect(page.locator('[data-search-enhanced="true"]')).toBeVisible();
  await expectNoBlockingAccessibilityViolations(page);
  await page
    .getByRole('searchbox', { name: 'Search published articles' })
    .fill('no such acceptance article');
  await expect(
    page.getByRole('heading', { name: 'Nothing matches “no such acceptance article”.' }),
  ).toBeVisible();
  await expectNoBlockingAccessibilityViolations(page);
});

test('Search is a complete browseable catalog before interaction and without JavaScript', async ({
  page,
}, testInfo) => {
  await page.goto('/search');

  await expect(page.getByRole('heading', { level: 1, name: 'Find a story.' })).toBeVisible();
  expect(
    await page
      .locator('.search__intro')
      .evaluate((element) => getComputedStyle(element).borderBottomWidth),
  ).toBe('0px');
  await expect(page.locator('.article-list > li')).toHaveCount(representativeCatalogSize);
  await expect(page.getByRole('article')).toHaveCount(representativeCatalogSize);

  const firstArticle = page.getByRole('article').first();
  await expect(firstArticle.getByRole('link', { name: /Every Reader Structure/ })).toHaveAttribute(
    'href',
    '/articles/acceptance-rich-column',
  );
  await expect(firstArticle.getByText('A deterministic rich article')).toBeVisible();
  await expect(firstArticle.locator('.reader-kicker')).toContainText('Field Notes');
  await expect(firstArticle.getByText('18 August 2026')).toBeVisible();
  await expect(firstArticle.locator('.reader-kicker')).toContainText('7 min');

  if (testInfo.project.name === 'reader-no-js') {
    await expect(page.getByText(/complete catalog remains available below/i)).toBeVisible();
  }
});

test('client filtering preserves shared search semantics, source order, and input focus', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'reader-no-js');
  await page.goto('/search');
  await expect(page.locator('[data-search-enhanced="true"]')).toBeVisible();

  const input = page.getByRole('searchbox', { name: 'Search published articles' });
  await input.focus();
  await input.fill('ČAČAK');

  await expect(input).toBeFocused();
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(
    page.getByRole('article').getByRole('link', { name: /Every Reader Structure/ }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('1 stories mention “ČAČAK”');

  await input.fill('Jelementi');
  await expect(input).toBeFocused();
  await expect(page.getByRole('article')).toHaveCount(representativeCatalogSize);
  await expect(page.getByRole('status')).toHaveText('12 stories mention “Jelementi”');

  await input.fill('');
  await expect(page.getByRole('article')).toHaveCount(representativeCatalogSize);
  await expect(page.getByRole('article').first()).toContainText('Every Reader Structure');
  await expect(page.getByRole('article').last()).toContainText(
    'Field Notes, part 2: The middle tower',
  );
});

test('submission and zero-result recovery keep control with the Search input', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'reader-no-js');
  await page.goto('/search');
  await expect(page.locator('[data-search-enhanced="true"]')).toBeVisible();

  const search = page.locator('.search-form');
  const input = page.getByRole('searchbox', { name: 'Search published articles' });
  await expect(search.getByRole('button', { name: 'Search' })).toBeVisible();
  await input.fill('no such acceptance article');
  await input.press('Enter');

  await expect(input).toBeFocused();
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { level: 2, name: 'Nothing matches “no such acceptance article”.' }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toHaveText(
    '0 stories mention “no such acceptance article”',
  );
  await expect(
    page.locator('.search-empty').getByRole('link', { name: 'Field Notes', exact: true }),
  ).toHaveAttribute('href', '/categories/field-notes');

  const clear = page.getByRole('button', { name: 'Clear search' });
  await clear.click();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('');
  await expect(page.getByRole('article')).toHaveCount(representativeCatalogSize);
  await expect(page.getByRole('status')).toHaveText('All 12 stories');

  expect(
    await page.locator('a a, a button, button a, button button').count(),
    'interactive controls must never be nested',
  ).toBe(0);
});

test('special and long queries stay safe, focused, and politely announced once per state', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'reader-no-js');
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/search');
  await expect(page.locator('[data-search-enhanced="true"]')).toBeVisible();

  const status = page.getByRole('status');
  await expect(status).toHaveCount(1);
  await expect(status).toHaveAttribute('aria-live', 'polite');
  await expect(status).toHaveAttribute('aria-atomic', 'true');
  await page.evaluate(() => {
    const liveRegion = document.querySelector('[role="status"]');
    if (!(liveRegion instanceof HTMLElement)) throw new Error('Search status region is missing.');
    const target = window as Window & { searchAnnouncements?: string[] };
    target.searchAnnouncements = [];
    new MutationObserver(() => {
      const announcement = liveRegion.textContent?.trim() ?? '';
      if (announcement) target.searchAnnouncements?.push(announcement);
    }).observe(liveRegion, { childList: true, characterData: true, subtree: true });
  });

  const input = page.getByRole('searchbox', { name: 'Search published articles' });
  await input.fill('ČAČAK');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(input).toBeFocused();

  const longSpecialQuery = '<>&"'.repeat(128);
  await input.fill(longSpecialQuery);
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(status).toContainText(longSpecialQuery);
  await expect(input).toBeFocused();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 320);

  const announcements = await page.evaluate(
    () => (window as Window & { searchAnnouncements?: string[] }).searchAnnouncements ?? [],
  );
  expect(announcements.length).toBeGreaterThanOrEqual(2);
  expect(announcements.filter((item, index) => item === announcements[index - 1])).toEqual([]);
});

test('Search reflows and remains keyboard-operable under Reader accessibility preferences', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'reader-no-js');
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/search');
  await expect(page.locator('[data-search-enhanced="true"]')).toBeVisible();

  const input = page.getByRole('searchbox', { name: 'Search published articles' });
  const clear = page.getByRole('button', { name: 'Clear', exact: true });
  const inputBox = await input.boundingBox();
  await input.fill('Culture');
  const clearBox = await clear.boundingBox();
  expect(inputBox?.height).toBeGreaterThanOrEqual(44);
  expect(clearBox?.height).toBeGreaterThanOrEqual(44);

  await input.focus();
  await input.fill('Culture');
  await page.keyboard.press('Tab');
  await expect(clear).toBeFocused();
  await expect(page.getByRole('article')).toHaveCount(2);

  const lightBackground = await page.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .not.toBe(lightBackground);

  await page.addStyleTag({
    content: `
      html { font-size: 200% !important; }
      body { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
      p { margin-bottom: 2em !important; }
    `,
  });
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 320);
  await expect(input).toBeVisible();
  await expect(page.getByRole('article').first()).toBeVisible();

  const motion = await input.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      animationDuration: style.animationDuration,
      transitionDuration: style.transitionDuration,
    };
  });
  expect(Number.parseFloat(motion.animationDuration)).toBeLessThan(0.02);
  expect(Number.parseFloat(motion.transitionDuration)).toBeLessThan(0.02);
});

test('400% zoom equivalent preserves Search reflow with and without JavaScript', async ({
  page,
}) => {
  // At 400% browser zoom, a 1280 CSS px layout has a 320 CSS px effective viewport.
  // This is the repository's established deterministic browser proof for 400% reflow.
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/search');

  await expect(page.getByRole('searchbox', { name: 'Search published articles' })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(representativeCatalogSize);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('Try chips fill the query and the field Clear restores all stories', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.includes('no-js'));
  await page.goto('/search');
  await expect(page.locator('[data-search-enhanced="true"]')).toBeVisible();
  const chip = page.locator('.search__try a').first();
  const tag = await chip.textContent();
  await chip.click();
  const input = page.getByRole('searchbox', { name: 'Search published articles' });
  await expect(input).toHaveValue(tag!);
  await expect(input).toBeFocused();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(input).toHaveValue('');
  await expect(page.getByRole('article')).toHaveCount(representativeCatalogSize);
});

test('body-only matches show original text and title matches use folded highlights', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.includes('no-js'));
  await page.goto('/search?query=locked');
  await expect(page.locator('[data-search-enhanced="true"]')).toBeVisible();
  await expect(page.locator('.search-snippet')).toHaveCount(1);
  await expect(page.locator('.search-snippet')).toContainText(
    'All locked marks remain observable.',
  );
  await expect(page.locator('.search-snippet mark')).toHaveText('locked');
  const input = page.getByRole('searchbox', { name: 'Search published articles' });
  await input.fill('cacak');
  await expect(page.locator('.title mark')).toHaveText('Čačak');
  await expect(page.locator('.search-snippet')).toHaveCount(0);
});

test('plain GET form navigates query URLs while retaining the full no-JS catalog', async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes('no-js'));
  await page.goto('/search');
  await page.getByRole('searchbox', { name: 'Search published articles' }).fill('Čačak');
  await page.locator('.search-form').getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page).toHaveURL(/\/search\?query=/);
  expect(new URL(page.url()).searchParams.get('query')).toBe('Čačak');
  await expect(page.getByRole('article')).toHaveCount(representativeCatalogSize);
});
