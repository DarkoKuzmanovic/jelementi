import { expect, test, type Page } from '@playwright/test';
import {
  STUDIO_ACCEPTANCE_IDENTITY_HEADER,
  STUDIO_ACCEPTANCE_IDENTITY_TOKEN,
} from '../../src/lib/server/studio/request-guard.server';
import { expectFirstSaveLanded, waitForStudioHydration } from './helpers';
import type { TestInfo } from '@playwright/test';

// New-article identity safety (#109): derived slugs, pre-mutation collision
// rejection, and inline pattern help. The canonical-collision journey
// creates nothing (the server rejects before any mutation), and the
// draft-clash journey uses a unique slug of its own like every other spec,
// so neither depends on nor disturbs the shared fixture articles.
const CANONICAL_SLUG = 'verified-harbor';

const identityHeaders = {
  [STUDIO_ACCEPTANCE_IDENTITY_HEADER]: STUDIO_ACCEPTANCE_IDENTITY_TOKEN,
};

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders(identityHeaders);
});

async function fillForSave(
  page: Page,
  title: string,
  slug: string,
  testInfo: TestInfo,
): Promise<void> {
  await page.goto('/studio/articles/new');
  // Hydration re-binds server-bound control values and would wipe early
  // typing; the helper is a no-op in the no-js project.
  await waitForStudioHydration(page, testInfo);
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill(title);
  await page.getByRole('textbox', { name: 'Slug', exact: true }).fill(slug);
  await page.getByRole('textbox', { name: 'Excerpt', exact: true }).fill('A collision probe.');
  await page.getByText('More metadata', { exact: false }).click();
  await page.getByRole('textbox', { name: 'Alt text', exact: true }).fill('Collision probe cover.');
  await page.getByRole('textbox', { name: 'Body', exact: true }).fill('Never committed.');
}

/**
 * The editor's own inline save-result region. Since #110, the publication
 * center's validation summary co-displays the same rejection copy ("first
 * issue" paragraph plus list items), so rejection-copy assertions anchor
 * here instead of the whole page.
 */
function editorSaveRejection(page: Page) {
  return page.getByRole('region', { name: 'Save could not read this form' });
}

test.describe('new-article slug safety (#109)', () => {
  test('documents the allowed slug pattern inline next to the Slug control', async ({
    page,
  }, testInfo) => {
    await page.goto('/studio/articles/new');
    await waitForStudioHydration(page, testInfo);

    const slugInput = page.getByRole('textbox', { name: 'Slug', exact: true });
    await expect(slugInput).toHaveAttribute('pattern', '[a-z0-9]+(?:-[a-z0-9]+)*');
    await expect(slugInput).toHaveAttribute('aria-describedby', 'studio-field-slug-help');
    await expect(page.getByText('Lowercase, numbers, hyphens.')).toBeVisible();
  });

  test('JS: typing a title derives the slug; a hand edit freezes it; clearing resumes it', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.includes('no-js'), 'Derivation needs hydrated input events.');
    await page.goto('/studio/articles/new');
    await waitForStudioHydration(page, testInfo);

    const title = page.getByRole('textbox', { name: 'Title', exact: true });
    const slug = page.getByRole('textbox', { name: 'Slug', exact: true });

    // The placeholder holds until the writer touches the Title.
    await expect(slug).toHaveValue('new-article');
    await title.fill('My Fresh Story');
    await expect(slug).toHaveValue('my-fresh-story');

    // A manual edit freezes tracking.
    await slug.fill('hand-picked');
    await title.fill('My Fresh Story Two');
    await expect(slug).toHaveValue('hand-picked');

    // Clearing the manual edits resumes tracking.
    await slug.fill('');
    await title.fill('Resumed Title Here');
    await expect(slug).toHaveValue('resumed-title-here');
  });

  test('saving the slug of a canonical article is rejected before any mutation', async ({
    page,
  }, testInfo) => {
    await fillForSave(page, 'The Verified Harbor Impostor', CANONICAL_SLUG, testInfo);
    await page.getByRole('button', { name: 'Save draft' }).click();

    await expect(
      editorSaveRejection(page).getByText(
        'An article with this slug already exists — open it instead.',
      ),
    ).toBeVisible();
    // Rejected before any GitHub mutation: no draft branch was created, so
    // no "Studio draft saved" confirmation can appear anywhere.
    await expect(page.getByText('Studio draft saved')).toHaveCount(0);
    if (testInfo.project.name === 'studio-no-js') return;
    await waitForStudioHydration(page, testInfo);
    await expect(page).toHaveURL(/\/studio\/articles\/new/);
  });

  test('saving the slug of an active Studio draft names its Draft PR and offers paths', async ({
    page,
  }, testInfo) => {
    const slug = `draft-clash-${Date.now().toString(36)}`;

    // Create a real active draft first so the clash is deterministic.
    await fillForSave(page, `Draft Clash ${slug}`, slug, testInfo);
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expectFirstSaveLanded(page, slug, testInfo);

    // A second new article claiming the same slug must be rejected with the
    // truthful copy: the existing draft's PR number plus open/rename/discard
    // paths — never "this draft moved on GitHub".
    await fillForSave(page, `Clashing ${slug}`, slug, testInfo);
    await page.getByRole('button', { name: 'Save draft' }).click();

    await expect(
      editorSaveRejection(page).getByText(
        /A Studio draft for this slug already exists \(PR #\d+\)\./,
      ),
    ).toBeVisible();
    await expect(
      editorSaveRejection(page).getByText(
        'Open it, pick a different slug, or discard the existing draft.',
      ),
    ).toBeVisible();
    await expect(page.getByText('this draft moved on GitHub')).toHaveCount(0);
    if (testInfo.project.name === 'studio-no-js') return;
    await waitForStudioHydration(page, testInfo);
    await expect(page).toHaveURL(/\/studio\/articles\/new/);
  });
});
