<script lang="ts">
  import type { StudioLifecycle } from '$lib/studio/contracts';
  import type { StudioPublishResult } from '$lib/server/studio/publish.server';
  import type { StudioUnpublishResult } from '$lib/server/studio/unpublish.server';
  import type { StudioDiscardResult } from '$lib/server/studio/discard.server';

  let {
    status,
    publish,
    unpublish,
    discard,
    editorFormId = 'studio-article-form',
    candidateDirty = false,
  }: {
    status: StudioLifecycle;
    publish?: StudioPublishResult;
    unpublish?: StudioUnpublishResult;
    discard?: StudioDiscardResult;
    editorFormId?: string;
    candidateDirty?: boolean;
  } = $props();

  // Publish is only offered for a revalidated, still-open draft (story 14).
  // Every other kind is either already approved, already merged, or has no
  // committed blob to approve.
  const canPublish = $derived(status.kind === 'draft_valid' && !candidateDirty);
  const publishReason = $derived(
    candidateDirty
      ? 'Save the current form before publishing.'
      : status.kind === 'draft_valid'
        ? 'Available for this valid saved version. The server rejects a newer or malformed form.'
        : status.kind === 'draft_invalid'
          ? 'Fix the reported issues before publishing, then save the corrected form.'
          : 'Publish is available only for a valid saved Studio draft.',
  );

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
  // are recoverable too: closing the approved Draft PR and deleting its branch is
  // the safe reset after auto-merge stalls or a required check fails.
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

<section class="studio-publication-actions" aria-labelledby="studio-status-heading">
  <h3 id="studio-status-heading">Publication actions</h3>

  {#if status.kind === 'draft_invalid'}
    <p>
      The committed draft on <code>{status.branch.name}</code> does not compile. It cannot be published
      until these issues are fixed and saved again:
    </p>
    <ul>
      {#each status.issues as issue, index (index)}
        <li>
          {issue.code}: {issue.message} ({issue.sourcePath}:{issue.line ?? 1}:{issue.column ?? 1})
        </li>
      {/each}
    </ul>
  {:else if status.kind === 'draft_valid'}
    <p>
      The committed draft on <code>{status.branch.name}</code> compiles. Publishing revalidates this exact
      head, flips the Draft PR ready, and enables auto-merge only for this head SHA — any later change
      to the branch requires a new Save and a new Publish (ADR-0004).
    </p>
  {:else if status.kind === 'ready'}
    <p>
      Approved and waiting on the required check: <a href={status.pullRequest.url}
        >Pull request #{status.pullRequest.number}</a
      >.
    </p>
  {:else if status.kind === 'checking'}
    <p>
      The required check is running: <a href={status.pullRequest.url}
        >Pull request #{status.pullRequest.number}</a
      >.
    </p>
  {:else if status.kind === 'check_failed'}
    <p>
      The required check failed. The Draft PR stays open with auto-merge still enabled; a changed
      blob needs a new Publish. Discard closes this unmerged Draft PR and deletes its Studio branch
      when you need to reset the failed check.
    </p>
    <p>
      <a href={status.pullRequest.url}>Pull request #{status.pullRequest.number}</a>
      {#if status.failedCheck.url}
        &mdash; <a href={status.failedCheck.url}>{status.failedCheck.name} check</a>
      {:else}
        &mdash; {status.failedCheck.name} check
      {/if}
    </p>
  {:else if status.kind === 'merged'}
    <p>Merged to <code>main</code> at {status.mainSha}. Not yet confirmed deployed or Live.</p>
  {:else if status.kind === 'pending_deployment'}
    <p>
      On <code>main</code> at {status.mainSha}, but production probes have not yet proven the public
      article and index match. A merge or successful build alone is never Live.
    </p>
  {:else if status.kind === 'live'}
    <p>
      Live: the public article fingerprint and index metadata both match <code
        >{status.contentVersion}</code
      >
      as of <code>main</code>
      {status.mainSha}.
    </p>
  {:else if status.kind === 'archived'}
    <p>Archived on <code>main</code> at {status.mainSha}.</p>
  {:else if status.kind === 'unpublish_pending'}
    <p>Unpublish is in flight from <code>main</code> at {status.mainSha}.</p>
  {:else if status.kind === 'conflict'}
    <p>This article's evidence moved on GitHub. Reload the editor before publishing again.</p>
  {:else if status.kind === 'failed'}
    <p>
      Status could not be determined ({status.phase}: {status.failure.category}). This is never
      treated as Live.
    </p>
  {:else}
    <p>Nothing is currently in flight for this article.</p>
  {/if}

  <div class="studio-publication-actions__primary" aria-label="Publication controls">
    <button
      type="submit"
      form={editorFormId}
      formaction="?/publish"
      name="expectedHeadSha"
      value={status.kind === 'draft_valid' ? status.branch.headSha : ''}
      disabled={!canPublish}
      aria-describedby="studio-publish-eligibility"
    >
      Publish saved version
    </button>
    <form method="POST" action="?/refresh">
      <button type="submit" aria-label="Check status — refresh evidence">Check status</button>
    </form>
  </div>
  <p id="studio-publish-eligibility">
    <strong>Publish eligibility:</strong>
    {publishReason}
  </p>

  {#if canUnpublish || canDiscard}
    <details class="studio-danger-zone">
      <summary>Danger zone</summary>
      <p>These actions are separate from ordinary writing and re-check fresh server evidence.</p>
      {#if canUnpublish}
        <form method="POST" action="?/unpublish">
          <p>
            Unpublish starts an archive change. Readers may continue to see this article until Check
            status verifies its public absence.
          </p>
          <label for="unpublish-confirmation">
            Type <code>{status.article.slug}</code> to archive this article
          </label>
          <input id="unpublish-confirmation" name="confirmation" autocomplete="off" />
          <button type="submit">Unpublish</button>
        </form>
      {/if}
      {#if canDiscard}
        <p>
          Discard closes only this Draft PR and deletes only
          <code>studio/article/{status.article.slug}</code>. <code>main</code> and any published article
          remain unchanged.
        </p>
        {#if status.kind === 'ready' || status.kind === 'checking' || status.kind === 'check_failed'}
          <p><a href={status.pullRequest.url}>Draft PR #{status.pullRequest.number}</a></p>
        {/if}
        <form method="POST" action="?/discard">
          <input type="hidden" name="expectedHeadSha" value={discardHeadSha} />
          <label for="discard-confirmation">
            Type <code>{status.article.slug}</code> to discard this draft
          </label>
          <input id="discard-confirmation" name="confirmation" autocomplete="off" />
          <button type="submit">Discard draft</button>
        </form>
      {/if}
    </details>
  {/if}

  {#if publish?.kind === 'published'}
    <section aria-labelledby="publish-result-heading">
      <h4 id="publish-result-heading">Published</h4>
      <p>
        Draft PR flipped ready and auto-merge enabled for {publish.headSha}:
        <a href={publish.pullRequest.url}>Pull request #{publish.pullRequest.number}</a>.
      </p>
    </section>
  {:else if publish?.kind === 'publish_conflict'}
    <section aria-labelledby="publish-conflict-heading">
      <h4 id="publish-conflict-heading">Publish blocked: the head changed</h4>
      <p>
        The approved head no longer matches what is on GitHub (no mutation after approval,
        ADR-0004). Reload the editor to see the current state.
      </p>
      <dl>
        <dt>Expected</dt>
        <dd>{publish.expectedHeadSha}</dd>
        <dt>Current</dt>
        <dd>{publish.currentHeadSha ?? 'branch not found'}</dd>
      </dl>
    </section>
  {:else if publish?.kind === 'publish_rejected'}
    <section aria-labelledby="publish-rejected-heading">
      <h4 id="publish-rejected-heading">
        {publish.compileIssues.some((issue) => issue.code === 'UNSAVED_EDITOR_CHANGES')
          ? 'Save the current form before publishing'
          : 'Publish rejected: the committed draft does not compile'}
      </h4>
      <ul>
        {#each publish.compileIssues as issue, index (index)}
          <li>
            {issue.code}: {issue.message} ({issue.sourcePath}:{issue.line ?? 1}:{issue.column ?? 1})
          </li>
        {/each}
      </ul>
    </section>
  {:else if publish?.kind === 'publish_failed'}
    <section aria-labelledby="publish-failed-heading">
      <h4 id="publish-failed-heading">Publish failed</h4>
      {#if publish.reason === 'topology'}
        <p>
          This article's Draft PR is not in the state Studio expects. Check
          <code>studio/article/{status.article.slug}</code> on GitHub directly before retrying.
        </p>
      {:else}
        <p>
          GitHub could not be reached at the {publish.phase} step. Nothing was changed; try again.
        </p>
      {/if}
    </section>
  {/if}

  {#if unpublish?.kind === 'unpublish_submitted'}
    <section aria-labelledby="unpublish-submitted-heading">
      <h4 id="unpublish-submitted-heading">Unpublish submitted</h4>
      <p>
        Archive commit {unpublish.commitSha} is on
        <a href={unpublish.pullRequest.url}>Pull request #{unpublish.pullRequest.number}</a>,
        flipped ready with auto-merge bound to that exact head. Use Check status once the merge has
        deployed to confirm the article is absent from production.
      </p>
    </section>
  {:else if unpublish?.kind === 'unpublish_conflict'}
    <section aria-labelledby="unpublish-conflict-heading">
      <h4 id="unpublish-conflict-heading">Unpublish blocked: the head changed</h4>
      <p>
        The branch moved while Unpublish was running (no mutation after approval, ADR-0004). Reload
        the editor to see the current state.
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
      <h4 id="unpublish-rejected-heading">
        Unpublish rejected: the archive change does not compile
      </h4>
      <ul>
        {#each unpublish.compileIssues as issue, index (index)}
          <li>
            {issue.code}: {issue.message} ({issue.sourcePath}:{issue.line ?? 1}:{issue.column ?? 1})
          </li>
        {/each}
      </ul>
    </section>
  {:else if unpublish?.kind === 'unpublish_blocked'}
    <section aria-labelledby="unpublish-blocked-heading">
      <h4 id="unpublish-blocked-heading">Unpublish blocked</h4>
      {#if unpublish.reason === 'differing-draft'}
        <p>
          An active committed draft differs from what is published on <code>main</code>. Unpublish
          never overwrites it; discard or finish that draft first.
        </p>
      {:else}
        <p>This article is not published on <code>main</code>, so there is nothing to unpublish.</p>
      {/if}
    </section>
  {:else if unpublish?.kind === 'unpublish_failed'}
    <section aria-labelledby="unpublish-failed-heading">
      <h4 id="unpublish-failed-heading">Unpublish failed</h4>
      {#if unpublish.reason === 'topology'}
        <p>
          This article's branch or Draft PR is not in the state Studio expects. Check
          <code>studio/article/{status.article.slug}</code> on GitHub directly before retrying.
        </p>
      {:else}
        <p>
          GitHub could not be reached at the {unpublish.phase} step. Nothing was changed; try again.
        </p>
      {/if}
    </section>
  {/if}

  {#if discard?.kind === 'discarded'}
    <section aria-labelledby="discard-result-heading">
      <h4 id="discard-result-heading">Draft discarded</h4>
      <p>
        Pull request <a href={discard.pullRequest.url}>#{discard.pullRequest.number}</a> closed and
        <code>studio/article/{status.article.slug}</code> deleted. <code>main</code> is unchanged.
      </p>
    </section>
  {:else if discard?.kind === 'discard_conflict'}
    <section aria-labelledby="discard-conflict-heading">
      <h4 id="discard-conflict-heading">Discard blocked: the head changed</h4>
      <p>
        The branch head no longer matches the head you saw when you confirmed. Nothing was closed or
        deleted. Reload the editor to see the current state.
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
          <code>studio/article/{status.article.slug}</code> on GitHub directly before retrying.
        </p>
      {:else}
        <p>
          GitHub could not be reached at the {discard.phase} step. Nothing was changed; retry rediscovers
          the current topology.
        </p>
      {/if}
    </section>
  {/if}
</section>

<style>
  .studio-publication-actions {
    display: grid;
    gap: var(--studio-space-3);
    margin-top: var(--studio-space-3);
    background: var(--studio-panel);
    border: 1px solid var(--studio-border);
    border-radius: var(--studio-radius-panel);
    padding: var(--studio-space-4);
  }

  .studio-publication-actions__primary {
    display: grid;
    gap: var(--studio-space-2);
  }

  .studio-publication-actions__primary form {
    display: contents;
  }

  .studio-publication-actions button {
    width: 100%;
    border: 1px solid var(--studio-action-primary-bg);
    border-radius: var(--studio-radius-control);
    padding: var(--studio-space-2) var(--studio-space-3);
    background: var(--studio-action-primary-bg);
    color: var(--studio-action-primary-fg);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .studio-publication-actions button:hover:not(:disabled) {
    background: var(--studio-action-primary-hover);
  }

  .studio-publication-actions button:disabled {
    border-color: var(--studio-disabled-bg);
    background: var(--studio-disabled-bg);
    color: var(--studio-disabled-text);
    cursor: not-allowed;
  }

  .studio-publication-actions input {
    box-sizing: border-box;
    width: 100%;
    background: var(--studio-panel);
    color: var(--studio-text-primary);
    border: 1px solid var(--studio-border);
    border-radius: var(--studio-radius-control);
    padding: var(--studio-space-2);
    font: inherit;
  }

  .studio-publication-actions label,
  .studio-danger-zone form {
    display: grid;
    gap: var(--studio-space-2);
  }

  .studio-danger-zone {
    background: var(--studio-danger-surface);
    color: var(--studio-danger-text);
    border-radius: var(--studio-radius-control);
    padding: var(--studio-space-3);
  }

  .studio-danger-zone summary {
    cursor: pointer;
    font-weight: 700;
  }

  .studio-danger-zone button {
    border-color: var(--studio-action-danger-bg);
    background: var(--studio-action-danger-bg);
    color: var(--studio-action-danger-fg);
  }

  .studio-danger-zone button:hover:not(:disabled) {
    background: var(--studio-action-danger-hover);
  }
</style>
