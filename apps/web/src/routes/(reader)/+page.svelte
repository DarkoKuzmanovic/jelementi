<script lang="ts">
  import type { PageData } from './$types';
  import ArticleSummary from '$lib/article/ArticleSummary.svelte';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head
  ><title>Jelementi</title><meta
    name="description"
    content="Curious, careful stories from nearby and far away — the complete published catalog of Jelementi."
  /></svelte:head
>
<section class="home-catalog" aria-labelledby="home-heading">
  <h1 id="home-heading" class="visually-hidden">Jelementi</h1>
  {#if data.catalog.lead}
    <div class="home-lead" data-home-tier="lead">
      <ArticleSummary article={data.catalog.lead} lead audioAvailable={data.hasLeadAudio} />
    </div>
  {/if}
  {#if data.catalog.recent.length > 0}
    <section class="home-recent" aria-labelledby="recent-heading" data-home-tier="recent">
      <div class="home-section-heading">
        <p id="recent-heading">Recently published</p>
        <a href="/search">All articles →</a>
      </div>
      <ol class="home-recent__list">
        {#each data.catalog.recent as article (article.slug)}<li>
            <ArticleSummary {article} />
          </li>{/each}
      </ol>
    </section>
  {/if}
  <aside class="podcast-invitation" aria-labelledby="podcast-heading">
    <div>
      <h2 id="podcast-heading">Prefer to listen?</h2>
      <p>The same stories, told aloud.<br />Add Jelementi to your podcast app.</p>
    </div>
    <a href="/podcast.xml">Get the podcast <span aria-hidden="true">↗</span></a>
  </aside>
  {#if data.catalog.more.length > 0}
    <section class="home-more" aria-labelledby="more-heading" data-home-tier="more">
      <p class="home-section-heading" id="more-heading">More articles</p>
      <ol class="home-more__list divided-list">
        {#each data.catalog.more as article (article.slug)}<li>
            <ArticleSummary {article} />
          </li>{/each}
      </ol>
    </section>
  {/if}
  <a class="archive-link" href="/search">Search the archive →</a>
</section>

<style>
  :global(.reader-home main.layout) {
    width: min(81rem, calc(100% - 2.75rem));
    padding-top: 2.5rem;
  }
  .home-catalog,
  .home-catalog * {
    min-width: 0;
  }
  .home-recent,
  .home-more {
    margin-top: 3.75rem;
  }
  .home-section-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin: 0 0 1.5rem;
    font-size: 1.75rem;
    letter-spacing: -0.035em;
  }
  .home-section-heading p {
    margin: 0;
  }
  .home-section-heading a,
  .archive-link {
    font-size: 0.875rem;
    text-decoration: none;
    letter-spacing: 0;
  }
  .home-recent__list {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 2.25rem;
    margin: 0;
    padding: 1.5rem 0 0;
    border-top: 1px solid var(--foundation-rule);
    list-style: none;
  }
  .home-recent :global(.article-summary) {
    flex-direction: column;
    gap: 1rem;
  }
  .home-recent :global(.article-summary__cover) {
    width: 100%;
  }
  .home-recent :global(.article-summary__title) {
    font-size: 1.75rem;
  }
  .home-more__list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 3.375rem;
  }
  .home-more :global(.article-summary) {
    gap: 1.25rem;
  }
  .home-more :global(.article-summary__cover) {
    width: 9.375rem;
  }
  .home-more :global(.article-summary__title) {
    font-size: 1.375rem;
  }
  .home-more :global(.article-summary__excerpt) {
    font-size: 0.875rem;
  }
  .podcast-invitation {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    margin-top: 3.75rem;
    padding: 2.5rem;
    background: #284c99;
    color: #f8f6f0;
  }
  .podcast-invitation h2 {
    margin: 0 0 0.75rem;
    font-weight: 500;
    font-size: 2.5rem;
    letter-spacing: -0.04em;
    line-height: 1.15;
  }
  .podcast-invitation p {
    margin: 0;
  }
  .podcast-invitation a {
    padding: 0.75rem 1.125rem;
    background: #f8f6f0;
    color: #284c99;
    text-decoration: none;
    border-radius: 3px;
    font-size: 0.875rem;
  }
  .archive-link {
    display: inline-block;
    padding-block: 1.5rem;
  }
  @media (max-width: 760px) {
    :global(.reader-home main.layout) {
      padding-top: 1.75rem;
    }
    .home-recent__list,
    .home-more__list {
      grid-template-columns: minmax(0, 1fr);
      gap: 0;
    }
    .home-recent__list > li {
      padding-block: 1.5rem;
      border-bottom: 1px solid var(--foundation-rule);
    }
    .home-recent__list > li:first-child {
      padding-top: 0;
    }
    .home-recent__list > li:not(:first-child) :global(.article-summary) {
      flex-direction: row-reverse;
    }
    .home-recent__list > li:not(:first-child) :global(.article-summary__cover),
    .home-more :global(.article-summary__cover) {
      width: 28%;
    }
    .home-recent__list > li:not(:first-child) :global(.article-summary__title) {
      font-size: 1.35rem;
    }
    .home-section-heading {
      font-size: 1.5rem;
    }
    .home-recent,
    .home-more,
    .podcast-invitation {
      margin-top: 2.5rem;
    }
    .podcast-invitation {
      padding: 1.625rem;
    }
    .podcast-invitation h2 {
      font-size: 2rem;
    }
  }
</style>
