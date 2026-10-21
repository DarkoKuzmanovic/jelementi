import { expect, test } from '@playwright/test';
import { expectNoBlockingAccessibilityViolations } from './accessibility';

const scenario = process.env.READER_ACCEPTANCE_SCENARIO ?? 'representative';

const catalogs = {
  sparse: {
    lead: ['One Article Is Still a Catalog'],
    recent: [],
    shelves: [],
  },
  intermediate: {
    lead: ['Čačak Field Notes: Every Reader Structure'],
    recent: ['The Middle Field Note', 'Culture at the Newest Edge', 'A Measured Sky'],
    shelves: [],
  },
  representative: {
    lead: ['Čačak Field Notes: Every Reader Structure'],
    recent: ['The Middle Field Note', 'Culture at the Newest Edge', 'A Measured Sky'],
    shelves: [
      'Field Notes · series in 3 parts',
      'The Oldest Field Note',
      'Culture in the Archive',
      'The Patient Instrument',
      'A Single Thread at Narrow Width',
      'A Sparse Column Without Audio',
    ],
  },
} as const;

function expectedCatalog() {
  if (scenario === 'sparse' || scenario === 'intermediate' || scenario === 'representative') {
    return catalogs[scenario];
  }
  throw new Error(`reader-home.spec.ts does not support scenario ${scenario}.`);
}

async function tierTitles(page: import('@playwright/test').Page, tier: string): Promise<string[]> {
  return page
    .locator(`[data-home-tier="${tier}"] .article-summary__title a`)
    .allTextContents()
    .then((titles) => titles.map((title) => title.trim()));
}

test('@home-catalog-scenario renders the exact tier order with series grouped once', async ({
  page,
}) => {
  const expected = expectedCatalog();
  const expectedTitles = [...expected.lead, ...expected.recent, ...expected.shelves];

  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'Jelementi' })).toHaveCount(1);
  expect(await tierTitles(page, 'lead')).toEqual(expected.lead);
  expect(await tierTitles(page, 'recent')).toEqual(expected.recent);
  expect(await tierTitles(page, 'shelves')).toEqual(expected.shelves);

  await expect(page.getByRole('region', { name: 'Recently published' })).toHaveCount(
    expected.recent.length > 0 ? 1 : 0,
  );
  await expect(page.getByRole('region', { name: 'More articles' })).toHaveCount(
    expected.shelves.length > 0 ? 1 : 0,
  );

  const allTitles = await page
    .locator('.home-catalog .article-summary__title a')
    .allTextContents()
    .then((titles) => titles.map((title) => title.trim()));
  expect(allTitles).toEqual(expectedTitles);
  expect(new Set(allTitles).size).toBe(expectedTitles.length);
  await expect(page.getByText('Acceptance Draft Must Stay Private')).toHaveCount(0);
  await expect(page.getByText('Acceptance Archive Must Stay Private')).toHaveCount(0);

  const summaries = page.locator('.home-catalog .article-summary');
  await expect(summaries).toHaveCount(expectedTitles.length);
  for (const summary of await summaries.all()) {
    await expect(summary.locator('a[href^="/categories/"]')).toHaveCount(1);
    await expect(summary.locator('time[datetime]')).toHaveCount(1);
    await expect(summary).toContainText(/\d+ min read/);
    await expect(summary.locator('.article-summary__meta')).toContainText(/ · \d+ min read/);
    if (await summary.evaluate((element) => !!element.closest('[data-home-tier="shelves"]'))) {
      await expect(summary.locator('.article-summary__excerpt')).toBeHidden();
    } else {
      await expect(summary.locator('.article-summary__excerpt')).not.toHaveText('');
    }
  }
});
test('Home places the series band after recent stories with responsive reading order', async ({
  page,
}) => {
  test.skip(scenario !== 'representative', 'Representative series fixture.');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  const band = page.locator('.home-series');
  await expect(band).toHaveCount(1);
  await expect(band.locator('.home-series__kicker')).toHaveText('Series · Field Notes');
  await expect(band.locator('h2')).toHaveText('Field Notes');
  await expect(band.locator('.home-series__details')).toHaveText('3 parts · 9 min');
  await expect(band.locator('.home-series__cards li')).toHaveCount(3);
  await expect(band.locator('.home-series__card-title')).toHaveText([
    'The first tower',
    'The middle tower',
    'The final tower',
  ]);
  await expect(band.getByRole('link', { name: 'Start with part 1 →' })).toHaveAttribute(
    'href',
    '/articles/acceptance-field-series-first',
  );

  const topPositions = await page.evaluate(() =>
    ['[data-home-tier="recent"]', '.home-series', '.podcast-invitation'].map((selector) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing Home section: ${selector}`);
      return element.getBoundingClientRect().top;
    }),
  );
  expect(topPositions[0]!).toBeLessThan(topPositions[1]!);
  expect(topPositions[1]!).toBeLessThan(topPositions[2]!);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(band.locator('.home-series__cards')).toBeHidden();
  await expect(band.locator('.home-series__covers li')).toHaveCount(3);
  await expect(band.locator('.home-series__covers')).toBeVisible();
  await expect(band.locator('.home-series__mobile-list a')).toHaveText([
    'The first tower',
    'The middle tower',
    'The final tower',
  ]);
  const buttonWidth = await band
    .locator('.home-series__action')
    .evaluate((element) => element.getBoundingClientRect().width);
  const bandWidth = await band
    .locator('.home-series__band')
    .evaluate((element) => element.getBoundingClientRect().width);
  expect(buttonWidth).toBeGreaterThan(bandWidth - 50);
});


test('compact illustrated archive rows retain stories without expanded preview prose', async ({
  page,
}) => {
  test.skip(scenario !== 'representative', 'Representative archive composition.');
  await page.goto('/');
  await expect(page.locator('.home-shelf--compact .article-summary__excerpt').first()).toBeHidden();
  await expect(page.locator('.home-shelf--compact .article-summary__title').first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.locator('.home-recent__list > li').nth(1).locator('.article-summary__excerpt'),
  ).toBeHidden();
  await expect(
    page.locator('.home-recent__list > li').first().locator('.article-summary__excerpt'),
  ).toBeVisible();
});

test('representative Home preserves the wide editorial scan and one 320px source sequence', async ({
  page,
}) => {
  test.skip(scenario !== 'representative', 'Representative-only composition contract.');
  await page.goto('/');

  const recent = page.locator('.home-recent__list');
  const compactShelves = page.locator('.home-shelves--compact');
  expect(
    (await recent.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).split(' '),
  ).toHaveLength(3);
  expect(
    (
      await compactShelves.evaluate((element) => getComputedStyle(element).gridTemplateColumns)
    ).split(' '),
  ).toHaveLength(2);

  await page.setViewportSize({ width: 320, height: 800 });
  await expect(page.locator('.home-catalog')).toBeVisible();
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 320);
  expect(
    (await recent.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).split(' '),
  ).toHaveLength(1);
  expect(
    (
      await compactShelves.evaluate((element) => getComputedStyle(element).gridTemplateColumns)
    ).split(' '),
  ).toHaveLength(1);

  const sourceOrder = await page
    .locator('.home-catalog .article-summary__title a')
    .allTextContents()
    .then((titles) => titles.map((title) => title.trim()));
  expect(sourceOrder).toEqual([
    ...catalogs.representative.lead,
    ...catalogs.representative.recent,
    ...catalogs.representative.shelves,
  ]);
});

test('Home survives 200% text, WCAG text spacing, long content, and keyboard source order', async ({
  page,
}, testInfo) => {
  test.skip(scenario !== 'representative', 'Representative-only stress contract.');
  test.skip(testInfo.project.name.includes('no-js'), 'Style injection requires JavaScript.');
  await page.goto('/');
  await page.addStyleTag({
    content: `
      html { font-size: 200% !important; }
      * { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
      p { margin-bottom: 2em !important; }
    `,
  });
  await page.setViewportSize({ width: 320, height: 800 });

  await expect(
    page.getByText('unbroken-content-token-that-must-reflow-without-page-level-overflow'),
  ).toHaveCount(1);
  await expect(
    page.getByRole('heading', {
      level: 3,
      name: 'A Deliberately Long Category Name for Narrow Readers',
    }),
  ).toBeVisible();
  const noHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(noHorizontalOverflow).toBe(true);

  const articleHrefs = await page
    .locator('.home-catalog .article-summary__title a')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  expect(articleHrefs).toEqual([
    '/articles/acceptance-rich-column',
    '/articles/acceptance-field-middle',
    '/articles/acceptance-culture-new',
    '/articles/acceptance-science-new',
    '/articles/acceptance-field-series-first',
    '/articles/acceptance-field-oldest',
    '/articles/acceptance-culture-old',
    '/articles/acceptance-science-old',
    '/articles/acceptance-long-category',
    '/articles/acceptance-no-audio-long-column',
  ]);
  await expect(page.locator('.home-catalog [tabindex]')).toHaveCount(0);

  const expectedKeyboardHrefs = [
    '/articles/acceptance-rich-column',
    '/categories/field-notes',
    '/articles/acceptance-rich-column',
    '/articles/acceptance-rich-column#reader:audio',
    '/categories/field-notes',
    '/articles/acceptance-field-middle',
    '/categories/culture',
    '/articles/acceptance-culture-new',
    '/categories/science',
    '/articles/acceptance-science-new',
    '/articles/acceptance-field-series-first',
    '/articles/acceptance-field-series-middle',
    '/articles/acceptance-field-series-third',
    '/articles/acceptance-field-series-first',
    '/articles/acceptance-field-series-middle',
    '/articles/acceptance-field-series-third',
    '/articles/acceptance-field-series-first',
    '/categories/field-notes',
    '/categories/field-notes',
    '/categories/field-notes',
    '/articles/acceptance-field-series-first',
    '/categories/field-notes',
    '/articles/acceptance-field-oldest',
    '/categories/culture',
    '/categories/culture',
    '/categories/culture',
    '/articles/acceptance-culture-old',
    '/categories/science',
    '/categories/science',
    '/categories/science',
    '/articles/acceptance-science-old',
    '/categories/a-deliberately-long-category-name-for-narrow-readers',
    '/categories/a-deliberately-long-category-name-for-narrow-readers',
    '/categories/a-deliberately-long-category-name-for-narrow-readers',
    '/articles/acceptance-long-category',
    '/categories/solo',
    '/categories/solo',
    '/categories/solo',
    '/articles/acceptance-no-audio-long-column',
  ];
  const keyboardHrefs: string[] = [];
  const focusOutlines: Array<{ style: string; width: string }> = [];
  for (let step = 0; step < 60 && keyboardHrefs.length < expectedKeyboardHrefs.length; step += 1) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const element = document.activeElement;
      if (!(element instanceof HTMLAnchorElement)) return undefined;
      const style = getComputedStyle(element);
      return {
        href: element.getAttribute('href'),
        outline: { style: style.outlineStyle, width: style.outlineWidth },
      };
    });
    if (focused?.href && expectedKeyboardHrefs.includes(focused.href)) {
      keyboardHrefs.push(focused.href);
      focusOutlines.push(focused.outline);
    }
  }
  expect(keyboardHrefs).toEqual(expectedKeyboardHrefs);
  expect(focusOutlines).toEqual(
    expectedKeyboardHrefs.map(() => ({ style: 'solid', width: '3px' })),
  );
});

test('Home has zero serious or critical Axe findings across width and theme roles', async ({
  page,
}, testInfo) => {
  test.skip(scenario !== 'representative', 'Representative-only accessibility scan.');
  test.skip(testInfo.project.name.includes('no-js'), 'Axe injection requires JavaScript.');

  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of [1280, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await expectNoBlockingAccessibilityViolations(page);
    }
  }
});
