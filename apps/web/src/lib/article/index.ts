/**
 * Authoritative article-rendering contract (spec #96, ticket #98).
 *
 * The public article route and Studio preview both consume the renderer,
 * block primitives, and the shared discovery summary through this single
 * ownership contract. Reader page chrome is never imported here; this
 * module carries only document rendering and summary surfaces, keeping the
 * framework-neutral article model free of Svelte presentation concerns.
 */
export { default as ArticleRenderer } from './ArticleRenderer.svelte';
export { default as ArticleSummary } from './ArticleSummary.svelte';
export { default as ArticleAudio } from './ArticleAudio.svelte';
export { default as InlineContent } from './InlineContent.svelte';
export { default as ParagraphBlock } from './blocks/ParagraphBlock.svelte';
export { default as HeadingBlock } from './blocks/HeadingBlock.svelte';
export { default as ImageBlock } from './blocks/ImageBlock.svelte';
export { default as ListBlock } from './blocks/ListBlock.svelte';
export { default as QuoteBlock } from './blocks/QuoteBlock.svelte';
export { default as CalloutBlock } from './blocks/CalloutBlock.svelte';
export { default as DividerBlock } from './blocks/DividerBlock.svelte';
