<script lang="ts">
  import type { StudioLifecycle } from '$lib/studio/contracts';
  import type { StudioPublishResult } from '$lib/server/studio/publish.server';

  let {
    status,
    publish,
  }: {
    status: StudioLifecycle;
    publish?: StudioPublishResult;
  } = $props();

  // Publish is only offered for a revalidated, still-open draft (story 14).
  // Every other kind is either already approved, already merged, or has no
  // committed blob to approve.
  const canPublish = $derived(status.kind === 'draft_valid');
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
</section>
