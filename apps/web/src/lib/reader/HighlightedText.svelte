<script lang="ts">
  import { highlightText } from './search';
  let { text, query }: { text: string; query: string } = $props();
</script>

{#each highlightText(text, query) as run, i (i)}{#if run.match}<mark>{run.text}</mark
    >{:else}{run.text}{/if}{/each}
