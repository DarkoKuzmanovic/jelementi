import { expect, test, type Page } from '@playwright/test';
import {
  STUDIO_ACCEPTANCE_IDENTITY_HEADER,
  STUDIO_ACCEPTANCE_IDENTITY_TOKEN,
} from '../../src/lib/server/studio/request-guard.server';

// The one article seeded as published on canonical main. Every journey in
// this spec restores it (Unpublish's archive PR is discarded through the UI)
// so later specs still see it Live — the acceptance world is shared across
// spec files and browser projects.
const LIVE_SLUG = 'verified-harbor';

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({
    [STUDIO_ACCEPTANCE_IDENTITY_HEADER]: STUDIO_ACCEPTANCE_IDENTITY_TOKEN,
  });
});

function projectSuffix(projectName: string): string {
  return projectName === 'studio-no-js' ? 'no-js' : 'js';
}

async function openDangerZone(page: Page): Promise<void> {
  await page.getByText('Danger zone', { exact: true }).click();
}

/** Submits a destructive confirmation, inline (no JS) or via the dialog. */
async function confirmDestructive(
  page: Page,
  hasJs: boolean,
  options: { opener: string; submit: string; slug: string; idPrefix: string },
): Promise<void> {
  if (hasJs) {
    await page.getByRole('button', { name: options.opener, exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator(`#${options.idPrefix}-confirmation`).fill(options.slug);
    await dialog.getByRole('button', { name: options.submit, exact: true }).click();
  } else {
    await page.locator(`#${options.idPrefix}-confirmation`).fill(options.slug);
    await page.getByRole('button', { name: options.submit, exact: true }).click();
  }
}

test.describe('Danger zone placement', () => {
  test('isolates Unpublish and Discard behind a labelled disclosure away from primary controls', async ({
    page,
    javaScriptEnabled,
  }) => {
    await page.goto(`/studio/articles/${LIVE_SLUG}`);

    await expect(page.getByRole('button', { name: 'Publish saved version' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Check status' })).toBeVisible();
    await expect(page.getByText('Danger zone', { exact: true })).toBeVisible();
    // Collapsed by default: no destructive control is exposed next to the
    // ordinary writing and publishing actions.
    await expect(page.getByRole('button', { name: /Unpublish/ })).toBeHidden();

    await openDangerZone(page);
    await expect(page.getByText('separate from ordinary writing')).toBeVisible();
    await expect(
      page.getByText('Readers may continue to see this article', { exact: false }),
    ).toBeVisible();
    if (javaScriptEnabled) {
      await expect(page.getByRole('button', { name: 'Unpublish…', exact: true })).toBeVisible();
    } else {
      await expect(page.getByRole('button', { name: 'Unpublish', exact: true })).toBeVisible();
      await expect(page.locator('#unpublish-confirmation')).toBeVisible();
    }
  });
});

test.describe('Enhanced confirmation dialog', () => {
  test('meets the modal contract: name, initial Cancel focus, contained Tab, Escape restore — and never mutates on open', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'The dialog is a JS-only enhancement.');

    await page.goto(`/studio/articles/${LIVE_SLUG}`);
    await openDangerZone(page);
    const opener = page.getByRole('button', { name: 'Unpublish…', exact: true });
    await opener.click();

    // Accessible name and description.
    const dialog = page.getByRole('dialog', { name: 'Unpublish this article?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Unpublish starts an archive change')).toBeVisible();

    // Initial focus lands on the safe path.
    const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true });
    await expect(cancel).toBeFocused();

    // The destructive submit stays disabled until the typed slug matches.
    const submit = dialog.getByRole('button', { name: 'Unpublish', exact: true });
    await expect(submit).toBeDisabled();
    await dialog.locator('#unpublish-confirmation').fill('wrong-slug');
    await expect(submit).toBeDisabled();
    await dialog.locator('#unpublish-confirmation').fill(LIVE_SLUG);
    await expect(submit).toBeEnabled();

    // Tab never reaches a control behind the modal (hops through browser
    // chrome, where the active element falls back to body, are allowed by
    // the APG dialog pattern).
    for (let i = 0; i < 5; i += 1) {
      await page.keyboard.press('Tab');
      const focusEscaped = await page.evaluate(() => {
        const openDialog = document.querySelector('dialog[open]');
        const active = document.activeElement;
        return (
          openDialog !== null &&
          active !== null &&
          active !== document.body &&
          active !== document.documentElement &&
          !openDialog.contains(active)
        );
      });
      expect(focusEscaped).toBe(false);
    }

    // Escape cancels, restores focus to the invoker, and says so.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    await expect(
      page.getByText('Cancelled. Nothing was submitted: GitHub is unchanged and readers see'),
    ).toBeVisible();

    // Opening and cancelling mutated nothing: the article is still published.
    await page.reload();
    await expect(page.getByText('production probes have not yet proven')).toBeVisible();
    await expect(page.getByText('Approved and waiting')).toBeHidden();
  });
});

test.describe('No-JS confirmation safety', () => {
  test('rejects a single accidental click server-side without any mutation', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(javaScriptEnabled === true, 'Covers the inline no-JS forms.');

    await page.goto(`/studio/articles/${LIVE_SLUG}`);
    await openDangerZone(page);

    const [response] = await Promise.all([
      page.waitForResponse((candidate) => candidate.request().method() === 'POST'),
      page.getByRole('button', { name: 'Unpublish', exact: true }).click(),
    ]);
    expect(response.status()).toBe(400);

    await page.goto(`/studio/articles/${LIVE_SLUG}`);
    await expect(page.getByText('production probes have not yet proven')).toBeVisible();
    await expect(page.getByText('Approved and waiting')).toBeHidden();
  });
});

test.describe('Unpublish journey', () => {
  test('archives the live article after typed confirmation, then Discard restores it', async ({
    page,
    javaScriptEnabled,
  }) => {
    const hasJs = javaScriptEnabled === true;

    await page.goto(`/studio/articles/${LIVE_SLUG}`);
    await openDangerZone(page);
    await confirmDestructive(page, hasJs, {
      opener: 'Unpublish…',
      submit: 'Unpublish',
      slug: LIVE_SLUG,
      idPrefix: 'unpublish',
    });

    await expect(page.getByRole('heading', { name: 'Unpublish submitted' })).toBeVisible();
    await expect(page.getByText('Readers may continue to see the', { exact: false })).toBeVisible();
    // The archive change is an ordinary approved Draft PR now.
    await expect(page.getByText('Approved and waiting')).toBeVisible();

    // Restore: discard the unmerged archive PR (ADR-0008 keeps approved PRs
    // discardable), leaving main and the published article untouched.
    await openDangerZone(page);
    await confirmDestructive(page, hasJs, {
      opener: 'Discard draft…',
      submit: 'Discard draft',
      slug: LIVE_SLUG,
      idPrefix: 'discard',
    });

    await expect(page.getByRole('heading', { name: 'Draft discarded' })).toBeVisible();
    await expect(page.getByText('readers are unaffected')).toBeVisible();

    // Check status re-probes production: the article is Live again.
    await page.getByRole('button', { name: 'Check status' }).click();
    await expect(page.getByText('Live:', { exact: false })).toBeVisible();
  });
});

test.describe('Discard journey', () => {
  test('discards a UI-created draft: only its PR closes, only its branch is deleted, no residue', async ({
    page,
    javaScriptEnabled,
  }, testInfo) => {
    const hasJs = javaScriptEnabled === true;
    const suffix = projectSuffix(testInfo.project.name);
    const slug = `danger-discard-${suffix}`;
    const title = `Danger discard ${suffix}`;

    await page.goto('/studio/articles/new');
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill(title);
    await page.getByRole('textbox', { name: 'Slug', exact: true }).fill(slug);
    await page.getByRole('textbox', { name: 'Excerpt', exact: true }).fill('A throwaway draft.');
    await page.getByRole('textbox', { name: 'Body', exact: true }).fill('Draft body to discard.');
    await page.getByText('More metadata', { exact: false }).click();
    await page.getByRole('textbox', { name: 'Alt text', exact: true }).fill('Throwaway cover.');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByRole('heading', { name: 'Studio draft saved' })).toBeVisible();

    await page.goto(`/studio/articles/${slug}`);
    await openDangerZone(page);
    await expect(
      page.getByText('Discard closes only the sole exact unmerged Draft PR', { exact: false }),
    ).toBeVisible();
    await confirmDestructive(page, hasJs, {
      opener: 'Discard draft…',
      submit: 'Discard draft',
      slug,
      idPrefix: 'discard',
    });

    // The article resource is gone, so the success lands on the Flowboard
    // with the closed outcome token and a truthful notice.
    await expect(page).toHaveURL(/\/studio\?outcome=draft-discarded$/);
    await expect(page.getByRole('heading', { name: 'Draft discarded' })).toBeVisible();
    await expect(page.getByText('Draft PR was closed', { exact: false })).toBeVisible();
    await expect(page.getByText('No published article changed', { exact: false })).toBeVisible();

    // No residue: the draft is gone from the Flowboard; the published world
    // is untouched.
    await expect(page.getByText(title)).toHaveCount(0);
    await expect(page.getByText('The Verified Harbor', { exact: false }).first()).toBeVisible();
  });
});
