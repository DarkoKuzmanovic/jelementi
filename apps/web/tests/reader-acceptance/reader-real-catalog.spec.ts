import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

interface CanonicalIndexEntry {
  slug: string;
  title: string;
  publishedAt: string;
  categorySlug: string;
}

const canonicalIndex = JSON.parse(
  readFileSync(new URL('../../../../generated/index.json', import.meta.url), 'utf8'),
) as CanonicalIndexEntry[];
const expectedHome = [...canonicalIndex].sort((left, right) => {
  const newestFirst = right.publishedAt.localeCompare(left.publishedAt);
  if (newestFirst !== 0) return newestFirst;
  if (left.slug < right.slug) return -1;
  if (left.slug > right.slug) return 1;
  return 0;
});

test('smokes the complete canonical generated Reader inventory independently of fixtures', async ({
  page,
  request,
}) => {
  const expectedLead = expectedHome[0];
  if (expectedLead === undefined) throw new Error('Canonical generated index is empty.');

  await page.goto('/');
  const homeLinks = page.locator('.home-catalog a[href^="/articles/"]');
  await expect(homeLinks).toHaveCount(expectedHome.length);
  expect(
    await homeLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
  ).toEqual(expectedHome.map((entry) => `/articles/${entry.slug}`));
  expect((await homeLinks.allTextContents()).map((title) => title.trim())).toEqual(
    expectedHome.map((entry) => entry.title),
  );

  const leadLink = page.locator('[data-home-tier="lead"] a[href^="/articles/"]');
  await expect(leadLink).toHaveCount(1);
  await expect(leadLink).toHaveText(expectedLead.title);
  await expect(page.locator('.home-catalog .article-summary')).toHaveCount(expectedHome.length);
  await expect(page.getByRole('region', { name: 'Recently published' })).toHaveCount(
    expectedHome.length > 1 ? 1 : 0,
  );
  await expect(page.getByRole('region', { name: 'More articles' })).toHaveCount(
    expectedHome.length > 4 ? 1 : 0,
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
  await expect(page.getByRole('link', { name: expectedLead.title })).not.toHaveCount(0);

  await page.goto(`/categories/${expectedLead.categorySlug}`);
  await expect(page.getByRole('link', { name: expectedLead.title })).toBeVisible();

  await page.goto(`/articles/${expectedLead.slug}`);
  await expect(page.getByRole('heading', { level: 1, name: expectedLead.title })).toBeVisible();
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
    if (!(page instanceof HTMLElement) || !(body instanceof HTMLElement)) {
      throw new Error('Canonical article measures are missing.');
    }
    return { page: page.getBoundingClientRect().width, body: body.getBoundingClientRect().width };
  });
  expect(measures.page).toBeLessThanOrEqual(52 * 16);
  expect(measures.body).toBeLessThanOrEqual(50 * 16);
  await expect(page.locator('meta[name="jelementi-content-version"]')).toHaveCount(1);

  const indexResponse = await request.get('/index.json');
  expect(indexResponse.ok()).toBe(true);
  const remoteIndex = (await indexResponse.json()) as Array<{ slug: string; title: string }>;
  expect(remoteIndex.length).toBeGreaterThan(0);

  await page.goto('/search');
  await expect(page.getByRole('heading', { level: 1, name: 'Search' })).toBeVisible();
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
