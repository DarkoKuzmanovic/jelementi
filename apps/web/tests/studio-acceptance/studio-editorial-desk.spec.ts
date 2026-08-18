import { expect, test } from '@playwright/test';
import {
  STUDIO_ACCEPTANCE_IDENTITY_HEADER,
  STUDIO_ACCEPTANCE_IDENTITY_TOKEN,
} from '../../src/lib/server/studio/request-guard.server';
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

    await expect(page.getByRole('heading', { name: 'Essentials' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Slug', exact: true })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Status', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Excerpt', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Body', exact: true })).toBeVisible();
    await expect(page.getByText('Writing · No autosave')).toBeVisible();

    await page.getByText('More metadata', { exact: false }).click();
    await expect(page.getByRole('textbox', { name: 'Updated date', exact: true })).toBeVisible();
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
    expect(editorBox.x).toBeLessThan(previewBox.x);
    expect(previewBox.x).toBeLessThan(publicationBox.x);
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
    const suffix = testInfo.project.name === 'studio-no-js' ? 'no-js' : 'js';
    const slug = `editorial-journey-${suffix}`;

    await page.goto('/studio/articles/new');
    await waitForStudioHydration(page, testInfo);
    await page
      .getByRole('textbox', { name: 'Title', exact: true })
      .fill(`Editorial journey ${suffix}`);
    await page.getByRole('textbox', { name: 'Slug', exact: true }).fill(slug);
    await page
      .getByRole('textbox', { name: 'Excerpt', exact: true })
      .fill('A deterministic publication journey.');
    await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('published');
    await page
      .getByRole('textbox', { name: 'Body', exact: true })
      .fill('A complete ordinary server-form publication journey.');
    await page.getByText('More metadata', { exact: false }).click();
    await page.getByRole('textbox', { name: 'Published date', exact: true }).fill('2026-08-18');
    await page.getByRole('textbox', { name: 'Alt text', exact: true }).fill('Acceptance cover.');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expectFirstSaveLanded(page, slug, testInfo);

    await page.goto(`/studio/articles/${slug}`);
    await expect(page.getByText('Ready to publish', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Unsaved form changes' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Publish saved version' })).toBeEnabled();
    await page.getByRole('button', { name: 'Publish saved version' }).click();

    await expect(page.getByRole('heading', { name: 'Published', exact: true })).toBeVisible();
  });
});
