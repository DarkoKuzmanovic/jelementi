import type { PageLoad } from './$types';

export type Variant = 'A' | 'B' | 'C';
export type DemoState = 'active' | 'blocked' | 'live' | 'empty';

export const prerender = false;
export const csr = true;

export const load: PageLoad<{ initialVariant: Variant; initialState: DemoState }> = ({ url }) => {
  const variantParam = url.searchParams.get('variant')?.toUpperCase();
  const stateParam = url.searchParams.get('state')?.toLowerCase();

  const initialVariant: Variant =
    variantParam === 'A' || variantParam === 'B' || variantParam === 'C' ? variantParam : 'A';
  const initialState: DemoState =
    stateParam === 'active' ||
    stateParam === 'blocked' ||
    stateParam === 'live' ||
    stateParam === 'empty'
      ? stateParam
      : 'active';

  return {
    initialVariant,
    initialState,
  };
};
