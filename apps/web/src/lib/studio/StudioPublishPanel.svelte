<script lang="ts">
  import type { StudioConcurrencyEvidence, StudioLifecycle } from '$lib/studio/contracts';
  import type { StudioPublishResult } from '$lib/server/studio/publish.server';
  import type { StudioUnpublishResult } from '$lib/server/studio/unpublish.server';
  import type { StudioDiscardResult } from '$lib/server/studio/discard.server';
  import {
    isConcludedSuccessfulCheck,
    publishStoppedCopy,
    shortStudioSha,
    statusUnavailableCopy,
  } from './evidence-copy';
  import StudioDangerZone from './StudioDangerZone.svelte';

  let {
    status,
    concurrency,
    publish,
    unpublish,
    discard,
    editorFormId = 'studio-article-form',
    candidateDirty = false,
  }: {
    status: StudioLifecycle;
    concurrency?: StudioConcurrencyEvidence;
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

  // #117: a concluded-successful check on an approved change means GitHub is
  // merging it — factually past "waiting for checks to start", and a moment
  // that must never invite a duplicate Publish. Derived, so it tracks the
  // refreshed status after Check status.
  const checksPassedMerging = $derived(
    status.kind === 'ready' && isConcludedSuccessfulCheck(status.check),
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
    {#if checksPassedMerging}
      <p>
        The required check has passed; GitHub is merging this change automatically:
        <a href={status.pullRequest.url}>Pull request #{status.pullRequest.number}</a>. Nothing to
        do &mdash; a new Publish is never needed here.
      </p>
    {:else}
      <p>
        Approved and waiting on the required check: <a href={status.pullRequest.url}
          >Pull request #{status.pullRequest.number}</a
        >.
      </p>
    {/if}
  {:else if status.kind === 'checking'}
    <p>
      The required check is running: <a href={status.pullRequest.url}
        >Pull request #{status.pullRequest.number}</a
      >.
    </p>
  {:else if status.kind === 'check_failed'}
    <p>
      The required check failed. Nothing was merged, and readers see no change. There are two ways
      forward:
    </p>
    <ol>
      <li>
        Fix the reported problem, then Save and run Publish again &mdash; this needs a new approval.
      </li>
      <li>
        Leave your content unchanged and re-run the failed check on GitHub: the check then completes
        without needing a new Publish approval, and auto-merge finishes on its own.
      </li>
    </ol>
    <p>
      Discard closes this unmerged Draft PR and deletes its Studio branch when you need to reset the
      failed check.
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
    <p>
      Merged to <code>main</code> at {shortStudioSha(status.mainSha)}. Not yet confirmed deployed or
      Live.
    </p>
  {:else if status.kind === 'pending_deployment'}
    <p>
      On <code>main</code> at {shortStudioSha(status.mainSha)}, but production probes have not yet
      proven the public article and index match. A merge or successful build alone is never Live.
    </p>
  {:else if status.kind === 'unverified'}
    <p>
      On <code>main</code> at {shortStudioSha(status.mainSha)}, but this screen has not verified
      what the public site currently serves. Check status to verify; nothing is in flight.
    </p>
  {:else if status.kind === 'live'}
    <p>
      Live: the public article fingerprint and index metadata both match
      <code>{shortStudioSha(status.contentVersion)}</code> as of <code>main</code>
      {shortStudioSha(status.mainSha)}.
    </p>
  {:else if status.kind === 'archived'}
    <p>
      Archived on <code>main</code> at {shortStudioSha(status.mainSha)}. Verified absent from the
      public index and the article route &mdash; readers no longer see it. Your other Studio work is
      untouched.
    </p>
  {:else if status.kind === 'unpublish_pending'}
    <p>
      Unpublish is in flight from <code>main</code> at {shortStudioSha(status.mainSha)}. Readers may
      still see the article until Check status verifies its public absence; your other Studio work
      is unaffected.
    </p>
  {:else if status.kind === 'conflict'}
    <p>This article's evidence moved on GitHub. Reload the editor before publishing again.</p>
  {:else if status.kind === 'failed'}
    <!-- #117: sentence form; internal phase/category codes are never echoed. -->
    <p>{statusUnavailableCopy()}</p>
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
      {#if concurrency}
        <input type="hidden" name="baseMainSha" value={concurrency.baseMainSha} />
        {#if concurrency.draftHeadSha}
          <input type="hidden" name="draftHeadSha" value={concurrency.draftHeadSha} />
        {/if}
        {#if concurrency.expectedBlobSha}
          <input type="hidden" name="expectedBlobSha" value={concurrency.expectedBlobSha} />
        {/if}
      {/if}
      <button type="submit" aria-label="Check status — refresh evidence">Check status</button>
    </form>
  </div>
  <p id="studio-publish-eligibility">
    <strong>Publish eligibility:</strong>
    {publishReason}
  </p>

  <StudioDangerZone {status} {unpublish} {discard} />

  {#if publish?.kind === 'published'}
    <section aria-labelledby="publish-result-heading">
      <h4 id="publish-result-heading">Published</h4>
      <p>
        Draft PR flipped ready and auto-merge enabled for {shortStudioSha(publish.headSha)}:
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
        <dd>{shortStudioSha(publish.expectedHeadSha)}</dd>
        <dt>Current</dt>
        <dd>
          {publish.currentHeadSha === null
            ? 'branch not found'
            : shortStudioSha(publish.currentHeadSha)}
        </dd>
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
      {#if publish.reason === 'transform'}
        <p>
          Publish could not derive the published form of this draft: its frontmatter status line
          could not be rewritten unambiguously. GitHub was not contacted and nothing was written.
          Inspect the committed draft, then save a corrected version before publishing again.
        </p>
      {:else if publish.reason === 'topology'}
        <p>
          This article's Draft PR is not in the state Studio expects. Check
          <code>studio/article/{status.article.slug}</code> on GitHub directly before retrying.
        </p>
      {:else}
        <!-- #117: sentence form; the internal phase code is never echoed. -->
        <p>
          {publishStoppedCopy(publish.phase, publish.reason)} Nothing was changed; try again.
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
</style>
