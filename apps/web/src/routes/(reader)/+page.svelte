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
      <span class="home-lead__mark" aria-hidden="true">01</span>
    </div>
  {/if}

  {#if data.catalog.recent.length > 0}
    <section class="home-recent" aria-labelledby="recent-heading" data-home-tier="recent">
      <!-- ArticleSummary's locked h2 remains the discovery heading; this label names the region. -->
      <p class="home-section-label" id="recent-heading">Recently published</p>
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
      <p class="home-section-label" id="more-heading">More articles</p>
      <ol class="home-more__list">
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
    border-bottom: 3px double var(--foundation-rule);
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
    position: relative;
    min-height: 23rem;
    display: flex;
    align-items: end;
    padding: clamp(var(--space-8), 6vw, 5rem) clamp(var(--space-6), 5vw, 4.5rem);
    border: 1px solid color-mix(in srgb, var(--foundation-accent) 45%, var(--foundation-rule));
    background: var(--foundation-accent-soft);
  }

  .home-lead :global(.article-summary) {
    position: relative;
    z-index: 1;
    max-width: 49rem;
  }

  .home-lead :global(.article-summary__title) {
    max-width: 18ch;
    margin-bottom: var(--space-3);
    font-size: clamp(2rem, 5vw, 4rem);
  }

  .home-lead :global(.article-summary__excerpt) {
    max-width: 52ch;
    font-family: var(--font-serif);
    font-size: clamp(1.0625rem, 2vw, 1.3125rem);
    line-height: 1.55;
  }

  .home-lead__mark {
    position: absolute;
    top: 0;
    right: 0;
    max-width: 100%;
    overflow: clip;
    color: color-mix(in srgb, var(--foundation-accent) 15%, transparent);
    font-family: var(--font-serif);
    font-size: clamp(12rem, 28vw, 24rem);
    font-weight: 700;
    line-height: 1;
    pointer-events: none;
    user-select: none;
  }

  .home-recent,
  .home-more {
    margin-top: var(--space-12);
  }

  .home-section-label {
    margin: 0 0 var(--space-3);
    color: var(--foundation-muted);
    font-family: var(--font-mono);
    font-size: var(--text-compact);
    line-height: 1.3;
    letter-spacing: 0.11em;
    text-transform: uppercase;
  }

  .home-recent__list,
  .home-more__list {
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;
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
    border-top: 1px solid var(--foundation-rule);
  }

  .home-more__list li {
    padding: var(--space-6) var(--space-6) var(--space-6) 0;
    border-bottom: 1px solid var(--foundation-rule);
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

    .home-lead__mark {
      font-size: clamp(9rem, 54vw, 13rem);
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
