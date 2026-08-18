import { describe, expect, it } from 'vitest';
import { revealAncestorDisclosures } from './validation-focus';
import type { StudioAncestorDisclosure, StudioDisclosureControl } from './validation-focus';

function disclosure(open: boolean, parent?: StudioAncestorDisclosure): StudioAncestorDisclosure {
  return {
    open,
    parentElement: {
      closest: () => parent ?? null,
    },
  };
}

function controlInside(nearest?: StudioAncestorDisclosure): StudioDisclosureControl {
  return { closest: () => nearest ?? null };
}

describe('revealAncestorDisclosures', () => {
  it('opens the closed disclosure a metadata control lives in before focus', () => {
    const metadataDisclosure = disclosure(false);

    const opened = revealAncestorDisclosures(controlInside(metadataDisclosure));

    expect(opened).toBe(1);
    expect(metadataDisclosure.open).toBe(true);
  });

  it('opens every nested ancestor disclosure, nearest first', () => {
    const outer = disclosure(false);
    const inner = disclosure(false, outer);

    const opened = revealAncestorDisclosures(controlInside(inner));

    expect(opened).toBe(2);
    expect(inner.open).toBe(true);
    expect(outer.open).toBe(true);
  });

  it('leaves already-open disclosures untouched and reports nothing newly opened', () => {
    const metadataDisclosure = disclosure(true);

    const opened = revealAncestorDisclosures(controlInside(metadataDisclosure));

    expect(opened).toBe(0);
    expect(metadataDisclosure.open).toBe(true);
  });

  it('is a no-op for controls outside any disclosure', () => {
    expect(revealAncestorDisclosures(controlInside())).toBe(0);
  });
});
