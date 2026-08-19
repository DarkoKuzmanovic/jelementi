import { expect, test } from '@playwright/test';
import { expectNoBlockingAccessibilityViolations } from './accessibility';

/**
 * #101 Quiet Column public article acceptance. Runs under both
 * reader-js-enabled and reader-no-js projects against the deterministic
 * representative fixture catalog through the real static Reader routes.
 */

test('rich article opening presents the complete compact hierarchy', async ({ page }) => {
  await page.goto('/articles/acceptance-rich-column');
  const opening = page.locator('.article-opening');
  await expect(
    page.getByRole('heading', { level: 1, name: /Every Reader Structure/ }),
  ).toBeVisible();
  await expect(opening.getByRole('link', { name: 'Field Notes' })).toHaveAttribute(
    'href',
    '/categories/field-notes',
  );
  await expect(opening.getByText('By Jelementi')).toBeVisible();
  await expect(opening.getByText('7 min read')).toBeVisible();
  await expect(opening.getByText('18 August 2026')).toBeVisible();
  await expect(opening.getByRole('list', { name: 'Tags' })).toBeVisible();
  await expect(opening.getByRole('list', { name: 'Tags' }).getByText('Čačak')).toBeVisible();
});

test('audio sits directly beneath the opening; cover and all seven blocks follow in one flow', async ({
  page,
}) => {
  await page.goto('/articles/acceptance-rich-column');
  const audio = page.locator('audio[aria-label^="Audio for"]');
  await expect(audio).toBeVisible();
  await expect(audio).toHaveAttribute('controls', '');
  await expect(page.locator('figure.article-cover img')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // DOM order: opening → audio → cover → first block → endmatter.
  const order = await page.evaluate(() => {
    const article = document.querySelector('article#article-top');
    if (!article) throw new Error('Article root missing.');
    const nodes = Array.from(article.children);
    const pos = (selector: string) =>
      nodes.findIndex((node) => node.querySelector(selector) !== null || node.matches(selector));
    return {
      opening: pos('.article-opening'),
      audio: pos('.article-audio'),
      cover: pos('.article-cover'),
      body: pos('.article-body'),
      endmatter: pos('.article-endmatter'),
    };
  });
  expect(order.audio).toBeGreaterThan(order.opening);
  expect(order.cover).toBeGreaterThan(order.audio);
  expect(order.body).toBeGreaterThan(order.cover);
  expect(order.endmatter).toBeGreaterThan(order.body);

  // All seven block discriminants in the flow.
  const body = page.locator('article#article-top div.article-body');
  await expect(body.locator('p').first()).toBeVisible();
  await expect(body.locator('h2')).toBeVisible();
  await expect(body.locator('figure img')).toBeVisible();
  await expect(body.locator('ol')).toBeVisible();
  await expect(body.locator('blockquote')).toBeVisible();
  await expect(body.locator('aside.callout')).toBeVisible();
  await expect(body.locator('hr')).toBeVisible();

  // Inline marks/nodes and footnote reference links.
  await expect(body.locator('strong, em, code, s').first()).toBeVisible();
  await expect(page.getByRole('link', { name: '[locked-seam]' })).toHaveCount(2);

  // Endmatter: sources, numbered footnotes, and every backlink.
  await expect(page.getByRole('heading', { name: 'Sources' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Footnotes' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to footnote reference 1' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to footnote reference 2' })).toBeVisible();
  await expect(page.locator('section.article-endmatter ol > li')).toHaveCount(1);
});

test('no-audio sparse article leaves no empty treatment', async ({ page }) => {
  await page.goto('/articles/acceptance-no-audio-long-column');
  await expect(page.locator('audio')).toHaveCount(0);
  await expect(page.locator('div.article-body p').first()).toBeVisible();
  // Long unbroken content stays inside the bounded column at wide width.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});

test('continuation: exactly one next-older in the category and no wrapped continuation for the oldest', async ({
  page,
}) => {
  const nav = page.getByRole('navigation', { name: 'Continue reading' });

  await page.goto('/articles/acceptance-rich-column');
  await expect(nav.getByRole('link', { name: /Return to Field Notes/ })).toBeVisible();
  await expect(nav.getByRole('link', { name: /Next older article in Field Notes/ })).toHaveCount(1);
  await expect(nav.getByRole('link', { name: /The Middle Field Note/ })).toHaveAttribute(
    'href',
    '/articles/acceptance-field-middle',
  );

  // The next-older page itself renders one next-older (the oldest).
  await page.goto('/articles/acceptance-field-middle');
  await expect(nav.getByRole('link', { name: /The Oldest Field Note/ })).toHaveCount(1);

  // Oldest article in the category: no wrapped continuation.
  await page.goto('/articles/acceptance-field-oldest');
  await expect(nav.getByRole('link', { name: /Return to Field Notes/ })).toBeVisible();
  await expect(nav.getByRole('link', { name: /Next older article/ })).toHaveCount(0);
});

test('320px reflow has no page-level horizontal overflow on the rich article', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/articles/acceptance-rich-column');
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 320);
});

test('text resize, 400% zoom equivalent, and WCAG text spacing preserve one contained sequence', async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 900 });
  await page.goto('/articles/acceptance-no-audio-long-column');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Continue reading' })).toBeVisible();

  await page.evaluate((content) => {
    const style = document.createElement('style');
    style.dataset.acceptanceTextSpacing = 'true';
    style.textContent = content;
    document.head.appendChild(style);
  }, '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }');
  const appliedSpacing = await page
    .locator('article#article-top p')
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        letterSpacing: Number.parseFloat(style.letterSpacing),
        wordSpacing: Number.parseFloat(style.wordSpacing),
        marginBottom: Number.parseFloat(style.marginBottom),
        rulePresent: document.querySelector('style[data-acceptance-text-spacing]') !== null,
      };
    });
  expect(appliedSpacing.rulePresent).toBe(true);
  expect(appliedSpacing.letterSpacing).toBeGreaterThan(0);
  expect(appliedSpacing.wordSpacing).toBeGreaterThan(0);
  expect(appliedSpacing.marginBottom).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const clipped = await page
    .locator('article#article-top h1, article#article-top p, article#article-top a')
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const box = element.getBoundingClientRect();
          return box.left < 0 || box.right > window.innerWidth || box.width === 0;
        })
        .map((element) => element.textContent?.trim() ?? element.tagName),
    );
  expect(clipped).toEqual([]);
  await expect(
    page.getByRole('navigation', { name: 'Continue reading' }).getByRole('link').first(),
  ).toBeVisible();

  // A 1280px page at 400% zoom has a 320 CSS px effective viewport.
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/articles/acceptance-rich-column');
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 320);
  await expect(page.getByRole('heading', { name: 'Footnotes' })).toBeVisible();
});

test('article links retain visible keyboard focus treatment', async ({ page }) => {
  await page.goto('/articles/acceptance-rich-column');
  const category = page.locator('.article-opening').getByRole('link', { name: 'Field Notes' });
  await category.focus();
  await expect(category).toBeFocused();
  expect(await category.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe(
    'none',
  );

  const backlink = page.getByRole('link', { name: 'Back to footnote reference 1' });
  await backlink.focus();
  await expect(backlink).toBeFocused();
  expect(await backlink.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe(
    'none',
  );
});

test('light/dark roles and reduced motion apply on the article surface', async ({
  page,
}, testInfo) => {
  if (testInfo.project.name.includes('no-js')) test.skip();
  await page.goto('/articles/acceptance-rich-column');
  await page.emulateMedia({ colorScheme: 'light' });
  const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.emulateMedia({ colorScheme: 'dark' });
  const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(light).not.toBe(dark);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const suppressed = await page.evaluate(() => {
    const el = document.createElement('div');
    el.style.animationDuration = '10s';
    el.style.transitionDuration = '10s';
    document.body.appendChild(el);
    const cs = getComputedStyle(el);
    const result = { a: cs.animationDuration, t: cs.transitionDuration };
    el.remove();
    return result;
  });
  const ok = (v: string) => Number.parseFloat(v) < 0.02;
  expect(ok(suppressed.a)).toBe(true);
  expect(ok(suppressed.t)).toBe(true);
});

test('article is prerendered without hydration entry', async ({ page }) => {
  const response = await page.goto('/articles/acceptance-rich-column');
  expect(response?.status()).toBe(200);
  // No client app entry on an ordinary Reader route.
  await expect(page.locator('script[src*="entry/start"]')).toHaveCount(0);
  await expect(page.locator('meta[name="jelementi-content-version"]')).toHaveCount(1);
});

test('missing article 404s with the shared error surface and no next-older', async ({ page }) => {
  const response = await page.goto('/articles/missing-reader-acceptance-article');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Continue reading' })).toHaveCount(0);
});

test('article semantics name figures, audio, landmarks, footnotes, and backlinks', async ({
  page,
}) => {
  await page.goto('/articles/acceptance-rich-column');
  await expect(page.getByRole('banner')).toHaveCount(1);
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('contentinfo')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('figure', { name: 'Abstract acceptance cover' })).toBeVisible();
  await expect(page.locator('article#article-top figure figcaption')).toContainText(
    'conventional source link',
  );
  await expect(page.locator('audio')).toHaveAttribute(
    'aria-label',
    'Audio for Čačak Field Notes: Every Reader Structure',
  );
  await expect(page.getByRole('heading', { name: 'Footnotes' })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Back to footnote reference/ })).toHaveCount(2);
});

test('article has zero serious or critical accessibility findings', async ({ page }, testInfo) => {
  if (testInfo.project.name.includes('no-js')) test.skip();
  await page.goto('/articles/acceptance-rich-column');
  await expectNoBlockingAccessibilityViolations(page);
});
