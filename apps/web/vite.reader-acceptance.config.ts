import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeConfig, type Plugin } from 'vite';
import baseConfig from './vite.config';
import type { ReaderAcceptanceScenario } from '../../scripts/reader-acceptance-fixtures';

const productionModule = fileURLToPath(
  new URL('./src/lib/generated-content.server.ts', import.meta.url),
);
const fixtureModule = fileURLToPath(
  new URL('../../scripts/reader-acceptance-fixtures.ts', import.meta.url),
);
const virtualModule = '\0jelementi-reader-acceptance-generated-content';

function acceptanceScenario(value: string | undefined): ReaderAcceptanceScenario {
  if (
    value === 'representative' ||
    value === 'intermediate' ||
    value === 'sparse' ||
    value === 'ordinary-error'
  )
    return value;
  throw new Error(
    'READER_ACCEPTANCE_SCENARIO must explicitly be representative, intermediate, sparse, or ordinary-error.',
  );
}

function candidateProductionPath(source: string, importer: string): string | undefined {
  if (source === '$lib/generated-content.server') return productionModule;
  if (!source.endsWith('/generated-content.server')) return undefined;
  return `${resolve(dirname(importer), source)}.ts`;
}

export function readerAcceptanceContentPlugin(scenario: ReaderAcceptanceScenario): Plugin {
  return {
    name: 'jelementi-reader-acceptance-content',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source === virtualModule) return virtualModule;
      if (importer === undefined) return undefined;
      const candidate = candidateProductionPath(source, importer);
      if (candidate === undefined) return undefined;
      if (candidate !== productionModule) {
        throw new Error(
          `Reader acceptance refused to replace unexpected generated-content module: ${candidate}.`,
        );
      }
      return virtualModule;
    },
    load(id) {
      if (id !== virtualModule) return undefined;
      return [
        `import { loadReaderAcceptanceContent } from ${JSON.stringify(fixtureModule)};`,
        `export const generatedContent = loadReaderAcceptanceContent(${JSON.stringify(scenario)});`,
      ].join('\n');
    },
  };
}

const scenario = acceptanceScenario(process.env.READER_ACCEPTANCE_SCENARIO);

export default mergeConfig(baseConfig, {
  cacheDir: `/tmp/jelementi-reader-acceptance-vite-${scenario}`,
  plugins: [readerAcceptanceContentPlugin(scenario)],
});
