# Secondary public routes prototype (#94)

> **PROTOTYPE ONLY — this directory is not a production route, component, or data source.**

Question: How should the approved **Editorial front** home and **The Quiet Column** article direction extend across Categories, category listings, Search, About, and ordinary public recovery/error states without over-designing secondary routes?

Three responsive treatments share the approved shell, type, color, article-summary hierarchy, and plain recovery language:

- **A — Quiet index:** restrained ruled lists and one calm reading sequence.
- **B — Editorial ledger:** stronger scan structure and a compact desktop directory.
- **C — Field notes:** selective numbering and annotation, while About and recovery stay plain.

All three preserve the fixed information decisions: category count/newest-story context; newest-first category listings; browse-before-typing Search with clear zero-result recovery; compact About; and Home, Search, and Categories recovery paths. The representative catalog is local prototype data only.

## Approved direction

The human selected **A — Quiet index**. Carry its restrained ruled directory and single reading sequence across Categories, category listings, and Search. About stays compact, while 404 and ordinary public errors stay plain and exact; these surfaces intentionally converge rather than acquiring variant-specific decoration.

## Run

From the repository root:

```bash
pnpm prototype:secondary-reader
```

Open <http://127.0.0.1:4394/?variant=A&route=categories>. Use the evaluation bar or URL parameters:

- `variant=A|B|C`
- `route=categories|category|search|about|404|error`
- `q=<search term>` on Search

Resize to 320 CSS pixels. Left/right arrow keys switch variants unless a form control is focused.

## Boundary

This standalone artifact does not import generated JSON, SvelteKit routes, the article model/compiler, Studio code, or production styles. It changes no public URL/data contract, hydration boundary, or Studio semantic. Production implementation must be rewritten from the approved decision; normal reader routes remain prerendered and non-hydrated, and `/search` remains the sole normal hydrated reader route.
