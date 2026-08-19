<script lang="ts">
  import type { PageData } from './$types';
  import ArticleSummary from '$lib/article/ArticleSummary.svelte';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Jelementi</title></svelte:head>
<section class="home-catalog" aria-labelledby="home-heading">
  <header class="home-introduction">
    <p class="home-kicker">Independent stories · Complete published catalog</p>
    <h1 id="home-heading">Jelementi</h1>
    <p class="home-lede">Curious, careful stories from nearby and far away.</p>
  </header>

  {#if data.catalog.lead}
    <div class="home-lead" data-home-tier="lead">
      <ArticleSummary article={data.catalog.lead} />
    </div>
  {/if}

  {#if data.catalog.recent.length > 0}
    <section class="home-recent" aria-labelledby="recent-heading" data-home-tier="recent">
      <!-- ArticleSummary's locked h2 remains the discovery heading; this label names the region. -->
      <p class="kicker" id="recent-heading">Recently published</p>
      <ol class="home-recent__list">
        {#each data.catalog.recent as article (article.slug)}
          <li>
            <ArticleSummary {article} />
          </li>
        {/each}
      </ol>
    </section>
  {/if}

  {#if data.catalog.more.length > 0}
    <section class="home-more" aria-labelledby="more-heading" data-home-tier="more">
      <p class="kicker" id="more-heading">More articles</p>
      <ol class="home-more__list divided-list">
        {#each data.catalog.more as article (article.slug)}
          <li>
            <ArticleSummary {article} />
          </li>
        {/each}
      </ol>
    </section>
  {/if}
</section>

<style>
  :global(main.layout) {
    width: min(74rem, calc(100% - 2rem));
  }

  .home-catalog,
  .home-catalog * {
    min-width: 0;
  }

  .home-introduction {
    display: grid;
    grid-template-columns: minmax(14rem, 0.8fr) minmax(0, 2fr);
    gap: var(--space-2) var(--space-12);
    align-items: end;
    margin-bottom: var(--space-6);
    padding-bottom: var(--space-4);
    border-bottom: 1px solid var(--foundation-rule);
  }

  .home-introduction h1 {
    margin: 0;
    font-family: var(--font-serif);
    font-size: clamp(2rem, 4vw, 3.25rem);
    line-height: var(--leading-heading);
  }

  .home-kicker,
  .home-lede {
    margin: 0;
    color: var(--foundation-muted);
  }

  .home-kicker {
    font-family: var(--font-mono);
    font-size: var(--text-compact);
    letter-spacing: 0.04em;
  }

  .home-lede {
    grid-column: 2;
    max-width: 55ch;
  }

  .home-lead {
    display: flex;
    align-items: end;
  }

  .home-recent,
  .home-more {
    margin-top: var(--space-12);
  }

  .home-recent__list {
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .home-more__list {
    display: grid;
  }

  .home-recent__list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    border-block: 1px solid var(--foundation-rule);
  }

  .home-recent__list li {
    padding: var(--space-6);
    border-inline-start: 1px solid var(--foundation-rule);
  }

  .home-recent__list li:first-child {
    padding-inline-start: 0;
    border-inline-start: 0;
  }

  .home-more__list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .home-more__list li {
    padding: var(--space-6) var(--space-6) var(--space-6) 0;
  }

  .home-more__list li:nth-child(even) {
    padding-inline: var(--space-6) 0;
  }

  .home-recent :global(.article-summary__title),
  .home-more :global(.article-summary__title) {
    font-size: var(--text-h3);
  }

  .home-more :global(.article-summary__excerpt) {
    font-size: var(--text-small);
  }

  @media (max-width: 760px) {
    .home-introduction,
    .home-recent__list,
    .home-more__list {
      grid-template-columns: minmax(0, 1fr);
    }

    .home-lede {
      grid-column: 1;
    }

    .home-lead {
      min-height: 18rem;
      padding: var(--space-8) var(--space-6);
    }

    .home-recent__list li,
    .home-recent__list li:first-child,
    .home-more__list li,
    .home-more__list li:nth-child(even) {
      padding: var(--space-6) 0;
      border-inline-start: 0;
      border-top: 1px solid var(--foundation-rule);
    }

    .home-recent__list li:first-child,
    .home-more__list li:first-child {
      border-top: 0;
    }
  }

  @media (max-width: 360px) {
    .home-lead {
      padding-inline: var(--space-4);
    }
  }
</style>
