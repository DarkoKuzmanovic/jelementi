import { validateSearchText } from './reader/search';
import { generatedContent } from './generated-content.server';

const modules = import.meta.glob('../../../../generated/search-text.json', {
  eager: true,
  import: 'default',
});
const imported = Object.values(modules);
if (imported.length !== 1)
  throw new Error('Generated search-text.json is missing or was imported more than once.');
export const searchText = validateSearchText(imported[0], generatedContent.index);
