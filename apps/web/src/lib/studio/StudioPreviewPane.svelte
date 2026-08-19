<script lang="ts">
  import ArticleRenderer from '../article/ArticleRenderer.svelte';
  import type { StudioPreviewResult } from './contracts';

  const PREVIEW_WIDTHS = [
    { value: 'wide', label: 'Wide (52rem)' },
    { value: 'narrow', label: 'Narrow (320px)' },
  ] as const;

  let { preview }: { preview?: StudioPreviewResult } = $props();
  let selectedWidth: 'wide' | 'narrow' = $state('wide');
</script>

<section class="studio-preview-pane" aria-labelledby="studio-preview-heading">
  <p class="studio-preview-pane__eyebrow">Reader view</p>
  <h2 id="studio-preview-heading">Explicit preview</h2>

  {#if preview === undefined}
    <p>No preview has been requested for this form yet.</p>
    <p>Use Preview to compile the current form snapshot. Preview never saves a draft.</p>
  {:else}
    <p class="studio-preview-pane__snapshot">
      This is the explicitly submitted current form snapshot. Nothing was saved or changed in
      GitHub.
    </p>
    {#if preview.kind === 'preview_issues'}
      <section aria-labelledby="preview-issues-heading">
        <h3 id="preview-issues-heading">Preview needs attention</h3>
        <ul>
          {#each preview.compileIssues as issue, index (index)}
            <li>
              {issue.code}: {issue.message} ({issue.sourcePath}:{issue.line ?? 1}:{issue.column ??
                1})
            </li>
          {/each}
        </ul>
      </section>
    {:else}
      <article aria-labelledby="preview-result-heading">
        <h3 id="preview-result-heading">Reader preview</h3>
        <!--
          Authoritative ArticleRenderer contract (#98, #101): Studio preview
          mounts the exact shared Reader content renderer and Reader content
          tokens/typography at the selected responsive width. It deliberately
          imports no Reader page chrome — no shell, header, footer, or
          navigation — and no lifecycle meaning changes.
        -->
        <fieldset class="preview-width-controls">
          <legend class="visually-hidden">Preview width</legend>
          {#each PREVIEW_WIDTHS as option (option.value)}
            <label>
              <input
                type="radio"
                name="preview-width"
                value={option.value}
                bind:group={selectedWidth}
              />
              {option.label}
            </label>
          {/each}
        </fieldset>
        <div class="article-preview-viewport">
          <div
            class="article-preview"
            class:article-preview--narrow={selectedWidth === 'narrow'}
            class:article-preview--wide={selectedWidth === 'wide'}
          >
            <ArticleRenderer document={preview.document} />
          </div>
        </div>
      </article>
    {/if}
  {/if}
</section>

<style>
  .studio-preview-pane {
    min-width: 0;
    background: var(--studio-panel);
    border: 1px solid var(--studio-border);
    border-radius: var(--studio-radius-panel);
    padding: var(--studio-space-4);
  }

  .studio-preview-pane__eyebrow,
  .studio-preview-pane__snapshot {
    color: var(--studio-text-muted);
    font-size: var(--studio-text-compact);
  }

  .preview-width-controls {
    display: flex;
    flex-wrap: wrap;
    gap: var(--studio-space-2) var(--studio-space-6);
    margin: 0 0 var(--studio-space-4);
    padding: 0;
    border: 0;
  }

  .preview-width-controls label {
    display: inline-flex;
    align-items: center;
    gap: var(--studio-space-2);
    color: var(--studio-text-muted);
    font-size: var(--studio-text-compact);
  }

  /* Exact Reader content tokens/typography at the selected responsive width,
     contained within the Studio pane: the preview canvas may scroll locally
     but must never widen the Studio page. */
  .article-preview-viewport {
    max-width: 100%;
    overflow-x: auto;
  }

  .article-preview {
    min-width: 0;
  }

  .article-preview--narrow {
    width: 320px;
  }

  .article-preview--wide {
    width: 52rem;
  }

  .article-preview :global(img),
  .article-preview :global(pre),
  .article-preview :global(code) {
    max-width: 100%;
  }

  .article-preview :global(pre) {
    overflow-x: auto;
  }
</style>
