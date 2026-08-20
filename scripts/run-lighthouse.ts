/**
 * Reproducible local mobile Lighthouse for T104 — amended unlisted-beta contract.
 *
 * Runs against a loopback production build (wrangler dev --local) and
 * captures mobile scores. Fails closed if thresholds not met.
 *
 * Amended thresholds (issue #104 + human decision 2026-08-19, global noindex immutable):
 * - Accessibility 100, Best Practices 100, Performance >=90
 * - During immutable unlisted-beta noindex: every applicable SEO audit must PASS
 *   and `is-crawlable` must be the SOLE failed SEO audit (caused by shipped global noindex).
 *   Record raw SEO score (currently 60) and exact audit evidence. Do not waive via numeric threshold.
 * - When global noindex is retired, gate becomes SEO 100 with no exception (no failed audits).
 *   Any second failed SEO audit blocks even during noindex phase.
 *
 * Output:
 * - Concise evidence: docs/evidence/reader-acceptance/lighthouse.json (committed, small, includes audit evidence)
 * - Raw output: /tmp/lighthouse-T104-*.json/.html (CI artifact, not committed)
 *
 * Usage: pnpm tsx scripts/run-lighthouse.ts
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export interface LighthouseScores {
  accessibility: number;
  bestPractices: number;
  seo: number;
  performance: number;
}

export interface FailedSeoAudit {
  id: string;
  title: string;
  score: number | null;
  scoreDisplayMode: string;
  description?: string;
}

export function getCurrentHead(): string {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
  if (r.status !== 0 || !r.stdout?.trim())
    throw new Error('Failed to derive HEAD for lighthouse evidence');
  const sha = r.stdout.trim();
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`Invalid HEAD sha: ${sha}`);
  return sha;
}

/**
 * Parse the Lighthouse LHR and return the set of failed applicable SEO audits.
 * Applicable = all auditRefs in the `seo` category whose scoreDisplayMode is
 * not `manual`, `notApplicable`, or `informative` and whose audit has a score.
 * A failed audit is one with score !== 1 (binary pass requires 1).
 * This parsing ensures a second failed audit beyond `is-crawlable` blocks the gate,
 * rather than merely lowering a numeric SEO threshold.
 */
export function isNoindexPresentInHtml(html: string): boolean {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '');
  return (
    /<meta[^>]*content=["']noindex["'][^>]*>/i.test(withoutComments) &&
    /<meta[^>]*name=["']robots["'][^>]*>/i.test(withoutComments) &&
    /<meta[^>]*name=["']robots["'][^>]*content=["']noindex["'][^>]*>|<meta[^>]*content=["']noindex["'][^>]*name=["']robots["'][^>]*>/i.test(
      withoutComments,
    )
  );
}

export function isGlobalNoindexPresent(): boolean {
  try {
    const appHtml = readFileSync(join(process.cwd(), 'apps/web/src/app.html'), 'utf8');
    return isNoindexPresentInHtml(appHtml);
  } catch (e) {
    throw new Error(
      `Failed to determine global noindex phase — failing closed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

export function getFailedSeoAudits(lhr: unknown): FailedSeoAudit[] {
  const lhrObj = lhr as Record<string, unknown> | null | undefined;
  if (!lhrObj || typeof lhrObj !== 'object')
    throw new Error('Lighthouse LHR is missing or not an object — failing closed');
  const categories = (lhrObj as Record<string, unknown>)['categories'] as
    Record<string, unknown> | undefined;
  const audits = (lhrObj as Record<string, unknown>)['audits'] as
    Record<string, unknown> | undefined;
  if (!categories) throw new Error('Lighthouse LHR missing categories — failing closed');
  if (!audits) throw new Error('Lighthouse LHR missing audits — failing closed');
  const seo = categories['seo'] as Record<string, unknown> | undefined;
  if (!seo) throw new Error('Lighthouse LHR missing seo category — failing closed');
  const auditRefs = seo['auditRefs'] as Array<Record<string, unknown>> | undefined;
  if (!auditRefs) throw new Error('Lighthouse LHR seo category missing auditRefs — failing closed');
  const failed: FailedSeoAudit[] = [];
  for (const ref of auditRefs) {
    const id = String(ref['id'] ?? '');
    if (!id) throw new Error('Lighthouse seo auditRef missing id — failing closed');
    const audit = audits[id] as Record<string, unknown> | undefined;
    if (!audit)
      throw new Error(
        `Lighthouse LHR missing audit record for seo auditRef "${id}" — failing closed`,
      );
    const scoreDisplayMode = String(audit['scoreDisplayMode'] ?? '');
    // Only consider audits that are applicable to this run.
    if (
      scoreDisplayMode === 'manual' ||
      scoreDisplayMode === 'notApplicable' ||
      scoreDisplayMode === 'informative'
    ) {
      continue;
    }
    const score = (audit['score'] as number | null | undefined) ?? null;
    // Applicable audits with score !== 1 are failures (binary 0 = fail, null means error but treat as fail if not notApplicable).
    if (score !== 1) {
      failed.push({
        id,
        title: String(audit['title'] ?? id),
        score,
        scoreDisplayMode,
        description: audit['description'] ? String(audit['description']).slice(0, 500) : undefined,
      });
    }
  }
  return failed;
}

export function getFailedSeoAuditIds(lhr: unknown): string[] {
  return getFailedSeoAudits(lhr)
    .map((a) => a.id)
    .sort();
}

/**
 * Legacy helper — preserved for backward compatibility. Delegates to the amended
 * contract when an LHR is provided; otherwise enforces the strict 100/100/100/>=90
 * gate (useful for unit tests without a full LHR).
 */
export function assertLighthouseThresholds(scores: LighthouseScores, lhr?: unknown): void {
  if (lhr !== undefined) {
    assertAmendedLighthouseContract(scores, lhr);
    return;
  }
  // Strict path (no LHR): requires SEO 100 — use only in simple unit tests.
  if (scores.accessibility !== 100)
    throw new Error(`Lighthouse Accessibility ${scores.accessibility} !== 100`);
  if (scores.bestPractices !== 100)
    throw new Error(`Lighthouse Best Practices ${scores.bestPractices} !== 100`);
  if (scores.seo !== 100) throw new Error(`Lighthouse SEO ${scores.seo} !== 100`);
  if (scores.performance < 90)
    throw new Error(`Lighthouse Performance ${scores.performance} < 90 — investigate and rerun`);
}

/**
 * Amended contract assertion — the canonical T104 gate.
 *
 * - Accessibility 100, Best Practices 100, Performance >=90
 * - SEO: either (a) sole failed applicable audit is `is-crawlable` (unlisted-beta noindex phase,
 *   raw SEO score recorded, typically 60), or (b) no failed audits and SEO 100 (future, noindex retired).
 *   Any other failed set blocks, including a second failure alongside is-crawlable.
 *   This encodes the future contract: once global noindex is retired, SEO must be 100 with no exception.
 */
export function assertAmendedLighthouseContract(
  scores: LighthouseScores,
  lhr: unknown,
  opts?: { globalNoindexPresent?: boolean },
): void {
  if (scores.accessibility !== 100)
    throw new Error(`Lighthouse Accessibility ${scores.accessibility} !== 100`);
  if (scores.bestPractices !== 100)
    throw new Error(`Lighthouse Best Practices ${scores.bestPractices} !== 100`);
  if (scores.performance < 90)
    throw new Error(`Lighthouse Performance ${scores.performance} < 90 — investigate and rerun`);

  const failedDetails = getFailedSeoAudits(lhr);
  const failedIds = failedDetails.map((a) => a.id).sort();

  // Fail-closed inconsistency guard — must be checked before any PASS return.
  if (failedIds.length === 1 && failedIds[0] === 'is-crawlable' && scores.seo === 100) {
    const detailStr = failedDetails
      .map((a) => `${a.id} (score=${String(a.score)}, mode=${a.scoreDisplayMode})`)
      .join(', ');
    throw new Error(
      `Lighthouse SEO gate: is-crawlable failed but SEO score is 100 — inconsistent LHR [${detailStr}]. Investigate.`,
    );
  }

  const globalNoindexPresent = opts?.globalNoindexPresent ?? isGlobalNoindexPresent();
  const detailStr = failedDetails.length
    ? failedDetails
        .map((a) => `${a.id} (score=${String(a.score)}, mode=${a.scoreDisplayMode})`)
        .join(', ')
    : '(none)';

  if (globalNoindexPresent) {
    // Unlisted-beta phase: every applicable SEO audit must PASS except is-crawlable.
    if (failedIds.length === 1 && failedIds[0] === 'is-crawlable') {
      return;
    }
    if (failedIds.length === 0 && scores.seo !== 100) {
      throw new Error(
        `Lighthouse SEO gate (global noindex present): no failed applicable SEO audits but SEO score ${scores.seo} !== 100 — [${detailStr}]. During unlisted-beta, is-crawlable must be the sole failed audit; got none.`,
      );
    }
    throw new Error(
      `Lighthouse SEO gate (global noindex present): failed applicable SEO audits must be exactly [is-crawlable]. ` +
        `Got [${failedIds.join(', ') || '(none)'}] with SEO ${scores.seo}. Failed details: ${detailStr}. ` +
        `During unlisted-beta global noindex, is-crawlable must be the sole failed SEO audit; any second failure blocks.`,
    );
  } else {
    // Future phase: global noindex retired — SEO must be 100 with no exception.
    if (failedIds.length === 0 && scores.seo === 100) {
      return;
    }
    throw new Error(
      `Lighthouse SEO gate (global noindex retired): SEO must be 100 with no failed applicable audits. ` +
        `Got [${failedIds.join(', ') || '(none)'}] with SEO ${scores.seo}. Failed details: ${detailStr}.`,
    );
  }
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
    const failedSeoAudits = getFailedSeoAudits(parsed);
    const failedSeoAuditIds = failedSeoAudits.map((a) => a.id).sort();
    console.log(
      `Failed applicable SEO audits: [${failedSeoAuditIds.join(', ') || '(none)'}] (raw SEO ${scores.seo})`,
    );
    // Enforce amended thresholds fail-closed — parses exact failed SEO audit set.
    assertAmendedLighthouseContract(scores, parsed);
    const concise = {
      generatedAt,
      commit,
      url,
      lighthouseVersion: String(lighthouseVersion),
      formFactor: 'mobile',
      scores,
      // Amended contract evidence — do not lower numeric threshold, record exact failed audit set.
      seo: {
        rawScore: scores.seo,
        failedApplicableAudits: failedSeoAuditIds,
        failedDetails: failedSeoAudits,
        contract:
          'During unlisted-beta global noindex, every applicable SEO audit must PASS and is-crawlable must be the sole failed SEO audit (raw SEO score recorded, currently 60). When global noindex is retired, SEO must be 100 with no exception. No artificial noindex-stripped build may be used as production evidence.',
      },
      rawJsonPath: tmpJson,
      rawHtmlPath: tmpHtml,
      note: 'Raw JSON/HTML are CI artifacts at /tmp, not committed. Rerun this script if Performance is noisy; do not waive. SEO evidence records exact failed applicable audit set — any second failure blocks.',
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
