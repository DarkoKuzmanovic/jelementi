import { validateGeneratedContent } from './generated-content';

const indexModules = import.meta.glob('../../../../generated/index.json', {
  eager: true,
  import: 'default',
});
const articleModules = import.meta.glob('../../../../generated/articles/*.json', {
  eager: true,
  import: 'default',
});

const importedIndex = Object.values(indexModules);
if (importedIndex.length !== 1) {
  throw new Error('Generated index.json is missing or was imported more than once.');
}

const importedArticles: Record<string, unknown> = {};
for (const [path, document] of Object.entries(articleModules)) {
  const filename = path.split('/').at(-1);
  if (!filename) throw new Error(`Unable to determine generated article filename: ${path}.`);
  importedArticles[filename] = document;
}

const lengthsModules = import.meta.glob('../../../../generated/audio-byte-lengths.json', {
  eager: true,
  import: 'default',
});
const importedLengths = Object.values(lengthsModules);
if (importedLengths.length !== 1) {
  throw new Error('Generated audio-byte-lengths.json is missing or was imported more than once.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Enclosure byte lengths by exact compiled audio URL; never faked, never zero. */
export const audioByteLengths: Record<string, number> = (() => {
  const raw = importedLengths[0];
  if (!isRecord(raw)) throw new Error('Generated audio-byte-lengths.json must be an object.');
  const lengths: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    let url: URL;
    try {
      url = new URL(key);
    } catch {
      throw new Error(`Generated audio-byte-lengths.json has an invalid audio URL: ${key}.`);
    }
    if (
      (url.protocol !== 'https:' && url.protocol !== 'http:') ||
      !/\.(mp3|m4a)$/i.test(url.pathname)
    ) {
      throw new Error(`Generated audio-byte-lengths.json has an invalid audio URL: ${key}.`);
    }
    if (!Number.isSafeInteger(value) || (value as number) <= 0) {
      throw new Error(`Generated audio-byte-lengths.json has an invalid length for ${key}.`);
    }
    lengths[key] = value as number;
  }
  return lengths;
})();

/** Build/server-only validated snapshot of statically bundled generated artifacts. */
export const generatedContent = validateGeneratedContent(importedIndex[0], importedArticles);
