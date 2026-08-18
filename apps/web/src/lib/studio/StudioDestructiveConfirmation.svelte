<script lang="ts">
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';

  let {
    action,
    slug,
    idPrefix,
    invokeLabel,
    title,
    confirmPrompt,
    expectedHeadSha,
    description,
  }: {
    /** Form action, e.g. `?/unpublish` or `?/discard`. */
    action: string;
    slug: string;
    /** Stable id prefix, e.g. `unpublish` or `discard`. */
    idPrefix: string;
    /** Label of the destructive submit (and of the dialog opener). */
    invokeLabel: string;
    /** Accessible dialog title, e.g. `Unpublish this article?` */
    title: string;
    /** Typed-slug prompt suffix, e.g. `to archive this article`. */
    confirmPrompt: string;
    expectedHeadSha?: string;
    /** Full consequence copy; rendered inline without JS and inside the dialog. */
    description: Snippet;
  } = $props();

  // Server-rendered (and no-JS) clients get the complete inline confirmation:
  // consequence copy, typed-slug control, and a real submit. Browsers with JS
  // swap the inline controls for an opener + native modal dialog after
  // hydration. The typed-slug gate on the dialog submit is a courtesy only —
  // the server re-validates confirmation and every topology precondition.
  // onMount (not $derived on `browser`): the swap must happen only after
  // hydration, so server HTML and the client's first render agree.
  let enhanced = $state(false);
  onMount(() => {
    enhanced = true;
  });

  let dialog: HTMLDialogElement | undefined = $state();
  let opener: HTMLButtonElement | undefined = $state();
  let typed = $state('');
  let submitting = $state(false);
  let cancelled = $state(false);

  function open() {
    cancelled = false;
    typed = '';
    submitting = false;
    dialog?.showModal();
  }

  function onclose() {
    if (!submitting) {
      cancelled = true;
      opener?.focus();
    }
  }
</script>

<div class="studio-destructive">
  {#if enhanced}
    <div class="studio-destructive__summary">
      {@render description()}
    </div>
    <button bind:this={opener} type="button" onclick={open}>{invokeLabel}&hellip;</button>
    {#if cancelled}
      <p role="status">
        Cancelled. Nothing was submitted: GitHub is unchanged and readers see exactly what they saw
        before.
      </p>
    {/if}
    <dialog
      bind:this={dialog}
      aria-labelledby="{idPrefix}-dialog-title"
      aria-describedby="{idPrefix}-dialog-description"
      {onclose}
    >
      <h4 id="{idPrefix}-dialog-title">{title}</h4>
      <div id="{idPrefix}-dialog-description">
        {@render description()}
      </div>
      <form method="POST" {action} onsubmit={() => (submitting = true)}>
        {#if expectedHeadSha}
          <input type="hidden" name="expectedHeadSha" value={expectedHeadSha} />
        {/if}
        <label for="{idPrefix}-confirmation">
          Type <code>{slug}</code>
          {confirmPrompt}
        </label>
        <input
          id="{idPrefix}-confirmation"
          name="confirmation"
          autocomplete="off"
          bind:value={typed}
        />
        <div class="studio-destructive__dialog-actions">
          <!-- Cancel comes first in DOM and receives initial focus: the safe
               path is the default for a destructive confirmation (APG modal
               dialog pattern). autofocus inside a <dialog> only takes effect
               on showModal(), never at page load. -->
          <!-- svelte-ignore a11y_autofocus -->
          <button
            type="button"
            autofocus
            class="studio-destructive__cancel"
            onclick={() => dialog?.close()}
          >
            Cancel
          </button>
          <button type="submit" disabled={typed !== slug}>{invokeLabel}</button>
        </div>
      </form>
    </dialog>
  {:else}
    <form method="POST" {action}>
      {@render description()}
      {#if expectedHeadSha}
        <input type="hidden" name="expectedHeadSha" value={expectedHeadSha} />
      {/if}
      <label for="{idPrefix}-confirmation">
        Type <code>{slug}</code>
        {confirmPrompt}
      </label>
      <input id="{idPrefix}-confirmation" name="confirmation" autocomplete="off" />
      <button type="submit">{invokeLabel}</button>
    </form>
  {/if}
</div>

<style>
  .studio-destructive form,
  .studio-destructive label {
    display: grid;
    gap: var(--studio-space-2);
  }

  .studio-destructive input {
    box-sizing: border-box;
    width: 100%;
    background: var(--studio-panel);
    color: var(--studio-text-primary);
    border: 1px solid var(--studio-border);
    border-radius: var(--studio-radius-control);
    padding: var(--studio-space-2);
    font: inherit;
  }

  .studio-destructive button {
    width: 100%;
    border: 1px solid var(--studio-action-danger-bg);
    border-radius: var(--studio-radius-control);
    padding: var(--studio-space-2) var(--studio-space-3);
    background: var(--studio-action-danger-bg);
    color: var(--studio-action-danger-fg);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .studio-destructive button:hover:not(:disabled) {
    background: var(--studio-action-danger-hover);
  }

  .studio-destructive button:disabled {
    border-color: var(--studio-disabled-bg);
    background: var(--studio-disabled-bg);
    color: var(--studio-disabled-text);
    cursor: not-allowed;
  }

  .studio-destructive dialog {
    box-sizing: border-box;
    max-width: 32rem;
    background: var(--studio-panel);
    color: var(--studio-text-primary);
    border: 1px solid var(--studio-border);
    border-radius: var(--studio-radius-panel);
    padding: var(--studio-space-4);
  }

  .studio-destructive dialog::backdrop {
    background: rgb(0 0 0 / 55%);
  }

  .studio-destructive__dialog-actions {
    display: grid;
    gap: var(--studio-space-2);
  }

  .studio-destructive button.studio-destructive__cancel {
    border-color: var(--studio-border);
    background: var(--studio-panel);
    color: var(--studio-text-primary);
  }

  .studio-destructive button.studio-destructive__cancel:hover {
    background: var(--studio-border);
  }
</style>
