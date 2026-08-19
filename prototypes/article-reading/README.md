# Article-reading prototype (#93)

> **PROTOTYPE ONLY — this directory is not a production route, component, or data source.**

Question: What should Jelementi's consolidated article-reading experience look and feel like across desktop and narrow widths while preserving article hierarchy, metadata, rich blocks, audio, references, footnotes, navigation context, and uninterrupted reading focus?

Run from the repository root:

```bash
pnpm prototype:article-reading
```

Open <http://127.0.0.1:4173/?variant=A>. Switch between `A`, `B`, `C`, and `D` with the fixed evaluation bar or the left/right arrow keys.

- **A — The Quiet Column:** maximum reading calm in a bounded literary column.
- **B — The Annotated Edition:** navigation and reference context occupy desktop margins, then collapse into the document flow.
- **C — The Magazine Opening:** an image-led threshold gives way to an uninterrupted single-column body.
- **D — The Field Guide:** chapter context supports scanning and orientation without creating a client application shell.

The artifact uses static representative content and inert links. It does not import generated JSON, the article model, the content compiler, SvelteKit routes, Studio code, or production styling. JavaScript only switches prototype presentation and updates `?variant=`; Variant A and all article content remain readable without JavaScript.
