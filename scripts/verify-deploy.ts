import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

interface WranglerConfig {
  main: string;
  workers_dev: false;
  preview_urls: true;
  assets: {
    binding: 'ASSETS';
    directory: string;
    not_found_handling: '404-page';
  };
  routes?: Array<{ pattern: string; custom_domain: boolean }>;
  r2_buckets: Array<{ binding: string; bucket_name: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function verifyWranglerContract(
  config: unknown,
  deployment: 'production' | 'branch-upload' = 'production',
): asserts config is WranglerConfig {
  if (!isRecord(config)) throw new Error('Wrangler config must be an object.');
  if (config.workers_dev !== false) throw new Error('workers_dev must remain false.');
  if (config.preview_urls !== true) throw new Error('preview_urls must remain true.');
  if (typeof config.main !== 'string' || config.main !== '.svelte-kit/cloudflare/_worker.js') {
    throw new Error('Wrangler main output contract changed.');
  }
  const assets = isRecord(config.assets) ? config.assets : undefined;
  if (
    assets?.binding !== 'ASSETS' ||
    assets.directory !== '.svelte-kit/cloudflare' ||
    assets.not_found_handling !== '404-page'
  ) {
    throw new Error('Static Assets must retain ASSETS, Cloudflare output, and 404-page handling.');
  }
  if (deployment === 'production') {
    if (
      !Array.isArray(config.routes) ||
      config.routes.length !== 1 ||
      !isRecord(config.routes[0]) ||
      config.routes[0].pattern !== 'jelementi.quz.ma' ||
      config.routes[0].custom_domain !== true
    ) {
      throw new Error('Wrangler production route must remain jelementi.quz.ma.');
    }
  } else if (
    config.routes !== undefined &&
    (!Array.isArray(config.routes) || config.routes.length > 0)
  ) {
    throw new Error('Wrangler branch-upload config must remain route-less.');
  }
  if (
    !Array.isArray(config.r2_buckets) ||
    config.r2_buckets.length !== 1 ||
    !isRecord(config.r2_buckets[0]) ||
    config.r2_buckets[0].binding !== 'R2_MEDIA' ||
    config.r2_buckets[0].bucket_name !== 'jelementi-media'
  ) {
    throw new Error('Reserved R2_MEDIA binding contract changed.');
  }
}

function run(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' });
    child.once('error', rejectRun);
    child.once('close', (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`Wrangler dry-run failed with exit code ${code ?? 'unknown'}.`));
    });
  });
}

async function main(): Promise<void> {
  const rootDir = process.cwd();
  const config: unknown = JSON.parse(
    (await readFile(join(rootDir, 'wrangler.jsonc'), 'utf8')).replace(/,\s*([}\]])/g, '$1'),
  );
  verifyWranglerContract(config);
  const branchConfig: unknown = JSON.parse(
    (await readFile(join(rootDir, 'wrangler.m2.jsonc'), 'utf8')).replace(/,\s*([}\]])/g, '$1'),
  );
  verifyWranglerContract(branchConfig, 'branch-upload');
  const temporaryDir = await mkdtemp(join(tmpdir(), 'jelementi-wrangler-dry-run-'));
  try {
    config.main = resolve(rootDir, config.main);
    config.assets.directory = resolve(rootDir, config.assets.directory);
    const configPath = join(temporaryDir, 'wrangler.json');
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
    await run(
      join(rootDir, 'node_modules/.bin/wrangler'),
      ['deploy', '--dry-run', '--config', configPath, '--outdir', temporaryDir],
      temporaryDir,
    );
  } finally {
    await rm(temporaryDir, { recursive: true, force: true });
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
