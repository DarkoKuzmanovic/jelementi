import { describe, expect, it } from 'vitest';
import { footnoteReferenceId, footnoteReferenceTargets } from './footnotes';

describe('footnote anchor strategy', () => {
  it('assigns unique DOM IDs to repeated references and preserves backlinks', () => {
    const targets = footnoteReferenceTargets([
      { type: 'paragraph', children: [{ type: 'footnoteReference', id: 'note' }] },
      { type: 'paragraph', children: [{ type: 'footnoteReference', id: 'note' }] },
    ]);
    expect(targets.note).toEqual([
      footnoteReferenceId('note', 'block-0', '0'),
      footnoteReferenceId('note', 'block-1', '0'),
    ]);
  });
});
