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
  let { facts }: { facts?: AboutFacts } = $props();

  const hasFacts = $derived(facts?.ownership !== undefined || facts?.contact !== undefined);
</script>

<article class="about" aria-labelledby="about-heading">
  <h1 id="about-heading">About Jelementi</h1>
  <p class="about__statement">Jelementi publishes carefully edited stories in English.</p>
  <p>Each story is researched from documented sources and edited for clarity and context.</p>

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

<style>
  .about {
    max-width: 36rem;
    overflow-wrap: anywhere;
  }

  .about__statement {
    font-family: var(--font-serif);
    font-size: var(--text-large);
  }

  .about section {
    margin-top: var(--space-8);
    padding-top: var(--space-4);
    border-top: 1px solid var(--foundation-rule);
  }

  .about span {
    margin-right: var(--space-2);
    font-weight: 700;
  }
</style>
