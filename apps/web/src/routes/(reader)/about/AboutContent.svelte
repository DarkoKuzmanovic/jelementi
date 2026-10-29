<script lang="ts" module>
  export interface AboutFacts {
    ownership?: string;
    contact?: {
      label: string;
      value: string;
      href?: string;
    };
  }
</script>

<script lang="ts">
  let {
    facts,
    storyCount = 0,
    categoryCount = 0,
  }: { facts?: AboutFacts; storyCount?: number; categoryCount?: number } = $props();

  const hasFacts = $derived(facts?.ownership !== undefined || facts?.contact !== undefined);
</script>

<article class="small-page about" aria-labelledby="about-heading">
  <p class="reader-kicker">About</p>
  <h1 id="about-heading">About Jelementi</h1>
  <p class="about__statement">Jelementi publishes carefully edited stories in English.</p>
  <p>Each story is researched from documented sources and edited for clarity and context.</p>

  <dl class="about__facts">
    <div>
      <dt>Stories</dt>
      <dd>{storyCount} in {categoryCount === 5 ? 'five' : categoryCount} sections</dd>
    </div>
    <div>
      <dt>Listen</dt>
      <dd><a href="/podcast.xml">Podcast</a></dd>
    </div>
    <div>
      <dt>Follow</dt>
      <dd><a href="/feed.xml">Article feed (RSS)</a></dd>
    </div>
  </dl>

  {#if hasFacts}
    <section aria-labelledby="publication-details-heading">
      <h2 id="publication-details-heading">Publication details</h2>
      {#if facts?.ownership !== undefined}<p>{facts.ownership}</p>{/if}
      {#if facts?.contact !== undefined}
        <p>
          <span>{facts.contact.label}:</span>
          {#if facts.contact.href !== undefined}
            <a href={facts.contact.href}>{facts.contact.value}</a>
          {:else}
            {facts.contact.value}
          {/if}
        </p>
      {/if}
    </section>
  {/if}
</article>
