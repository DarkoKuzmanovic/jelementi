import { pathToFileURL } from 'node:url';
import {
  buildContent,
  formatContentError,
  loadMediaBaseUrl,
  validateContent,
  watchContent,
} from './content';

export interface ContentCliOptions {
  rootDir: string;
  env?: NodeJS.ProcessEnv;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
}

export async function runContentCli(
  args: string[],
  { rootDir, env, stdout = console.log, stderr = console.error }: ContentCliOptions,
): Promise<number> {
  const command = args[0];
  if (command !== 'validate' && command !== 'build' && command !== 'watch') {
    stderr('Usage: content-cli <validate|build|watch>');
    return 1;
  }
  try {
    const mediaBaseUrl = loadMediaBaseUrl({ rootDir, ...(env === undefined ? {} : { env }) });
    if (command === 'validate') {
      await validateContent({ rootDir, mediaBaseUrl });
      stdout('Content validation succeeded.');
    } else if (command === 'build') {
      await buildContent({ rootDir, mediaBaseUrl });
      stdout('Content build succeeded.');
    } else {
      await watchContent({
        rootDir,
        mediaBaseUrl,
        onError: (error) => stderr(formatContentError(error)),
      });
      stdout('Watching content/articles for changes.');
    }
    return 0;
  } catch (error) {
    stderr(formatContentError(error));
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = await runContentCli(process.argv.slice(2), { rootDir: process.cwd() });
  if (exitCode !== 0) process.exitCode = exitCode;
}
