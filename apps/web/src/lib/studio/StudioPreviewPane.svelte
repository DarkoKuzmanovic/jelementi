<script lang="ts">
  import ArticleRenderer from '../article/ArticleRenderer.svelte';
  import type { StudioPreviewResult } from './contracts';

  let { preview }: { preview?: StudioPreviewResult } = $props();
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
          Authoritative ArticleRenderer contract (#98): Studio preview reuses
          the exact shared Reader content renderer and foundation typography
          at the selected width. It deliberately imports no Reader page
          chrome — no shell, header, footer, or navigation.
        -->
        <div class="article-preview">
          <ArticleRenderer document={preview.document} />
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

  .studio-preview-pane :global(img),
  .studio-preview-pane :global(pre),
  .studio-preview-pane :global(code) {
    max-width: 100%;
  }

  .studio-preview-pane :global(pre) {
    overflow-x: auto;
  }

  .article-preview {
    min-width: 0;
  }
</style>
