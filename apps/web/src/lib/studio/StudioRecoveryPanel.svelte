<script lang="ts">
  import type { StudioRecoveryProjection } from './recovery-projection';

  /**
   * StudioRecoveryPanel — conflict/failure/replacement recovery presentation
   * for the publication center (#77). Always answers, in order: what
   * happened, whether the writer's work is safe, whether readers saw a
   * change, and the one deterministic next action. Comparison and evidence
   * rows surface the concurrency proof behind the presentation. The
   * replacement button appears only when the server proved eligibility and
   * submits the editor form (`form` attribute), so it works without
   * JavaScript.
   */
  let {
    recovery,
    formId = 'studio-article-form',
  }: { recovery?: StudioRecoveryProjection; formId?: string } = $props();
</script>

{#if recovery}
  <section
    class="studio-recovery-panel studio-recovery-panel--{recovery.tone}"
    aria-labelledby="studio-recovery-panel-heading"
  >
    <h3 id="studio-recovery-panel-heading">{recovery.heading}</h3>
    <p class="studio-recovery-panel__what">{recovery.whatHappened}</p>
    <p class="studio-recovery-panel__safety">{recovery.workSafety}</p>
    <p class="studio-recovery-panel__readers">{recovery.readerEffect}</p>
    <p class="studio-recovery-panel__next">
      <strong>Next:</strong>
      {recovery.nextAction}
    </p>

    {#if recovery.offerReplacement}
      <button
        type="submit"
        form={formId}
        formaction="?/replace"
        class="studio-recovery-panel__replace"
      >
        Replace stale Studio draft
      </button>
    {/if}

    {#if recovery.comparison && recovery.comparison.length > 0}
      <table class="studio-recovery-panel__comparison">
        <thead>
          <tr>
            <th scope="col">Evidence</th>
            <th scope="col">Loaded</th>
            <th scope="col">Current</th>
          </tr>
        </thead>
        <tbody>
          {#each recovery.comparison as row (row.label)}
            <tr>
              <th scope="row">{row.label}</th>
              <td><code>{row.loaded}</code></td>
              <td><code>{row.current}</code></td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}

    {#if recovery.evidence.length > 0}
      <dl class="studio-recovery-panel__evidence">
        {#each recovery.evidence as row (row.label + row.value)}
          <dt>{row.label}</dt>
          <dd>
            {#if row.url}
              <a href={row.url}>{row.value}</a>
            {:else}
              <code>{row.value}</code>
            {/if}
          </dd>
        {/each}
      </dl>
    {/if}
  </section>
{/if}

<style>
  .studio-recovery-panel {
    border: 1px solid var(--studio-border, #d0d0d0);
    border-radius: 0.5rem;
    padding: 0.75rem 1rem;
    margin-block: 0.75rem;
  }

  .studio-recovery-panel--conflict {
    border-color: var(--studio-warning, #b58900);
  }

  .studio-recovery-panel--failure {
    border-color: var(--studio-danger, #b00020);
  }

  .studio-recovery-panel--success {
    border-color: var(--studio-success, #2e7d32);
  }

  .studio-recovery-panel h3 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
  }

  .studio-recovery-panel p {
    margin: 0 0 0.5rem;
  }

  .studio-recovery-panel__replace {
    display: inline-block;
    margin-block: 0.25rem 0.5rem;
  }

  .studio-recovery-panel__comparison {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.85rem;
  }

  .studio-recovery-panel__comparison th,
  .studio-recovery-panel__comparison td {
    text-align: left;
    padding: 0.25rem 0.5rem;
    border-top: 1px solid var(--studio-border, #d0d0d0);
    word-break: break-all;
  }

  .studio-recovery-panel__evidence {
    margin: 0.5rem 0 0;
    font-size: 0.85rem;
  }

  .studio-recovery-panel__evidence dt {
    font-weight: 600;
  }

  .studio-recovery-panel__evidence dd {
    margin: 0 0 0.25rem;
    word-break: break-all;
  }
</style>
