import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

interface WranglerConfig {
  main: string;
  assets: { directory: string };
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
  const config = JSON.parse(
    (await readFile(join(rootDir, 'wrangler.jsonc'), 'utf8')).replace(/,\s*([}\]])/g, '$1'),
  ) as WranglerConfig;
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

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
