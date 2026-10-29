import { expect, test } from '@playwright/test';
import { expectNoBlockingAccessibilityViolations } from './accessibility';

test('tablet contents remain available without the desktop rail', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto('/articles/acceptance-rich-column');
  await expect(page.locator('.article-margin')).toBeHidden();
  const contents = page.locator('.article-mobile-contents');
  await expect(contents).toBeVisible();
  await contents.locator('summary').click();
  const link = contents.locator('a[href="#rich-inline-heading"]');
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.locator('#rich-inline-heading')).toBeInViewport();
});

/**
 * #101 Quiet Column public article acceptance. Runs under both
 * reader-js-enabled and reader-no-js projects against the deterministic
 * representative fixture catalog through the real static Reader routes.
 */

test('reader-owned fragments resolve to exact targets beside colliding authored headings', async ({
  page,
}) => {
  await page.goto('/articles/acceptance-rich-column');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  expect(
    await page.evaluate(
      () =>
        document.getElementById(decodeURIComponent(location.hash.slice(1))) ===
        document.querySelector('main'),
    ),
  ).toBe(true);

  const ids = await page.locator('[id]').evaluateAll((nodes) => nodes.map((node) => node.id));
  expect(new Set(ids).size).toBe(ids.length);
  for (const link of await page.locator('.article-margin .article-contents a').all()) {
    await link.click();
    expect(
      await link.evaluate((node) => {
        const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
        if (node.getAttribute('href') === '#reader:sources')
          return target === document.querySelector('.article-endmatter > h2');
        return [...document.querySelectorAll('.article-body h2')].some(
          (heading) => heading === target && `#${heading.id}` === node.getAttribute('href'),
        );
      }),
    ).toBe(true);
  }
  for (const name of ['Sources', 'Footnotes']) {
    const section = page.getByRole('region', { name, exact: true });
    await expect(section.getByRole('heading', { name, exact: true })).toHaveCount(1);
  }
  for (const forward of await page.locator('.article-body sup > a').all()) {
    await forward.click();
    expect(
      await forward.evaluate((node) => {
        const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
        return (
          target?.matches('.article-endmatter ol > li') &&
          [...target.querySelectorAll('a[aria-label]')].some(
            (back) =>
              document.getElementById(back.getAttribute('href')!.slice(1)) === node.parentElement,
          )
        );
      }),
    ).toBe(true);
  }
  for (const back of await page.getByRole('link', { name: /^Back to footnote reference/ }).all()) {
    await back.click();
    expect(
      await back.evaluate((node) => {
        const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
        const forward = target?.querySelector('a');
        return (
          target?.tagName === 'SUP' &&
          forward &&
          document.getElementById(forward.getAttribute('href')!.slice(1)) === node.parentElement
        );
      }),
    ).toBe(true);
  }
});

test('narrow rich headings keep emphasis and links in one sentence flow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/articles/acceptance-rich-column');
  const heading = page.locator('#rich-inline-heading');
  await expect(heading.locator('em')).toHaveText('an emphasized phrase');
  await expect(heading.getByRole('link')).toHaveAttribute('href', 'https://example.com/heading');
  const layout = await heading.evaluate((node) => {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let first: Node | null;
    while ((first = walker.nextNode()) && !first.textContent?.startsWith('Before')) {}
    const range = document.createRange();
    range.setStart(first!, 0);
    range.setEnd(first!, 6);
    const before = [...range.getClientRects()];
    const em = node.querySelector('em')!.getClientRects()[0]!;
    return {
      beforeLines: before.length,
      sameLine: Math.abs(before[0]!.top - em.top) < 3,
      overflow: node.scrollWidth > node.clientWidth,
    };
  });
  expect(layout).toEqual({ beforeLines: 1, sameLine: true, overflow: false });
});

test('sources expose authored numbers and domains, then reveal later references natively', async ({
  page,
}) => {
  await page.goto('/articles/acceptance-rich-column');
  const sources = page.getByRole('region', { name: 'Sources', exact: true });
  const sourceLists = sources.locator('.article-sources');

  await expect(sourceLists).toHaveCount(2);
  await expect(sourceLists.nth(0).locator('li')).toHaveCount(4);
  await expect(sourceLists.nth(1).locator('li')).toHaveCount(7);
  await expect(sources.locator('.article-source__number').first()).toHaveText('4');
  await expect(sources.locator('.article-source__domain').first()).toContainText('example.com');
  await expect(sources.locator('.article-source__domain').first()).toContainText(
    'Jelementi fixtures',
  );
  await expect(
    sources.getByRole('link', { name: 'Reader acceptance source', exact: true }),
  ).toHaveAttribute('href', 'https://www.example.com/reader-acceptance-1');

  const details = sources.locator('details');
  const summary = details.getByText('Show all 11 sources', { exact: true });
  await expect(summary).toBeVisible();
  expect(
    await summary.evaluate((element) => ({
      color: getComputedStyle(element).color,
      fontWeight: getComputedStyle(element).fontWeight,
    })),
  ).toEqual({
    color: await sources
      .locator('.endmatter-heading')
      .first()
      .evaluate((element) => getComputedStyle(element).color),
    fontWeight: '500',
  });
  await summary.click();
  expect(
    await details.locator('.article-sources').evaluate((el) => getComputedStyle(el).marginTop),
  ).toBe('28px');
  await expect(sources.locator('.article-source__number').last()).toHaveText('11');
  await expect(sources.getByRole('link', { name: 'Reader acceptance source 11' })).toBeVisible();
});

test('rich article opening presents the complete compact hierarchy', async ({ page }) => {
  await page.goto('/articles/acceptance-rich-column');
  const opening = page.locator('.article-opening');
  await expect(
    page.getByRole('heading', { level: 1, name: /Every Reader Structure/ }),
  ).toBeVisible();
  await expect(opening.getByRole('link', { name: /Field Notes/ })).toHaveAttribute(
    'href',
    '/categories/field-notes',
  );
  await expect(opening.getByText('By Jelementi')).toBeVisible();
  await expect(opening.getByText('· 7 min read')).toBeVisible();
  await expect(opening.getByText('18 August 2026')).toBeVisible();
  await expect(page.locator('.article-facts').getByRole('list', { name: 'Tags' })).toBeVisible();
  await expect(
    page.locator('.article-facts').getByRole('list', { name: 'Tags' }).getByText('Čačak'),
  ).toBeVisible();
});

test('illustration precedes native audio and all seven blocks in one complete flow', async ({
  page,
}) => {
  await page.goto('/articles/acceptance-rich-column');
  const audio = page.locator('audio[aria-label^="Audio for"]');
  await expect(audio).toBeVisible();
  await expect(audio).toHaveAttribute('controls', '');
  await expect(page.locator('figure.article-cover img')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // The header pill targets the native player at the ending; the body follows the cover.
  const order = await page.evaluate(() => {
    const article = document.querySelector('article:has(> .article-opening)');
    if (!article) throw new Error('Article root missing.');
    const nodes = Array.from(
      article.querySelectorAll(
        '.article-opening, .article-cover, .article-audio, .article-body, .article-endmatter',
      ),
    );
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
  expect(order.cover).toBeGreaterThan(order.opening);
  expect(order.audio).toBeGreaterThan(order.cover);
  expect(order.audio).toBeGreaterThan(order.body);
  expect(order.endmatter).toBeGreaterThan(order.body);

  // All seven block discriminants in the flow.
  const body = page.locator('article:has(> .article-opening) div.article-body');
  await expect(body.locator('p').first()).toBeVisible();
  await expect(body.locator('h2').first()).toBeVisible();
  await expect(body.locator('figure img')).toBeVisible();
  await expect(body.locator('ol')).toBeVisible();
  await expect(body.locator('blockquote')).toBeVisible();
  await expect(body.locator('aside.callout')).toHaveCount(3);
  await expect(body.locator('aside.callout-fact')).toBeVisible();
  await expect(body.locator('aside.callout-note')).toBeVisible();
  await expect(body.locator('aside.callout-warning')).toBeVisible();
  await expect(body.locator('hr')).toBeVisible();

  // Inline marks/nodes and footnote reference links.
  await expect(body.locator('strong, em, code, s').first()).toBeVisible();
  await expect(page.getByRole('link', { name: '[locked-seam]' })).toHaveCount(2);

  // Endmatter: sources, numbered footnotes, and every backlink.
  await expect(page.getByRole('heading', { name: 'Sources', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Footnotes', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to footnote reference 1' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to footnote reference 2' })).toBeVisible();
  await expect(
    page.locator('section.article-endmatter[aria-labelledby="reader:footnotes"] ol > li'),
  ).toHaveCount(1);
});

test('no-audio sparse article leaves no empty treatment', async ({ page }) => {
  await page.goto('/articles/acceptance-no-audio-long-column');
  await expect(page.locator('audio')).toHaveCount(0);
  await expect(page.locator('.article-listen')).toHaveCount(0);
  await expect(page.locator('.article-body blockquote')).toHaveCount(0);
  await expect(page.locator('div.article-body p').first()).toBeVisible();
  // Long unbroken content stays inside the bounded column at wide width.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});

test('continuation offers three next-older category cards and never wraps', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Continue reading' });
  await page.goto('/articles/acceptance-rich-column');
  await expect(nav.getByRole('heading', { name: 'Keep reading in Field Notes' })).toBeVisible();
  await expect(nav.locator('.article-keep-reading__cards article')).toHaveCount(3);
  await expect(nav.getByRole('link', { name: 'The Middle Field Note' })).toHaveAttribute(
    'href',
    '/articles/acceptance-field-middle',
  );
  await page.goto('/articles/acceptance-field-middle');
  await expect(nav.getByRole('link', { name: /Field Notes, part 3: The final tower/ })).toHaveCount(
    1,
  );
  await page.goto('/articles/acceptance-field-oldest');
  await expect(nav.getByRole('link', { name: 'All Field Notes →' })).toBeVisible();
  await expect(nav.locator('.article-keep-reading__cards article')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(nav.getByRole('link', { name: 'All Field Notes →' })).toBeVisible();
});
test('mobile Keep reading uses compact rows with read time and right-hand square covers', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/articles/acceptance-rich-column');
  const section = page.locator('.article-keep-reading');
  await expect(section.getByRole('link', { name: 'All Field Notes →' })).toBeHidden();
  const row = section.locator('article').first();
  const image = await row.locator('img').boundingBox();
  const title = await row.getByRole('heading').boundingBox();
  expect(image!.width).toBe(104);
  expect(image!.height).toBe(104);
  expect(image!.x).toBeGreaterThan(title!.x + title!.width);
  await expect(row.locator('.deck')).toBeHidden();
  await expect(row.locator('.meta')).toContainText('min read');
  const meta = await row.locator('.meta').boundingBox();
  expect(
    Math.abs((title!.y + meta!.y + meta!.height) / 2 - (image!.y + image!.height / 2)),
  ).toBeLessThan(1);
  expect(await section.locator('h2').evaluate((el) => getComputedStyle(el).textTransform)).toBe(
    'uppercase',
  );
});

test('series articles show linked route discs, adjacent cards and complete endings', async ({
  page,
}) => {
  const ending = page.locator('.article-series-continuation');
  const partOne = '/articles/acceptance-field-series-first';
  const partTwo = '/articles/acceptance-field-series-middle';
  const partThree = '/articles/acceptance-field-series-third';
  const route = page.getByRole('navigation', { name: 'Field Notes parts' });
  const adjacent = page.getByRole('navigation', { name: 'Series parts', exact: true });

  await page.goto(partOne);
  await expect(page.locator('.article-opening__category')).toContainText('Part 1 of 3');
  await expect(route.locator('li')).toHaveCount(3);
  await expect(route.locator('[aria-current=step]')).toHaveText('1');
  await expect(route.getByRole('link', { name: 'Part 2', exact: true })).toHaveAttribute(
    'href',
    partTwo,
  );
  await expect(adjacent.locator('.article-series-position__previous')).toHaveCount(0);
  await expect(adjacent.locator('.article-series-position__next')).toHaveAttribute('href', partTwo);
  await expect(page.locator('h1')).toHaveText('The first tower');
  await expect(ending.getByRole('link', { name: 'Read part 2 →' })).toHaveAttribute(
    'href',
    partTwo,
  );
  await expect(ending.locator('.article-series-continuation__part')).toHaveCount(3);
  await expect(ending.locator('[aria-current=page]')).toContainText('You are here');
  await expect(ending).not.toContainText('Up next');
  await expect(page.locator('.article-keep-reading')).toBeVisible();

  await page.goto(partTwo);
  await expect(route.locator('[aria-current=step]')).toHaveText('2');
  await expect(adjacent.locator('.article-series-position__previous')).toHaveAttribute(
    'href',
    partOne,
  );
  await expect(adjacent.locator('.article-series-position__next')).toHaveAttribute(
    'href',
    partThree,
  );

  await page.goto(partThree);
  await expect(route.locator('[aria-current=step]')).toHaveText('3');
  await expect(adjacent.locator('.article-series-position__next')).toHaveCount(0);
  await expect(adjacent.locator('.article-series-position__previous')).toHaveAttribute(
    'href',
    partTwo,
  );
  await expect(ending.getByRole('link', { name: 'Back to part 1' })).toHaveAttribute(
    'href',
    partOne,
  );
  await expect(ending.getByRole('link', { name: /^Read part/ })).toHaveCount(0);
  await expect(ending.locator('.article-series-continuation__part')).toHaveCount(3);
  await expect(page.getByText('Keep reading in Field Notes')).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(partTwo);
  await expect(route).toBeVisible();
  await expect(page.locator('.article-margin')).toBeHidden();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  const band = await ending.boundingBox();
  const keep = await page.locator('.article-keep-reading').boundingBox();
  expect(band!.y + band!.height).toBeLessThanOrEqual(keep!.y);
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
    .locator('article:has(> .article-opening) p')
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
    .locator(
      'article:has(> .article-opening) h1, article:has(> .article-opening) p, article:has(> .article-opening) a',
    )
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          if (element.getClientRects().length === 0) return false;
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
  await expect(page.getByRole('heading', { name: 'Footnotes', exact: true })).toBeVisible();
});

test('article links retain visible keyboard focus treatment', async ({ page }) => {
  await page.goto('/articles/acceptance-rich-column');
  const category = page.locator('.article-opening').getByRole('link', { name: /Field Notes/ });
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
  await expect(page.getByRole('heading', { name: 'This page is not available.' })).toBeVisible();
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
  await expect(page.locator('article:has(> .article-opening) figure figcaption')).toContainText(
    'conventional source link',
  );
  await expect(page.locator('audio')).toHaveAttribute(
    'aria-label',
    'Audio for Čačak Field Notes: Every Reader Structure',
  );
  await expect(page.getByRole('heading', { name: 'Footnotes', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Back to footnote reference/ })).toHaveCount(2);
});

test('article has zero serious or critical accessibility findings', async ({ page }, testInfo) => {
  if (testInfo.project.name.includes('no-js')) test.skip();
  await page.goto('/articles/acceptance-rich-column');
  await expectNoBlockingAccessibilityViolations(page);
});

test('citation navigation reveals a collapsed source without hydration', async ({ page }) => {
  await page.goto('/articles/acceptance-rich-column');
  const source = page.locator('[id="reader:source:5"]');
  await expect(source).toBeHidden();
  await page.getByRole('link', { name: 'Source 5', exact: true }).click();
  await expect(source).toBeVisible();
  await expect(source).toBeInViewport();
  await page.goto('/articles/acceptance-rich-column#reader:source:6');
  await expect(page.locator('[id="reader:source:6"]')).toBeVisible();
});

test('mobile contents use native details and tablet rails disappear', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/articles/acceptance-rich-column');
  const details = page.locator('.article-mobile-contents');
  await expect(details.locator('nav')).toBeHidden();
  await details.locator('summary').click();
  const first = details.getByRole('link').first();
  await expect(first).toBeVisible();
  const target = await first.getAttribute('href');
  await first.click();
  expect(new URL(page.url()).hash).toBe(target);
  await page.setViewportSize({ width: 1000, height: 844 });
  await expect(page.locator('.article-margin')).toBeHidden();
  await expect(page.locator('.article-facts')).toBeHidden();
});
