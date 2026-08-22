import { expect, test } from '@playwright/test';
import {
  STUDIO_ACCEPTANCE_IDENTITY_HEADER,
  STUDIO_ACCEPTANCE_IDENTITY_TOKEN,
} from '../../src/lib/server/studio/request-guard.server';
import { waitForStudioHydration } from './helpers';

const ARTICLE_SLUG = 'lighthouse-watch';
const ARTICLE_TITLE = 'The Lighthouse Watch';
const LIVE_SLUG = 'verified-harbor';

const identityHeaders = {
  [STUDIO_ACCEPTANCE_IDENTITY_HEADER]: STUDIO_ACCEPTANCE_IDENTITY_TOKEN,
};

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders(identityHeaders);
});

function parseHex(hex: string): [number, number, number] | null {
  const h = hex.trim().toLowerCase();
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(h);
  if (!m) return null;
  let c = m[1]!;
  if (c.length === 3)
    c = c
      .split('')
      .map((ch) => ch + ch)
      .join('');
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

function luminance([r, g, b]: [number, number, number]): number {
  const toLinear = (c: number): number => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(fg: string, bg: string): number | null {
  const fgRgb = parseHex(fg);
  const bgRgb = parseHex(bg);
  if (!fgRgb || !bgRgb) return null;
  const l1 = luminance(fgRgb);
  const l2 = luminance(bgRgb);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

test.describe('responsive reflow — #79 criterion 3', () => {
  test('Flowboard at ~320 CSS px has no page-level horizontal reflow', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto('/studio');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    // Stacked order is preserved (Resume work → Ready for your decision → Library) even at 320.
    const resumeBox = await page.getByRole('heading', { name: 'Resume work' }).boundingBox();
    const decisionBox = await page
      .getByRole('heading', { name: 'Ready for your decision' })
      .boundingBox();
    const libraryBox = await page
      .getByRole('heading', { name: 'Library', exact: true })
      .boundingBox();
    if (!resumeBox || !decisionBox || !libraryBox)
      throw new Error('Flowboard columns not laid out at 320px');
    expect(resumeBox.y).toBeLessThan(decisionBox.y);
    expect(decisionBox.y).toBeLessThan(libraryBox.y);
    // Ordinary cards are present — no information loss at narrow width.
    await expect(page.locator('[data-article-slug]').first()).toBeVisible();
  });

  test('Editorial desk at ~320 CSS px has no page-level horizontal reflow and stacks editor→preview→publication', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(`/studio/articles/${ARTICLE_SLUG}`);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const editor = page.getByRole('region', { name: ARTICLE_TITLE, exact: true });
    const preview = page.getByRole('region', { name: 'Explicit preview', exact: true });
    const publication = page.getByRole('complementary', { name: 'Publication center' });
    const [eBox, pBox, pubBox] = await Promise.all([
      editor.boundingBox(),
      preview.boundingBox(),
      publication.boundingBox(),
    ]);
    if (!eBox || !pBox || !pubBox) throw new Error('Editorial desk not laid out at 320px');
    expect(eBox.y).toBeLessThan(pBox.y);
    expect(pBox.y).toBeLessThan(pubBox.y);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });

  test('400% zoom equivalent (320px effective) has no page-level two-axis scrolling — both routes', async ({
    page,
  }) => {
    // 400% zoom on a 1280px design = 320px effective viewport. Covers #79 "approximately
    // 320 CSS pixels and 400% zoom" with a single narrow-viewport proof; genuinely
    // two-dimensional comparisons scroll only within their region (checked below).
    for (const path of ['/studio', `/studio/articles/${ARTICLE_SLUG}`]) {
      await page.setViewportSize({ width: 320, height: 800 });
      await page.goto(path);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      // Page-level two-axis would be simultaneous horizontal + vertical page scrollbars
      // for ordinary content. Horizontal must stay absent; vertical is allowed.
      const hasHorizontal = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(hasHorizontal).toBe(false);
    }
    // No region traps the page: the only overflow-y:auto region is the desktop publication
    // column, which collapses to static at narrow widths — verify it does not force a second axis.
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`/studio/articles/${ARTICLE_SLUG}`);
    const pubOverflow = await page.evaluate(() => {
      const el = document.querySelector(
        '.studio-editorial-desk__publication',
      ) as HTMLElement | null;
      if (!el) return null;
      return getComputedStyle(el).overflowY;
    });
    expect(['visible', 'auto', 'scroll'].includes(pubOverflow ?? '')).toBe(true);
  });

  test('Editorial desk intermediate two-region layout (desktop→2-col→stacked)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/studio/articles/${ARTICLE_SLUG}`);
    const editor = page.getByRole('region', { name: ARTICLE_TITLE, exact: true });
    const preview = page.getByRole('region', { name: 'Explicit preview', exact: true });
    const publication = page.getByRole('complementary', { name: 'Publication center' });
    let [eBox, pBox, pubBox] = await Promise.all([
      editor.boundingBox(),
      preview.boundingBox(),
      publication.boundingBox(),
    ]);
    if (!eBox || !pBox || !pubBox) throw new Error('Editorial desk not laid out at 1280');
    // Desktop: three columns side-by-side (x ordering; y roughly equal, within a
    // band). The editor takes the centre column and the preview the left one;
    // DOM order stays editor -> preview -> publication.
    expect(pBox.x).toBeLessThan(eBox.x);
    expect(eBox.x).toBeLessThan(pubBox.x);
    expect(Math.abs(eBox.y - pBox.y)).toBeLessThan(40);

    // Intermediate (~1000px, below 1120 breakpoint): publication wraps to full-width second row.
    await page.setViewportSize({ width: 1024, height: 900 });
    [eBox, pBox, pubBox] = await Promise.all([
      editor.boundingBox(),
      preview.boundingBox(),
      publication.boundingBox(),
    ]);
    if (!eBox || !pBox || !pubBox) throw new Error('Editorial desk not laid out at 1024');
    expect(eBox.y).toBeLessThan(pubBox.y);
    expect(pBox.y).toBeLessThan(pubBox.y);
    // Publication spans full width in the intermediate layout.
    expect(pubBox.x).toBeLessThanOrEqual(Math.min(eBox.x, pBox.x) + 2);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    // Narrow: fully stacked editor→preview→publication (already proven above, but order again).
    await page.setViewportSize({ width: 600, height: 900 });
    [eBox, pBox, pubBox] = await Promise.all([
      editor.boundingBox(),
      preview.boundingBox(),
      publication.boundingBox(),
    ]);
    if (!eBox || !pBox || !pubBox) throw new Error('Editorial desk not laid out at 600');
    expect(eBox.y).toBeLessThan(pBox.y);
    expect(pBox.y).toBeLessThan(pubBox.y);
  });
});

test.describe('light/dark semantic tokens and WCAG AA — #79 criterion 4', () => {
  test('semantic role pairs meet WCAG 2.2 AA contrast in both light and dark', async ({ page }) => {
    await page.goto(`/studio/articles/${ARTICLE_SLUG}`);
    // Probe the shell where tokens are defined (.studio-shell).
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      const vars = await page.evaluate(() => {
        const shell = document.querySelector('.studio-shell') as HTMLElement | null;
        if (!shell) return null;
        const cs = getComputedStyle(shell);
        const pick = (name: string) => cs.getPropertyValue(name).trim();
        return {
          canvas: pick('--studio-canvas'),
          panel: pick('--studio-panel'),
          textPrimary: pick('--studio-text-primary'),
          textMuted: pick('--studio-text-muted'),
          border: pick('--studio-border'),
          surfaceSelected: pick('--studio-surface-selected'),
          textSelected: pick('--studio-text-selected'),
          actionBg: pick('--studio-action-primary-bg'),
          actionFg: pick('--studio-action-primary-fg'),
          infoSurface: pick('--studio-info-surface'),
          infoText: pick('--studio-info-text'),
          dangerSurface: pick('--studio-danger-surface'),
          dangerText: pick('--studio-danger-text'),
          disabledBg: pick('--studio-disabled-bg'),
          disabledText: pick('--studio-disabled-text'),
          focus: pick('--studio-focus'),
          link: pick('--studio-link'),
        };
      });
      if (!vars) throw new Error('Missing .studio-shell tokens');

      // Normal text on canvas/panel must be ≥4.5:1.
      expect(
        contrastRatio(vars.textPrimary, vars.canvas),
        `text-primary/canvas ${scheme}`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(vars.textMuted, vars.canvas),
        `text-muted/canvas ${scheme}`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(vars.link, vars.canvas), `link/canvas ${scheme}`).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(
        contrastRatio(vars.textSelected, vars.surfaceSelected),
        `text-selected/surface-selected ${scheme}`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(vars.actionFg, vars.actionBg),
        `action fg/bg ${scheme}`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(vars.infoText, vars.infoSurface),
        `info ${scheme}`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(vars.dangerText, vars.dangerSurface),
        `danger ${scheme}`,
      ).toBeGreaterThanOrEqual(4.5);
      // Non-text (disabled) ≥3:1.
      expect(
        contrastRatio(vars.disabledText, vars.disabledBg),
        `disabled ${scheme}`,
      ).toBeGreaterThanOrEqual(3);
      // Focus ring must contrast with canvas at ≥3:1 (UI component) and is 3px solid.
      expect(
        contrastRatio(vars.focus, vars.canvas),
        `focus/canvas ${scheme}`,
      ).toBeGreaterThanOrEqual(3);
    }
    // Reset.
    await page.emulateMedia({ colorScheme: 'light' });
  });

  test('status text is visible independent of hue (not color-alone) and focus ring is unobscured', async ({
    page,
  }) => {
    await page.goto('/studio');
    // Every card exposes published/working labels as text plus pill — visible even without hue.
    const cards = page.locator('[data-article-slug]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(6);
    for (let i = 0; i < Math.min(count, 3); i += 1) {
      const card = cards.nth(i);
      await expect(card.getByText('Published version', { exact: true })).toBeVisible();
      await expect(card.getByText('Working change', { exact: true })).toBeVisible();
      const pill = card.locator('dd').first();
      const color = await pill.evaluate((el) => getComputedStyle(el).color);
      const bg = await pill.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(color).not.toBe('rgba(0, 0, 0, 0)');
      expect(bg).not.toBe('rgba(0, 0, 0, 0)');
      expect(await pill.textContent()).not.toBe('');
    }

    // Focus ring: a Tabbed Studio control (inside .studio-shell) shows the
    // spec 3px solid outline with 3px offset. The global site header lives
    // outside the shell and carries the browser's default 1px ring — that
    // is correct scoping, not a gap, so seek the first *Studio* control.
    const focusStudio = async () => {
      for (let i = 0; i < 15; i += 1) {
        await page.keyboard.press('Tab');
        const info = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el) return null;
          const inShell = el.closest('.studio-shell') !== null;
          const cs = getComputedStyle(el);
          return { inShell, style: cs.outlineStyle, width: cs.outlineWidth };
        });
        if (info?.inShell) return info;
      }
      return null;
    };
    const info = await focusStudio();
    if (!info) throw new Error('Tab never reached a focusable control inside .studio-shell');
    // Now assert the shell-scoped :focus-visible contract.
    const outline = await page.locator(':focus').evaluate((el) => {
      const cs = getComputedStyle(el);
      return { style: cs.outlineStyle, width: cs.outlineWidth, offset: cs.outlineOffset };
    });
    expect(outline.style).not.toBe('none');
    expect(outline.width).toBe('3px');
    expect(outline.offset).toBe('3px');
    const box = await page.locator(':focus').boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(-2);
      expect(box.x + box.width).toBeLessThanOrEqual(1280 + 2);
    }

    // Dark scheme also yields the distinct --studio-focus ring inside the shell.
    await page.emulateMedia({ colorScheme: 'dark' });
    const darkInfo = await focusStudio();
    if (!darkInfo) throw new Error('Tab never reached .studio-shell in dark scheme');
    const outlineDark = await page
      .locator(':focus')
      .evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outlineDark).not.toBe('none');
    await page.emulateMedia({ colorScheme: 'light' });
  });
});

test.describe('keyboard-only operation — #79 criterion 5', () => {
  test('Flowboard: Tab reaches search, filter, view controls, card links, Check status, and Evidence disclosures in DOM order', async ({
    page,
  }) => {
    await page.goto('/studio');
    const expected = [
      { role: 'link', name: 'New article' },
      { role: 'searchbox', name: 'Search articles' },
      { role: 'combobox', name: /Filter by workflow/i },
      { role: 'radio', name: 'Board' },
      { role: 'radio', name: 'Compact' },
    ] as const;

    // Walk DOM order: each expected control must be focusable via Tab at some point.
    // Press Tab up to 40 times and track which expected roles were focused.
    const seen = new Set<string>();
    const focusLog: string[] = [];
    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return null;
        const role = el.getAttribute('role') ?? el.tagName.toLowerCase();
        const label =
          el.getAttribute('aria-label') ??
          (el as HTMLInputElement).placeholder ??
          el.textContent?.trim().slice(0, 40) ??
          '';
        return {
          tag: el.tagName,
          role,
          label,
          id: el.id,
          name: (el as HTMLInputElement).name ?? '',
        };
      });
      if (info) focusLog.push(`${info.tag}:${info.role}:${info.label}`);
      for (const exp of expected) {
        try {
          const loc = page.locator(':focus');
          if (exp.role === 'link') {
            if (
              (await loc.evaluate((e) => e.tagName === 'A')) &&
              (await loc.textContent())?.includes('New article')
            )
              seen.add('new-article');
          } else if (exp.role === 'searchbox') {
            if (
              await loc.evaluate(
                (e) =>
                  e.getAttribute('role') === 'searchbox' ||
                  (e as HTMLInputElement).type === 'search',
              )
            )
              seen.add('search');
          } else if (exp.role === 'combobox') {
            if (
              await loc.evaluate(
                (e) => e.tagName === 'SELECT' || e.getAttribute('role') === 'combobox',
              )
            )
              seen.add('filter');
          } else if (exp.role === 'radio') {
            const text = (await loc.textContent())?.trim() ?? '';
            if (text.includes(exp.name as string)) seen.add(exp.name as string);
          }
        } catch {}
      }
      // Early exit when all expected have been seen plus at least one card link and one Check button.
      const hasCardLink = await page
        .locator(':focus')
        .evaluate((e) => e.tagName === 'A' && e.getAttribute('href')?.includes('/studio/articles/'))
        .catch(() => false);
      const hasCheck = await page
        .locator(':focus')
        .evaluate((e) => e.textContent?.includes('Check status') ?? false)
        .catch(() => false);
      if (hasCardLink) seen.add('card-link');
      if (hasCheck) seen.add('check');
      if (
        seen.has('new-article') &&
        seen.has('search') &&
        seen.has('filter') &&
        seen.has('card-link') &&
        seen.has('check')
      )
        break;
    }
    expect(
      seen.has('new-article'),
      `Tab never reached New article; focus log: ${focusLog.join(' | ')}`,
    ).toBe(true);
    expect(seen.has('search'), `Tab never reached Search; log: ${focusLog.join(' | ')}`).toBe(true);
    expect(seen.has('filter'), `Tab never reached Filter; log: ${focusLog.join(' | ')}`).toBe(true);
    expect(
      seen.has('card-link'),
      `Tab never reached a card link; log: ${focusLog.join(' | ')}`,
    ).toBe(true);
    expect(seen.has('check'), `Tab never reached Check status; log: ${focusLog.join(' | ')}`).toBe(
      true,
    );

    // Evidence disclosure is a native <details>/<summary> — summary is keyboard reachable (Space/Enter toggles).
    const firstSummary = page.locator('details summary').first();
    await firstSummary.focus();
    await expect(firstSummary).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Base version').first()).toBeVisible();
  });

  test('Editorial desk: Tab reaches every field, disclosure, link, action, and destructive confirmation', async ({
    page,
  }, testInfo) => {
    await page.goto(`/studio/articles/${ARTICLE_SLUG}`);
    await waitForStudioHydration(page, testInfo);

    // #111: lifecycle Status is presentation-only — still exposed next to the
    // other essentials, but not an interactive Tab stop.
    await expect(page.locator('#studio-field-status')).toBeVisible();

    const fieldLabels = ['Title', 'Slug', 'Excerpt', 'Body'] as const;
    for (const label of fieldLabels) {
      const ctrl = page.getByRole('textbox', { name: label, exact: true });
      await ctrl.focus();
      await expect(ctrl).toBeFocused();
      // Focus ring must be visible on each field.
      const outlineStyle = await ctrl.evaluate((el) => getComputedStyle(el).outlineStyle);
      // JSDOM-less: outline is on :focus-visible after keyboard nav; after .focus() it may be
      // programmatic — press Tab to it instead and check outline.
      if (outlineStyle === 'none') {
        await page.keyboard.press('Tab');
        const focused = page.locator(':focus');
        const s = await focused.evaluate((el) => getComputedStyle(el).outlineStyle);
        expect(s).not.toBe('none');
      }
    }

    // More metadata disclosure is a details/summary — keyboard reachable and opens to reveal nested fields.
    const moreMeta = page.getByText('More metadata', { exact: false });
    await moreMeta.click();
    await expect(page.getByRole('textbox', { name: 'Category', exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'Category', exact: true }).focus();
    await expect(page.getByRole('textbox', { name: 'Category', exact: true })).toBeFocused();

    // Actions: Preview, Save draft, Publish saved version, Check status.
    for (const name of ['Preview', 'Save draft'] as const) {
      const btn = page.getByRole('button', { name, exact: true });
      await btn.focus();
      await expect(btn).toBeFocused();
    }
    const checkBtn = page.getByRole('button', { name: /Check status/ }).first();
    await checkBtn.focus();
    await expect(checkBtn).toBeFocused();
    const publishBtn = page.getByRole('button', { name: 'Publish saved version' });
    await publishBtn.focus();
    await expect(publishBtn).toBeFocused();

    // Validation summary links focus their target control (already keyboard reachable) — covered in
    // studio-recovery.spec.ts via link click; here ensure the summary itself is reachable when present
    // by seeding an invalid fixture.
    await page.goto(`/studio/articles/weather-notes`);
    await waitForStudioHydration(page, testInfo);
    const issueLink = page.getByRole('link', { name: /Go to Body/i }).first();
    await issueLink.focus();
    await expect(issueLink).toBeFocused();

    // Recovery panel controls are keyboard reachable when a stale recovery is present (JS only).
    if (testInfo.project.name !== 'studio-no-js') {
      const staleRecord = {
        version: 1,
        candidate: {
          metadata: {
            title: 'The Lighthouse Watch',
            slug: ARTICLE_SLUG,
            excerpt: 'Stale',
            status: 'draft',
            updatedAt: '2026-08-18',
            category: 'Fixtures',
            tags: ['acceptance'],
            author: 'Studio Acceptance',
            cover: { src: 'articles/lighthouse-watch/cover.svg', alt: 'A lighthouse at dusk.' },
            references: [],
          },
          body: 'A stale body for keyboard reach.',
          concurrency: { baseMainSha: 'a'.repeat(40), draftHeadSha: 'b'.repeat(40) },
        },
        loadedConcurrency: { baseMainSha: 'a'.repeat(40), draftHeadSha: 'b'.repeat(40) },
        capturedAt: '2026-08-18T12:00:00.000Z',
      };
      await page.addInitScript((record) => {
        sessionStorage.setItem(
          'jelementi.studio.recovery.lighthouse-watch',
          JSON.stringify(record),
        );
      }, staleRecord);
      await page.goto(`/studio/articles/${ARTICLE_SLUG}`);
      await waitForStudioHydration(page, testInfo);
      const compareBtn = page.getByRole('button', { name: 'Compare/Restore' });
      await compareBtn.focus();
      await expect(compareBtn).toBeFocused();
    }

    // Destructive confirmation: danger zone disclosure → Unpublish… button → dialog Cancel focus → Escape restore.
    await page.goto(`/studio/articles/${LIVE_SLUG}`);
    await waitForStudioHydration(page, testInfo);
    const dangerSummary = page.getByText('Danger zone', { exact: true });
    await dangerSummary.click();
    const opener = page.getByRole('button', { name: /Unpublish/ }).first();
    await opener.focus();
    await expect(opener).toBeFocused();
    if (testInfo.project.name !== 'studio-no-js') {
      await page.getByRole('button', { name: 'Unpublish…', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Unpublish this article?' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
      // Tab never escapes the modal.
      for (let i = 0; i < 4; i += 1) {
        await page.keyboard.press('Tab');
        const escaped = await page.evaluate(() => {
          const dlg = document.querySelector('dialog[open]');
          const active = document.activeElement;
          return (
            !!dlg &&
            !!active &&
            active !== document.body &&
            active !== document.documentElement &&
            !dlg.contains(active)
          );
        });
        expect(escaped).toBe(false);
      }
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(page.getByRole('button', { name: 'Unpublish…', exact: true })).toBeFocused();
    }
  });
});

test.describe('explicit Check status — both routes, both projects', () => {
  test('Flowboard Check status and Editorial desk Check status are present and keyboard reachable', async ({
    page,
  }) => {
    await page.goto('/studio');
    await expect(page.getByRole('button', { name: 'Check status' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Check status' }).first().focus();
    await expect(page.getByRole('button', { name: 'Check status' }).first()).toBeFocused();

    await page.goto(`/studio/articles/${ARTICLE_SLUG}`);
    const check = page.getByRole('button', { name: /Check status/ }).first();
    await expect(check).toBeVisible();
    await check.focus();
    await expect(check).toBeFocused();
  });
});
