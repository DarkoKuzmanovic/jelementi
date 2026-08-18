<script lang="ts">
  import type {
    StudioValidationIssueView,
    StudioValidationProjection,
    StudioValidationTarget,
  } from '../server/studio/validation-projection.server';
  import { revealAncestorDisclosures } from './validation-focus';

  /**
   * StudioValidationSummary — actionable validation presentation for the
   * publication center (#77). Always visible, never gated behind Evidence:
   * count, blocking severity, affected phases, and the first actionable
   * issue lead; every issue links to its target control. Server-rendered
   * anchors work without JavaScript; when hydrated, activating a link also
   * focuses the control and selects the offending body range.
   */
  let { validation }: { validation?: StudioValidationProjection } = $props();

  function focusTarget(event: MouseEvent, target: StudioValidationTarget): void {
    if (target.kind === 'source' || typeof document === 'undefined') {
      return;
    }
    const control = document.getElementById(target.controlId);
    if (!control) {
      return;
    }
    event.preventDefault();
    // Metadata controls live inside an initially closed <details>; focus()
    // on an element hidden in a closed disclosure is a no-op, so open every
    // ancestor disclosure first. Without JavaScript the plain fragment
    // navigation reveals the target via the browser's native ancestor
    // details revealing behavior.
    revealAncestorDisclosures(control);
    control.focus();
    if (
      target.kind === 'body' &&
      control instanceof HTMLTextAreaElement &&
      target.selectionEnd <= control.value.length &&
      target.selectionStart <= target.selectionEnd
    ) {
      control.setSelectionRange(target.selectionStart, target.selectionEnd);
    }
    control.scrollIntoView({ block: 'center' });
  }

  function targetText(view: StudioValidationIssueView): string {
    const target = view.target;
    if (target.kind === 'field') {
      return target.label;
    }
    if (target.kind === 'body') {
      return `Body, line ${target.bodyLine}, column ${target.bodyColumn}`;
    }
    return view.location;
  }
</script>

{#if validation}
  <section class="studio-validation-summary" aria-labelledby="studio-validation-summary-heading">
    <h3 id="studio-validation-summary-heading">Validation issues</h3>
    <p class="studio-validation-summary__overview">{validation.summary}</p>

    <p class="studio-validation-summary__first">
      <strong>First issue:</strong>
      {validation.first.issue.message}
      {#if validation.first.target.kind === 'source'}
        <span class="studio-validation-summary__location">({validation.first.location})</span>
      {:else}
        <a
          href="#{validation.first.target.controlId}"
          onclick={(event) => focusTarget(event, validation.first.target)}
        >
          Go to {targetText(validation.first)}
        </a>
      {/if}
    </p>

    <ol class="studio-validation-summary__issues">
      {#each validation.issues as view (view.location + view.issue.code + view.issue.message)}
        <li>
          <span class="studio-validation-summary__phase">{view.phase}</span>
          {view.issue.message}
          {#if view.target.kind === 'source'}
            <span class="studio-validation-summary__location">{view.location}</span>
          {:else}
            <a href="#{view.target.controlId}" onclick={(event) => focusTarget(event, view.target)}>
              {targetText(view)}
            </a>
          {/if}
        </li>
      {/each}
    </ol>
  </section>
{/if}

<style>
  .studio-validation-summary {
    border: 1px solid var(--studio-border, #d0d0d0);
    border-radius: 0.5rem;
    padding: 0.75rem 1rem;
    margin-block: 0.75rem;
  }

  .studio-validation-summary h3 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
  }

  .studio-validation-summary__overview {
    font-weight: 600;
    margin: 0 0 0.5rem;
  }

  .studio-validation-summary__first {
    margin: 0 0 0.5rem;
  }

  .studio-validation-summary__issues {
    margin: 0;
    padding-inline-start: 1.25rem;
  }

  .studio-validation-summary__phase {
    text-transform: uppercase;
    font-size: 0.75rem;
    letter-spacing: 0.04em;
    color: var(--studio-muted, #555);
    margin-inline-end: 0.25rem;
  }

  .studio-validation-summary__location {
    font-family: var(--studio-mono, monospace);
    font-size: 0.8rem;
    color: var(--studio-muted, #555);
  }
</style>
