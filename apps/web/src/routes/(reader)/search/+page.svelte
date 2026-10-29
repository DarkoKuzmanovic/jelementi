<script lang="ts">
  import { onMount } from 'svelte';
  import type { PageData } from './$types';
  import { filterArticles } from '$lib/generated-content';
  import ListItem from '$lib/reader/ListItem.svelte';
  import HighlightedText from '$lib/reader/HighlightedText.svelte';
  import { storySnippet } from '$lib/reader/search';
  import { categoryHue } from '$lib/reader/category-hues';

  let { data }: { data: PageData } = $props();
  let width = $state(1440);
  let query = $state('');
  let hasInteracted = $state(false);
  let enhanced = $state(false);
  let searchInput: HTMLInputElement;

  onMount(() => {
    query = new URL(window.location.href).searchParams.get('query') ?? '';
    hasInteracted = query.trim().length > 0;
    enhanced = true;
  });

  const results = $derived(filterArticles(data.index, query));
  const hasQuery = $derived(query.trim().length > 0);
  const resultCount = $derived(
    hasQuery
      ? `${results.length} stories mention “${query.trim()}”`
      : `All ${results.length} stories`,
  );
  const resultStatus = $derived(hasInteracted ? resultCount : '');

  function setQuery(value: string): void {
    query = value;
    hasInteracted = true;
    searchInput.focus();
  }

  function submitSearch(event: SubmitEvent): void {
    event.preventDefault();
    hasInteracted = true;
    searchInput.focus();
  }
</script>

<svelte:window bind:innerWidth={width} />

<svelte:head
  ><title>Search — Jelementi</title><meta
    name="description"
    content="Search Jelementi — browse and filter the complete published catalog."
  /></svelte:head
>
<section
  class="search"
  aria-labelledby="search-heading"
  data-search-enhanced={enhanced ? 'true' : undefined}
>
  <div class="search__top">
    <header class="search__intro">
      <h1 id="search-heading">Find a story.</h1>
      <p>
        Search all {data.index.length} stories by subject, place, or a half-remembered detail. Matches
        inside the text show where they were found.
      </p>
    </header>
    <form class="search-form" role="search" action="/search" method="get" onsubmit={submitSearch}>
      <label class="visually-hidden" for="article-search">Search published articles</label>
      <div class="search-form__row">
        <svg
          width="16"
          height="16"
          viewBox="0 0 18 18"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true"><path d="M7 13A6 6 0 1 0 7 1a6 6 0 0 0 0 12zM11.5 11.5L16 16" /></svg
        >
        <input
          id="article-search"
          name="query"
          type="search"
          autocomplete="off"
          placeholder="Subject, place, or a half-remembered detail"
          bind:this={searchInput}
          value={query}
          oninput={(event) => {
            query = event.currentTarget.value;
            hasInteracted = true;
          }}
        />
        {#if hasQuery}<button class="search-clear" type="button" onclick={() => setQuery('')}
            >Clear</button
          >{/if}
        <button class="reader-button search-submit" type="submit">Search</button>
      </div>
    </form>
    <div class="search__try">
      <span>Try</span>{#each data.tryTags as tag (tag)}<a
          href={`/search?query=${encodeURIComponent(tag)}`}
          onclick={(event) => {
            event.preventDefault();
            setQuery(tag);
          }}>{tag}</a
        >{/each}
    </div>
  </div>
  <p class="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{resultStatus}</p>
  <noscript
    ><p class="search__notice">
      Filtering needs JavaScript; the complete catalog remains available below.
    </p></noscript
  >
  <div class="search__results">
    {#if results.length === 0}
      <section class="search-empty" aria-labelledby="empty-search-heading">
        <h2 id="empty-search-heading">Nothing matches “{query.trim()}”.</h2>
        <p>Check the spelling, try a single word, or start from a section.</p>
        <div class="recovery-links">
          <button
            class="reader-button reader-button--secondary"
            type="button"
            onclick={() => setQuery('')}>Clear search</button
          >
          {#each data.categories as category (category.slug)}<a
              class="reader-button reader-button--secondary"
              href={`/categories/${category.slug}`}
              ><span class="hue-dot" style:background={categoryHue(category.slug)}
              ></span>{category.name}</a
            >{/each}
        </div>
      </section>
    {:else}
      <div class="search-results__heading">
        <p>{resultCount}</p>
        <span>Newest first</span>
      </div>
      <ul class="article-list">
        {#each results as article (article.slug)}
          {@const snippet = storySnippet(
            article,
            data.searchText[article.slug] ?? '',
            query,
            width <= 600 ? 84 : 110,
          )}
          <li>
            <ListItem {article} dateOnly kickerExtra={`${article.readingTimeMinutes} min`}>
              {#snippet titleContent()}<HighlightedText text={article.title} {query} />{/snippet}
              {#snippet afterDeck()}{#if snippet}<div class="search-snippet">
                    <span>In the story</span>
                    <p><HighlightedText text={snippet} {query} /></p>
                  </div>{/if}{/snippet}
            </ListItem>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</section>
