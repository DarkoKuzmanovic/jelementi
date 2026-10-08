import { expect, test } from '@playwright/test';
import {
  STUDIO_ACCEPTANCE_IDENTITY_HEADER,
  STUDIO_ACCEPTANCE_IDENTITY_TOKEN,
} from '../../src/lib/server/studio/request-guard.server';
import { STUDIO_ACCEPTANCE_PUBLISHABLE_SLUGS } from '../../src/lib/server/studio/acceptance-bootstrap.server';
import { expectFirstSaveLanded, waitForStudioHydration } from './helpers';

const ARTICLE_SLUG = 'lighthouse-watch';
const ARTICLE_TITLE = 'The Lighthouse Watch';

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({
    [STUDIO_ACCEPTANCE_IDENTITY_HEADER]: STUDIO_ACCEPTANCE_IDENTITY_TOKEN,
  });
});

test.describe('Editorial desk server baseline', () => {
  test('renders editor, preview, then publication center in semantic DOM order', async ({
    page,
  }) => {
    const response = await page.goto(`/studio/articles/${ARTICLE_SLUG}`);
    expect(response?.status()).toBe(200);

    const headings = await page.getByRole('heading', { level: 2 }).allTextContents();
    expect(headings.indexOf(ARTICLE_TITLE)).toBeLessThan(headings.indexOf('Explicit preview'));
    expect(headings.indexOf('Explicit preview')).toBeLessThan(
      headings.indexOf('Publication center'),
    );

    // The three column captions sit on one line. The editor and preview
    // eyebrows are pushed down by their panel padding; the publication caption
    // is not inside a panel, so it carries a matching top margin instead.
    // Measured before anything scrolls the page: the publication column is
    // `position: sticky`, so once scrolled its box no longer shares a
    // coordinate space with the two panel eyebrows.
    await page.evaluate(() => window.scrollTo(0, 0));
    const [editorEyebrow, previewEyebrow, publicationCaption] = await Promise.all([
      page.getByText('Draft article', { exact: true }).boundingBox(),
      page.getByText('Reader view', { exact: true }).boundingBox(),
      page.getByRole('heading', { name: 'Publication center', exact: true }).boundingBox(),
    ]);
    if (editorEyebrow === null || previewEyebrow === null || publicationCaption === null) {
      throw new Error('Editorial desk column captions were not laid out.');
    }
    expect(Math.abs(editorEyebrow.y - previewEyebrow.y)).toBeLessThan(4);
    expect(Math.abs(publicationCaption.y - editorEyebrow.y)).toBeLessThan(4);

    await expect(page.getByRole('heading', { name: 'Essentials' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Slug', exact: true })).toBeVisible();
    // Lifecycle status stays exposed (spec story 8) but is read-only (#111):
    // a plain-language display of the loaded state, never an editable select.
    const statusField = page.locator('#studio-field-status');
    await expect(statusField).toHaveText('Draft');
    await expect(page.locator('#studio-article-form select[name="status"]')).toHaveCount(0);
    await expect(page.getByText(/Set via Publish \/ Unpublish/)).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Excerpt', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Body', exact: true })).toBeVisible();
    await expect(page.getByText('Writing · No autosave')).toBeVisible();

    await page.getByText('More metadata', { exact: false }).click();
    await expect(page.getByRole('textbox', { name: 'Updated date', exact: true })).toBeVisible();

    // Every editor control shares one left edge. The disclosure band and its
    // fieldsets group without inset: a horizontal padding, a UA fieldset
    // border, or a summary marker each used to step nested fields further
    // right than Title/Excerpt/Body.
    const columnEdges = await page.evaluate(() => {
      const x = (selector: string) => {
        const element = document.querySelector(selector);
        return element === null ? -1 : Math.round(element.getBoundingClientRect().x);
      };
      return {
        title: x('#studio-field-title'),
        body: x("textarea[name='body']"),
        summary: x('.studio-editor__metadata summary'),
        updatedAt: x('#studio-field-updatedAt'),
        coverSrc: x('#studio-field-coverSrc'),
      };
    });
    expect(columnEdges.title).toBeGreaterThan(0);
    for (const [name, edge] of Object.entries(columnEdges)) {
      expect(`${name}:${edge}`).toBe(`${name}:${columnEdges.title}`);
    }
    await expect(page.getByRole('textbox', { name: 'Category', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Author', exact: true })).toBeVisible();

    await expect(page.getByText('Published version')).toBeVisible();
    await expect(page.getByText('Working change')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish saved version' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Check status' })).toBeVisible();
    await expect(page.getByText('Publish eligibility', { exact: false })).toBeVisible();
    await expect(page.getByText('Danger zone')).toBeVisible();
    await expect(page.locator('#publication-center')).toBeVisible();
    await expect(page.locator('#validation-summary')).toBeVisible();
    await expect(page.locator('#recovery')).toBeVisible();

    const editor = page.getByRole('region', { name: ARTICLE_TITLE, exact: true });
    const preview = page.getByRole('region', { name: 'Explicit preview', exact: true });
    const publication = page.getByRole('complementary', { name: 'Publication center' });
    const [editorBox, previewBox, publicationBox] = await Promise.all([
      editor.boundingBox(),
      preview.boundingBox(),
      publication.boundingBox(),
    ]);
    if (editorBox === null || previewBox === null || publicationBox === null) {
      throw new Error('Editorial desk regions were not laid out.');
    }
    // Editor in the centre column, preview to its left, publication right.
    // DOM order stays editor -> preview -> publication (asserted above and in
    // editorial-desk.test.ts); only the wide-desk placement differs.
    expect(previewBox.x).toBeLessThan(editorBox.x);
    expect(editorBox.x).toBeLessThan(publicationBox.x);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    await page.setViewportSize({ width: 720, height: 900 });
    const [stackedEditor, stackedPreview, stackedPublication] = await Promise.all([
      editor.boundingBox(),
      preview.boundingBox(),
      publication.boundingBox(),
    ]);
    if (stackedEditor === null || stackedPreview === null || stackedPublication === null) {
      throw new Error('Stacked Editorial desk regions were not laid out.');
    }
    expect(stackedEditor.y).toBeLessThan(stackedPreview.y);
    expect(stackedPreview.y).toBeLessThan(stackedPublication.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

  test('previews only the submitted form snapshot and states that GitHub was unchanged', async ({
    page,
  }) => {
    await page.goto(`/studio/articles/${ARTICLE_SLUG}`);
    await page
      .getByRole('textbox', { name: 'Body', exact: true })
      .fill('An explicit unsaved preview paragraph.');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Reader preview' })).toBeVisible();
    await expect(
      page
        .getByRole('article', { name: 'Reader preview' })
        .getByText('An explicit unsaved preview paragraph.'),
    ).toBeVisible();
    await expect(page.getByText(/Nothing was saved or changed in\s+GitHub\./)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Unsaved form changes' })).toBeVisible();
    await expect(page.getByText('Not saved yet.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish saved version' })).toBeDisabled();
    await expect(page.getByRole('textbox', { name: 'Body', exact: true })).toHaveValue(
      'An explicit unsaved preview paragraph.',
    );
  });

  test('rejects a newer unsaved candidate before Publish and preserves it in the form', async ({
    page,
  }) => {
    await page.goto(`/studio/articles/${ARTICLE_SLUG}`);
    await page
      .getByRole('textbox', { name: 'Body', exact: true })
      .fill('This candidate is newer than the saved draft.');
    await page.getByRole('button', { name: 'Publish saved version' }).click();

    await expect(
      page.getByRole('heading', { name: 'Save the current form before publishing' }),
    ).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Body', exact: true })).toHaveValue(
      'This candidate is newer than the saved draft.',
    );
  });

  test('completes Save draft then Publish saved version through ordinary full-page forms', async ({
    page,
  }, testInfo) => {
    // #111: lifecycle Status is read-only in the editor, so a brand-new
    // draft can no longer be marked `published` through the form. The
    // ordinary full-page Save→Publish journey therefore starts from a
    // canonical article that is already published on `main` with no active
    // draft — its derived draft status stays `published`. Each project uses
    // its own pristine fixture: publishing merges an edit to `main`, and the
    // shared acceptance world must not leak that into the other project.
    const publishableSlug =
      testInfo.project.name === 'studio-no-js'
        ? STUDIO_ACCEPTANCE_PUBLISHABLE_SLUGS[1]
        : STUDIO_ACCEPTANCE_PUBLISHABLE_SLUGS[0];
    await page.goto(`/studio/articles/${publishableSlug}`);
    await waitForStudioHydration(page, testInfo);
    await expect(page.locator('#studio-field-status')).toHaveText('Published');

    await page
      .getByRole('textbox', { name: 'Body', exact: true })
      .fill('A complete ordinary server-form publication journey.');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(
      page.getByRole('heading', { name: 'Studio draft saved', exact: true }),
    ).toBeVisible();

    // Reload for fresh lifecycle evidence before approving the merge.
    await page.goto(`/studio/articles/${publishableSlug}`);
    await expect(page.getByText('Ready to publish', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Unsaved form changes' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Publish saved version' })).toBeEnabled();
    await page.getByRole('button', { name: 'Publish saved version' }).click();

    await expect(page.getByRole('heading', { name: 'Published', exact: true })).toBeVisible();
  });

  test('a brand-new article reaches publication through the server-authored status flip (#111 Design A)', async ({
    page,
  }, testInfo) => {
    // Lifecycle Status is read-only in the editor, so a brand-new draft is
    // saved as Draft. Publish itself originates the one byte-minimal
    // status-flip commit and binds readiness + auto-merge to the POST-flip
    // head — so the ordinary create→save→publish journey completes without
    // the form ever carrying a lifecycle value. Per-project slug: the merge
    // mutates the shared acceptance world.
    const suffix = testInfo.project.name === 'studio-no-js' ? 'no-js' : 'js';
    const slug = `first-light-${suffix}`;

    await page.goto('/studio/articles/new');
    await waitForStudioHydration(page, testInfo);
    await expect(page.locator('#studio-field-status')).toHaveText('Draft');
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill(`First Light ${suffix}`);
    await page.getByRole('textbox', { name: 'Slug', exact: true }).fill(slug);
    await page
      .getByRole('textbox', { name: 'Excerpt', exact: true })
      .fill('A first publication carried by the server-authored flip.');
    await page.getByText('More metadata', { exact: false }).click();
    await page.getByRole('textbox', { name: 'Published date', exact: true }).fill('2026-08-18');
    await page.getByRole('textbox', { name: 'Alt text', exact: true }).fill('First light cover.');
    await page
      .getByRole('textbox', { name: 'Body', exact: true })
      .fill('A brand-new article body published through the guarded flip.');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expectFirstSaveLanded(page, slug, testInfo);

    await page.goto(`/studio/articles/${slug}`);
    await expect(page.locator('#studio-field-status')).toHaveText('Draft');
    await expect(page.getByText('Ready to publish', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Publish saved version' }).click();

    await expect(page.getByRole('heading', { name: 'Published', exact: true })).toBeVisible();

    // The committed draft now says `published` (the flip landed), which is
    // exactly what the read-only status display derives from on a reload.
    await page.goto(`/studio/articles/${slug}`);
    await expect(page.locator('#studio-field-status')).toHaveText('Published');
  });
});
