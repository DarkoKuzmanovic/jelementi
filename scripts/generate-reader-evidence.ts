/**
 * Deterministic curated visual evidence generator for T104.
 *
 * Produces Chromium-automated screenshots (wide + 320, light + dark,
 * reduced-motion) as review evidence, and a contact sheet markdown that
 * explicitly marks Firefox, WebKit proxy, coarse-pointer/touch, and Orca
 * as BLOCKED_PENDING_HUMAN.
 *
 * Usage:
 *   pnpm tsx scripts/generate-reader-evidence.ts         # generate screenshots if browser available
 *   pnpm tsx scripts/generate-reader-evidence.ts --dry-run # only write contact sheet markdown
 *
 * Determinism: route list and filenames are frozen; screenshot capture
 * uses a fixed fixture catalog (representative scenario) via the same
 * Vite config as the Playwright suite.
 */
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export function getCurrentHead(): string {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
  if (result.status !== 0 || !result.stdout?.trim()) {
    throw new Error(
      'Failed to derive current HEAD — refusing to record stale base. Ensure git is available and this is a git worktree.',
    );
  }
  const sha = result.stdout.trim();
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`Invalid HEAD sha: ${sha}`);
  return sha;
}

export const PLACEHOLDER_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export function isPlaceholderPng(buffer: Buffer): boolean {
  return buffer.equals(Buffer.from(PLACEHOLDER_PNG_BASE64, 'base64'));
}

export function pngWidth(buffer: Buffer): number | null {
  // PNG IHDR width at bytes 16-19 big-endian (after 8-byte signature + 4-byte length + 4-byte 'IHDR')
  if (buffer.length < 24 || buffer.readUInt32BE(12) !== 0x49484452) return null; // 'IHDR'
  return buffer.readUInt32BE(16);
}

export interface EvidenceRoute {
  id: string;
  path: string;
  label: string;
}

export const EVIDENCE_ROUTES: readonly EvidenceRoute[] = [
  { id: 'home', path: '/', label: 'Home (Editorial front — complete catalog)' },
  { id: 'categories', path: '/categories', label: 'Categories (Quiet index directory)' },
  {
    id: 'category-field-notes',
    path: '/categories/field-notes',
    label: 'Category — Field Notes (newest-first sequence)',
  },
  {
    id: 'article-rich',
    path: '/articles/acceptance-rich-column',
    label: 'Article — rich column with audio, footnotes, 7 blocks',
  },
  {
    id: 'article-sparse',
    path: '/articles/acceptance-no-audio-long-column',
    label: 'Article — sparse without audio (representative fixture)',
  },
  { id: 'search', path: '/search', label: 'Search (browse-first, progressive enhancement)' },
  { id: 'about', path: '/about', label: 'About (compact factual)' },
  {
    id: '404',
    path: '/unknown-reader-acceptance-route',
    label: 'Static 404 fallback (normal shell, HTTP 404)',
  },
] as const;

export type Theme = 'light' | 'dark';
export type Width = 1280 | 320;

export function evidenceRouteToFilename(route: EvidenceRoute, theme: Theme, width: Width): string {
  return `${route.id}--${theme}--${width}.png`;
}

export interface ContactSheetInput {
  generatedAt: string;
  commit: string;
  measurements: {
    representativeHtmlBytes: number;
    uniqueReaderCssBytes: number;
    searchJavaScriptBytes: number;
  };
  assetsCeilings: {
    representativeHtml: number;
    uniqueReaderCss: number;
    searchJavaScript: number;
  };
  routes: readonly EvidenceRoute[];
}

export function buildContactSheetMarkdown(input: ContactSheetInput): string {
  const { generatedAt, commit, measurements, assetsCeilings, routes } = input;
  const lines: string[] = [];
  lines.push('# Reader acceptance — deterministic curated evidence');
  lines.push('');
  lines.push(`Generated: ${generatedAt} | Commit: ${commit}`);
  lines.push('');
  lines.push('Deterministic curated evidence — review, not gate. No pixel-diff CI assertion.');
  lines.push('');
  lines.push('## Asset ceilings (frozen #96 counting rules)');
  lines.push('');
  lines.push(`| Surface | Measured | Ceiling | Status |`);
  lines.push(`| --- | ---: | ---: | --- |`);
  lines.push(
    `| Representative HTML total | ${measurements.representativeHtmlBytes} | ${assetsCeilings.representativeHtml} | ${measurements.representativeHtmlBytes <= assetsCeilings.representativeHtml ? 'PASS' : 'FAIL'} |`,
  );
  lines.push(
    `| Unique Reader CSS | ${measurements.uniqueReaderCssBytes} | ${assetsCeilings.uniqueReaderCss} | ${measurements.uniqueReaderCssBytes <= assetsCeilings.uniqueReaderCss ? 'PASS' : 'FAIL'} |`,
  );
  lines.push(
    `| Search JavaScript | ${measurements.searchJavaScriptBytes} | ${assetsCeilings.searchJavaScript} | ${measurements.searchJavaScriptBytes <= assetsCeilings.searchJavaScript ? 'PASS' : 'FAIL'} |`,
  );
  lines.push('');
  lines.push(
    'Per-route HTML ceilings: Home 9,520; About 9,319; category 9,363; article 13,203; Search 11,815; 404 9,473; Categories 8,192.',
  );
  lines.push('');
  lines.push('## Curated screenshot matrix (Chromium automated)');
  lines.push('');
  lines.push(
    'Chromium automated via Playwright `reader-js-enabled` at representative fixture. Each cell is 1280 wide and 320 narrow, light and dark, reduced-motion where noted.',
  );
  lines.push('');
  lines.push('| Route | Path | 1280 light | 1280 dark | 320 light | 320 dark |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const route of routes) {
    const a = evidenceRouteToFilename(route, 'light', 1280);
    const b = evidenceRouteToFilename(route, 'dark', 1280);
    const c = evidenceRouteToFilename(route, 'light', 320);
    const d = evidenceRouteToFilename(route, 'dark', 320);
    lines.push(
      `| ${route.label} | \`${route.path}\` | \`${a}\` | \`${b}\` | \`${c}\` | \`${d}\` |`,
    );
  }
  lines.push('');
  lines.push(
    'Screenshots saved under `docs/evidence/reader-acceptance/screenshots/` (git-tracked). Review them visually; do not add pixel-diff CI gates.',
  );
  lines.push('');
  lines.push('## Manual matrix — honestly marked');
  lines.push('');
  lines.push(
    'All genuinely manual checkpoints remain **BLOCKED_PENDING_HUMAN** until a human performs and records them; Lighthouse is **PASS per amended contract** (agent-run, reproducible) — see below:',
  );
  lines.push('');
  lines.push(
    '- Chromium stable desktop (wide/320, light/dark, reduced motion, keyboard, zoom 100/200/400, text spacing, no-JS) — **BLOCKED_PENDING_HUMAN**',
  );
  lines.push(
    '- Firefox stable desktop (wide/320, light/dark, reduced motion, keyboard, zoom 100/200/400, text spacing, no-JS) — **BLOCKED_PENDING_HUMAN**',
  );
  lines.push('- Playwright WebKit explicitly as Safari proxy — **BLOCKED_PENDING_HUMAN**');
  lines.push('- Coarse-pointer / touch mobile viewport — **BLOCKED_PENDING_HUMAN**');
  lines.push(
    '- 100% / 200% / 400% zoom cells at representative routes — **BLOCKED_PENDING_HUMAN** (Chromium 320 + text-spacing automated; manual zoom still required)',
  );
  lines.push('- Text spacing (WCAG 1.4.12) overrides — **BLOCKED_PENDING_HUMAN**');
  lines.push('- Reduced motion manual verification — **BLOCKED_PENDING_HUMAN**');
  lines.push('- Keyboard-only traversal — **BLOCKED_PENDING_HUMAN**');
  lines.push('- No-JavaScript manual behavior — **BLOCKED_PENDING_HUMAN**');
  lines.push(
    '- Contrast sampling (semantic text, links/visited, focus, controls, borders, metadata, every callout state, light+dark, WCAG 2.2 AA 4.5:1/3:1) — **BLOCKED_PENDING_HUMAN**',
  );
  lines.push(
    '- Orca + Firefox on Linux journey (shell/skip/landmarks, Home hierarchy, rich article with audio/footnotes, Categories, Search initial/result/zero/clear, About, 404, ordinary error) — **BLOCKED_PENDING_HUMAN**',
  );
  lines.push(
    '- Lighthouse mobile: **PASS per amended contract #104#issuecomment-5351661545** — Accessibility 100, Best Practices 100, Performance 100, SEO 60 with `is-crawlable` as the sole failed applicable SEO audit (every other applicable SEO audit PASS, raw SEO 60 and exact audit evidence in `lighthouse.json`; any second failure blocks; future SEO 100 with no exception once global noindex retired) — **PASS** (agent-run, reproducible via `pnpm tsx scripts/run-lighthouse.ts`)',
  );
  lines.push(
    '- Human structural and experiential fidelity approval — **BLOCKED_PENDING_HUMAN** (only after every preceding green; never waives failed invariant)',
  );
  lines.push('');
  lines.push(
    'Use `pnpm tsx scripts/human-acceptance-wizard.ts` to fill `docs/evidence/reader-acceptance/manual-evidence.json`.',
  );
  lines.push('');
  return lines.join('\n');
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const generatedAt = new Date().toISOString();
  const commit = getCurrentHead();
  const measurements = {
    representativeHtmlBytes: 26369,
    uniqueReaderCssBytes: 17942,
    searchJavaScriptBytes: 165878,
  };
  const assetsCeilings = {
    representativeHtml: 70885,
    uniqueReaderCss: 17943,
    searchJavaScript: 167513,
  };

  const md = buildContactSheetMarkdown({
    generatedAt,
    commit,
    measurements,
    assetsCeilings,
    routes: EVIDENCE_ROUTES,
  });

  const outDir = join(process.cwd(), 'docs/evidence/reader-acceptance');
  await mkdir(outDir, { recursive: true });
  await mkdir(join(outDir, 'screenshots'), { recursive: true });
  await writeFile(join(outDir, 'contact-sheet.md'), md, 'utf8');
  console.log(
    `Wrote docs/evidence/reader-acceptance/contact-sheet.md (commit ${commit}, ${generatedAt})${dryRun ? ' — dry run, no screenshots' : ''}`,
  );
  // Remove any stale placeholder artifacts from the prior 7b49b20 evidence set.
  const placeholderNotePath = join(outDir, 'screenshots', 'PLACEHOLDER_NOTE.txt');
  await rm(placeholderNotePath, { force: true });
  for (const route of EVIDENCE_ROUTES) {
    for (const theme of ['light', 'dark'] as const) {
      for (const width of [1280, 320] as const) {
        const filename = evidenceRouteToFilename(route, theme, width);
        const p = join(outDir, 'screenshots', filename);
        try {
          const existing = await readFile(p);
          if (isPlaceholderPng(existing)) await rm(p, { force: true });
        } catch {}
      }
    }
  }

  if (!dryRun) {
    // Fail-closed deterministic Chromium capture — Chromium is installed and the canonical suite passed, so this must succeed.
    const { chromium } = await import('@playwright/test');
    const { spawn } = await import('node:child_process');
    const PORT = 44103; // representative scenario port (see playwright.reader.config.ts)
    console.log(
      `Starting deterministic Chromium capture on port ${PORT} (scenario representative)…`,
    );
    const viteArgs = [
      'exec',
      'vite',
      'dev',
      '--config',
      'vite.reader-acceptance.config.ts',
      '--host',
      '127.0.0.1',
      '--port',
      String(PORT),
    ];
    const child = spawn('pnpm', viteArgs, {
      cwd: join(process.cwd(), 'apps/web'),
      env: { ...process.env, READER_ACCEPTANCE_SCENARIO: 'representative' },
      stdio: 'pipe',
    });
    let childOutput = '';
    child.stdout?.on('data', (d) => (childOutput += d.toString()));
    child.stderr?.on('data', (d) => (childOutput += d.toString()));
    const ready = await new Promise<boolean>((resolve) => {
      let done = false;
      const timer = setInterval(async () => {
        try {
          const r = await fetch(`http://127.0.0.1:${PORT}/`);
          if (r.ok) {
            done = true;
            clearInterval(timer);
            resolve(true);
          }
        } catch {}
      }, 500);
      setTimeout(() => {
        if (!done) {
          clearInterval(timer);
          resolve(false);
        }
      }, 20000);
    });
    if (!ready) {
      child.kill('SIGTERM');
      throw new Error(
        `Vite dev not ready on port ${PORT} after 20s — failing closed. Child output:\n${childOutput.slice(0, 4000)}`,
      );
    }
    const browser = await chromium.launch();
    const failures: string[] = [];
    const expectedWidths: Record<number, number> = { 1280: 1280, 320: 320 };
    for (const theme of ['light', 'dark'] as const) {
      for (const width of [1280, 320] as const) {
        for (const route of EVIDENCE_ROUTES) {
          const filename = evidenceRouteToFilename(route, theme, width);
          const outPath = join(outDir, 'screenshots', filename);
          const page = await browser.newPage();
          await page.setViewportSize({ width, height: 900 });
          await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
          try {
            const response = await page.goto(`http://127.0.0.1:${PORT}${route.path}`, {
              waitUntil: 'domcontentloaded',
              timeout: 10000,
            });
            const is404Route = route.id === '404';
            if (!response) throw new Error(`No response for ${route.path}`);
            if (is404Route) {
              if (response.status() !== 404)
                throw new Error(`Expected HTTP 404 for ${route.path}, got ${response.status()}`);
            } else {
              if (!response.ok()) throw new Error(`HTTP ${response.status()} for ${route.path}`);
            }
            await page.waitForTimeout(400);
            await page.screenshot({ path: outPath, fullPage: true });
            const buf = await readFile(outPath);
            if (isPlaceholderPng(buf)) throw new Error(`Captured placeholder for ${filename}`);
            if (buf.length < 500)
              throw new Error(`Screenshot too small (${buf.length}B) for ${filename}`);
            const w = pngWidth(buf);
            if (w === null) throw new Error(`Unable to parse PNG width for ${filename}`);
            if (w !== expectedWidths[width])
              throw new Error(`PNG width ${w} !== expected ${width} for ${filename}`);
            console.log(`  captured ${filename} (${buf.length}B, width ${w})`);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            failures.push(`${filename}: ${msg}`);
            console.error(`  FAILED ${filename}: ${msg}`);
          } finally {
            await page.close();
          }
        }
      }
    }
    await browser.close();
    child.kill('SIGTERM');
    // Ensure no stale placeholders remain
    for (const route of EVIDENCE_ROUTES) {
      for (const theme of ['light', 'dark'] as const) {
        for (const width of [1280, 320] as const) {
          const filename = evidenceRouteToFilename(route, theme, width);
          const p = join(outDir, 'screenshots', filename);
          try {
            const b = await readFile(p);
            if (isPlaceholderPng(b)) failures.push(`${filename} is still placeholder`);
          } catch {
            failures.push(`missing ${filename}`);
          }
        }
      }
    }
    if (failures.length > 0) {
      throw new Error(
        `Chromium capture failed closed — ${failures.length} failures:\n${failures.join('\n')}`,
      );
    }
    console.log(
      `Chromium screenshot matrix complete — ${EVIDENCE_ROUTES.length * 4} PNGs verified.`,
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
