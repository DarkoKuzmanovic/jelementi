import type { PageServerLoad } from './$types';
import { generatedContent } from '../../lib/generated-content.server';
import { projectHomeCatalog } from '../../lib/home/home-catalog';

export const prerender = true;
export const csr = false;

export const load: PageServerLoad = () => ({ catalog: projectHomeCatalog(generatedContent.index) });
