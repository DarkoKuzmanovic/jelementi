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
    recent: [
      'The Middle Field Note',
      'Culture at the Newest Edge',
      'A Measured Sky',
      'Field Notes, part 3: The final tower',
      'Field Notes, part 2: The middle tower',
      'Field Notes, part 1: The first tower',
      'The Oldest Field Note',
    ],
    shelves: [
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
    .locator(`[data-home-tier="${tier}"] [data-home-story] .title a`)
    .allTextContents()
    .then((titles) => titles.map((title) => title.trim()));
}

test('@home-catalog-scenario renders the ordered tiers and optional series and narration', async ({
  page,
}) => {
  const expected = expectedCatalog();
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'Jelementi' })).toHaveCount(1);
  for (const tier of ['lead', 'recent', 'shelves'] as const) {
    expect(await tierTitles(page, tier)).toEqual(expected[tier]);
  }
  const titles = [...expected.lead, ...expected.recent, ...expected.shelves];
  const stories = page.locator('.home-catalog [data-home-story]');
  await expect(stories).toHaveCount(titles.length);
  const slugs = await stories.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-home-story')),
  );
  expect(new Set(slugs).size).toBe(titles.length);
  await expect(page.getByText('Acceptance Draft Must Stay Private')).toHaveCount(0);
  await expect(page.getByText('Acceptance Archive Must Stay Private')).toHaveCount(0);

  await expect(page.locator('#series')).toHaveCount(1);
  await expect(page.locator('.home-series__band')).toHaveCount(
    scenario === 'representative' ? 1 : 0,
  );
  await expect(page.locator('.home-narration')).toHaveCount(scenario === 'sparse' ? 0 : 1);
  if (scenario !== 'sparse') {
    await expect(page.locator('.home-narration')).toHaveAttribute(
      'href',
      '/articles/acceptance-rich-column#reader:audio',
    );
  }
  const invitation = page.locator('.podcast-invitation');
  await expect(invitation.getByRole('link', { name: /Get the podcast/ })).toHaveAttribute(
    'href',
    '/podcast.xml',
  );
  await expect(invitation.getByRole('link', { name: 'Podcast RSS' })).toHaveAttribute(
    'href',
    '/podcast.xml',
  );
  if (expected.recent.length) {
    await expect(page.getByRole('heading', { name: 'Latest stories' })).toBeVisible();
    await expect(page.locator('.home-recent')).toContainText('Newest first');
    await expect(
      page.locator('.home-recent').getByRole('link', { name: /All stories/ }),
    ).toHaveAttribute('href', '/search');
  }
});

test('Home places the series route between latest stories and listening', async ({ page }) => {
  test.skip(scenario !== 'representative', 'Representative series fixture.');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const band = page.locator('.home-series__band');
  await expect(band.locator('.reader-kicker')).toContainText('Field Notes');
  await expect(band.locator('.reader-kicker')).toContainText('Series');
  await expect(band.locator('h2')).toHaveText('Field Notes');
  await expect(band.locator('.home-series__details')).toHaveText(
    /Three\s+parts\s*·\s*9 minutes\s*·\s*read in order or dip in/i,
  );
  const cards = band.locator('.home-series__cards');
  await expect(cards.locator('li')).toHaveCount(3);
  await expect(cards.locator('.home-series__card-title')).toHaveText([
    'The first tower',
    'The middle tower',
    'The final tower',
  ]);
  await expect(band.locator('.home-series__action')).toHaveAttribute(
    'href',
    '/articles/acceptance-field-series-first',
  );
  const positions = await page.evaluate(() =>
    ['.home-recent', '.home-series__band', '.podcast-invitation'].map((selector) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing Home section: ${selector}`);
      return element.getBoundingClientRect().top;
    }),
  );
  expect(positions[0]!).toBeLessThan(positions[1]!);
  expect(positions[1]!).toBeLessThan(positions[2]!);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(cards).toBeVisible();
  await expect(cards.locator('li')).toHaveCount(3);
  const strip = await cards.evaluate((element) => ({
    overflow: getComputedStyle(element).overflowX,
    widths: Array.from(element.querySelectorAll('li')).map(
      (item) => item.getBoundingClientRect().width,
    ),
  }));
  expect(strip.overflow).toBe('auto');
  for (const width of strip.widths) expect(width).toBeCloseTo(150, 0);
});

test('latest stories and section shelves adapt without changing source order', async ({ page }) => {
  test.skip(scenario !== 'representative', 'Representative-only composition contract.');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const recent = page.locator('.home-recent');
  const stories = recent.locator('[data-home-story]');
  await expect(stories).toHaveCount(7);
  await expect(recent.locator('.home-recent__list [data-home-story]')).toHaveCount(4);
  await expect(recent.locator('.home-recent__more [data-home-story]')).toHaveCount(3);
  expect(
    (
      await recent
        .locator('.home-recent__list')
        .evaluate((element) => getComputedStyle(element).gridTemplateColumns)
    ).split(' '),
  ).toHaveLength(4);
  const titles = await tierTitles(page, 'recent');

  await page.setViewportSize({ width: 320, height: 800 });
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 320);
  expect(await tierTitles(page, 'recent')).toEqual(titles);
  for (let i = 0; i < 7; i++) {
    if (i < 5) {
      await expect(stories.nth(i)).toBeVisible();
      const image = stories.nth(i).locator('img');
      const box = await image.boundingBox();
      expect(box?.width).toBeCloseTo(104, 0);
      expect(box?.height).toBeCloseTo(104, 0);
      const title = await stories.nth(i).locator('.title').boundingBox();
      expect(title!.x + title!.width).toBeLessThanOrEqual(box!.x);
      expect(Math.abs(title!.y - box!.y)).toBeLessThan(104);
    } else await expect(stories.nth(i)).toBeHidden();
  }
  const shelves = page.locator('.home-shelf--wide, .home-shelf--compact');
  await expect(shelves).not.toHaveCount(0);
  for (const shelf of await shelves.all()) {
    await expect(shelf.locator('.home-shelf__entries')).toBeHidden();
    await expect(shelf.locator('.home-shelf__label')).toBeVisible();
  }
});

test('Home survives text spacing, long content, and keyboard source order', async ({
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
    page.getByRole('heading', {
      level: 3,
      name: 'A Deliberately Long Category Name for Narrow Readers',
    }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  const links = page.locator('.home-catalog a[href]:visible');
  const expectedHrefs = await links.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('href')),
  );
  expect(expectedHrefs.length).toBeGreaterThan(0);
  const focusedHrefs: string[] = [];
  const outlines: Array<{ style: string; width: number }> = [];
  for (let step = 0; step < 200 && focusedHrefs.length < expectedHrefs.length; step++) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const element = document.activeElement;
      if (!(element instanceof HTMLAnchorElement) || !element.closest('.home-catalog'))
        return undefined;
      const style = getComputedStyle(element);
      return {
        href: element.getAttribute('href'),
        style: style.outlineStyle,
        width: parseFloat(style.outlineWidth),
      };
    });
    if (focused?.href) {
      focusedHrefs.push(focused.href);
      outlines.push({ style: focused.style, width: focused.width });
    }
  }
  expect(focusedHrefs).toEqual(expectedHrefs);
  for (const outline of outlines) {
    expect(outline.style).not.toBe('none');
    expect(outline.width).toBeGreaterThanOrEqual(2);
  }
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
