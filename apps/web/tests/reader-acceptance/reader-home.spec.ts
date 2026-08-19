import { expect, test } from '@playwright/test';

const scenario = process.env.READER_ACCEPTANCE_SCENARIO ?? 'representative';

const catalogs = {
  sparse: {
    lead: ['One Article Is Still a Catalog'],
    recent: [],
    more: [],
  },
  intermediate: {
    lead: ['Čačak Field Notes: Every Reader Structure'],
    recent: ['The Middle Field Note', 'Culture at the Newest Edge', 'A Measured Sky'],
    more: [],
  },
  representative: {
    lead: ['Čačak Field Notes: Every Reader Structure'],
    recent: ['The Middle Field Note', 'Culture at the Newest Edge', 'A Measured Sky'],
    more: [
      'The Oldest Field Note',
      'Culture in the Archive',
      'The Patient Instrument',
      'A Single Thread at Narrow Width',
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
    .locator(`[data-home-tier="${tier}"] a[href^="/articles/"]`)
    .allTextContents()
    .then((titles) => titles.map((title) => title.trim()));
}

test('@home-catalog-scenario renders each published article once in the exact Editorial-front tier order', async ({
  page,
}) => {
  const expected = expectedCatalog();
  const expectedTitles = [...expected.lead, ...expected.recent, ...expected.more];

  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'Jelementi' })).toHaveCount(1);
  expect(await tierTitles(page, 'lead')).toEqual(expected.lead);
  expect(await tierTitles(page, 'recent')).toEqual(expected.recent);
  expect(await tierTitles(page, 'more')).toEqual(expected.more);

  await expect(page.getByRole('region', { name: 'Recently published' })).toHaveCount(
    expected.recent.length > 0 ? 1 : 0,
  );
  await expect(page.getByRole('region', { name: 'More articles' })).toHaveCount(
    expected.more.length > 0 ? 1 : 0,
  );

  const allTitles = await page
    .locator('.home-catalog a[href^="/articles/"]')
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
    await expect(summary.locator('.article-summary__excerpt')).not.toHaveText('');
  }
});

test('representative Home preserves the wide editorial scan and one 320px source sequence', async ({
  page,
}) => {
  test.skip(scenario !== 'representative', 'Representative-only composition contract.');
  await page.goto('/');

  const recent = page.locator('.home-recent__list');
  const more = page.locator('.home-more__list');
  expect(
    (await recent.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).split(' '),
  ).toHaveLength(3);
  expect(
    (await more.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).split(' '),
  ).toHaveLength(2);

  await page.setViewportSize({ width: 320, height: 800 });
  await expect(page.locator('.home-catalog')).toBeVisible();
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 320);
  expect(
    (await recent.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).split(' '),
  ).toHaveLength(1);
  expect(
    (await more.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).split(' '),
  ).toHaveLength(1);

  const sourceOrder = await page
    .locator('.home-catalog a[href^="/articles/"]')
    .allTextContents()
    .then((titles) => titles.map((title) => title.trim()));
  expect(sourceOrder).toEqual([
    ...catalogs.representative.lead,
    ...catalogs.representative.recent,
    ...catalogs.representative.more,
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

  const noHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(noHorizontalOverflow).toBe(true);

  const articleHrefs = await page
    .locator('.home-catalog a[href^="/articles/"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  expect(articleHrefs).toEqual([
    '/articles/acceptance-rich-column',
    '/articles/acceptance-field-middle',
    '/articles/acceptance-culture-new',
    '/articles/acceptance-science-new',
    '/articles/acceptance-field-oldest',
    '/articles/acceptance-culture-old',
    '/articles/acceptance-science-old',
    '/articles/acceptance-long-category',
  ]);
  await expect(page.locator('.home-catalog [tabindex]')).toHaveCount(0);

  const keyboardArticleHrefs: string[] = [];
  let firstArticleOutline: { style: string; width: string } | undefined;
  for (let step = 0; step < 40 && keyboardArticleHrefs.length < articleHrefs.length; step += 1) {
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
    if (focused?.href?.startsWith('/articles/')) {
      keyboardArticleHrefs.push(focused.href);
      firstArticleOutline ??= focused.outline;
    }
  }
  expect(keyboardArticleHrefs).toEqual(articleHrefs);
  expect(firstArticleOutline).toEqual({ style: 'solid', width: '3px' });
});
