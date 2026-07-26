import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadMediaBaseUrl, validateContent } from './content';
import {
  uploadMedia,
  verifyPublishedMedia,
  type MediaFetch,
  type MediaProcessRunner,
  type MediaStatFile,
} from './media';

interface MediaCliOptions {
  rootDir: string;
  env?: NodeJS.ProcessEnv;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
  fetch?: MediaFetch;
  run?: MediaProcessRunner;
  statFile?: MediaStatFile;
}

interface UploadArguments {
  file: string;
  key: string;
  contentType: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseUploadArguments(args: string[]): UploadArguments {
  if (args.length !== 6)
    throw new Error('Usage: media-cli upload --file <path> --key <key> --content-type <mime>');
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (
      value === undefined ||
      (flag !== '--file' && flag !== '--key' && flag !== '--content-type') ||
      values.has(flag)
    ) {
      throw new Error('Usage: media-cli upload --file <path> --key <key> --content-type <mime>');
    }
    values.set(flag, value);
  }
  const file = values.get('--file');
  const key = values.get('--key');
  const contentType = values.get('--content-type');
  if (file === undefined || key === undefined || contentType === undefined) {
    throw new Error('Usage: media-cli upload --file <path> --key <key> --content-type <mime>');
  }
  return { file, key, contentType };
}

const runProcess: MediaProcessRunner = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.once('error', reject);
    child.once('close', (exitCode) => {
      resolve({ exitCode: exitCode ?? 1, stdout, stderr });
    });
  });

const fetchMedia: MediaFetch = async (url, options) => {
  const response = await fetch(url, options);
  return response;
};

export async function runMediaCli(
  args: string[],
  {
    rootDir,
    env,
    stdout = console.log,
    stderr = console.error,
    fetch: fetchImpl = fetchMedia,
    run = runProcess,
    statFile = stat,
  }: MediaCliOptions,
): Promise<number> {
  const command = args[0];
  if (command !== 'upload' && command !== 'verify') {
    stderr('Usage: media-cli <upload|verify>');
    return 1;
  }
  try {
    const mediaBaseUrl = loadMediaBaseUrl({ rootDir, ...(env === undefined ? {} : { env }) });
    if (command === 'upload') {
      const { file, key, contentType } = parseUploadArguments(args.slice(1));
      const url = await uploadMedia({
        file,
        key,
        contentType,
        mediaBaseUrl,
        fetch: fetchImpl,
        run,
        statFile,
      });
      stdout(url);
    } else {
      if (args.length !== 1) throw new Error('Usage: media-cli verify');
      const batch = await validateContent({ rootDir, mediaBaseUrl });
      await verifyPublishedMedia({ batch, fetch: fetchImpl });
      stdout('Media verification succeeded.');
    }
    return 0;
  } catch (error: unknown) {
    stderr(errorMessage(error));
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rootDir = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
  const exitCode = await runMediaCli(process.argv.slice(2), { rootDir });
  if (exitCode !== 0) process.exitCode = exitCode;
}
