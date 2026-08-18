<script lang="ts">
  import type {
    StudioEditorData,
    StudioPreviewInput,
    StudioSaveResult,
  } from '../server/studio/editor.server';
  import type { StudioDraftReplacementResult } from '../server/studio/draft-replacement.server';

  let {
    editor,
    submitted,
    save,
    replacement,
    formId = 'studio-article-form',
    recoveryPresentation = 'inline',
  }: {
    editor: StudioEditorData;
    submitted?: StudioPreviewInput;
    save?: StudioSaveResult;
    replacement?: StudioDraftReplacementResult;
    formId?: string;
    /**
     * Where conflict/failure/replacement results are presented. 'inline'
     * (default) keeps the original in-editor sections and replace button;
     * 'external' hides them so a route-owned recovery panel (#77) can own
     * that presentation without duplicating it. Saved and save_rejected
     * confirmations always stay inline — they are editor feedback, not
     * recovery.
     */
    recoveryPresentation?: 'inline' | 'external';
  } = $props();

  const inlineRecovery = $derived(recoveryPresentation === 'inline');

  const visible = $derived(submitted ?? { metadata: editor.metadata, body: editor.body });
  const metadata = $derived(visible.metadata);

  // A successful Save moves the branch head and committed blob forward. A
  // save that failed after the commit landed (only the pull-request stage
  // failed) carries that same advanced evidence so a retry resumes from it
  // instead of the stale, pre-commit evidence self-conflicting. Either way,
  // the hidden concurrency fields must track the new evidence (not the
  // originally loaded one) so a second Save or Preview on the same page,
  // without a reload, is checked against what is actually on GitHub now.
  const concurrency = $derived(
    replacement?.kind === 'replaced'
      ? replacement.concurrency
      : save?.kind === 'saved'
        ? save.concurrency
        : ((save?.kind === 'save_failed' ? save.concurrency : undefined) ?? editor.concurrency),
  );
  // The slug becomes immutable the moment a draft branch exists. On an
  // established article route the server already enforces this on every
  // submit; this only keeps the field itself from inviting a change.
  const slugLocked = $derived(!editor.slugEditable || save?.kind === 'saved');
</script>

<section class="studio-editor" aria-labelledby="studio-editor-heading">
  <p class="studio-editor__eyebrow">
    {metadata.status === 'draft' ? 'Draft article' : 'Canonical article'}
  </p>
  <h2 id="studio-editor-heading">{metadata.title}</h2>

  <form id={formId} method="POST" action="?/preview" class="studio-editor-form">
    <section class="studio-editor__section" aria-labelledby="studio-essentials-heading">
      <h3 id="studio-essentials-heading">Essentials</h3>
      <p>Required to understand the article.</p>
      <div class="studio-editor__field-grid">
        <label class="studio-editor__field-wide">
          Title
          <input id="studio-field-title" name="title" value={metadata.title} required />
        </label>
        <label>
          Slug
          <input
            id="studio-field-slug"
            name="slug"
            value={metadata.slug}
            readonly={slugLocked}
            required
          />
        </label>
        <label>
          Status
          <select id="studio-field-status" name="status" value={metadata.status}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label class="studio-editor__field-wide">
          Excerpt
          <textarea id="studio-field-excerpt" name="excerpt" rows="3" required
            >{metadata.excerpt}</textarea
          >
        </label>
      </div>
    </section>

    <details class="studio-editor__metadata">
      <summary>
        More metadata
        <span>Dates, category, tags, author, media, audio, and references</span>
      </summary>
      <div class="studio-editor__field-grid">
        <label>
          Updated date
          <input id="studio-field-updatedAt" name="updatedAt" value={metadata.updatedAt} required />
        </label>
        <label>
          Published date
          <input
            id="studio-field-publishedAt"
            name="publishedAt"
            value={metadata.publishedAt ?? ''}
          />
        </label>
        <label>
          Category
          <input id="studio-field-category" name="category" value={metadata.category} required />
        </label>
        <label>
          Tags <span>(comma-separated)</span>
          <input id="studio-field-tags" name="tags" value={metadata.tags.join(', ')} />
        </label>
        <label class="studio-editor__field-wide">
          Author
          <input id="studio-field-author" name="author" value={metadata.author} required />
        </label>
      </div>

      <fieldset>
        <legend>Cover</legend>
        <div class="studio-editor__field-grid">
          <label>
            Media key
            <input id="studio-field-coverSrc" name="coverSrc" value={metadata.cover.src} required />
          </label>
          <label>
            Alt text
            <input id="studio-field-coverAlt" name="coverAlt" value={metadata.cover.alt} />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Audio (optional)</legend>
        <div class="studio-editor__field-grid">
          <label>
            Media key
            <input id="studio-field-audioSrc" name="audioSrc" value={metadata.audio?.src ?? ''} />
          </label>
          <label>
            Duration in seconds
            <input
              id="studio-field-audioDurationSeconds"
              name="audioDurationSeconds"
              type="number"
              min="1"
              value={metadata.audio?.durationSeconds ?? ''}
            />
          </label>
        </div>
      </fieldset>

      <fieldset id="studio-field-references" tabindex="-1">
        <legend>References</legend>
        {#each metadata.references as reference, index (index)}
          <div class="studio-reference-fields">
            <label>
              Title
              <input name="referenceTitle" value={reference.title} />
            </label>
            <label>
              URL
              <input name="referenceUrl" type="url" value={reference.url} />
            </label>
            <label>
              Publisher
              <input name="referencePublisher" value={reference.publisher ?? ''} />
            </label>
            <label>
              Accessed date
              <input name="referenceAccessedAt" value={reference.accessedAt ?? ''} />
            </label>
          </div>
        {/each}
        <div class="studio-reference-fields" aria-label="New reference">
          <label>
            Title
            <input name="referenceTitle" />
          </label>
          <label>
            URL
            <input name="referenceUrl" type="url" />
          </label>
          <label>
            Publisher
            <input name="referencePublisher" />
          </label>
          <label>
            Accessed date
            <input name="referenceAccessedAt" />
          </label>
        </div>
      </fieldset>
    </details>

    <section class="studio-editor__section">
      <p class="studio-editor__eyebrow">Writing · No autosave</p>
      <h3 id="studio-body-heading">Markdown body</h3>
      <label>
        Body
        <textarea id="studio-body" name="body" rows="24" spellcheck="true">{visible.body}</textarea>
      </label>
      <p>Unsaved text stays in this form. Save draft is the only commit action.</p>
      <p>Reading time is generated by the compiler and is not editable.</p>
    </section>

    <input type="hidden" name="baseMainSha" value={concurrency.baseMainSha} />
    {#if concurrency.draftHeadSha}
      <input type="hidden" name="draftHeadSha" value={concurrency.draftHeadSha} />
    {/if}
    {#if concurrency.expectedBlobSha}
      <input type="hidden" name="expectedBlobSha" value={concurrency.expectedBlobSha} />
    {/if}
    <div class="studio-editor__actions">
      <button type="submit">Preview</button>
      <button type="submit" formaction="?/save">Save draft</button>
      {#if inlineRecovery && save?.kind === 'save_conflict' && save.replacementAvailable}
        <button type="submit" formaction="?/replace">Replace stale Studio draft</button>
      {/if}
    </div>
  </form>

  {#if save?.kind === 'saved'}
    <section aria-labelledby="save-result-heading">
      <h3 id="save-result-heading">
        {save.compileIssues.length > 0 ? 'Saved — needs fixes' : 'Studio draft saved'}
      </h3>
      <p>
        Committed to <code>studio/article/{metadata.slug}</code> and opened as
        <a href={save.pullRequest.url}>Draft PR #{save.pullRequest.number}</a>.
      </p>
      {#if save.compileIssues.length > 0}
        <p>This draft is saved but not yet valid. It can never be published or merged as-is:</p>
        <ul>
          {#each save.compileIssues as issue, index (index)}
            <li>
              {issue.code}: {issue.message} ({issue.sourcePath}:{issue.line ?? 1}:{issue.column ??
                1})
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {:else if inlineRecovery && save?.kind === 'save_conflict'}
    <section aria-labelledby="save-conflict-heading">
      <h3 id="save-conflict-heading">Save blocked: this draft moved on GitHub</h3>
      <p>
        What you loaded no longer matches what is currently on GitHub. Reload the editor to pick up
        the current state before saving again; your unsaved text above is not lost until you do.
      </p>
      <dl>
        <dt>Loaded</dt>
        <dd>
          main {save.loaded.baseMainSha}{#if save.loaded.draftHeadSha}, draft {save.loaded
              .draftHeadSha}{/if}
        </dd>
        <dt>Current</dt>
        <dd>
          main {save.current.baseMainSha}{#if save.current.draftHeadSha}, draft {save.current
              .draftHeadSha}{/if}
        </dd>
      </dl>
    </section>
  {:else if save?.kind === 'save_rejected'}
    <section aria-labelledby="save-rejected-heading">
      <h3 id="save-rejected-heading">Save could not read this form</h3>
      <ul>
        {#each save.compileIssues as issue, index (index)}
          <li>
            {issue.code}: {issue.message} ({issue.sourcePath}:{issue.line ?? 1}:{issue.column ?? 1})
          </li>
        {/each}
      </ul>
    </section>
  {:else if inlineRecovery && save?.kind === 'save_failed'}
    <section aria-labelledby="save-failed-heading">
      <h3 id="save-failed-heading">Save failed</h3>
      {#if save.reason === 'topology'}
        <p>
          This article's Draft PR is not in the state Studio expects (more than one open pull
          request, or it is no longer a draft). Check <code>studio/article/{metadata.slug}</code> on GitHub
          directly before retrying.
        </p>
      {:else if save.concurrency}
        <p>
          Your draft was committed to <code>studio/article/{metadata.slug}</code>, but opening the
          pull request failed. Save again to retry; it will not create a duplicate branch or commit.
        </p>
      {:else}
        <p>GitHub could not be reached. Nothing was changed; try again.</p>
      {/if}
    </section>
  {/if}

  {#if inlineRecovery}
    {#if replacement?.kind === 'replaced'}
      <section aria-labelledby="replacement-result-heading">
        <h3 id="replacement-result-heading">Studio draft replaced</h3>
        <p>
          The replacement is based on main <code>{replacement.concurrency.baseMainSha}</code> and
          has a new
          <a href={replacement.pullRequest.url}>Draft PR #{replacement.pullRequest.number}</a>.
          Review it and run Publish again; the previous approval was not carried forward.
        </p>
        {#if replacement.compileIssues.length > 0}
          <p>The candidate was preserved, but the replacement is not publishable yet:</p>
          <ul>
            {#each replacement.compileIssues as issue, index (index)}
              <li>{issue.code}: {issue.message}</li>
            {/each}
          </ul>
        {/if}
      </section>
    {:else if replacement}
      <section aria-labelledby="replacement-failed-heading">
        <h3 id="replacement-failed-heading">Draft replacement stopped</h3>
        <p>
          Phase <code>{replacement.phase}</code> stopped with <code>{replacement.reason}</code>.
          Your candidate remains in the editor above. Inspect this evidence before retrying.
        </p>
        <dl>
          {#if replacement.evidence.mainSha}
            <dt>Main</dt>
            <dd><code>{replacement.evidence.mainSha}</code></dd>
          {/if}
          {#if replacement.evidence.target}
            <dt>Target</dt>
            <dd>
              <code>{replacement.evidence.target.path}</code>, loaded blob
              <code>{replacement.evidence.target.loadedBlobSha ?? 'absent'}</code>, fresh blob
              <code>{replacement.evidence.target.freshBlobSha ?? 'absent'}</code>
            </dd>
          {/if}
          {#if replacement.evidence.branch}
            <dt>Branch</dt>
            <dd>
              <a href={replacement.evidence.branch.url}>{replacement.evidence.branch.name}</a>
              at <code>{replacement.evidence.branch.headSha}</code>
            </dd>
          {/if}
          {#if replacement.evidence.pullRequest}
            <dt>Pull request</dt>
            <dd>
              <a href={replacement.evidence.pullRequest.url}
                >#{replacement.evidence.pullRequest.number}</a
              >
              ({replacement.evidence.pullRequest.state}, {replacement.evidence.pullRequest.draft
                ? 'Draft'
                : 'ready'})
            </dd>
          {/if}
        </dl>
      </section>
    {/if}
  {/if}
</section>

<style>
  .studio-editor {
    min-width: 0;
    background: var(--studio-panel);
    border: 1px solid var(--studio-border);
    border-radius: var(--studio-radius-panel);
    padding: var(--studio-space-4);
  }

  .studio-editor__eyebrow,
  .studio-editor p,
  .studio-editor summary span,
  .studio-editor label span {
    color: var(--studio-text-muted);
    font-size: var(--studio-text-compact);
  }

  .studio-editor-form,
  .studio-editor__section,
  .studio-editor__metadata,
  .studio-editor fieldset {
    display: grid;
    gap: var(--studio-space-3);
  }

  .studio-editor__field-grid,
  .studio-reference-fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--studio-space-3);
  }

  .studio-editor__field-wide {
    grid-column: 1 / -1;
  }

  .studio-editor label {
    display: grid;
    gap: var(--studio-space-1);
    min-width: 0;
  }

  .studio-editor input,
  .studio-editor select,
  .studio-editor textarea {
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    background: var(--studio-panel);
    color: var(--studio-text-primary);
    border: 1px solid var(--studio-border);
    border-radius: var(--studio-radius-control);
    padding: var(--studio-space-2);
    font: inherit;
  }

  .studio-editor textarea[name='body'] {
    min-height: 28rem;
    resize: vertical;
    font-family: var(--studio-font-evidence);
    line-height: var(--studio-line-height-body);
  }

  .studio-editor__metadata {
    background: var(--studio-surface-subtle);
    border-radius: var(--studio-radius-control);
    padding: var(--studio-space-3);
  }

  .studio-editor__metadata summary {
    cursor: pointer;
    font-weight: 700;
  }

  .studio-editor__metadata summary span {
    display: block;
    font-weight: 400;
  }

  .studio-editor__actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--studio-space-2);
  }

  .studio-editor button {
    border: 1px solid var(--studio-action-primary-bg);
    border-radius: var(--studio-radius-control);
    padding: var(--studio-space-2) var(--studio-space-4);
    background: var(--studio-action-primary-bg);
    color: var(--studio-action-primary-fg);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .studio-editor button:hover {
    background: var(--studio-action-primary-hover);
  }

  @media (max-width: 640px) {
    .studio-editor__field-grid,
    .studio-reference-fields {
      grid-template-columns: minmax(0, 1fr);
    }

    .studio-editor__field-wide {
      grid-column: auto;
    }

    .studio-editor__actions {
      display: grid;
    }
  }
</style>
