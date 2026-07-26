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

/** Build/server-only validated snapshot of statically bundled generated artifacts. */
export const generatedContent = validateGeneratedContent(importedIndex[0], importedArticles);
