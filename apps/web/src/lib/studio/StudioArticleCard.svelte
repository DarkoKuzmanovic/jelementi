<script lang="ts">
  import StudioEvidenceDisclosure from './StudioEvidenceDisclosure.svelte';
  import { formatStudioVerifiedAt } from './workspace-projection';
  import type { StudioFlowboardCard } from './flowboard-projection';

  let { card, hidden = false }: { card: StudioFlowboardCard; hidden?: boolean } = $props();

  // #116: a verified card shows when it was verified ("Live — verified <time>").
  const verifiedAt = $derived(formatStudioVerifiedAt(card.projection.publishedVersion.verifiedAt));
</script>

<article class="studio-flowboard-card" data-article-slug={card.slug} {hidden}>
  <header>
    {#if card.updatedAt !== undefined}<p class="updated">Updated {card.updatedAt}</p>{/if}
    <h3><a href={`/studio/articles/${card.slug}`}>{card.title}</a></h3>
    <p class="slug">{card.slug}</p>
  </header>

  <p class="summary">{card.projection.summary}</p>

  <dl class="facts">
    <div>
      <dt>Published version</dt>
      <dd>
        <span>{card.projection.publishedVersion.label}</span>{#if verifiedAt}<span class="verified"
            >&nbsp;· verified {verifiedAt}</span
          >{/if}
      </dd>
    </div>
    <div>
      <dt>Working change</dt>
      <dd>{card.projection.workingChange.label}</dd>
    </div>
  </dl>

  <p class="reader-effect"><strong>Readers:</strong> {card.projection.readerEffect}</p>
  <p class="recommended"><strong>Recommended:</strong> {card.projection.recommendedAction}</p>
  {#if card.projection.validationSummary !== 'No validation issues.'}
    <p class="validation">{card.projection.validationSummary}</p>
  {/if}

  <div class="card-actions">
    <div class="primary-action">
      {#if card.primaryAction.kind === 'check'}
        <form method="POST" action="?/check">
          <input type="hidden" name="slug" value={card.slug} />
          <button type="submit">{card.primaryAction.label}</button>
        </form>
      {:else}
        <a href={card.primaryAction.href}>{card.primaryAction.label}</a>
      {/if}
    </div>
    {#if card.primaryAction.kind !== 'check'}
      <form method="POST" action="?/check" class="secondary-action">
        <input type="hidden" name="slug" value={card.slug} />
        <button type="submit">Check status</button>
      </form>
    {/if}
  </div>

  <StudioEvidenceDisclosure projection={card.projection} />
</article>

<style>
  .studio-flowboard-card {
    display: grid;
    gap: var(--studio-space-3);
    min-width: 0;
    padding: var(--studio-space-4);
    background: var(--studio-panel);
    border: 1px solid var(--studio-border);
    border-radius: var(--studio-radius-panel);
  }

  .studio-flowboard-card[hidden] {
    display: none;
  }

  header,
  h3,
  p,
  dl,
  dd {
    margin: 0;
  }

  h3 a {
    color: var(--studio-text-primary);
  }

  .updated,
  .slug {
    color: var(--studio-text-muted);
    font-size: var(--studio-text-compact);
  }

  .slug {
    overflow-wrap: anywhere;
    font-family: var(--studio-font-evidence);
  }

  .facts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--studio-space-2);
  }

  .facts div {
    min-width: 0;
  }

  dt {
    color: var(--studio-text-muted);
    font-size: var(--studio-text-compact);
  }

  dd {
    margin-top: var(--studio-space-1);
    padding: var(--studio-space-1) var(--studio-space-2);
    overflow-wrap: anywhere;
    border-radius: var(--studio-radius-pill);
    background: var(--studio-surface-selected);
    color: var(--studio-text-selected);
    font-size: var(--studio-text-compact);
  }

  /* #116: the "· verified <time>" stamp reads as secondary evidence. */
  .verified {
    color: var(--studio-text-muted);
  }

  .reader-effect,
  .recommended,
  .validation {
    font-size: var(--studio-text-compact);
  }

  .recommended {
    padding: var(--studio-space-2);
    background: var(--studio-info-surface);
    color: var(--studio-info-text);
    border-radius: var(--studio-radius-control);
  }

  .validation {
    color: var(--studio-danger-text);
  }

  .primary-action a,
  .primary-action button {
    display: inline-block;
    padding: var(--studio-space-2) var(--studio-space-3);
    border: 0;
    border-radius: var(--studio-radius-control);
    background: var(--studio-action-primary-bg);
    color: var(--studio-action-primary-fg);
    font: inherit;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
  }

  .primary-action a:hover,
  .primary-action button:hover {
    background: var(--studio-action-primary-hover);
  }

  .card-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--studio-space-2);
  }

  .secondary-action button {
    padding: var(--studio-space-2);
    border: 0;
    background: transparent;
    color: var(--studio-link);
    font: inherit;
    text-decoration: underline;
    cursor: pointer;
  }

  @media (max-width: 400px) {
    .facts {
      grid-template-columns: 1fr;
    }
  }
</style>
