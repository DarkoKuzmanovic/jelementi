import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { ArticleIndexEntry } from '@jelementi/article-model';
import { projectHomeCatalog } from '../../src/lib/home/home-catalog';

const canonicalIndex = JSON.parse(
  readFileSync(new URL('../../../../generated/index.json', import.meta.url), 'utf8'),
) as ArticleIndexEntry[];
const expectedHome = [...canonicalIndex].sort((left, right) => {
  const newestFirst = right.publishedAt.localeCompare(left.publishedAt);
  if (newestFirst !== 0) return newestFirst;
  if (left.slug < right.slug) return -1;
  if (left.slug > right.slug) return 1;
  return 0;
});
const catalog = projectHomeCatalog(canonicalIndex);
const expectedHomeShelves = [
  ...(catalog.lead ? [catalog.lead] : []),
  ...catalog.recent,
  ...catalog.shelves.flatMap((shelf) => shelf.entries),
];

test('section navigation, data utility strip, compact current state and fallback recovery', async ({
  page,
  request,
}) => {
  const expected = ['history', 'places', 'science', 'inventions', 'nature'].filter((slug) =>
    canonicalIndex.some((entry) => entry.categorySlug === slug),
  );
  for (const width of [320, 390, 768, 900, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Primary navigation' });
    const topics = nav.locator('.nav-sections a');
    expect(await topics.evaluateAll((links) => links.map((a) => a.getAttribute('href')))).toEqual(
      expected.map((slug) => `/categories/${slug}`),
    );
    for (const topic of await topics.all()) await expect(topic).toBeVisible();
    if (width > 900) {
      await expect(nav.getByRole('link', { name: 'Series', exact: true })).toBeVisible();
      await expect(nav.getByRole('search')).toHaveAttribute('method', 'get');
      await expect(page.locator('.site-utility')).toContainText(
        `${canonicalIndex.length} stories in five sections`,
      );
      await expect(page.locator('.site-utility')).toContainText('Updated 27 October 2026');
    } else {
      expect(await nav.evaluate((el) => getComputedStyle(el).overflowX)).toBe('auto');
      await expect(page.locator('.mobile-search')).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }
  for (const slug of expected)
    expect((await request.get(`/categories/${slug}`)).status()).toBe(200);
  await page.goto('/categories/science');
  await expect(page.locator('.site-header nav [aria-current="page"]')).toHaveAttribute(
    'href',
    '/categories/science',
  );
  const response = await page.goto('/missing-navigation-route');
  expect(response?.status()).toBe(404);
  await expect(page.locator('.site-footer a[href="/categories"]')).toBeVisible();
});

test('compact masthead fits interior routes at the mobile breakpoint boundary', async ({
  page,
}) => {
  for (const width of [901, 960, 961, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/categories/history');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('html')).toHaveJSProperty('scrollWidth', width);
    if (width <= 960) {
      await expect(page.locator('.mobile-masthead')).toBeVisible();
      await expect(page.locator('.site-header__inner')).toBeHidden();
    } else {
      const search = page.getByRole('search', { name: 'Navigation search' });
      await expect(search).toBeVisible();
      const bounds = await search.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    }
  }
});

test('masthead search replaces an already hydrated search query', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/search?query=blue');
  const input = page.getByRole('searchbox', { name: 'Search published articles' });
  await expect(input).toHaveValue('blue');
  await expect(page.getByRole('status')).toContainText('“blue”');

  const masthead = page.getByRole('search', { name: 'Navigation search' });
  await masthead.getByRole('searchbox').fill('history');
  await masthead.getByRole('button', { name: 'Find stories' }).click();
  await expect(page).toHaveURL(/\/search\?query=history$/);
  await expect(input).toHaveValue('history');
  await expect(page.getByRole('status')).toContainText('“history”');
  await expect(page.getByRole('article')).not.toHaveCount(0);
});

test('smokes the complete canonical generated Reader inventory independently of fixtures', async ({
  page,
}) => {
  const expectedLead = expectedHome[0];
  if (expectedLead === undefined) throw new Error('Canonical generated index is empty.');
  const richArticle = expectedHome.find((entry) => entry.slug === 'tristan-da-cunha');
  if (richArticle === undefined) throw new Error('Canonical rich article is missing.');

  await page.goto('/');
  const homeLinks = page.locator('.home-catalog [data-home-story] .title a');
  await expect(homeLinks).toHaveCount(expectedHomeShelves.length);
  expect(
    await homeLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
  ).toEqual(expectedHomeShelves.map((entry) => `/articles/${entry.slug}`));
  expect((await homeLinks.allTextContents()).map((title) => title.trim())).toEqual(
    expectedHomeShelves.map((entry) => entry.title),
  );

  const leadLink = page.locator('[data-home-tier="lead"] [data-home-story] .title a');
  await expect(leadLink).toHaveCount(1);
  await expect(leadLink).toHaveText(expectedLead.title);
  await expect(page.locator('.home-catalog [data-home-story]')).toHaveCount(
    expectedHomeShelves.length,
  );
  await expect(page.locator('.home-recent')).toHaveCount(expectedHome.length > 1 ? 1 : 0);
  await expect(page.locator('[data-home-tier="shelves"] .home-shelf')).toHaveCount(
    catalog.shelves.length,
  );

  await page.goto('/categories');
  await expect(page.getByRole('heading', { level: 1, name: 'Sections' })).toBeVisible();
  await expect(
    page.getByRole('main').getByRole('link', { name: 'History', exact: true }),
  ).toHaveAttribute('href', '/categories/history');
  await expect(
    page.getByRole('main').getByRole('link', { name: expectedLead.title }),
  ).toHaveAttribute('href', `/articles/${expectedLead.slug}`);

  await page.goto('/categories/history');
  await expect(page.getByRole('heading', { level: 1, name: 'History' })).toBeVisible();
  await expect(page.getByRole('link', { name: richArticle.title })).not.toHaveCount(0);

  await page.goto(`/categories/${expectedLead.categorySlug}`);
  await expect(page.getByRole('link', { name: expectedLead.title })).toBeVisible();

  await page.goto(`/articles/${expectedLead.slug}`);
  await expect(page.getByRole('heading', { level: 1, name: expectedLead.title })).toBeVisible();

  // The known rich article owns these content-specific assertions, not the newest article.
  await page.goto(`/articles/${richArticle.slug}`);
  await expect(page.getByRole('heading', { level: 1, name: richArticle.title })).toBeVisible();
  const opening = page.locator('.article-opening');
  await expect(opening.getByText('By Jelementi')).toBeVisible();
  await expect(opening.getByText('26 July 2026')).toBeVisible();
  await expect(opening.getByText('1 min read')).toBeVisible();
  await expect(opening.getByText(/min read/)).toBeVisible();
  await expect(page.locator('.article-facts').getByRole('list', { name: 'Tags' })).toBeVisible();
  await expect(
    page.locator('figure.article-cover').getByRole('img', { name: /Tristan da Cunha/ }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sources' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Footnotes' })).toBeVisible();
  const continuation = page.getByRole('navigation', { name: 'Continue reading' });
  await expect(continuation.getByRole('link', { name: /All History/ })).toBeVisible();
  const measures = await page.evaluate(() => {
    const page = document.querySelector('.article-page');
    const body = document.querySelector('.article-body');
    const prose = document.querySelector('.article-body > p');
    if (
      !(page instanceof HTMLElement) ||
      !(body instanceof HTMLElement) ||
      !(prose instanceof HTMLElement)
    ) {
      throw new Error('Canonical article measures are missing.');
    }
    return {
      page: page.getBoundingClientRect().width,
      body: body.getBoundingClientRect().width,
      prose: prose.getBoundingClientRect().width,
    };
  });
  expect(measures.page).toBe(await page.evaluate(() => window.innerWidth));
  expect(measures.prose).toBeLessThanOrEqual(42.5 * 16);
  expect(measures.body).toBeLessThanOrEqual(50 * 16);
  await expect(page.locator('meta[name="jelementi-content-version"]')).toHaveCount(1);

  await page.goto('/search');
  await expect(page.getByRole('heading', { level: 1, name: 'Find a story.' })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(canonicalIndex.length);
  await expect(page.getByRole('link', { name: expectedLead.title })).toBeVisible();
  expect(
    await page
      .locator('.article-list a[href^="/articles/"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
  ).toEqual(canonicalIndex.map(({ slug }) => `/articles/${slug}`));

  await page.goto('/about');
  await expect(page.getByRole('heading', { level: 1, name: 'About Jelementi' })).toBeVisible();
  await expect(page.locator('.about__facts')).toContainText(
    `${canonicalIndex.length} in five sections`,
  );
  await expect(
    page.getByRole('main').getByRole('link', { name: 'Podcast', exact: true }),
  ).toHaveAttribute('href', '/podcast.xml');
  await expect(
    page.getByRole('main').getByRole('link', { name: 'Article feed (RSS)' }),
  ).toHaveAttribute('href', '/feed.xml');

  await page.goto('/series/kalemegdan/dates');
  await expect(page.getByRole('heading', { level: 1, name: 'Dates to remember' })).toBeVisible();
  const card = page.locator('.study details').first();
  const date = card.locator('p');
  await expect(date).toBeHidden();
  const dateText = (await date.textContent())!.trim();
  expect(dateText).not.toBe('');
  expect(await card.ariaSnapshot()).not.toContain(dateText);
  await card.locator('summary').click();
  await expect(date).toBeVisible();
  expect(await card.ariaSnapshot()).toContain(dateText);
  await expect(card.locator('summary span')).toBeHidden();
  await expect(
    page.getByRole('link', { name: 'Download the series as an e-book' }),
  ).toHaveAttribute('href', '/series/kalemegdan.epub');

  const notFound = await page.goto('/missing-real-catalog-route');
  expect(notFound?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'This page is not available.' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Page recovery' })).toBeVisible();
  const recoverySearch = page.getByRole('search', { name: 'Page search' });
  await expect(recoverySearch).toHaveAttribute('method', 'get');
  await expect(recoverySearch).toHaveAttribute('action', '/search');
  await expect(recoverySearch.getByRole('searchbox')).toHaveAttribute('name', 'query');
  await recoverySearch.getByRole('searchbox').fill('blue');
  await recoverySearch.getByRole('button', { name: 'Search stories' }).click();
  await expect(page).toHaveURL(/\/search\?query=blue$/);
  await expect(page.getByRole('status')).toContainText('“blue”');
});
test('home shelves become category summaries on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const shelves = page.locator('.home-shelf--wide');
  await expect(shelves).not.toHaveCount(0);
  const firstShelf = shelves.first();
  const label = firstShelf.locator('.home-shelf__label h3');
  await expect(label).toBeVisible();
  expect(await label.evaluate((element) => getComputedStyle(element).fontSize)).toBe('34px');
  await expect(firstShelf.locator('.home-shelf__entries [data-home-story]')).not.toHaveCount(0);

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('html')).toHaveJSProperty('scrollWidth', width);
    for (const shelf of await page.locator('.home-shelf--wide, .home-shelf--compact').all()) {
      await expect(shelf.locator('.home-shelf__entries')).toBeHidden();
      await expect(shelf.locator('.home-shelf__label')).toBeVisible();
      await expect(shelf.locator('a[href^="/categories/"]:visible').first()).toBeVisible();
      await expect(shelf).toContainText(/\d+ stor(?:y|ies)/);
      const image = shelf.locator('img:visible');
      await expect(image).toBeVisible();
      const box = await image.boundingBox();
      expect(box?.width).toBeCloseTo(72, 0);
      expect(box?.height).toBeCloseTo(48, 0);
    }
  }
});
