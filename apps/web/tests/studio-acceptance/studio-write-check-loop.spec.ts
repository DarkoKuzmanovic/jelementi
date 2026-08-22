import { expect, test, type Page, type TestInfo } from '@playwright/test';
import {
  STUDIO_ACCEPTANCE_IDENTITY_HEADER,
  STUDIO_ACCEPTANCE_IDENTITY_TOKEN,
} from '../../src/lib/server/studio/request-guard.server';
import { waitForStudioHydration } from './helpers';

/**
 * #114 smooth the write–check loop.
 *
 * Body-first drafting past metadata requirements (located missing-field
 * issues instead of native tooltips), the ⌘/Ctrl+Enter preview shortcut,
 * the out-of-date indicator lifecycle, post-update focus on the preview
 * region, Tab/Shift+Tab body indentation, and the live word count.
 *
 * Fixture safety: the established-article journeys only ever run Preview
 * (read-only, never commits); every mutating journey happens on
 * /studio/articles/new under a unique slug whose emptied form fails server
 * decoding BEFORE any GitHub call, so nothing is ever created or changed.
 */

const ARTICLE_SLUG = 'lighthouse-watch';

const identityHeaders = {
  [STUDIO_ACCEPTANCE_IDENTITY_HEADER]: STUDIO_ACCEPTANCE_IDENTITY_TOKEN,
};

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders(identityHeaders);
});

async function openEstablishedEditor(page: Page, testInfo: TestInfo): Promise<void> {
  await page.goto(`/studio/articles/${ARTICLE_SLUG}`);
  await waitForStudioHydration(page, testInfo);
}

async function openNewArticleEditor(page: Page, testInfo: TestInfo): Promise<void> {
  await page.goto('/studio/articles/new');
  await waitForStudioHydration(page, testInfo);
}

function bodyBox(page: Page) {
  return page.getByRole('textbox', { name: 'Body', exact: true });
}

/**
 * Clears every control an emptied-metadata draft must be able to submit.
 * The Slug is skipped on established routes (draft-locked readonly there)
 * and emptied on routes where it is editable via the dedicated helper.
 */
async function emptyRequiredMetadata(page: Page): Promise<void> {
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('');
  await page.getByRole('textbox', { name: 'Excerpt', exact: true }).fill('');
  await page.getByText('More metadata', { exact: false }).click();
  await page.getByLabel('Updated date').fill('');
  await page.getByLabel('Category', { exact: true }).fill('');
  await page.getByLabel('Author', { exact: true }).fill('');
  await page.getByLabel('Media key').first().fill('');
}

test.describe('#114 body-first drafting past metadata requirements', () => {
  test('JS: an emptied established draft runs Preview and gets located missing-field issues', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.includes('no-js'), 'JS-specific focus assertions.');
    await openEstablishedEditor(page, testInfo);
    await emptyRequiredMetadata(page);

    // No native constraint blocks the submission: the enhanced request
    // completes and the located pipeline answers instead of a tooltip.
    await page.getByRole('button', { name: 'Preview', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Preview needs attention' })).toBeVisible();
    const summary = page.getByRole('region', { name: 'Validation issues' });
    await expect(summary).toBeVisible();
    await expect(summary.getByText(/validation issues \(blocking\)/)).toBeVisible();
    // Only the first issue carries the "Go to" lead; every issue in the
    // list anchors to its own control by label.
    for (const label of ['Title', 'Excerpt', 'Updated date', 'Author']) {
      await expect(summary.getByRole('link', { name: label, exact: true })).toBeVisible();
    }

    // Anchored: following an issue link lands on its own control — here a
    // control hidden inside the closed "More metadata" disclosure.
    await summary.getByRole('link', { name: 'Cover media key', exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.id ?? ''))
      .toBe('studio-field-coverSrc');
  });

  test('no-JS: an emptied established draft previews through full navigation with located issues', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'studio-no-js', 'No-JS equivalence only.');
    await page.goto(`/studio/articles/${ARTICLE_SLUG}`);
    await emptyRequiredMetadata(page);
    await page.getByRole('button', { name: 'Preview', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Preview needs attention' })).toBeVisible();
    const summary = page.getByRole('region', { name: 'Validation issues' });
    await expect(summary).toBeVisible();
    // Server-rendered fragment anchors work without JavaScript. Two links
    // target the Title: the first-issue lead plus its list entry.
    await expect(summary.locator('a[href="#studio-field-title"]')).toHaveCount(2);
    await expect(bodyBox(page)).not.toHaveValue('');
  });

  test('JS: an emptied new-article Save reports located issues and creates nothing', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.includes('no-js'), 'In-place enhanced assertion.');
    await openNewArticleEditor(page, testInfo);
    // On this route the Slug is editable, so it joins the emptied set.
    await page.getByRole('textbox', { name: 'Slug', exact: true }).fill('');
    await emptyRequiredMetadata(page);

    await page.getByRole('button', { name: 'Save draft' }).click();

    // Decode fails server-side before any GitHub call: the rejection is
    // presented in place, with per-field anchoring, and no draft exists.
    await expect(page.getByRole('region', { name: 'Save could not read this form' })).toBeVisible();
    const summary = page.getByRole('region', { name: 'Validation issues' });
    await expect(summary.getByRole('link', { name: 'Cover media key', exact: true })).toBeVisible();
    // #78 by design: an emptied form cannot be captured as a bounded
    // candidate, so the enhancement controller falls through to a guarded
    // NATIVE submission. The server rejects it before any GitHub call —
    // the located rejection above is the proof that nothing was created.
    expect(page.url()).toContain('?/save');
  });

  test('no-JS: an emptied new-article Save reports located issues through full navigation', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'studio-no-js', 'No-JS equivalence only.');
    await page.goto('/studio/articles/new');
    await emptyRequiredMetadata(page);
    await page.getByRole('button', { name: 'Save draft' }).click();

    await expect(page.getByRole('region', { name: 'Save could not read this form' })).toBeVisible();
    await expect(
      page
        .getByRole('region', { name: 'Validation issues' })
        .locator('a[href="#studio-field-author"]'),
    ).toHaveCount(1);
  });
});

test.describe('#114 preview shortcut and result landing', () => {
  test('JS: Ctrl+Enter from the body submits the preview intent; plain Enter stays a newline', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.includes('no-js'), 'Keyboard shortcut requires hydration.');
    await openEstablishedEditor(page, testInfo);

    const body = bodyBox(page);
    await body.click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');

    // Modifier-less Enter inserted a newline and requested nothing.
    await expect(page.getByText('No preview has been requested for this form yet.')).toBeVisible();
    expect(await body.evaluate((el) => (el as HTMLTextAreaElement).value.endsWith('\n'))).toBe(
      true,
    );

    await page.keyboard.press('Control+Enter');
    await expect(page.getByRole('article', { name: 'Reader preview' })).toBeVisible();
    expect(page.url()).not.toContain('?/preview');
  });

  test('JS: an enhanced preview completion lands focus on the preview region heading', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.includes('no-js'), 'Enhanced completion requires hydration.');
    await openEstablishedEditor(page, testInfo);

    // Keyboard-only walkthrough: request the preview from inside the body.
    await bodyBox(page).click();
    await page.keyboard.press('Control+Enter');
    await expect(page.getByRole('article', { name: 'Reader preview' })).toBeVisible();

    // Completion housekeeping restores the submitter's focus first; the
    // heading then takes over as the result landing point.
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.id ?? ''), { timeout: 3000 })
      .toBe('studio-preview-heading');
    await expect(page.locator('#studio-preview-heading')).toHaveAttribute('tabindex', '-1');
  });
});

test.describe('#114 out-of-date indicator', () => {
  test('JS: editing after a preview marks the pane stale; re-previewing clears it', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.includes('no-js'), 'Indicator tracking requires hydration.');
    await openEstablishedEditor(page, testInfo);
    const staleBadge = page.locator('[data-studio-preview-stale="true"]');

    const body = bodyBox(page);
    await body.fill('A paragraph that will be previewed once.');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(page.getByRole('article', { name: 'Reader preview' })).toBeVisible();
    await expect(staleBadge).toHaveCount(0);

    // The next keystroke changes the form after the rendered snapshot.
    await body.fill('A paragraph that was edited after its preview.');
    await expect(staleBadge).toBeVisible();
    await expect(staleBadge).toContainText('Run Preview again');
    // One polite announcement per staleness episode, via the status region.
    await expect(page.getByText('Preview is out of date.')).toBeVisible();

    // Re-previewing refreshes the snapshot and clears the mark.
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(staleBadge).toHaveCount(0);
  });

  test('JS: no indicator appears before any preview exists', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('no-js'), 'Indicator tracking requires hydration.');
    await openEstablishedEditor(page, testInfo);
    await bodyBox(page).fill('Typing with no preview requested yet.');
    await expect(page.locator('[data-studio-preview-stale]')).toHaveCount(0);
  });
});

test.describe('#114 body textarea indentation', () => {
  test('JS: Tab indents two spaces, Shift+Tab removes them, multi-line works, copy/paste holds', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.includes('no-js'), 'Key interception requires hydration.');
    await openNewArticleEditor(page, testInfo);
    const body = bodyBox(page);
    await body.click();

    await page.keyboard.press('Tab');
    expect(await body.inputValue()).toBe('  ');
    await page.keyboard.type('item one');
    expect(await body.inputValue()).toBe('  item one');

    // Shift+Tab removes up to two preceding spaces on the current line.
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+Tab');
    expect(await body.inputValue()).toBe('item one');

    // Multi-line selection: indent both lines, then outdent both back.
    await body.fill('alpha\nbeta');
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Tab');
    expect(await body.inputValue()).toBe('  alpha\n  beta');
    await page.keyboard.press('Shift+Tab');
    expect(await body.inputValue()).toBe('alpha\nbeta');

    // Copy/paste integrity around the edited block (the undo-stack caveat
    // is engine-level and documented in body-editing.ts: Chromium does not
    // record setRangeText edits natively, matching the #113 insert-image
    // affordance that uses the same mechanism).
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Control+End');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Control+v');
    expect(await body.inputValue()).toBe('alpha\nbeta\n\nalpha\nbeta');
  });

  test('JS: Tab outside the body keeps navigating between fields', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('no-js'), 'Focus assertions require hydration.');
    await openEstablishedEditor(page, testInfo);
    await page.getByRole('textbox', { name: 'Title', exact: true }).click();
    await page.keyboard.press('Tab');
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.id ?? ''))
      .toBe('studio-field-slug');
  });
});

test.describe('#114 live word count', () => {
  test('JS: counts live beside the reading-time note and collapses whitespace', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.includes('no-js'), 'Live updates require hydration.');
    await openNewArticleEditor(page, testInfo);
    const counter = page.locator('#studio-body-word-count');
    await expect(counter).toContainText('Word count: 0');

    await bodyBox(page).pressSequentially('one two  three\n\nfour');
    await expect(counter).toContainText('Word count: 4');
  });

  test('JS: the rendered count matches a manual count of the loaded body', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.includes('no-js'), 'Hydrated editor only.');
    await openEstablishedEditor(page, testInfo);
    const manualCount = await page.evaluate(() => {
      const value = document.querySelector<HTMLTextAreaElement>('#studio-body')?.value ?? '';
      return (value.match(/\S+/g) ?? []).length;
    });
    expect(manualCount).toBeGreaterThan(0);
    await expect(page.locator('#studio-body-word-count')).toContainText(
      `Word count: ${manualCount}`,
    );
  });

  test('no-JS: the loaded body still ships its SSR word count', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'studio-no-js', 'SSR rendering equivalence only.');
    await page.goto(`/studio/articles/${ARTICLE_SLUG}`);
    const manualCount = await page.evaluate(() => {
      const value = document.querySelector<HTMLTextAreaElement>('#studio-body')?.value ?? '';
      return (value.match(/\S+/g) ?? []).length;
    });
    await expect(page.locator('#studio-body-word-count')).toContainText(
      `Word count: ${manualCount}`,
    );
  });
});
