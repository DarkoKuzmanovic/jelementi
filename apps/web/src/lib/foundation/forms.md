# Shared form-core contract (target)

This document records the **target** shared form-core contract for the
Jelementi foundation (spec #96, ticket #98). It is a contract
specification, not an extraction: no control is promoted until it has two
real consumers with matching purpose, accessibility contract, interaction
behavior, and change reasons. Validation timing, message meaning, and
recovery semantics are surface-owned and are never defined here.

## Contract surface

Buttons, text inputs, textareas, selects, checkboxes, radios, and links
share:

- **label** — every control has a programmatically associated visible
  label (`<label for>` or a wrapping label).
- **help** — supplementary help text is associated with the control via
  `aria-describedby`.
- **error** — error text is associated with the control via
  `aria-describedby`, with `aria-invalid` on the control.
- **ARIA linkage** — label, help, and error are wired with
  `for`/`id`/`aria-describedby`; never by visual proximity alone.
- **focus** — controls receive the shared visible focus treatment
  (`:focus-visible` from `foundation.css`).
- **invalid** — invalid state is expressed with `[aria-invalid="true"]`
  (or `:user-invalid`) plus a non-color cue; never color-only.
- **disabled** — disabled controls use the shared disabled aliases
  (`--foundation-control-disabled-*`) and remain inert.
- **required** — required controls carry `required`/`aria-required` and a
  visible required indication.

## Surface-owned

Validation timing, message meaning, and recovery semantics are owned by
each surface (Reader vs Studio), never by the shared foundation. The
foundation provides only the shared contract above.
