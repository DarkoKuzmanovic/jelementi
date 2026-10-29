<script lang="ts">
  import type { PageData } from './$types';
  import Kicker from '../../../../../lib/reader/Kicker.svelte';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>{data.series.title}: dates to remember — Jelementi</title>
  <meta name="description" content={`Study cards for the dates in ${data.series.title}.`} />
</svelte:head>
<article class="small-page study">
  <Kicker
    category={data.series.category}
    categorySlug={data.series.categorySlug}
    extra={data.series.title}
  />
  <h1>Dates to remember</h1>
  <p class="small-page__deck">Read each event, recall its date, then tap to check.</p>
  {#each data.parts as part (part.slug)}
    <section aria-labelledby={`part-${part.part}`}>
      <h2 id={`part-${part.part}`}>
        Part {part.part}: <a href={`/articles/${part.slug}`}>{part.title}</a>
      </h2>
      <ul>
        {#each part.cards as card, index (index)}
          <li>
            <details>
              <summary>{card.what}<span>Tap to reveal</span></summary>
              <p>{card.when}</p>
            </details>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
  <a
    class="reader-button reader-button--secondary"
    href={`/series/${data.series.slug}.epub`}
    download>Download the series as an e-book</a
  >
</article>
