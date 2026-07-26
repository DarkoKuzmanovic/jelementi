/**
 * Compile-time exhaustiveness guard for article block rendering.
 *
 * Called from the `{:else}` branch of the block dispatch. While the union
 * in `@jelementi/article-model` is exhaustive over the rendered block types,
 * this function's `never` parameter makes adding a new block type without a
 * renderer case a hard type error — and provides a clear runtime error if an
 * unsupported block ever reaches the renderer.
 */
export function assertExhaustiveBlock(block: never): never {
  throw new Error(`Unsupported article block type: ${JSON.stringify(block)}`);
}

export function assertExhaustiveHeadingLevel(level: never): never {
  throw new Error(`Unsupported heading level: ${String(level)}`);
}
