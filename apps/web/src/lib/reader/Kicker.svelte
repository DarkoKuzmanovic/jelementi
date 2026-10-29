<script lang="ts">
  import { categoryHue } from './category-hues';

  let {
    category,
    categorySlug,
    extra,
  }: { category: string; categorySlug: string; extra?: string } = $props();
</script>

<span class="reader-kicker" style:color={categoryHue(categorySlug)}>
  <span class="dot" aria-hidden="true"></span>
  <span>{category}</span>
  {#if extra}<span class="extra">· {extra}</span>{/if}
</span>
