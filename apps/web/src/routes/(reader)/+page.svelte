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
      <ArticleSummary
        article={data.catalog.lead}
        lead
        audioAvailable={data.hasLeadAudio}
        citationIds={data.leadCitationIds}
      />
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
