<!--
  Compact landing notice for a draft Discard whose article never reached
  canonical main: the article page no longer exists, so the discard action
  redirects to the Flowboard with a closed outcome token and this fixed copy
  states both halves of the outcome — the work was removed safely, and no
  published article changed.
-->
<section class="studio-draft-discarded" role="status" aria-labelledby="draft-discarded-heading">
  <h2 id="draft-discarded-heading">Draft discarded</h2>
  <p>
    The Draft PR was closed and its Studio branch deleted &mdash; your other Studio work is
    untouched. No published article changed: <code>main</code> is exactly as before, and readers cannot
    see the discarded draft.
  </p>
</section>

<style>
  .studio-draft-discarded {
    display: grid;
    gap: var(--studio-space-2);
    background: var(--studio-panel);
    border: 1px solid var(--studio-border);
    border-radius: var(--studio-radius-panel);
    padding: var(--studio-space-3) var(--studio-space-4);
    margin-bottom: var(--studio-space-3);
  }

  .studio-draft-discarded h2 {
    margin: 0;
    font-size: 1rem;
  }

  .studio-draft-discarded p {
    margin: 0;
  }
</style>
