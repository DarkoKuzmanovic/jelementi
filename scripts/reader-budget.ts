import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  READER_ASSET_BUDGETS,
  assertReaderAssetBudgets,
  loadProductionInput,
  measureReaderAssets,
  type ReaderAssetMeasurement,
} from './reader-assets';

const execFileAsync = promisify(execFile);

// ponytail: snapshot list, copy bytes — no new deps, no app env seam.
const SKIPPED_PREFIXES = ['content/articles/', 'generated/', '.svelte-kit/', 'node_modules/'];

export interface PrepareOptions {
  listFiles?: (repoRoot: string) => Promise<string[]>;
  fixtureDir?: string;
}

export async function listTrackedFiles(repoRoot: string): Promise<string[]> {
  const { stdout } = await execFileAsync('git', ['ls-files', '-z'], {
    cwd: repoRoot,
    env: process.env,
  });
  return stdout.split('\0').filter((entry) => entry !== '');
}

function isSkipped(trackedPath: string): boolean {
  return SKIPPED_PREFIXES.some((prefix) => trackedPath.startsWith(prefix));
}

export async function prepareIsolatedWorkspace(
  repoRoot: string,
  options: PrepareOptions = {},
): Promise<string> {
  const workspace = await mkdtemp(join(process.env.TMPDIR ?? tmpdir(), 'reader-budget-'));
  try {
    const files = await (options.listFiles ?? listTrackedFiles)(repoRoot);
    for (const file of files) {
      if (file === '' || isSkipped(file)) continue;
      const destination = join(workspace, file);
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(join(repoRoot, file), destination);
    }
    const fixtureDir = options.fixtureDir ?? join(repoRoot, 'scripts/fixtures/reader-budget');
    const wanted = (await readdir(fixtureDir, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry) => entry.name)
      .sort();
    if (wanted.length === 0) throw new Error(`Fixed benchmark catalog is empty: ${fixtureDir}.`);
    const articlesDir = join(workspace, 'content/articles');
    await mkdir(articlesDir, { recursive: true });
    for (const name of wanted) await copyFile(join(fixtureDir, name), join(articlesDir, name));
    const isolated = (await readdir(articlesDir)).filter((name) => name.endsWith('.md')).sort();
    if (JSON.stringify(isolated) !== JSON.stringify(wanted)) {
      throw new Error('Isolated workspace catalog is not fixture-only.');
    }
    return workspace;
  } catch (error) {
    await rm(workspace, { recursive: true, force: true });
    throw error;
  }
}

export async function runStep(file: string, args: string[], cwd: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(file, args, {
      cwd,
      env: process.env,
      maxBuffer: 16 * 1024 * 1024,
    });
    return stdout;
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Benchmark step failed: ${file} ${args.join(' ')}: ${detail}`);
  }
}

export async function buildFixedWorkspace(
  workspace: string,
  run: typeof runStep = runStep,
): Promise<ReaderAssetMeasurement> {
  await run('pnpm', ['install', '--offline', '--frozen-lockfile'], workspace);
  await run('pnpm', ['build:web'], workspace);
  const measurement = measureReaderAssets(await loadProductionInput(workspace));
  assertReaderAssetBudgets(measurement);
  return measurement;
}

export function assertLiveCssJs(measurement: ReaderAssetMeasurement): void {
  if (measurement.uniqueReaderCssBytes > READER_ASSET_BUDGETS.uniqueReaderCss) {
    throw new Error(
      `Unique Reader CSS is ${measurement.uniqueReaderCssBytes} raw bytes; frozen ceiling is ${READER_ASSET_BUDGETS.uniqueReaderCss}.`,
    );
  }
  if (measurement.searchJavaScriptBytes > READER_ASSET_BUDGETS.searchJavaScript) {
    throw new Error(
      `Search JavaScript is ${measurement.searchJavaScriptBytes} raw bytes; frozen ceiling is ${READER_ASSET_BUDGETS.searchJavaScript}.`,
    );
  }
}

async function collectFiles(directory: string): Promise<string[]> {
  let found: string[] = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found = found.concat(await collectFiles(path));
    else if (entry.isFile()) found.push(path);
  }
  return found;
}

export async function fingerprintProduction(repoRoot: string): Promise<string> {
  const entries: string[] = [];
  for (const sub of ['content/articles', 'generated', '.svelte-kit/cloudflare']) {
    for (const path of await collectFiles(join(repoRoot, sub))) {
      const hash = createHash('sha256')
        .update(await readFile(path))
        .digest('hex');
      entries.push(`${relative(repoRoot, path)}:${hash}`);
    }
  }
  entries.sort();
  return createHash('sha256').update(entries.join('\n')).digest('hex');
}

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  const before = await fingerprintProduction(repoRoot);
  const workspace = await prepareIsolatedWorkspace(repoRoot);
  try {
    const fixed = await buildFixedWorkspace(workspace);
    const live = measureReaderAssets(await loadProductionInput(repoRoot));
    assertLiveCssJs(live);
    const after = await fingerprintProduction(repoRoot);
    if (after !== before)
      throw new Error('Production content changed during the isolated benchmark.');
    console.log(JSON.stringify({ fixed, live }, null, 2));
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

function isMainEntry(): boolean {
  const argv1 = process.argv[1];
  if (argv1 === undefined) return false;
  try {
    return fileURLToPath(import.meta.url) === resolve(argv1);
  } catch {
    return false;
  }
}

if (isMainEntry()) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
