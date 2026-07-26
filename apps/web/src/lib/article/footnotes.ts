import type { ArticleBlock, InlineNode } from '@jelementi/article-model';

export function footnoteReferenceId(id: string, scope: string, path: string): string {
  return `footnote-ref-${id}-${scope}-${path}`;
}

function collectInlineTargets(
  nodes: InlineNode[],
  scope: string,
  targets: Record<string, string[]>,
  parentPath = '',
): void {
  for (const [index, node] of nodes.entries()) {
    const path = parentPath === '' ? `${index}` : `${parentPath}-${index}`;
    if (node.type === 'footnoteReference') {
      (targets[node.id] ??= []).push(footnoteReferenceId(node.id, scope, path));
    } else if (node.type === 'link') {
      collectInlineTargets(node.children, scope, targets, path);
    }
  }
}

/** Produces unique reference anchors in the same deterministic order as the renderer. */
export function footnoteReferenceTargets(blocks: ArticleBlock[]): Record<string, string[]> {
  const targets: Record<string, string[]> = {};
  for (const [blockIndex, block] of blocks.entries()) {
    const scope = `block-${blockIndex}`;
    if (block.type === 'divider') continue;
    if (block.type === 'image') {
      if (block.caption) collectInlineTargets(block.caption, `${scope}-caption`, targets);
    } else if (block.type === 'list') {
      for (const [itemIndex, item] of block.items.entries()) {
        collectInlineTargets(item, `${scope}-item-${itemIndex}`, targets);
      }
    } else {
      collectInlineTargets(block.children, scope, targets);
    }
  }
  return targets;
}
