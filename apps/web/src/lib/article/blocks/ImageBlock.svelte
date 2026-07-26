<script lang="ts">
  import type { ImageBlock } from '@jelementi/article-model';
  import InlineContent from '../InlineContent.svelte';
  let { block }: { block: ImageBlock } = $props();
</script>

<figure>
  <img src={block.src} alt={block.alt} width={block.width} height={block.height} loading="lazy" />
  {#if block.caption}
    <figcaption>
      <InlineContent nodes={block.caption} />
    </figcaption>
  {/if}
</figure>
