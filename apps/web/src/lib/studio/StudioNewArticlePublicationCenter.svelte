<script lang="ts">
  import type { StudioConcurrencyEvidence } from './contracts';

  let { concurrency }: { concurrency: StudioConcurrencyEvidence } = $props();
</script>

<aside
  id="publication-center"
  class="studio-new-publication"
  aria-labelledby="studio-publication-center-heading"
>
  <h2 id="studio-publication-center-heading">Publication center</h2>
  <section id="validation-summary" aria-labelledby="studio-new-lifecycle-heading">
    <h3 id="studio-new-lifecycle-heading">Lifecycle summary</h3>
    <p>This article has not been saved yet. Readers see no change.</p>
    <p><strong>Recommended:</strong> Save the first Studio draft.</p>
    <div class="studio-new-publication__axes">
      <div>
        <p>Published version</p>
        <strong>Not published</strong>
      </div>
      <div>
        <p>Working change</p>
        <strong>Not saved yet</strong>
      </div>
    </div>
    <p>No validation issues reported yet.</p>
  </section>
  <section
    id="recovery"
    class="studio-new-publication__eligibility"
    aria-labelledby="studio-new-publish-heading"
  >
    <h3 id="studio-new-publish-heading">Publish eligibility</h3>
    <p>Save the current form before publishing. Save draft is the only commit action.</p>
  </section>
  <details class="studio-new-publication__evidence">
    <summary>Evidence</summary>
    <dl>
      <dt>Base version</dt>
      <dd>{concurrency.baseMainSha}</dd>
    </dl>
  </details>
</aside>

<style>
  .studio-new-publication {
    display: grid;
    gap: var(--studio-space-3);
  }

  .studio-new-publication > section {
    background: var(--studio-panel);
    border: 1px solid var(--studio-border);
    border-radius: var(--studio-radius-panel);
    padding: var(--studio-space-4);
  }

  .studio-new-publication__axes {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--studio-space-2);
  }

  .studio-new-publication__axes strong {
    display: inline-block;
    border-radius: var(--studio-radius-pill);
    padding: var(--studio-space-1) var(--studio-space-3);
    background: var(--studio-surface-selected);
    color: var(--studio-text-selected);
    font-size: var(--studio-text-compact);
  }

  .studio-new-publication > .studio-new-publication__eligibility {
    background: var(--studio-info-surface);
    color: var(--studio-info-text);
  }

  .studio-new-publication__evidence {
    overflow-wrap: anywhere;
    font-family: var(--studio-font-evidence);
    font-size: var(--studio-text-compact);
    background: var(--studio-surface-subtle);
    border-radius: var(--studio-radius-control);
    padding: var(--studio-space-3);
  }

  @media (max-width: 400px) {
    .studio-new-publication__axes {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
