/**
 * Reproducible local mobile Lighthouse for T104.
 *
 * Runs against a loopback production build (wrangler dev --local) and
 * captures mobile scores. Fails closed if thresholds not met.
 *
 * Thresholds: Accessibility 100, Best Practices 100, SEO 100, Performance >=90.
 * On noisy Performance, rerun rather than waive — this script does one run;
 * operator should rerun this script to investigate.
 *
 * Output:
 * - Concise evidence: docs/evidence/reader-acceptance/lighthouse.json (committed, small)
 * - Raw output: /tmp/lighthouse-T104-*.json/.html (CI artifact, not committed)
 *
 * Usage: pnpm tsx scripts/run-lighthouse.ts
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export interface LighthouseScores {
  accessibility: number;
  bestPractices: number;
  seo: number;
  performance: number;
}

export function getCurrentHead(): string {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
  if (r.status !== 0 || !r.stdout?.trim())
    throw new Error('Failed to derive HEAD for lighthouse evidence');
  const sha = r.stdout.trim();
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`Invalid HEAD sha: ${sha}`);
  return sha;
}

export function assertLighthouseThresholds(scores: LighthouseScores): void {
  if (scores.accessibility !== 100)
    throw new Error(`Lighthouse Accessibility ${scores.accessibility} !== 100`);
  if (scores.bestPractices !== 100)
    throw new Error(`Lighthouse Best Practices ${scores.bestPractices} !== 100`);
  if (scores.seo !== 100) throw new Error(`Lighthouse SEO ${scores.seo} !== 100`);
  if (scores.performance < 90)
    throw new Error(`Lighthouse Performance ${scores.performance} < 90 — investigate and rerun`);
}

async function pollReady(url: string, timeoutMs = 20000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {}
    await new Promise((res) => setTimeout(res, 500));
  }
  throw new Error(`Preview not ready at ${url} after ${timeoutMs}ms`);
}

async function main(): Promise<void> {
  const commit = getCurrentHead();
  const generatedAt = new Date().toISOString();
  const port = 43123;
  const url = `http://127.0.0.1:${port}/`;
  const outDir = join(process.cwd(), 'docs/evidence/reader-acceptance');
  await mkdir(outDir, { recursive: true });

  // Ensure production build exists
  const buildCheck = spawnSync('pnpm', ['exec', 'wrangler', '--version'], { encoding: 'utf8' });
  if (buildCheck.status !== 0) throw new Error('wrangler not available');

  console.log(`Starting loopback preview on ${url} (commit ${commit})…`);
  const child = spawn(
    'pnpm',
    [
      'exec',
      'wrangler',
      'dev',
      '--local',
      '--ip',
      '127.0.0.1',
      '--port',
      String(port),
      '--persist-to',
      join(tmpdir(), 'jelementi-lighthouse-preview'),
    ],
    {
      stdio: 'pipe',
      env: { ...process.env },
    },
  );
  let childLog = '';
  child.stdout?.on('data', (d) => (childLog += d.toString()));
  child.stderr?.on('data', (d) => (childLog += d.toString()));

  try {
    await pollReady(url, 30000);
    console.log('Preview ready, running Lighthouse (mobile)…');
    const tmpBase = join(tmpdir(), `lighthouse-T104-${Date.now()}`);
    const tmpJson = `${tmpBase}.report.json`;
    const tmpHtml = `${tmpBase}.report.html`;
    // Use npx lighthouse; install 13.4.1 as seen in npx version
    const lh = spawnSync(
      'npx',
      [
        'lighthouse',
        url,
        '--form-factor=mobile',
        '--throttling-method=devtools',
        '--output=json',
        '--output=html',
        `--output-path=${tmpBase}`,
        '--chrome-flags=--headless --no-sandbox --disable-gpu',
        '--only-categories=accessibility,best-practices,seo,performance',
        '--quiet',
      ],
      { encoding: 'utf8', timeout: 120000 },
    );
    if (lh.status !== 0) {
      throw new Error(
        `Lighthouse failed (status ${lh.status}):\n${lh.stderr?.slice(0, 4000)}\n${lh.stdout?.slice(0, 4000)}\nChild log: ${childLog.slice(0, 2000)}`,
      );
    }
    // lighthouse writes two files: .json and .html; find the json
    const rawJson = await readFile(tmpJson, 'utf8');
    const parsed = JSON.parse(rawJson);
    const scores: LighthouseScores = {
      accessibility: Math.round((parsed.categories?.accessibility?.score ?? 0) * 100),
      bestPractices: Math.round((parsed.categories?.['best-practices']?.score ?? 0) * 100),
      seo: Math.round((parsed.categories?.seo?.score ?? 0) * 100),
      performance: Math.round((parsed.categories?.performance?.score ?? 0) * 100),
    };
    const lighthouseVersion = parsed.lighthouseVersion ?? '13.4.1';
    console.log(`Lighthouse scores: ${JSON.stringify(scores)} (version ${lighthouseVersion})`);
    // Enforce thresholds fail-closed
    assertLighthouseThresholds(scores);
    const concise = {
      generatedAt,
      commit,
      url,
      lighthouseVersion: String(lighthouseVersion),
      formFactor: 'mobile',
      scores,
      rawJsonPath: tmpJson,
      rawHtmlPath: tmpHtml,
      note: 'Raw JSON/HTML are CI artifacts at /tmp, not committed. Rerun this script if Performance is noisy; do not waive.',
    };
    await writeFile(join(outDir, 'lighthouse.json'), JSON.stringify(concise, null, 2), 'utf8');
    console.log(`Wrote concise evidence to docs/evidence/reader-acceptance/lighthouse.json`);
    console.log(`Raw artifacts (not committed): ${tmpJson}, ${tmpHtml}`);
  } finally {
    child.kill('SIGTERM');
    // Give wrangler a moment to exit
    await new Promise((res) => setTimeout(res, 1000));
    try {
      child.kill('SIGKILL');
    } catch {}
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
