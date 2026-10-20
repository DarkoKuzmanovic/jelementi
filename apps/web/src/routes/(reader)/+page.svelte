<script lang="ts">
  import type { PageData } from './$types';
  import ArticleSummary from '$lib/article/ArticleSummary.svelte';

  let { data }: { data: PageData } = $props();
  const wideShelves = $derived(data.catalog.shelves.filter((shelf) => shelf.entries.length === 3));
  const compactShelves = $derived(data.catalog.shelves.filter((shelf) => shelf.entries.length < 3));
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
  {#if data.catalog.shelves.length > 0}
    <section class="home-more" aria-labelledby="more-heading" data-home-tier="shelves">
      <div class="home-section-heading">
        <h2 id="more-heading">More articles</h2>
        <a href="/search">Search the archive →</a>
      </div>
      {#if wideShelves.length > 0}
        <div class="home-shelves home-shelves--wide">
          {#each wideShelves as shelf (shelf.categorySlug)}
            <section
              class="home-shelf home-shelf--wide"
              aria-labelledby={`home-shelf-${shelf.categorySlug}`}
            >
              <div class="home-shelf__label">
                <h3 id={`home-shelf-${shelf.categorySlug}`}>
                  <a href={`/categories/${shelf.categorySlug}`}>{shelf.category}</a>
                </h3>
                <p>{shelf.total} stories</p>
                <a class="home-shelf__all" href={`/categories/${shelf.categorySlug}`}>
                  <span class="home-shelf__all-wide">All in {shelf.category} →</span>
                  <span class="home-shelf__all-compact">All {shelf.total} →</span>
                </a>
              </div>
              <ol class="home-shelf__entries">
                {#each shelf.entries as article (article.slug)}
                  <li><ArticleSummary {article} headingLevel={4} /></li>
                {/each}
              </ol>
            </section>
          {/each}
        </div>
      {/if}
      {#if compactShelves.length > 0}
        <div class="home-shelves home-shelves--compact">
          {#each compactShelves as shelf (shelf.categorySlug)}
            <section
              class="home-shelf home-shelf--compact"
              aria-labelledby={`home-shelf-${shelf.categorySlug}`}
            >
              <div class="home-shelf__heading">
                <div>
                  <h3 id={`home-shelf-${shelf.categorySlug}`}>
                    <a href={`/categories/${shelf.categorySlug}`}>{shelf.category}</a>
                  </h3>
                  <p>{shelf.total} stories</p>
                </div>
                <a class="home-shelf__all" href={`/categories/${shelf.categorySlug}`}>
                  <span class="home-shelf__all-wide">All in {shelf.category} →</span>
                  <span class="home-shelf__all-compact">All {shelf.total} →</span>
                </a>
              </div>
              <ol class="home-shelf__entries">
                {#each shelf.entries as article (article.slug)}
                  <li><ArticleSummary {article} headingLevel={4} /></li>
                {/each}
              </ol>
            </section>
          {/each}
        </div>
      {/if}
    </section>
  {/if}
</section>
