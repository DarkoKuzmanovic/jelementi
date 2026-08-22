import { expect, test, type Page, type TestInfo } from '@playwright/test';
import {
  STUDIO_ACCEPTANCE_IDENTITY_HEADER,
  STUDIO_ACCEPTANCE_IDENTITY_TOKEN,
} from '../../src/lib/server/studio/request-guard.server';
import { STUDIO_ACCEPTANCE_SAVE_UNLOCK_SLUGS } from '../../src/lib/server/studio/acceptance-bootstrap.server';
import { waitForStudioHydration } from './helpers';

/**
 * #115 save advances the visible lifecycle.
 *
 * A successful Save must advance the page's lifecycle status immediately:
 * a valid save on a published article with no prior draft unlocks Publish
 * with zero additional actions — no Check status click, no reload — and an
 * invalid save flips the summary and the publish panel to the invalid
 * state together. Both delivery paths prove it: the enhanced in-place
 * completion (JS project) and the server-rendered action result (no-JS).
 *
 * Fixture safety: each project edits only its own pristine canonical
 * published article (`calm-bay-*`, per-project like #111's open-cove
 * fixtures); no other spec reads these slugs.
 */

const identityHeaders = {
  [STUDIO_ACCEPTANCE_IDENTITY_HEADER]: STUDIO_ACCEPTANCE_IDENTITY_TOKEN,
};

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders(identityHeaders);
});

function saveUnlockSlug(testInfo: TestInfo): string {
  return testInfo.project.name === 'studio-no-js'
    ? STUDIO_ACCEPTANCE_SAVE_UNLOCK_SLUGS[1]
    : STUDIO_ACCEPTANCE_SAVE_UNLOCK_SLUGS[0];
}

async function expectPublishLocked(page: Page): Promise<void> {
  const publish = page.getByRole('button', { name: 'Publish saved version' });
  await expect(publish).toBeDisabled();
  await expect(
    page.getByText('Publish is available only for a valid saved Studio draft.'),
  ).toBeVisible();
}

test('#115 a successful Save unlocks Publish with no reload or Check-status click', async ({
  page,
}, testInfo) => {
  const slug = saveUnlockSlug(testInfo);
  await page.goto(`/studio/articles/${slug}`);
  await waitForStudioHydration(page, testInfo);

  // Pre-state: a canonical published article without a draft cannot offer
  // Publish, and the eligibility copy says exactly why.
  await expectPublishLocked(page);

  await page
    .getByRole('textbox', { name: 'Body', exact: true })
    .fill('A valid edit whose Save alone must unlock Publish.');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByRole('heading', { name: 'Studio draft saved' })).toBeVisible();

  // Enhanced path: the completion happened in place — no navigation at all,
  // so every assertion below is proven against the same document the Save
  // response updated. (The no-JS path's full-page POST IS its navigation.)
  if (testInfo.project.name !== 'studio-no-js') {
    expect(page.url()).not.toContain('?/');
  }

  // Zero additional actions: no reload, no Check status click. Summary and
  // panel agree that the just-saved draft is ready to publish.
  const validationSummary = page.locator('#validation-summary');
  await expect(validationSummary.getByText('Ready to publish', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publish saved version' })).toBeEnabled();
  await expect(
    page.getByText('Available for this valid saved version.', { exact: false }),
  ).toBeVisible();

  // The follow-up invalid save flips BOTH surfaces to the invalid state
  // coherently: the summary names the broken working change while the panel
  // lists the blocking issue and keeps Publish locked with matching copy.
  await page
    .getByRole('textbox', { name: 'Body', exact: true })
    .fill('# Unsupported heading after a valid save.');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByRole('heading', { name: 'Saved — needs fixes' })).toBeVisible();

  await expect(validationSummary.getByText('Saved — needs fixes', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publish saved version' })).toBeDisabled();
  await expect(
    page
      .getByRole('complementary', { name: 'Publication center' })
      .getByText('does not compile', { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText('Fix the reported issues before publishing, then save the corrected form.'),
  ).toBeVisible();
});
