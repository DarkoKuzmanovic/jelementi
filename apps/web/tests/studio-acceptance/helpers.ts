import { expect, type Page, type TestInfo } from '@playwright/test';

/**
 * #78 acceptance helpers.
 *
 * SvelteKit hydration on the newly-hydrated Studio routes (`/studio`,
 * `/studio/articles/new`, `/studio/articles/[slug]`) completes
 * asynchronously after the first paint. Hydration re-binds every
 * server-bound control value, which would wipe any fill performed in that
 * window. The hydrated pages set
 * `document.documentElement.dataset.studioHydrated = 'true'` (see
 * `installStudioEnhancement` in studio-enhancement-page.ts); these helpers
 * wait for that marker before driving forms in the JS project, and are
 * no-ops in the no-JS project (which never hydrates).
 */

export async function waitForStudioHydration(page: Page, testInfo: TestInfo): Promise<void> {
  if (testInfo.project.name === 'studio-no-js') return;
  await page.waitForFunction(() => document.documentElement.dataset.studioHydrated === 'true');
}

/**
 * Asserts where a first Save on `/studio/articles/new` lands. With JS, the
 * enhanced Save performs a server-authored redirect to the canonical
 * `/studio/articles/<slug>` route (immutable slug; the workspace moves
 * there). Without JS, the full-navigation result stays in place with the
 * "Studio draft saved" confirmation.
 */
export async function expectFirstSaveLanded(
  page: Page,
  slug: string,
  testInfo: TestInfo,
): Promise<void> {
  if (testInfo.project.name === 'studio-no-js') {
    await expect(page.getByRole('heading', { name: 'Studio draft saved' })).toBeVisible();
    return;
  }
  await expect(page).toHaveURL(new RegExp(`/studio/articles/${slug}$`));
}
