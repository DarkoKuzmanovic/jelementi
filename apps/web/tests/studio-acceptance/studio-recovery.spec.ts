import { expect, test, type Page, type TestInfo } from '@playwright/test';
import {
  STUDIO_ACCEPTANCE_IDENTITY_HEADER,
  STUDIO_ACCEPTANCE_IDENTITY_TOKEN,
} from '../../src/lib/server/studio/request-guard.server';

/**
 * Validation & recovery presentation acceptance (#77).
 *
 * Every scenario here is induced by mutating the deterministic fake-GitHub
 * world through `x-studio-acceptance-recovery` (see
 * `acceptance-bootstrap.server.ts`) — the save/replace/publish domain
 * functions themselves are never faked; they observe a moved `main`, a
 * moved draft head, or an unreachable GitHub exactly as production would.
 *
 * Both Playwright projects run this file: the js-enabled project also
 * proves the progressive enhancement (issue links focusing the exact body
 * range); the no-js project proves the same panels and the same ordinary
 * `<form method="POST">` recovery journey need no client script.
 */

// Mirrors STUDIO_ACCEPTANCE_RECOVERY_HEADER (acceptance-bootstrap.server.ts).
const RECOVERY_SCENARIO_HEADER = 'x-studio-acceptance-recovery';
// Seeded committed-but-invalid fixture owned by #74 (read-only here).
const INVALID_SLUG = 'weather-notes';
const INVALID_BODY = '# Unsupported acceptance heading';

const identityHeaders = {
  [STUDIO_ACCEPTANCE_IDENTITY_HEADER]: STUDIO_ACCEPTANCE_IDENTITY_TOKEN,
};

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders(identityHeaders);
});

function slugSuffix(testInfo: TestInfo): string {
  return testInfo.project.name === 'studio-no-js' ? 'no-js' : 'js';
}

/** Creates and saves a fresh, valid article through the real new-article form. */
async function createSavedArticle(
  page: Page,
  slug: string,
  options: { publishable: boolean },
): Promise<void> {
  await page.goto('/studio/articles/new');
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill(`Recovery ${slug}`);
  await page.getByRole('textbox', { name: 'Slug', exact: true }).fill(slug);
  await page
    .getByRole('textbox', { name: 'Excerpt', exact: true })
    .fill('A deterministic recovery-journey article.');
  await page
    .getByRole('textbox', { name: 'Body', exact: true })
    .fill('A deterministic recovery-journey body paragraph.');
  await page.getByText('More metadata', { exact: false }).click();
  await page.getByRole('textbox', { name: 'Alt text', exact: true }).fill('Recovery cover.');
  if (options.publishable) {
    await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('published');
    await page.getByRole('textbox', { name: 'Published date', exact: true }).fill('2026-08-18');
  }
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByRole('heading', { name: 'Studio draft saved' })).toBeVisible();
}

test.describe('Validation summary', () => {
  test('a committed invalid draft surfaces an actionable, targeted summary on plain load', async ({
    page,
  }, testInfo) => {
    await page.goto(`/studio/articles/${INVALID_SLUG}`);

    await expect(page.getByRole('heading', { name: 'Validation issues' })).toBeVisible();
    await expect(
      page.getByText('1 validation issue (blocking) in body.', { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByText('Publish stays blocked until every issue is fixed.', { exact: false }),
    ).toBeVisible();

    // The issue links to the exact body location, as a plain anchor that
    // needs no JavaScript.
    const issueLink = page.getByRole('link', { name: /Go to Body, line \d+, column \d+/ }).first();
    await expect(issueLink).toHaveAttribute('href', '#studio-body');

    if (testInfo.project.name !== 'studio-no-js') {
      // Progressive enhancement: clicking the link focuses the body textarea
      // and selects exactly the offending line. Before hydration attaches
      // the handler the click falls back to plain fragment navigation
      // (focus only, no selection), so poll: re-click until the hydrated
      // handler has produced the selection.
      await expect
        .poll(async () => {
          await issueLink.click();
          return page.evaluate(() => {
            const active = document.activeElement;
            if (!(active instanceof HTMLTextAreaElement) || active.id !== 'studio-body') {
              return null;
            }
            return active.value.slice(active.selectionStart ?? 0, active.selectionEnd ?? 0);
          });
        })
        .toBe(INVALID_BODY);
    }
  });

  test('a metadata issue link reveals and focuses its control inside the closed disclosure', async ({
    page,
  }, testInfo) => {
    const slug = `recovery-nested-${slugSuffix(testInfo)}`;
    // A published article saved without a published date: Save never blocks
    // on validity, and the resulting issue targets the Published date
    // control, which lives inside the initially closed "More metadata"
    // disclosure.
    await page.goto('/studio/articles/new');
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill(`Recovery ${slug}`);
    await page.getByRole('textbox', { name: 'Slug', exact: true }).fill(slug);
    await page
      .getByRole('textbox', { name: 'Excerpt', exact: true })
      .fill('A nested-control validation-targeting article.');
    await page.getByRole('textbox', { name: 'Body', exact: true }).fill('A fine body paragraph.');
    await page.getByText('More metadata', { exact: false }).click();
    await page.getByRole('textbox', { name: 'Alt text', exact: true }).fill('Recovery cover.');
    await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('published');
    await page.getByRole('button', { name: 'Save draft' }).click();

    await expect(page.getByRole('heading', { name: 'Saved — needs fixes' })).toBeVisible();

    // The publication center's validation summary lives on the article
    // route; the committed draft is invalid, so a plain load targets the
    // Published date control.
    await page.goto(`/studio/articles/${slug}`);
    await expect(page.getByRole('heading', { name: 'Validation issues' })).toBeVisible();
    const link = page.getByRole('link', { name: 'Go to Published date' }).first();
    await expect(link).toHaveAttribute('href', '#studio-field-publishedAt');

    // The focus enhancement must work from the closed state — close the
    // disclosure again if the creation flow left it open after hydration.
    const disclosure = page.locator('details.studio-editor__metadata');
    if (await disclosure.evaluate((node) => (node as HTMLDetailsElement).open)) {
      await page.getByText('More metadata', { exact: false }).click();
    }
    await expect(disclosure).toHaveJSProperty('open', false);

    if (testInfo.project.name === 'studio-no-js') {
      // Without JavaScript the link stays a plain fragment anchor.
      await link.click();
      await expect(page).toHaveURL(new RegExp('#studio-field-publishedAt$'));
      return;
    }

    // Hydrated: activating the link opens the ancestor disclosure and
    // focuses the exact control. Before hydration attaches the handler the
    // click is plain fragment navigation (no focus), so poll: re-click
    // until the hydrated handler has revealed and focused.
    await expect
      .poll(async () => {
        await link.click();
        return page.evaluate(() => {
          const metadataDisclosure = document.querySelector('details.studio-editor__metadata');
          return {
            open: metadataDisclosure instanceof HTMLDetailsElement ? metadataDisclosure.open : null,
            focused: document.activeElement?.id ?? null,
          };
        });
      })
      .toEqual({ open: true, focused: 'studio-field-publishedAt' });
  });
});

test.describe('Recovery presentation', () => {
  test('a save conflict explains itself, offers replacement, and the replacement completes', async ({
    page,
  }, testInfo) => {
    const slug = `recovery-journey-${slugSuffix(testInfo)}`;
    await createSavedArticle(page, slug, { publishable: false });
    await page.goto(`/studio/articles/${slug}`);

    // Another session moves `main` before this Save lands.
    await page.setExtraHTTPHeaders({
      ...identityHeaders,
      [RECOVERY_SCENARIO_HEADER]: 'main-moved',
    });
    await page.getByRole('button', { name: 'Save draft' }).click();

    await expect(
      page.getByRole('heading', { name: 'Save blocked: this draft moved on GitHub' }),
    ).toBeVisible();
    await expect(page.getByText('Nothing you typed was lost.', { exact: false })).toBeVisible();
    await expect(
      page.getByText('Readers saw no change; the published site was not touched.').first(),
    ).toBeVisible();
    // The evidence comparison names what moved.
    await expect(page.getByText('Draft head', { exact: true })).toBeVisible();

    // The offered path always carries the server-read eligibility evidence:
    // the article blob on loaded main versus fresh main (proven identical),
    // never an unread placeholder.
    const recoveryPanel = page.locator('.studio-recovery-panel');
    await expect(recoveryPanel.getByText('Article on main', { exact: true })).toBeVisible();
    await expect(recoveryPanel.getByText(`content/articles/${slug}.md`)).toBeVisible();
    await expect(
      recoveryPanel.getByText('Draft article blob (expected)', { exact: true }),
    ).toBeVisible();
    await expect(recoveryPanel.getByText('not read')).toHaveCount(0);

    // The offer is the server-verified replacement path, one click away.
    const replaceButton = page.getByRole('button', { name: 'Replace stale Studio draft' });
    await expect(replaceButton).toBeVisible();
    await replaceButton.click();

    await expect(page.getByRole('heading', { name: 'Studio draft replaced' })).toBeVisible();
    await expect(
      page.getByText('the previous approval was not carried forward', { exact: false }),
    ).toBeVisible();
    // Replacement evidence links to the recreated pull request.
    await expect(page.getByRole('link', { name: /^#\d+$/ })).toBeVisible();

    // The journey continues in the same form: with the fresh evidence the
    // next ordinary Save succeeds.
    await page.setExtraHTTPHeaders(identityHeaders);
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByRole('heading', { name: 'Studio draft saved' })).toBeVisible();
  });

  test('a save failure states that nothing changed, and the promised retry works', async ({
    page,
  }, testInfo) => {
    const slug = `recovery-offline-${slugSuffix(testInfo)}`;
    await createSavedArticle(page, slug, { publishable: false });
    await page.goto(`/studio/articles/${slug}`);

    // GitHub is unreachable for exactly the next save attempt.
    await page.setExtraHTTPHeaders({
      ...identityHeaders,
      [RECOVERY_SCENARIO_HEADER]: 'save-offline',
    });
    await page.getByRole('button', { name: 'Save draft' }).click();

    await expect(page.getByRole('heading', { name: 'Save failed' })).toBeVisible();
    await expect(
      page.getByText('GitHub could not be reached during the main phase. Nothing was changed.'),
    ).toBeVisible();
    await expect(page.getByText('Save again when GitHub is reachable.')).toBeVisible();

    // The stated next action is true: the same form saves once GitHub is back.
    await page.setExtraHTTPHeaders(identityHeaders);
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByRole('heading', { name: 'Studio draft saved' })).toBeVisible();
  });

  test('a replacement that fails after mutating GitHub tells the truth about the partial state', async ({
    page,
  }, testInfo) => {
    const slug = `recovery-partial-${slugSuffix(testInfo)}`;
    await createSavedArticle(page, slug, { publishable: false });
    await page.goto(`/studio/articles/${slug}`);

    // Another session moves `main`, so this Save conflicts with an offer.
    await page.setExtraHTTPHeaders({
      ...identityHeaders,
      [RECOVERY_SCENARIO_HEADER]: 'main-moved',
    });
    await page.getByRole('button', { name: 'Save draft' }).click();
    const replaceButton = page.getByRole('button', { name: 'Replace stale Studio draft' });
    await expect(replaceButton).toBeVisible();

    // Main moves again and GitHub becomes unreachable for exactly the
    // branch delete — AFTER the replacement already closed the old Draft PR
    // (post-mutation partial state).
    await page.setExtraHTTPHeaders({
      ...identityHeaders,
      [RECOVERY_SCENARIO_HEADER]: 'replace-late-offline',
    });
    await replaceButton.click();

    await expect(
      page.getByRole('heading', { name: 'Draft replacement did not complete' }),
    ).toBeVisible();
    await page.setExtraHTTPHeaders(identityHeaders);
    // The presentation is truthful about the partial state: no global
    // no-mutation claim, no unproven Save-resume promise.
    await expect(
      page.getByText('The old Draft PR may already be closed', { exact: false }),
    ).toBeVisible();
    await expect(page.getByText('No branch or Draft PR was deleted')).toHaveCount(0);
    await expect(page.getByText('Save again to resume')).toHaveCount(0);
    await expect(
      page.getByText('Open this Studio article in a new tab', { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByText('your candidate stays in this form for copying', { exact: false }),
    ).toBeVisible();
    // The candidate is really still in the form.
    await expect(page.getByRole('textbox', { name: 'Body', exact: true })).toHaveValue(
      'A deterministic recovery-journey body paragraph.',
    );

    // The stated next action is true: rediscovering the article in a new
    // tab shows the current committed draft, and an ordinary Save there
    // continues the journey (the old Draft PR is closed; Save opens a
    // fresh one for the intact branch).
    const rediscovery = await page.context().newPage();
    await rediscovery.setExtraHTTPHeaders(identityHeaders);
    await rediscovery.goto(`/studio/articles/${slug}`);
    await rediscovery.getByRole('button', { name: 'Save draft' }).click();
    await expect(rediscovery.getByRole('heading', { name: 'Studio draft saved' })).toBeVisible();
    await rediscovery.close();
  });

  test('an exact-head publish is blocked when the draft moved, without touching readers', async ({
    page,
  }, testInfo) => {
    const slug = `recovery-publish-${slugSuffix(testInfo)}`;
    await createSavedArticle(page, slug, { publishable: true });
    await page.goto(`/studio/articles/${slug}`);
    await expect(page.getByText('Ready to publish', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish saved version' })).toBeEnabled();

    // A concurrent session lands a further commit on the draft branch.
    await page.setExtraHTTPHeaders({
      ...identityHeaders,
      [RECOVERY_SCENARIO_HEADER]: 'draft-moved',
    });
    await page.getByRole('button', { name: 'Publish saved version' }).click();

    await expect(
      page.getByRole('heading', { name: 'Publish blocked: the draft moved on GitHub' }),
    ).toBeVisible();
    await expect(
      page.getByText('Readers saw no change; the published site was not touched.').first(),
    ).toBeVisible();

    await page.setExtraHTTPHeaders(identityHeaders);
  });
});
