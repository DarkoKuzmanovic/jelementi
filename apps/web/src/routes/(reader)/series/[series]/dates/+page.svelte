<script lang="ts">
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>{data.series.title}: dates to remember — Jelementi</title>
  <meta name="description" content={`Study cards for the dates in ${data.series.title}.`} />
</svelte:head>
<!-- Inline styles: a route stylesheet would count against the frozen reader CSS budget. -->
<article>
  <h1>{data.series.title}: dates to remember</h1>
  <p>Read each event, recall its date, then tap the event to check.</p>
  <p><a href={`/series/${data.series.slug}.epub`} download>Download the series as an e-book</a></p>
  {#each data.parts as part (part.slug)}
    <section aria-labelledby={`part-${part.part}`}>
      <h2 id={`part-${part.part}`}>
        Part {part.part}: <a href={`/articles/${part.slug}`}>{part.title}</a>
      </h2>
      <ul style="padding: 0; list-style: none">
        {#each part.cards as card, index (index)}
          <li>
            <details style="border-top: 1px solid var(--rule); padding: 0.75rem 0">
              <summary style="cursor: pointer">{card.what}</summary>
              <p><strong>{card.when}</strong></p>
            </details>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</article>
