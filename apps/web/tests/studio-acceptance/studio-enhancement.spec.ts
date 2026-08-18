import { expect, test, type Page, type TestInfo } from '@playwright/test';
import {
  STUDIO_ACCEPTANCE_IDENTITY_HEADER,
  STUDIO_ACCEPTANCE_IDENTITY_TOKEN,
} from '../../src/lib/server/studio/request-guard.server';
import { waitForStudioHydration } from './helpers';

/**
 * Selective enhancement and Recovery copy browser acceptance (#78).
 *
 * These are the browser-visible behaviors of slice 4: targeted in-place
 * Preview / Save / Check status through the shared decoded route envelope,
 * the bounded per-article Recovery copy, transport uncertainty/fallback,
 * and the guarantee that high-consequence submitters (Publish, Unpublish,
 * Discard, replacement) are never enhanced.
 *
 * Scoping notes:
 * - Recovery copy, snapshot reconciliation, and transport-failure handling
 *   are browser-only features (the no-JS project renders no client script,
 *   so it has no recovery panel and no enhancement). Those tests are
 *   gated to the JS project; the no-JS project instead proves the
 *   ordinary full-navigation Preview/Save equivalence.
 * - Test-side `page.route`/`page.addInitScript` are used ONLY to inject
 *   storage state and transport behavior — never to fake server authority.
 *   Aborted high-consequence requests prove request *mode* (no
 *   `x-sveltekit-action` header) while never reaching the shared fake
 *   GitHub world, so the deterministic fixtures stay uncorrupted.
 */

const ARTICLE_SLUG = 'lighthouse-watch';
const INVALID_SLUG = 'weather-notes';
const LIVE_SLUG = 'verified-harbor';
const RECOVERY_KEY = `jelementi.studio.recovery.${ARTICLE_SLUG}`;
const RECOVERY_CANDIDATE_BODY = 'Unsaved typing to recover.';
const STALE_CANDIDATE_BODY = 'A stale recovery body paragraph captured before evidence moved.';

const identityHeaders = {
  [STUDIO_ACCEPTANCE_IDENTITY_HEADER]: STUDIO_ACCEPTANCE_IDENTITY_TOKEN,
};

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders(identityHeaders);
});

/** Counts enhanced (fetch-based) Studio submissions. */
function countEnhancedPosts(page: Page): () => number {
  let count = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.headers()['x-sveltekit-action'] === 'true') {
      count += 1;
    }
  });
  return () => count;
}

async function openArticleEditor(
  page: Page,
  testInfo: TestInfo,
  slug = ARTICLE_SLUG,
): Promise<void> {
  await page.goto(`/studio/articles/${slug}`);
  await waitForStudioHydration(page, testInfo);
}

test.describe('targeted Preview and Save (#78)', () => {
  test('JS: targeted Preview updates in place without navigation and preserves focus and value', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.includes('no-js'), 'Enhanced submission requires hydration.');
    const enhancedPosts = countEnhancedPosts(page);
    await openArticleEditor(page, testInfo);

    const body = page.getByRole('textbox', { name: 'Body', exact: true });
    await body.fill('A targeted in-place preview paragraph.');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Reader preview' })).toBeVisible();
    await expect(
      page
        .getByRole('article', { name: 'Reader preview' })
        .getByText('A targeted in-place preview paragraph.'),
    ).toBeVisible();
    // In-place: no navigation, no full-page reload, candidate preserved.
    expect(page.url()).not.toContain('?/preview');
    await expect(body).toHaveValue('A targeted in-place preview paragraph.');
    // Routine success preserves focus on the submitted control.
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.textContent?.trim() ?? ''))
      .toBe('Preview');
    // Exactly one enhanced request — no extra automatic requests.
    await page.waitForTimeout(400);
    expect(enhancedPosts()).toBe(1);
  });

  test('no-JS: ordinary Preview completes through full navigation', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'studio-no-js', 'No-JS equivalence only.');
    await page.goto(`/studio/articles/${ARTICLE_SLUG}`);

    await page
      .getByRole('textbox', { name: 'Body', exact: true })
      .fill('A no-JS ordinary preview paragraph.');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Reader preview' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Body', exact: true })).toHaveValue(
      'A no-JS ordinary preview paragraph.',
    );
  });

  test('JS: a delayed Save response updates evidence without overwriting newer typing, and recovery is preserved', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.includes('no-js'), 'Enhanced submission requires hydration.');
    await page.route(/studio\/articles\/lighthouse-watch\?\/save/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.continue();
    });
    await openArticleEditor(page, testInfo);

    const body = page.getByRole('textbox', { name: 'Body', exact: true });
    await body.fill('Candidate to submit.');
    // Wait for the debounced recovery copy to land before submitting.
    await expect(page.getByRole('heading', { name: 'Recovery copy' })).toBeVisible({
      timeout: 3000,
    });

    await page.getByRole('button', { name: 'Save draft' }).click();
    // Newer typing lands while the Save is still in flight.
    await body.fill('NEWER typing after save submit.');

    // The authoritative response still updates the evidence regions.
    await expect(page.getByRole('heading', { name: 'Studio draft saved' })).toBeVisible();
    await expect(page.getByText(/your newer typing was kept/)).toBeVisible();
    // The newer candidate is never overwritten and stays dirty/recoverable.
    await expect(body).toHaveValue('NEWER typing after save submit.');
    await expect(page.getByRole('heading', { name: 'Recovery copy' })).toBeVisible();
    await expect(page.getByText('Not saved yet.', { exact: false }).first()).toBeVisible();

    // The next Save uses the advanced concurrency returned by the first
    // envelope rather than re-submitting the stale loaded head.
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText('Updated.', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recovery copy' })).toBeHidden();
    await expect(body).toHaveValue('NEWER typing after save submit.');
  });

  test('JS: enhanced invalid Save refreshes actionable validation, then a valid Save clears it', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.includes('no-js'), 'Enhanced submission requires hydration.');
    await openArticleEditor(page, testInfo);
    const body = page.getByRole('textbox', { name: 'Body', exact: true });

    await body.fill('# Unsupported heading');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByRole('heading', { name: 'Validation issues' })).toBeVisible();
    await expect(page.getByText(/1 validation issue \(blocking\)/)).toBeVisible();

    await body.fill('A restored valid paragraph.');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByRole('heading', { name: 'Validation issues' })).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Studio draft saved' })).toBeVisible();
  });

  test('JS: a valid enhanced Save clears validation loaded from an invalid committed draft', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.includes('no-js'), 'Enhanced submission requires hydration.');
    await openArticleEditor(page, testInfo, INVALID_SLUG);
    await expect(page.getByRole('heading', { name: 'Validation issues' })).toBeVisible();

    await page
      .getByRole('textbox', { name: 'Body', exact: true })
      .fill('A corrected valid paragraph.');
    await page.getByRole('button', { name: 'Save draft' }).click();

    await expect(page.getByRole('heading', { name: 'Validation issues' })).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Studio draft saved' })).toBeVisible();

    // Restore the shared acceptance fixture for the later #77 suite.
    await page
      .getByRole('textbox', { name: 'Body', exact: true })
      .fill('# Unsupported acceptance heading');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByRole('heading', { name: 'Validation issues' })).toBeVisible();
  });

  test('no-JS: ordinary Save completes through full navigation', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'studio-no-js', 'No-JS equivalence only.');
    await page.goto(`/studio/articles/${ARTICLE_SLUG}`);

    await page
      .getByRole('textbox', { name: 'Body', exact: true })
      .fill('A no-JS ordinary save paragraph.');
    await page.getByRole('button', { name: 'Save draft' }).click();

    await expect(page.getByRole('heading', { name: 'Studio draft saved' })).toBeVisible();
  });
});

test.describe('Flowboard Check status in place (#78)', () => {
  test('JS: enhanced Check replaces the full projection, keeps enhancing on a second check, never polls', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.includes('no-js'), 'Enhanced submission requires hydration.');
    const enhancedPosts = countEnhancedPosts(page);
    await page.goto('/studio');
    await waitForStudioHydration(page, testInfo);

    const liveCard = page.locator(`[data-article-slug="${LIVE_SLUG}"]`);
    await expect(liveCard.getByText('Updating the site')).toBeVisible();
    await liveCard.getByRole('button', { name: 'Check status' }).click();

    await expect(page.getByText(`Status checked for ${LIVE_SLUG}.`)).toBeVisible();
    await expect(
      page.locator(`[data-article-slug="${LIVE_SLUG}"]`).getByText('Live and verified', {
        exact: true,
      }),
    ).toBeVisible();
    // In place: no navigation to the action URL.
    expect(page.url()).not.toContain('?/check');

    // A second card's Check status still enhances on the same page.
    await page
      .locator(`[data-article-slug="${ARTICLE_SLUG}"]`)
      .getByRole('button', {
        name: 'Check status',
      })
      .click();
    await expect(page.getByText(`Status checked for ${ARTICLE_SLUG}.`)).toBeVisible();
    expect(page.url()).not.toContain('?/check');

    // Exactly two enhanced requests; no background polling follows.
    await page.waitForTimeout(600);
    expect(enhancedPosts()).toBe(2);
  });
});

test.describe('Recovery copy browser behavior (#78)', () => {
  test('JS: matching recovery is offered, never auto-applied, and restores only on explicit click', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name.includes('no-js'),
      'Recovery copy is a browser-only convenience.',
    );
    await openArticleEditor(page, testInfo);

    const body = page.getByRole('textbox', { name: 'Body', exact: true });
    await body.fill(RECOVERY_CANDIDATE_BODY);
    await expect(page.getByRole('heading', { name: 'Recovery copy' })).toBeVisible({
      timeout: 3000,
    });

    // Reload: the stored record matches the loaded evidence.
    await page.reload();
    await waitForStudioHydration(page, testInfo);
    await expect(page.getByRole('button', { name: 'Restore recovery copy' })).toBeVisible();
    await expect(page.getByText('Not saved yet.', { exact: false }).first()).toBeVisible();
    // Never auto-applied: the form shows the committed server content.
    await expect(body).not.toHaveValue(RECOVERY_CANDIDATE_BODY);

    // Explicit restoration applies the candidate.
    await page.getByRole('button', { name: 'Restore recovery copy' }).click();
    await expect(body).toHaveValue(RECOVERY_CANDIDATE_BODY);
  });

  test('JS: stale recovery renders fresh server content first and requires Compare/Restore before restore', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name.includes('no-js'),
      'Recovery copy is a browser-only convenience.',
    );
    // Seeded before load with evidence that no longer matches the loaded one.
    const staleRecord = {
      version: 1,
      candidate: {
        metadata: {
          title: 'The Lighthouse Watch',
          slug: ARTICLE_SLUG,
          excerpt: 'A stale browser recovery candidate.',
          status: 'draft',
          updatedAt: '2026-08-18',
          category: 'Fixtures',
          tags: ['acceptance'],
          author: 'Studio Acceptance',
          cover: { src: 'articles/lighthouse-watch/cover.svg', alt: 'A lighthouse at dusk.' },
          references: [],
        },
        body: STALE_CANDIDATE_BODY,
        concurrency: { baseMainSha: 'a'.repeat(40), draftHeadSha: 'b'.repeat(40) },
      },
      loadedConcurrency: { baseMainSha: 'a'.repeat(40), draftHeadSha: 'b'.repeat(40) },
      capturedAt: '2026-08-18T12:00:00.000Z',
    };
    await page.addInitScript((record) => {
      sessionStorage.setItem('jelementi.studio.recovery.lighthouse-watch', JSON.stringify(record));
    }, staleRecord);
    await openArticleEditor(page, testInfo);

    const body = page.getByRole('textbox', { name: 'Body', exact: true });
    // Fresh server content leads; the stale candidate is never auto-applied.
    await expect(body).not.toHaveValue(STALE_CANDIDATE_BODY);
    await expect(page.getByRole('heading', { name: 'Recovery copy' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restore recovery copy' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Compare/Restore' }).click();

    // Comparison shows the candidate and the loaded/current evidence.
    await expect(page.getByText('Recovery base', { exact: true })).toBeVisible();
    await expect(page.getByText('Current base', { exact: true })).toBeVisible();
    await expect(page.locator('pre').getByText(STALE_CANDIDATE_BODY)).toBeVisible();

    await page.getByRole('button', { name: 'Restore recovery copy' }).click();
    await expect(body).toHaveValue(STALE_CANDIDATE_BODY);
  });

  test('JS: a malformed stored record is treated as absent and the editor keeps working', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name.includes('no-js'),
      'Recovery copy is a browser-only convenience.',
    );
    await page.addInitScript((key) => {
      sessionStorage.setItem(key, '{not valid json');
    }, RECOVERY_KEY);
    await openArticleEditor(page, testInfo);

    await expect(page.getByRole('heading', { name: 'Recovery copy' })).toHaveCount(0);
    await page
      .getByRole('textbox', { name: 'Body', exact: true })
      .fill('A preview after a malformed recovery record.');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Reader preview' })).toBeVisible();
  });

  test('JS: storage unavailability disables only the recovery convenience and the enhanced Save still works', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name.includes('no-js'),
      'Recovery copy is a browser-only convenience.',
    );
    await page.addInitScript(() => {
      const storage = window.sessionStorage;
      const deny = (): never => {
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      };
      Object.defineProperty(storage, 'setItem', { value: deny });
      Object.defineProperty(storage, 'removeItem', { value: deny });
    });
    await openArticleEditor(page, testInfo);

    await expect(page.getByRole('heading', { name: 'Browser recovery unavailable' })).toBeVisible();

    // The enhanced Save path is transport, not storage, and still works.
    await page
      .getByRole('textbox', { name: 'Body', exact: true })
      .fill('A save that must work without browser storage.');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByRole('heading', { name: 'Studio draft saved' })).toBeVisible();
  });
});

test.describe('transport uncertainty and disable (#78)', () => {
  test('JS: uncertain completion preserves the candidate, makes exactly one request, and never retries', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.includes('no-js'), 'Enhanced submission requires hydration.');
    const enhancedPosts = countEnhancedPosts(page);
    await page.route(/studio\/articles\/lighthouse-watch\?\/preview/, (route) => route.abort());
    await openArticleEditor(page, testInfo);

    const body = page.getByRole('textbox', { name: 'Body', exact: true });
    await body.fill('Candidate that must survive an uncertain result.');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();

    await expect(page.getByText(/Completion unknown/)).toBeVisible();
    await expect(body).toHaveValue('Candidate that must survive an uncertain result.');
    // No automatic retry: exactly one enhanced request was attempted.
    await page.waitForTimeout(500);
    expect(enhancedPosts()).toBe(1);
  });

  test('JS: two transport failures disable enhancement and the next submit is a native full navigation', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.includes('no-js'), 'Enhanced submission requires hydration.');
    let aborted = 0;
    await page.route(/studio\/articles\/lighthouse-watch\?\/save/, (route) => {
      if (route.request().headers()['x-sveltekit-action'] === 'true' && aborted < 2) {
        aborted += 1;
        route.abort();
      } else {
        route.continue();
      }
    });
    await openArticleEditor(page, testInfo);

    await page.getByRole('textbox', { name: 'Body', exact: true }).fill('Fallback save candidate.');
    const saveButton = page.getByRole('button', { name: 'Save draft' });

    await saveButton.click();
    await expect(page.getByText(/Completion unknown/)).toBeVisible();
    await saveButton.click();
    await expect(
      page.getByText(/Enhanced submission is disabled for this form for this session/),
    ).toBeVisible();

    // The disabled form falls through to a native full-navigation submit —
    // the server request carries no enhancement header and actually lands.
    await saveButton.click();
    await expect(page.getByRole('heading', { name: 'Studio draft saved' })).toBeVisible();
    expect(page.url()).toContain('?/save');
  });
});

test.describe('high-consequence actions stay full navigation (#78)', () => {
  test('Publish saved version is a native full-navigation submission, never enhanced', async ({
    page,
  }, testInfo) => {
    await page.goto(`/studio/articles/${ARTICLE_SLUG}`);
    await waitForStudioHydration(page, testInfo);

    const publishRequests: Array<{ url: string; headers: Record<string, string> }> = [];
    await page.route(/studio\/articles\/lighthouse-watch\?\/publish/, (route) => {
      publishRequests.push({ url: route.request().url(), headers: route.request().headers() });
      // Fulfill (not abort) so the browser settles the navigation cleanly;
      // the request never reaches the server, so the shared fixture is
      // untouched and the follow-up page.goto is not racing an error page.
      route.fulfill({ status: 403, contentType: 'text/html', body: 'blocked by acceptance proof' });
    });

    await page.getByRole('button', { name: 'Publish saved version' }).click();
    await expect.poll(() => publishRequests.length).toBe(1);
    const publishRequest = publishRequests[0];
    if (publishRequest === undefined) throw new Error('Publish request was not captured');
    expect(publishRequest.url).toContain('?/publish');
    // An enhanced fetch would carry the SvelteKit action header; native
    // full-navigation form posts never do.
    expect(publishRequest.headers['x-sveltekit-action']).toBeUndefined();

    // The fixture is untouched (the request never reached GitHub).
    await page.goto(`/studio/articles/${ARTICLE_SLUG}`);
    await expect(page.getByText('Ready to publish', { exact: true })).toBeVisible();
  });

  test('successful Discard clears only the matching article Recovery copy', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.includes('no-js'), 'Recovery copy requires hydration.');
    const slug = `discard-recovery-${Date.now().toString(36)}`;
    await page.goto('/studio/articles/new');
    await waitForStudioHydration(page, testInfo);
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Discard recovery');
    await page.getByRole('textbox', { name: 'Slug', exact: true }).fill(slug);
    await page
      .getByRole('textbox', { name: 'Excerpt', exact: true })
      .fill('A temporary recovery-clear article.');
    await page.getByRole('textbox', { name: 'Body', exact: true }).fill('Saved body.');
    await page.getByText('More metadata', { exact: false }).click();
    await page.getByRole('textbox', { name: 'Alt text', exact: true }).fill('Temporary cover.');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page).toHaveURL(new RegExp(`/studio/articles/${slug}$`));
    await waitForStudioHydration(page, testInfo);

    await page.getByRole('textbox', { name: 'Body', exact: true }).fill('Unsaved abandonment.');
    await expect(page.getByRole('heading', { name: 'Recovery copy' })).toBeVisible();
    await page.getByText('Danger zone', { exact: true }).click();
    await page.getByRole('button', { name: 'Discard draft…', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('#discard-confirmation').fill(slug);
    await dialog.getByRole('button', { name: 'Discard draft', exact: true }).click();

    await expect(page).toHaveURL(/\/studio\?outcome=draft-discarded/);
    await waitForStudioHydration(page, testInfo);
    await expect
      .poll(() =>
        page.evaluate((key) => sessionStorage.getItem(key), `jelementi.studio.recovery.${slug}`),
      )
      .toBeNull();
  });

  test('danger-zone Unpublish is a native full-navigation submission, never enhanced', async ({
    page,
  }, testInfo) => {
    await page.goto(`/studio/articles/${LIVE_SLUG}`);
    await waitForStudioHydration(page, testInfo);

    const unpublishRequests: Array<{ headers: Record<string, string> }> = [];
    await page.route(/studio\/articles\/verified-harbor\?\/unpublish/, (route) => {
      unpublishRequests.push({ headers: route.request().headers() });
      route.fulfill({ status: 403, contentType: 'text/html', body: 'blocked by acceptance proof' });
    });

    await page.getByText('Danger zone', { exact: true }).click();
    if (testInfo.project.name === 'studio-no-js') {
      await page.locator('#unpublish-confirmation').fill(LIVE_SLUG);
      await page.getByRole('button', { name: 'Unpublish', exact: true }).click();
    } else {
      await page.getByRole('button', { name: 'Unpublish…', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.locator('#unpublish-confirmation').fill(LIVE_SLUG);
      await dialog.getByRole('button', { name: 'Unpublish', exact: true }).click();
    }

    await expect.poll(() => unpublishRequests.length).toBe(1);
    const unpublishRequest = unpublishRequests[0];
    if (unpublishRequest === undefined) throw new Error('Unpublish request was not captured');
    expect(unpublishRequest.headers['x-sveltekit-action']).toBeUndefined();

    // The fixture is untouched and the article page still renders.
    await page.goto(`/studio/articles/${LIVE_SLUG}`);
    await expect(
      page.getByRole('heading', { name: 'The Verified Harbor', level: 2 }),
    ).toBeVisible();
  });
});
