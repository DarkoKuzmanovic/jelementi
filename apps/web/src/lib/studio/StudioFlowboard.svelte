<script lang="ts">
  import StudioArticleCard from './StudioArticleCard.svelte';
  import type {
    StudioFlowboardCard,
    StudioFlowboardColumn,
    StudioFlowboardProjection,
  } from './flowboard-projection';

  let { flowboard }: { flowboard: StudioFlowboardProjection } = $props();
  let query = $state('');
  let stateFilter = $state<'all' | StudioFlowboardColumn>('all');
  let view = $state<'board' | 'compact'>('board');

  const allCards = $derived([
    ...flowboard.columns.resumeWork,
    ...flowboard.columns.readyForDecision,
    ...flowboard.columns.library,
  ]);
  const columnDefinitions = $derived([
    {
      headingId: 'resume-work-heading',
      title: 'Resume work',
      cards: flowboard.columns.resumeWork,
      emptyMessage: 'No work needs resuming.',
    },
    {
      headingId: 'ready-for-decision-heading',
      title: 'Ready for your decision',
      cards: flowboard.columns.readyForDecision,
      emptyMessage: 'Nothing is waiting for your decision.',
    },
    {
      headingId: 'library-heading',
      title: 'Library',
      cards: flowboard.columns.library,
      emptyMessage: 'No other articles.',
    },
  ]);
  const normalizedQuery = $derived(query.trim().toLocaleLowerCase());

  function isVisible(card: StudioFlowboardCard): boolean {
    const stateMatches = stateFilter === 'all' || card.column === stateFilter;
    const searchMatches = normalizedQuery.length === 0 || card.searchText.includes(normalizedQuery);
    return stateMatches && searchMatches;
  }

  const visibleCount = $derived(allCards.filter(isVisible).length);
</script>

<section class="studio-flowboard" aria-labelledby="flowboard-heading">
  <div class="heading-row">
    <div>
      <p class="eyebrow">Resume publishing work</p>
      <h2 id="flowboard-heading">Flowboard</h2>
      <p>Every canonical article and active Studio draft, assigned once by server facts.</p>
    </div>
    <a class="new-article" href="/studio/articles/new">New article</a>
  </div>

  {#if flowboard.totalCount === 0}
    <section class="empty-state" aria-labelledby="flowboard-empty-heading">
      <h3 id="flowboard-empty-heading">No articles in Studio yet</h3>
      <p>No canonical articles or active Studio drafts were found.</p>
      <a class="new-article" href="/studio/articles/new">Create your first article</a>
    </section>
  {:else}
    <div class="toolbar" aria-label="Flowboard display controls">
      <label>
        <span>Search articles</span>
        <input type="search" bind:value={query} placeholder="Title, slug, or lifecycle" />
      </label>
      <label>
        <span>Filter by workflow</span>
        <select bind:value={stateFilter}>
          <option value="all">All workflow states</option>
          <option value="resume-work">Resume work</option>
          <option value="ready-for-decision">Ready for your decision</option>
          <option value="library">Library</option>
        </select>
      </label>
      <fieldset>
        <legend>View</legend>
        <label><input type="radio" bind:group={view} value="board" /> Board</label>
        <label><input type="radio" bind:group={view} value="compact" /> Compact</label>
      </fieldset>
      <p aria-live="polite">{visibleCount} of {flowboard.totalCount} articles shown</p>
    </div>

    {#if visibleCount === 0}
      <p class="filtered-empty">
        No articles match these local controls. Reset search or workflow.
      </p>
    {/if}

    <div class:compact={view === 'compact'} class="columns">
      {#each columnDefinitions as column (column.headingId)}
        <section aria-labelledby={column.headingId}>
          <header class="column-heading">
            <h2 id={column.headingId}>{column.title}</h2>
            <span>{column.cards.filter(isVisible).length}</span>
          </header>
          <div class="cards">
            {#each column.cards as card (card.slug)}
              <StudioArticleCard {card} hidden={!isVisible(card)} />
            {/each}
            {#if column.cards.length === 0}
              <p class="column-empty">{column.emptyMessage}</p>
            {/if}
          </div>
        </section>
      {/each}
    </div>
  {/if}
</section>

<style>
  .studio-flowboard {
    display: grid;
    width: min(96rem, calc(100vw - 48px));
    margin-inline: calc((100% - min(96rem, calc(100vw - 48px))) / 2);
    gap: var(--studio-space-6);
  }

  .heading-row {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: var(--studio-space-4);
  }

  .heading-row h2,
  .heading-row p {
    margin-block: 0 var(--studio-space-1);
  }

  .eyebrow {
    color: var(--studio-text-muted);
    font-size: var(--studio-text-compact);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .new-article {
    flex: none;
    padding: var(--studio-space-2) var(--studio-space-4);
    border-radius: var(--studio-radius-control);
    background: var(--studio-action-primary-bg);
    color: var(--studio-action-primary-fg);
    font-weight: 700;
    text-decoration: none;
  }

  .toolbar {
    display: flex;
    align-items: end;
    gap: var(--studio-space-4);
    padding: var(--studio-space-4);
    background: var(--studio-panel);
    border: 1px solid var(--studio-border);
    border-radius: var(--studio-radius-panel);
  }

  .toolbar > label {
    display: grid;
    flex: 1;
    gap: var(--studio-space-1);
    min-width: 12rem;
  }

  .toolbar span,
  .toolbar legend {
    color: var(--studio-text-muted);
    font-size: var(--studio-text-compact);
    font-weight: 700;
  }

  input,
  select {
    min-height: 2.75rem;
    min-width: 0;
    padding: var(--studio-space-2);
    border: 1px solid var(--studio-border);
    border-radius: var(--studio-radius-control);
    background: var(--studio-panel);
    color: var(--studio-text-primary);
    font: inherit;
  }

  fieldset {
    display: flex;
    gap: var(--studio-space-2);
    margin: 0;
    padding: var(--studio-space-1) var(--studio-space-2);
    border: 1px solid var(--studio-border);
    border-radius: var(--studio-radius-control);
  }

  fieldset label {
    white-space: nowrap;
  }

  .toolbar > p {
    margin: 0;
    color: var(--studio-text-muted);
    font-size: var(--studio-text-compact);
    white-space: nowrap;
  }

  .columns {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;
  }

  .columns > section {
    min-width: 0;
  }

  .column-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--studio-space-2);
    margin-bottom: var(--studio-space-3);
    padding-bottom: var(--studio-space-2);
    border-bottom: 1px solid var(--studio-border);
  }

  .column-heading h2 {
    margin: 0;
  }

  .column-heading span {
    min-width: 2rem;
    padding: var(--studio-space-1) var(--studio-space-2);
    border-radius: var(--studio-radius-pill);
    background: var(--studio-surface-selected);
    color: var(--studio-text-selected);
    text-align: center;
  }

  .cards {
    display: grid;
    gap: var(--studio-space-3);
  }

  .compact {
    grid-template-columns: 1fr;
  }

  .compact .cards {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
  }

  .empty-state,
  .filtered-empty {
    padding: var(--studio-space-6);
    background: var(--studio-panel);
    border: 1px solid var(--studio-border);
    border-radius: var(--studio-radius-panel);
  }

  .column-empty,
  .filtered-empty {
    color: var(--studio-text-muted);
  }

  @media (max-width: 1024px) {
    .columns {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 760px) {
    .studio-flowboard {
      width: calc(100vw - 32px);
      margin-inline: calc((100% - (100vw - 32px)) / 2);
    }
  }

  @media (max-width: 640px) {
    .heading-row,
    .toolbar {
      align-items: stretch;
      flex-direction: column;
    }

    .toolbar > label {
      min-width: 0;
    }

    .toolbar > p {
      white-space: normal;
    }
  }

  @media (max-width: 400px) {
    .studio-flowboard {
      width: calc(100vw - 20px);
      margin-inline: calc((100% - (100vw - 20px)) / 2);
    }
  }
</style>
