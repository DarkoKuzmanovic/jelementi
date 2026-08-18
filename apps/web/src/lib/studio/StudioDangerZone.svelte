<script lang="ts">
  import type { StudioLifecycle } from '$lib/studio/contracts';
  import type { StudioUnpublishResult } from '$lib/server/studio/unpublish.server';
  import type { StudioDiscardResult } from '$lib/server/studio/discard.server';
  import StudioDestructiveConfirmation from './StudioDestructiveConfirmation.svelte';

  let {
    status,
    unpublish,
    discard,
  }: {
    status: StudioLifecycle;
    unpublish?: StudioUnpublishResult;
    discard?: StudioDiscardResult;
  } = $props();

  // Unpublish archives a published article on main. `live`,
  // `pending_deployment`, and `merged` are the ordinary published states;
  // `ready`, `checking`, and `check_failed` are included so an Unpublish
  // whose readiness flip succeeded but whose auto-merge failed can still be
  // retried after a reload (the service re-reads topology fresh, so the
  // retry either completes or reports a conflict). Showing the action for an
  // ordinary publish-approved draft is safe: unpublishStudioArticle re-reads
  // the committed draft and still blocks (`differing-draft`) any active
  // draft that differs byte-for-byte from canonical main, so this approval
  // path can never clobber a real draft.
  const canUnpublish = $derived(
    status.kind === 'live' ||
      status.kind === 'pending_deployment' ||
      status.kind === 'merged' ||
      status.kind === 'ready' ||
      status.kind === 'checking' ||
      status.kind === 'check_failed',
  );

  // Discard is offered for an unmerged Draft PR. Ready/checking/check_failed
  // are recoverable too (ADR-0008): closing the approved Draft PR and
  // deleting its branch is the safe reset after auto-merge stalls or a
  // required check fails.
  const canDiscard = $derived(
    status.kind === 'draft_valid' ||
      status.kind === 'draft_invalid' ||
      status.kind === 'ready' ||
      status.kind === 'checking' ||
      status.kind === 'check_failed',
  );

  const discardHeadSha = $derived(
    status.kind === 'draft_valid' || status.kind === 'draft_invalid'
      ? status.branch.headSha
      : status.kind === 'ready' || status.kind === 'checking' || status.kind === 'check_failed'
        ? status.pullRequest.headSha
        : '',
  );
</script>

{#if canUnpublish || canDiscard}
  <details class="studio-danger-zone">
    <summary>Danger zone</summary>
    <p>These actions are separate from ordinary writing and re-check fresh server evidence.</p>
    {#if canUnpublish}
      <StudioDestructiveConfirmation
        action="?/unpublish"
        slug={status.article.slug}
        idPrefix="unpublish"
        invokeLabel="Unpublish"
        title="Unpublish this article?"
        confirmPrompt="to archive this article"
      >
        {#snippet description()}
          <p>
            Unpublish starts an archive change. Readers may continue to see this article until Check
            status verifies its public absence.
          </p>
        {/snippet}
      </StudioDestructiveConfirmation>
    {/if}
    {#if canDiscard}
      <StudioDestructiveConfirmation
        action="?/discard"
        slug={status.article.slug}
        idPrefix="discard"
        invokeLabel="Discard draft"
        title="Discard this draft?"
        confirmPrompt="to discard this draft"
        expectedHeadSha={discardHeadSha}
      >
        {#snippet description()}
          <p>
            Discard closes only the sole exact unmerged Draft PR for
            <code>studio/article/{status.article.slug}</code> and deletes only that branch.
            <code>main</code> and any published article remain unchanged.
          </p>
          {#if status.kind === 'ready' || status.kind === 'checking' || status.kind === 'check_failed'}
            <p><a href={status.pullRequest.url}>Draft PR #{status.pullRequest.number}</a></p>
          {/if}
        {/snippet}
      </StudioDestructiveConfirmation>
    {/if}
  </details>
{/if}

{#if unpublish?.kind === 'unpublish_submitted'}
  <section aria-labelledby="unpublish-submitted-heading">
    <h4 id="unpublish-submitted-heading">Unpublish submitted</h4>
    <p>
      Archive commit {unpublish.commitSha} is on
      <a href={unpublish.pullRequest.url}>Pull request #{unpublish.pullRequest.number}</a>, flipped
      ready with auto-merge bound to that exact head. Readers may continue to see the article until
      that merge deploys; use Check status to confirm it is absent from production. Your other
      Studio work is untouched.
    </p>
  </section>
{:else if unpublish?.kind === 'unpublish_conflict'}
  <section aria-labelledby="unpublish-conflict-heading">
    <h4 id="unpublish-conflict-heading">Unpublish blocked: the head changed</h4>
    <p>
      The branch moved while Unpublish was running, so this attempt stopped at the mismatch and made
      no further change (no mutation after a detected conflict, ADR-0004). Studio has not verified
      what readers currently see — use Check status for the true published state. Reload the editor
      to see the current draft state; your other Studio work is untouched.
    </p>
    <dl>
      <dt>Expected</dt>
      <dd>{unpublish.expectedHeadSha}</dd>
      <dt>Current</dt>
      <dd>{unpublish.currentHeadSha ?? 'branch not found'}</dd>
    </dl>
  </section>
{:else if unpublish?.kind === 'unpublish_rejected'}
  <section aria-labelledby="unpublish-rejected-heading">
    <h4 id="unpublish-rejected-heading">Unpublish rejected: the archive change does not compile</h4>
    <ul>
      {#each unpublish.compileIssues as issue, index (index)}
        <li>
          {issue.code}: {issue.message} ({issue.sourcePath}:{issue.line ?? 1}:{issue.column ?? 1})
        </li>
      {/each}
    </ul>
    <p>
      This attempt approved no merge, so readers still see the article as before. An archive commit
      may remain on this article's Studio branch (a retry revalidates fresh state); your other
      Studio work is untouched.
    </p>
  </section>
{:else if unpublish?.kind === 'unpublish_blocked'}
  <section aria-labelledby="unpublish-blocked-heading">
    <h4 id="unpublish-blocked-heading">Unpublish blocked</h4>
    {#if unpublish.reason === 'differing-draft'}
      <p>
        An active committed draft differs from what is published on <code>main</code>. Unpublish
        never overwrites it; discard or finish that draft first. Nothing was archived: readers still
        see the published article.
      </p>
    {:else}
      <p>
        This article is not published on <code>main</code>, so there is nothing to unpublish.
        Nothing changed, and your Studio work is untouched. Absence from <code>main</code> does not by
        itself prove what readers currently see — use Check status to verify the deployed state.
      </p>
    {/if}
  </section>
{:else if unpublish?.kind === 'unpublish_failed'}
  <section aria-labelledby="unpublish-failed-heading">
    <h4 id="unpublish-failed-heading">Unpublish failed</h4>
    {#if unpublish.reason === 'topology'}
      <p>
        This article's branch or Draft PR is not in the state Studio expects. Check
        <code>studio/article/{status.article.slug}</code> on GitHub directly before retrying. This attempt
        approved no merge — Studio has not verified any change to what readers see; use Check status for
        the true published state. Your other Studio work is untouched.
      </p>
    {:else}
      <p>
        GitHub could not be reached at the {unpublish.phase} step, so Studio cannot confirm what that
        step changed. No merge has been verified: readers may still see the article — use Check status
        for the true published state. Steps that had already succeeded (an archive commit, Draft PR, or
        readiness flip) stay in place on this article's Studio branch; retrying re-reads the current state
        and finishes only what remains, or reports a conflict. Your other Studio work is untouched.
      </p>
    {/if}
  </section>
{/if}

{#if discard?.kind === 'discarded'}
  <section aria-labelledby="discard-result-heading">
    <h4 id="discard-result-heading">Draft discarded</h4>
    <p>
      Pull request <a href={discard.pullRequest.url}>#{discard.pullRequest.number}</a> closed and
      <code>studio/article/{status.article.slug}</code> deleted. <code>main</code> is unchanged and readers
      are unaffected.
    </p>
  </section>
{:else if discard?.kind === 'discard_conflict'}
  <section aria-labelledby="discard-conflict-heading">
    <h4 id="discard-conflict-heading">Discard blocked: the head changed</h4>
    <p>
      The branch head no longer matches the head you saw when you confirmed, so this attempt deleted
      nothing. If the current head below reads &ldquo;branch not found&rdquo;, the branch itself is
      already gone — removed outside this attempt, not by it. If this attempt had already closed the
      Draft PR before the head moved (Discard closes the PR before deleting the branch), it stays
      closed; reload the editor to see the true current state. Discard never touches <code
        >main</code
      >: any published article and its readers are unaffected.
    </p>
    <dl>
      <dt>Expected</dt>
      <dd>{discard.expectedHeadSha}</dd>
      <dt>Current</dt>
      <dd>{discard.currentHeadSha ?? 'branch not found'}</dd>
    </dl>
  </section>
{:else if discard?.kind === 'discard_failed'}
  <section aria-labelledby="discard-failed-heading">
    <h4 id="discard-failed-heading">Discard failed</h4>
    {#if discard.reason === 'topology'}
      <p>
        This article's Draft PR is not in the state Studio expects. Check
        <code>studio/article/{status.article.slug}</code> on GitHub directly before retrying. If
        this or an earlier attempt had already closed the Draft PR, it stays closed — only the
        branch deletion may remain. Discard never touches <code>main</code>, so any published
        article and its readers are unaffected, and your other Studio work is untouched.
      </p>
    {:else}
      <p>
        GitHub could not be reached at the {discard.phase} step. <code>main</code> and any published article
        are unchanged, and readers are unaffected. If this attempt had already closed the Draft PR, it
        stays closed; retry rediscovers the current topology and finishes only the remaining step — never
        a duplicate close or a new PR.
      </p>
    {/if}
  </section>
{/if}

<style>
  .studio-danger-zone {
    display: grid;
    gap: var(--studio-space-2);
    background: var(--studio-danger-surface);
    color: var(--studio-danger-text);
    border-radius: var(--studio-radius-control);
    padding: var(--studio-space-3);
  }

  .studio-danger-zone summary {
    cursor: pointer;
    font-weight: 700;
  }
</style>
