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

<style>
  .reader-kicker {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.09em;
    line-height: 1.3;
    text-transform: uppercase;
  }
  .dot {
    width: 7px;
    height: 7px;
    flex: none;
    border-radius: 50%;
    background: currentColor;
  }
  .extra {
    color: var(--foundation-muted);
    font-weight: 500;
  }
</style>
