<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    editor,
    preview,
    publication,
  }: {
    editor: Snippet;
    preview: Snippet;
    publication: Snippet;
  } = $props();
</script>

<div class="studio-editorial-desk">
  <div class="studio-editorial-desk__editor">{@render editor()}</div>
  <div class="studio-editorial-desk__preview">{@render preview()}</div>
  <div class="studio-editorial-desk__publication">{@render publication()}</div>
</div>

<style>
  .studio-editorial-desk {
    --studio-desk-inline-size: min(96rem, calc(100vw - 3rem));

    display: grid;
    width: var(--studio-desk-inline-size);
    margin-inline: calc((100% - var(--studio-desk-inline-size)) / 2);
    grid-template-columns: minmax(22rem, 1fr) minmax(22rem, 1fr) minmax(18rem, 20rem);
    gap: var(--studio-space-4);
    align-items: start;
  }

  /*
   * The editor sits in the centre column visually, with the preview to its
   * left. DOM order stays editor -> preview -> publication (asserted in
   * editorial-desk.test.ts and the acceptance spec), so the stacked
   * small-screen order and the reading/announcement order stay editor-first;
   * only the wide-desk placement differs.
   */
  .studio-editorial-desk__preview {
    grid-column: 1;
    grid-row: 1;
  }

  .studio-editorial-desk__editor {
    grid-column: 2;
    grid-row: 1;
  }

  .studio-editorial-desk__publication {
    grid-column: 3;
    /* Explicit row on all three: the preview is second in DOM but first in
       column order, and sparse auto-placement will not move an item backwards
       within a row — without this the preview drops to a second row. */
    grid-row: 1;
    position: sticky;
    top: var(--studio-space-4);
    max-height: calc(100vh - var(--studio-space-8));
    overflow-y: auto;
  }

  @media (max-width: 1120px) {
    .studio-editorial-desk {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    /* Two columns: fall back to DOM order so the editor leads. */
    .studio-editorial-desk__editor,
    .studio-editorial-desk__preview {
      grid-column: auto;
      grid-row: auto;
    }

    .studio-editorial-desk__publication {
      grid-column: 1 / -1;
      grid-row: auto;
      position: static;
      max-height: none;
      overflow-y: visible;
    }
  }

  @media (max-width: 760px) {
    .studio-editorial-desk {
      --studio-desk-inline-size: calc(100vw - 2rem);

      grid-template-columns: minmax(0, 1fr);
    }

    .studio-editorial-desk__publication {
      grid-column: auto;
    }
  }

  @media (max-width: 400px) {
    .studio-editorial-desk {
      --studio-desk-inline-size: calc(100vw - 1.25rem);
    }
  }
</style>
