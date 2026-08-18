/**
 * Ancestor-disclosure reveal for validation-summary focus targeting (#77).
 *
 * Metadata controls live inside an initially closed `<details>` disclosure;
 * calling `focus()` on an element hidden inside a closed disclosure is a
 * no-op, so every ancestor disclosure must be opened first. The interfaces
 * are structural so the walk is unit-testable without a DOM: a real
 * `HTMLElement` satisfies `StudioDisclosureControl` via the tag-name
 * `closest('details')` overload.
 *
 * Without JavaScript the summary's plain fragment navigation reveals the
 * target through the browser's native ancestor details revealing behavior —
 * this helper only replaces that for the hydrated, focus-enhancing path.
 */

export interface StudioAncestorDisclosure {
  open: boolean;
  parentElement: { closest(selector: 'details'): StudioAncestorDisclosure | null } | null;
}

export interface StudioDisclosureControl {
  closest(selector: 'details'): StudioAncestorDisclosure | null;
}

/**
 * Opens every ancestor `<details>` of the control, nearest first, and
 * returns how many were newly opened.
 */
export function revealAncestorDisclosures(control: StudioDisclosureControl): number {
  let opened = 0;
  let disclosure = control.closest('details');
  while (disclosure) {
    if (!disclosure.open) {
      opened += 1;
    }
    disclosure.open = true;
    disclosure = disclosure.parentElement?.closest('details') ?? null;
  }
  return opened;
}
