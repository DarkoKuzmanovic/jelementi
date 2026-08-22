import { expect, test, type Page, type TestInfo } from '@playwright/test';
import {
  STUDIO_ACCEPTANCE_IDENTITY_HEADER,
  STUDIO_ACCEPTANCE_IDENTITY_TOKEN,
} from '../../src/lib/server/studio/request-guard.server';
import { STUDIO_ACCEPTANCE_RECOVERY_HEADER } from '../../src/lib/server/studio/acceptance-bootstrap.server';
import { expectFirstSaveLanded, waitForStudioHydration } from './helpers';

const FLOWBOARD_SCENARIO_HEADER = 'x-studio-acceptance-flowboard';
const READY_SLUG = 'lighthouse-watch';
const INVALID_SLUG = 'weather-notes';
const FAILED_SLUG = 'failed-crossing';
const APPROVED_SLUG = 'approved-passage';
const CHECKING_SLUG = 'checking-tide';
const LIVE_SLUG = 'verified-harbor';
const REQUIRED_FIXTURE_SLUGS = [
  READY_SLUG,
  INVALID_SLUG,
  FAILED_SLUG,
  APPROVED_SLUG,
  CHECKING_SLUG,
  LIVE_SLUG,
] as const;

async function renderedArticleSlugs(page: Page): Promise<string[]> {
  return page.locator('[data-article-slug]').evaluateAll((cards) =>
    cards.map((card) => {
      const slug = card.getAttribute('data-article-slug');
      if (slug === null) throw new Error('Flowboard card is missing its article slug.');
      return slug;
    }),
  );
}

async function expectCompleteUniqueArticleSet(page: Page): Promise<string[]> {
  const slugs = await renderedArticleSlugs(page);
  expect(slugs.length).toBeGreaterThanOrEqual(REQUIRED_FIXTURE_SLUGS.length);
  expect(new Set(slugs).size).toBe(slugs.length);
  for (const slug of REQUIRED_FIXTURE_SLUGS) expect(slugs).toContain(slug);
  await expect(page.getByText(`${slugs.length} of ${slugs.length} articles shown`)).toBeVisible();
  return slugs;
}

async function createRegressionDraft(page: Page, testInfo: TestInfo): Promise<string> {
  const suffix = testInfo.project.name === 'studio-no-js' ? 'no-js' : 'js';
  const slug = `flowboard-created-${suffix}`;
  await page.goto('/studio/articles/new');
  await waitForStudioHydration(page, testInfo);
  await page
    .getByRole('textbox', { name: 'Title', exact: true })
    .fill(`Flowboard created ${suffix}`);
  await page.getByRole('textbox', { name: 'Slug', exact: true }).fill(slug);
  await page
    .getByRole('textbox', { name: 'Excerpt', exact: true })
    .fill('A draft created to prove exhaustive Flowboard assignment.');
  await page
    .getByRole('textbox', { name: 'Body', exact: true })
    .fill('This newly created article must remain visible on the Flowboard.');
  await page.getByText('More metadata', { exact: false }).click();
  await page.getByRole('textbox', { name: 'Alt text', exact: true }).fill('Acceptance cover.');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expectFirstSaveLanded(page, slug, testInfo);
  return slug;
}

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({
    [STUDIO_ACCEPTANCE_IDENTITY_HEADER]: STUDIO_ACCEPTANCE_IDENTITY_TOKEN,
  });
});

test.describe('Flowboard server projection', () => {
  test('renders every active, blocked, decision, Library, and newly created article exactly once', async ({
    page,
  }, testInfo) => {
    const createdSlug = await createRegressionDraft(page, testInfo);
    const response = await page.goto('/studio');
    expect(response?.status()).toBe(200);

    await expect(page.getByRole('heading', { name: 'Resume work' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ready for your decision' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Library', exact: true })).toBeVisible();

    const slugs = await expectCompleteUniqueArticleSet(page);
    expect(slugs).toContain(createdSlug);
    await expect(page.locator(`[data-article-slug="${createdSlug}"]`)).toHaveCount(1);

    await expect(
      page.locator(`[data-article-slug="${INVALID_SLUG}"]`).getByText('Saved — needs fixes'),
    ).toBeVisible();
    await expect(
      page.locator(`[data-article-slug="${FAILED_SLUG}"]`).getByText('Checks failed'),
    ).toBeVisible();
    await expect(
      page.locator(`[data-article-slug="${READY_SLUG}"]`).getByText('Ready to publish'),
    ).toBeVisible();
    await expect(
      page
        .locator(`[data-article-slug="${APPROVED_SLUG}"]`)
        .getByText('Approved — waiting for checks'),
    ).toBeVisible();
    await expect(
      page.locator(`[data-article-slug="${CHECKING_SLUG}"]`).getByText('Checks running'),
    ).toBeVisible();
    await expect(
      page.locator(`[data-article-slug="${READY_SLUG}"]`).getByRole('link', {
        name: 'Publish saved version',
      }),
    ).toHaveAttribute('href', `/studio/articles/${READY_SLUG}#publication-center`);
  });

  test('Check status probes one card and returns fresh Live evidence without polling', async ({
    page,
  }) => {
    await page.goto('/studio');
    const card = page.locator(`[data-article-slug="${LIVE_SLUG}"]`);
    // #116: the unprobed default is honest neutral, never a perpetual rollout.
    await expect(card.getByText('Published — not verified')).toBeVisible();

    await Promise.all([
      page.waitForNavigation(),
      card.getByRole('button', { name: 'Check status' }).click(),
    ]);

    const checkedCard = page.locator(`[data-article-slug="${LIVE_SLUG}"]`);
    await expect(checkedCard.getByText('Live and verified', { exact: true })).toBeVisible();
    // #116: a verified outcome shows when it was verified.
    await expect(checkedCard.getByText(/verified \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC/)).toBeVisible();
    await expect(page.getByText(`Status checked for ${LIVE_SLUG}.`)).toBeVisible();

    await page.goto('/studio');
    await expect(
      page
        .locator(`[data-article-slug="${LIVE_SLUG}"]`)
        .getByText('Published — not verified', { exact: true }),
    ).toBeVisible();
  });

  test('announces a failed check honestly while every card degrades gracefully (#116)', async ({
    page,
  }, testInfo) => {
    await page.setExtraHTTPHeaders({
      [STUDIO_ACCEPTANCE_IDENTITY_HEADER]: STUDIO_ACCEPTANCE_IDENTITY_TOKEN,
      [STUDIO_ACCEPTANCE_RECOVERY_HEADER]: 'check-offline',
    });
    await page.goto('/studio');
    await waitForStudioHydration(page, testInfo);
    const slugs = await expectCompleteUniqueArticleSet(page);

    const card = page.locator(`[data-article-slug="${READY_SLUG}"]`);
    if (testInfo.project.name === 'studio-no-js') {
      await Promise.all([
        page.waitForNavigation(),
        card.getByRole('button', { name: 'Check status' }).click(),
      ]);
    } else {
      await card.getByRole('button', { name: 'Check status' }).click();
    }

    // #116: the failure names its cause category with retry guidance —
    // never "Status checked".
    await expect(
      page.getByText(`Could not check ${READY_SLUG} — GitHub could not be reached. Try again.`),
    ).toBeVisible();
    await expect(page.getByText(`Status checked for ${READY_SLUG}.`)).toHaveCount(0);
    // Graceful degradation: the complete board still renders.
    await expectCompleteUniqueArticleSet(page);
    expect(slugs.length).toBeGreaterThan(0);
  });

  test('stacks columns in approved order without losing cards or horizontal reflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto('/studio');

    const resumeBox = await page.getByRole('heading', { name: 'Resume work' }).boundingBox();
    const decisionBox = await page
      .getByRole('heading', { name: 'Ready for your decision' })
      .boundingBox();
    const libraryBox = await page
      .getByRole('heading', { name: 'Library', exact: true })
      .boundingBox();
    expect(resumeBox?.y).toBeLessThan(decisionBox?.y ?? 0);
    expect(decisionBox?.y).toBeLessThan(libraryBox?.y ?? 0);
    const slugs = await expectCompleteUniqueArticleSet(page);
    await expect(page.locator('[data-article-slug]')).toHaveCount(slugs.length);
    await expect(page.getByText('Published version', { exact: true })).toHaveCount(slugs.length);
    await expect(page.getByRole('button', { name: 'Check status' })).toHaveCount(slugs.length);

    const firstCard = page.locator('[data-article-slug]').first();
    await firstCard.getByText('Evidence', { exact: true }).click();
    await expect(firstCard.getByText('Base version', { exact: true })).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

  test('renders the purposeful no-content state through the acceptance-only server fixture', async ({
    page,
  }) => {
    await page.setExtraHTTPHeaders({
      [STUDIO_ACCEPTANCE_IDENTITY_HEADER]: STUDIO_ACCEPTANCE_IDENTITY_TOKEN,
      [FLOWBOARD_SCENARIO_HEADER]: 'empty',
    });
    await page.goto('/studio');

    await expect(page.getByRole('heading', { name: 'No articles in Studio yet' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create your first article' })).toBeVisible();
  });
});

test.describe('Flowboard local enhancement', () => {
  test('search, workflow filter, counts, and view controls affect only rendered cards', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.includes('no-js'), 'Local controls require hydration.');
    await page.goto('/studio');
    await page.waitForLoadState('networkidle');
    const slugs = await expectCompleteUniqueArticleSet(page);
    const enhancementRequests: string[] = [];
    page.on('request', (request) => enhancementRequests.push(request.url()));

    await page.getByRole('searchbox', { name: 'Search articles' }).fill('weather');
    await expect(page.getByText(`1 of ${slugs.length} articles shown`)).toBeVisible();
    await expect(page.locator(`[data-article-slug="${INVALID_SLUG}"]`)).toBeVisible();
    await expect(page.locator(`[data-article-slug="${READY_SLUG}"]`)).toBeHidden();

    await page.getByRole('searchbox', { name: 'Search articles' }).fill('');
    await page.getByLabel('Filter by workflow').selectOption('ready-for-decision');
    await expect(page.locator(`[data-article-slug="${READY_SLUG}"]`)).toBeVisible();
    const visibleDecisionCount = await page.locator('[data-article-slug]:visible').count();
    await expect(
      page.getByText(`${visibleDecisionCount} of ${slugs.length} articles shown`),
    ).toBeVisible();

    await page.getByRole('radio', { name: 'Compact' }).check();
    await expect(page.getByRole('radio', { name: 'Compact' })).toBeChecked();
    await expect(page.locator('[data-article-slug]')).toHaveCount(slugs.length);
    expect(enhancementRequests).toEqual([]);
  });

  test('shows a filtered empty state without fetching or inventing lifecycle state', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.includes('no-js'), 'Local controls require hydration.');
    await page.goto('/studio');
    const slugs = await expectCompleteUniqueArticleSet(page);
    await page.getByRole('searchbox', { name: 'Search articles' }).fill('does-not-exist');

    await expect(page.getByText(`0 of ${slugs.length} articles shown`)).toBeVisible();
    await expect(page.getByText('No articles match these local controls.')).toBeVisible();
    await expect(page.locator('[data-article-slug]')).toHaveCount(slugs.length);
  });
});
