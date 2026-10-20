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

test('published topic shortcuts keep approved desktop order with compact navigation and fallback recovery', async ({
  page,
  request,
}) => {
  const priority = ['science', 'history', 'places', 'nature', 'inventions'];
  const expected = priority.filter((slug) =>
    canonicalIndex.some((entry) => entry.categorySlug === slug),
  );
  for (const width of [320, 390, 768, 900, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Primary navigation' });
    const topics = nav.locator('.topic-shortcut');
    expect(await topics.evaluateAll((links) => links.map((a) => a.getAttribute('href')))).toEqual(
      expected.map((slug) => `/categories/${slug}`),
    );
    for (const topic of await topics.all()) {
      if (width >= 900) await expect(topic).toBeVisible();
      else await expect(topic).toBeHidden();
    }
    const directory = nav.getByRole('link', { name: 'Categories', exact: true });
    if (width >= 900 && expected.length) await expect(directory).toBeHidden();
    else await expect(directory).toBeVisible();
    for (const name of ['Home', 'Podcast', 'About', 'Search'])
      await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
    const boxes = await nav.locator('a:visible').evaluateAll((links) =>
      links.map((a) => ({
        text: a.textContent?.trim(),
        left: a.getBoundingClientRect().left,
        right: a.getBoundingClientRect().right,
        top: a.getBoundingClientRect().top,
      })),
    );
    expect(boxes.every((box) => box.left >= 0 && box.right <= width)).toBe(true);
    if (width >= 900 && expected.length) {
      const podcast = boxes.find((box) => box.text === 'Podcast')!;
      const lastTopic = boxes[expected.length]!;
      expect(podcast.top).toBe(lastTopic.top);
      expect(podcast.left - lastTopic.right).toBeGreaterThanOrEqual(width >= 1440 ? 100 : 28);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }
  for (const slug of expected)
    expect((await request.get(`/categories/${slug}`)).status()).toBe(200);
  await page.goto('/categories/science');
  await expect(page.locator('.site-header [aria-current="page"]')).toHaveAttribute(
    'href',
    '/categories',
  );
  const response = await page.goto('/missing-navigation-route');
  expect(response?.status()).toBe(404);
  await expect(page.locator('.site-header a[href="/categories"]')).toBeVisible();
  await expect(page.locator('.site-footer a[href="/categories"]')).toBeVisible();
});

test('smokes the complete canonical generated Reader inventory independently of fixtures', async ({
  page,
  request,
}) => {
  const expectedLead = expectedHome[0];
  if (expectedLead === undefined) throw new Error('Canonical generated index is empty.');
  const richArticle = expectedHome.find((entry) => entry.slug === 'tristan-da-cunha');
  if (richArticle === undefined) throw new Error('Canonical rich article is missing.');

  await page.goto('/');
  const homeLinks = page.locator('.home-catalog .article-summary__title a');
  await expect(homeLinks).toHaveCount(expectedHomeShelves.length);
  expect(
    await homeLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
  ).toEqual(expectedHomeShelves.map((entry) => `/articles/${entry.slug}`));
  expect((await homeLinks.allTextContents()).map((title) => title.trim())).toEqual(
    expectedHomeShelves.map((entry) => entry.title),
  );

  const leadLink = page.locator('[data-home-tier="lead"] .article-summary__title a');
  await expect(leadLink).toHaveCount(1);
  await expect(leadLink).toHaveText(expectedLead.title);
  await expect(page.locator('.home-catalog .article-summary')).toHaveCount(
    expectedHomeShelves.length,
  );
  await expect(page.getByRole('region', { name: 'Recently published' })).toHaveCount(
    expectedHome.length > 1 ? 1 : 0,
  );
  await expect(page.getByRole('region', { name: 'More articles' })).toHaveCount(
    catalog.shelves.length > 0 ? 1 : 0,
  );

  await page.goto('/categories');
  await expect(page.getByRole('heading', { level: 1, name: 'Categories' })).toBeVisible();
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
  await expect(opening.getByRole('list', { name: 'Tags' })).toBeVisible();
  await expect(
    page.locator('figure.article-cover').getByRole('img', { name: /Tristan da Cunha/ }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sources' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Footnotes' })).toBeVisible();
  const continuation = page.getByRole('navigation', { name: 'Continue reading' });
  await expect(continuation.getByRole('link', { name: /Return to/ })).toBeVisible();
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
  expect(measures.page).toBe(71.25 * 16);
  expect(measures.prose).toBeLessThanOrEqual(42.5 * 16);
  expect(measures.body).toBeLessThanOrEqual(50 * 16);
  await expect(page.locator('meta[name="jelementi-content-version"]')).toHaveCount(1);

  const indexResponse = await request.get('/index.json');
  expect(indexResponse.ok()).toBe(true);
  const remoteIndex = (await indexResponse.json()) as Array<{ slug: string; title: string }>;
  expect(remoteIndex.length).toBeGreaterThan(0);

  await page.goto('/search');
  await expect(page.getByRole('heading', { level: 1, name: 'Find a story.' })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(remoteIndex.length);
  await expect(page.getByRole('link', { name: expectedLead.title })).toBeVisible();
  expect(
    await page
      .locator('.article-list a[href^="/articles/"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
  ).toEqual(remoteIndex.map(({ slug }) => `/articles/${slug}`));

  await page.goto('/about');
  await expect(page.getByRole('heading', { level: 1, name: 'About Jelementi' })).toBeVisible();

  const notFound = await page.goto('/missing-real-catalog-route');
  expect(notFound?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'This page is not available.' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Page recovery' })).toBeVisible();
});
