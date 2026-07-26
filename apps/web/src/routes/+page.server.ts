import type { PageServerLoad } from './$types';
import { generatedContent } from '../lib/generated-content.server';

export const prerender = true;
export const csr = false;

export const load: PageServerLoad = () => ({ index: generatedContent.index });
