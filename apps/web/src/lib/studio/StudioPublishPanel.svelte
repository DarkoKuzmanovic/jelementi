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
  }: {
    status: StudioLifecycle;
    publish?: StudioPublishResult;
    unpublish?: StudioUnpublishResult;
    discard?: StudioDiscardResult;
  } = $props();

  // Publish is only offered for a revalidated, still-open draft (story 14).
  // Every other kind is either already approved, already merged, or has no
  // committed blob to approve.
  const canPublish = $derived(status.kind === 'draft_valid');

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

  // Discard is offered while the article's PR is still a Draft; once the
  // draft has been published (flipped ready) there is no Draft PR to close.
  const canDiscard = $derived(status.kind === 'draft_valid' || status.kind === 'draft_invalid');

  const discardHeadSha = $derived(
    status.kind === 'draft_valid' || status.kind === 'draft_invalid' ? status.branch.headSha : '',
  );
</script>

<section aria-labelledby="studio-status-heading">
  <h3 id="studio-status-heading">Publish status</h3>

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
      The required check failed. The pull request stays open with auto-merge still enabled; a
      changed blob needs a new Publish.
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

  <form method="POST" action="?/publish">
    {#if status.kind === 'draft_valid'}
      <input type="hidden" name="expectedHeadSha" value={status.branch.headSha} />
    {/if}
    <button type="submit" disabled={!canPublish}>Publish</button>
  </form>
  <form method="POST" action="?/refresh">
    <button type="submit">Refresh</button>
  </form>

  {#if canUnpublish}
    <form method="POST" action="?/unpublish">
      <label for="unpublish-confirmation">
        Type <code>{status.article.slug}</code> to archive this article
      </label>
      <input id="unpublish-confirmation" name="confirmation" autocomplete="off" />
      <button type="submit">Unpublish</button>
    </form>
  {/if}
  {#if canDiscard}
    <form method="POST" action="?/discard">
      <input type="hidden" name="expectedHeadSha" value={discardHeadSha} />
      <label for="discard-confirmation">
        Type <code>{status.article.slug}</code> to discard this draft
      </label>
      <input id="discard-confirmation" name="confirmation" autocomplete="off" />
      <button type="submit">Discard draft</button>
    </form>
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
      <h4 id="publish-rejected-heading">Publish rejected: the committed draft does not compile</h4>
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
        flipped ready with auto-merge bound to that exact head. Use Refresh once the merge has
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
