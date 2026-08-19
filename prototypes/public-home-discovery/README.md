# Public home and discovery prototype

> **Throwaway prototype only.** Nothing in this directory is imported by the SvelteKit application or included in the production build.

Four responsive home-page directions, switchable with `?variant=A|B|C|D`, the floating arrow controls, or the keyboard left/right arrows:

- **A — Editorial front:** horizontal front-page scan with a decisive lead.
- **B — Slow journal:** narrow, sequential, literary reading path.
- **C — Curious index:** category wayfinding beside the editorial sequence.
- **D — Field notebook:** restrained asymmetry and annotation as a recognizable signature.

Every direction preserves the already-decided home hierarchy: newest lead, up to three recent articles, then the complete remaining catalog. The repeated fixture data is representative prototype copy, not production content.

## Run

From the repository root:

```bash
pnpm prototype:public-home
```

Open <http://127.0.0.1:4392/?variant=A>. Resize to 320 CSS pixels to inspect the narrow composition.

## Decision question

What should the consolidated public home and discovery experience look and feel like across desktop and narrow widths, using the approved product character, navigation hierarchy, and shared design foundation while preserving static-reader constraints?
