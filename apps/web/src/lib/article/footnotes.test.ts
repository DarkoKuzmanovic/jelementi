import { describe, expect, it } from 'vitest';
import { footnoteReferenceId, footnoteReferenceTargets } from './footnotes';

describe('footnote anchor strategy', () => {
  it('keeps nested inline, list, and caption reference paths in their own namespace', () => {
    const reference = { type: 'footnoteReference' as const, id: 'note' };
    const nested = { type: 'link' as const, href: 'https://example.org/', children: [reference] };
    expect(
      footnoteReferenceTargets([
        { type: 'paragraph', children: [nested, reference] },
        { type: 'list', ordered: false, items: [[nested], [reference]] },
        {
          type: 'image',
          src: 'https://example.org/image.webp',
          alt: 'Image',
          caption: [nested, reference],
        },
      ]),
    ).toEqual({
      note: [
        'reader:footnote-ref:note:block-0:0-0',
        'reader:footnote-ref:note:block-0:1',
        'reader:footnote-ref:note:block-1-item-0:0-0',
        'reader:footnote-ref:note:block-1-item-1:0',
        'reader:footnote-ref:note:block-2-caption:0-0',
        'reader:footnote-ref:note:block-2-caption:1',
      ],
    });
  });
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
