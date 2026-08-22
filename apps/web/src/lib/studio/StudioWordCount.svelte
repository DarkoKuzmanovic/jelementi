<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { studioWordCount } from './body-editing';

  /**
   * Live whitespace-collapsing word count beside the reading-time note
   * (#114).
   *
   * This component owns ALL of its keystroke-driven state in its own child
   * reactive scope, mirroring the StudioRecoveryCopyPanel pattern (#78):
   * updating the count must never re-render the sibling editor form, whose
   * uncontrolled inputs hold the writer's unsaved text. The body textarea
   * stays unbound — this panel only listens to it, so programmatic edits
   * (insert image, Tab indent/outdent, recovery restore) count exactly like
   * typed characters because they dispatch real input events.
   */
  let { sourceId = 'studio-body', initial }: { sourceId?: string; initial: string } = $props();

  // Seeded once from the loaded body (untrack: deliberately non-reactive,
  // same pattern as StudioEditor's one-time slug seed); live updates come
  // exclusively from the textarea input listener below.
  let count = $state(untrack(() => studioWordCount(initial)));

  onMount(() => {
    const source = document.getElementById(sourceId);
    if (!(source instanceof HTMLTextAreaElement)) return;
    const update = (): void => {
      count = studioWordCount(source.value);
    };
    source.addEventListener('input', update);
    return () => {
      source.removeEventListener('input', update);
    };
  });
</script>

<!-- #114: live count; the SSR render carries the loaded body's count. -->
<p id="studio-body-word-count" data-studio-word-count={count}>Word count: {count}</p>
