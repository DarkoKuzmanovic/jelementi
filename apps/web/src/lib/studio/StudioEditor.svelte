<script lang="ts">
  import type {
    StudioEditorData,
    StudioPreviewInput,
    StudioSaveResult,
  } from '../server/studio/editor.server';
  import type { StudioDraftReplacementResult } from '../server/studio/draft-replacement.server';
  import { untrack } from 'svelte';
  import { resumesTitleTracking, slugDerivedFromTitle } from './slug-tracking';
  import { EDITOR_INPUT_LIMITS, STUDIO_ISO_DATE_PATTERN } from './contracts';
  import {
    AUDIO_MEDIA_KEY_HINT,
    COVER_MEDIA_KEY_HINT,
    MARKDOWN_DIALECT_REFERENCE,
    buildStandaloneImageSnippet,
    insertSnippetAtCursor,
  } from './markdown-dialect';
  import {
    indentStudioBodySelection,
    outdentStudioBodySelection,
    resolveStudioBodyKeyIntent,
  } from './body-editing';
  import StudioWordCount from './StudioWordCount.svelte';

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

  // #109: while the writer has not touched the Slug field, it live-tracks
  // kebab-case(title); a manual edit freezes tracking and clearing the field
  // resumes it. The state is local to this component instance and seeded
  // once from the loaded metadata (untrack: deliberately non-reactive) — an
  // authoritative response never replaces typed form values (#78).
  let slugValue = $state(untrack(() => metadata.slug));
  let slugTracksTitle = $state(untrack(() => editor.slugEditable));

  function handleSlugInput(event: Event & { currentTarget: HTMLInputElement }): void {
    slugTracksTitle = resumesTitleTracking(event.currentTarget.value);
  }

  function handleTitleInput(event: Event & { currentTarget: HTMLInputElement }): void {
    const derived = slugDerivedFromTitle(event.currentTarget.value, slugTracksTitle && !slugLocked);
    if (derived !== undefined) slugValue = derived;
  }

  // #113: inserts a compiling standalone image paragraph keyed to the current
  // Slug field value at the caret in the body textarea.
  let bodyTextarea: HTMLTextAreaElement | undefined = $state();

  function handleInsertImage(): void {
    if (!bodyTextarea) return;
    insertSnippetAtCursor(bodyTextarea, buildStandaloneImageSnippet(slugValue));
    // Programmatic edits bypass native input events; announce the change so
    // dirty tracking (#112) sees inserted content like typed text.
    bodyTextarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // #114: the form and its Preview submitter are bound so a keydown inside
  // the body can request the exact Preview submission (the enhancement
  // controller's submit listener sees it like a button click).
  let editorFormEl: HTMLFormElement | undefined = $state();
  let previewSubmitButton: HTMLButtonElement | undefined = $state();

  function handleBodyKeyDown(event: KeyboardEvent): void {
    const intent = resolveStudioBodyKeyIntent(event);
    if (intent === undefined) return;
    event.preventDefault();
    switch (intent) {
      case 'preview-submit': {
        // While an enhanced submission is pending, syncPendingControls has
        // disabled this submitter; a second shortcut then does nothing
        // rather than throwing out of requestSubmit.
        if (editorFormEl === undefined || previewSubmitButton?.disabled === true) return;
        editorFormEl.requestSubmit(previewSubmitButton);
        return;
      }
      case 'indent':
        if (bodyTextarea !== undefined) {
          indentStudioBodySelection(bodyTextarea);
          announceBodyEdit();
        }
        return;
      case 'outdent':
        if (bodyTextarea !== undefined) {
          outdentStudioBodySelection(bodyTextarea);
          announceBodyEdit();
        }
        return;
    }
  }

  /** Tab edits bypass native input events; mirror them for #112/#114 listeners. */
  function announceBodyEdit(): void {
    bodyTextarea?.dispatchEvent(new Event('input', { bubbles: true }));
  }
</script>

<section class="studio-editor" aria-labelledby="studio-editor-heading">
  <p class="studio-editor__eyebrow">
    {metadata.status === 'draft' ? 'Draft article' : 'Canonical article'}
  </p>
  <h2 id="studio-editor-heading">{metadata.title}</h2>

  <form
    bind:this={editorFormEl}
    id={formId}
    method="POST"
    action="?/preview"
    class="studio-editor-form"
  >
    <section class="studio-editor__section" aria-labelledby="studio-essentials-heading">
      <h3 id="studio-essentials-heading">Essentials</h3>
      <p>Required to understand the article.</p>
      <div class="studio-editor__field-grid">
        <label class="studio-editor__field-wide">
          Title
          <input
            id="studio-field-title"
            name="title"
            value={metadata.title}
            maxlength={EDITOR_INPUT_LIMITS.titleMax}
            oninput={handleTitleInput}
          />
        </label>
        <div>
          <label>
            Slug
            <input
              id="studio-field-slug"
              name="slug"
              bind:value={slugValue}
              oninput={handleSlugInput}
              readonly={slugLocked}
              maxlength={EDITOR_INPUT_LIMITS.slugMax}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              aria-describedby="studio-field-slug-help"
            />
          </label>
          <!-- Outside the label so the control's accessible name stays "Slug". -->
          <span id="studio-field-slug-help" class="studio-editor__field-hint">
            Lowercase letters, numbers, and hyphens.
          </span>
        </div>
        <div>
          <label>
            Status
            <output id="studio-field-status" data-studio-status={metadata.status}>
              {metadata.status === 'published'
                ? 'Published'
                : metadata.status === 'archived'
                  ? 'Archived'
                  : 'Draft'}
            </output>
          </label>
          <!-- Outside the label so the control's accessible name stays "Status". -->
          <span id="studio-field-status-help" class="studio-editor__field-hint">
            Change publishing state via Publish / Unpublish in the publication panel.
          </span>
        </div>
        <label class="studio-editor__field-wide">
          Excerpt
          <textarea
            id="studio-field-excerpt"
            name="excerpt"
            rows="3"
            maxlength={EDITOR_INPUT_LIMITS.excerptMax}>{metadata.excerpt}</textarea
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
          <input
            id="studio-field-updatedAt"
            name="updatedAt"
            value={metadata.updatedAt}
            placeholder="YYYY-MM-DD"
            pattern={STUDIO_ISO_DATE_PATTERN}
          />
        </label>
        <label>
          Published date
          <input
            id="studio-field-publishedAt"
            name="publishedAt"
            value={metadata.publishedAt ?? ''}
            placeholder="YYYY-MM-DD"
            pattern={STUDIO_ISO_DATE_PATTERN}
          />
        </label>
        <label>
          Category
          <input
            id="studio-field-category"
            name="category"
            value={metadata.category}
            maxlength={EDITOR_INPUT_LIMITS.categoryMax}
          />
        </label>
        <label>
          Tags <span>(comma-separated)</span>
          <!-- No maxlength (#110): the server limit is per tag, not on the
               combined comma-separated text, so capping the input could
               client-block a valid multi-tag list. -->
          <input id="studio-field-tags" name="tags" value={metadata.tags.join(', ')} />
        </label>
        <label class="studio-editor__field-wide">
          Author
          <input
            id="studio-field-author"
            name="author"
            value={metadata.author}
            maxlength={EDITOR_INPUT_LIMITS.authorMax}
          />
        </label>
      </div>

      <fieldset>
        <legend>Cover</legend>
        <div class="studio-editor__field-grid">
          <div>
            <label>
              Media key
              <input
                id="studio-field-coverSrc"
                name="coverSrc"
                value={metadata.cover.src}
                maxlength={EDITOR_INPUT_LIMITS.mediaKeyMax}
                aria-describedby="studio-field-coverSrc-help"
              />
            </label>
            <!-- Outside the label so the control's accessible name stays "Media key". -->
            <span id="studio-field-coverSrc-help" class="studio-editor__field-hint">
              {COVER_MEDIA_KEY_HINT}
            </span>
          </div>
          <label>
            Alt text
            <input
              id="studio-field-coverAlt"
              name="coverAlt"
              value={metadata.cover.alt}
              maxlength={EDITOR_INPUT_LIMITS.altMax}
            />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Audio (optional)</legend>
        <div class="studio-editor__field-grid">
          <div>
            <label>
              Media key
              <input
                id="studio-field-audioSrc"
                name="audioSrc"
                value={metadata.audio?.src ?? ''}
                maxlength={EDITOR_INPUT_LIMITS.mediaKeyMax}
                aria-describedby="studio-field-audioSrc-help"
              />
            </label>
            <!-- Outside the label so the control's accessible name stays "Media key". -->
            <span id="studio-field-audioSrc-help" class="studio-editor__field-hint">
              {AUDIO_MEDIA_KEY_HINT}
            </span>
          </div>
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
              <input
                name="referenceTitle"
                value={reference.title}
                maxlength={EDITOR_INPUT_LIMITS.referenceTitleMax}
              />
            </label>
            <label>
              URL
              <input
                name="referenceUrl"
                type="url"
                value={reference.url}
                maxlength={EDITOR_INPUT_LIMITS.urlMax}
              />
            </label>
            <label>
              Publisher
              <input
                name="referencePublisher"
                value={reference.publisher ?? ''}
                maxlength={EDITOR_INPUT_LIMITS.referencePublisherMax}
              />
            </label>
            <label>
              Accessed date
              <input
                name="referenceAccessedAt"
                value={reference.accessedAt ?? ''}
                placeholder="YYYY-MM-DD"
                pattern={STUDIO_ISO_DATE_PATTERN}
              />
            </label>
          </div>
        {/each}
        <div class="studio-reference-fields" aria-label="New reference">
          <label>
            Title
            <input name="referenceTitle" maxlength={EDITOR_INPUT_LIMITS.referenceTitleMax} />
          </label>
          <label>
            URL
            <input name="referenceUrl" type="url" maxlength={EDITOR_INPUT_LIMITS.urlMax} />
          </label>
          <label>
            Publisher
            <input
              name="referencePublisher"
              maxlength={EDITOR_INPUT_LIMITS.referencePublisherMax}
            />
          </label>
          <label>
            Accessed date
            <input
              name="referenceAccessedAt"
              placeholder="YYYY-MM-DD"
              pattern={STUDIO_ISO_DATE_PATTERN}
            />
          </label>
        </div>
      </fieldset>
    </details>

    <section class="studio-editor__section">
      <p class="studio-editor__eyebrow">Writing · No autosave</p>
      <h3 id="studio-body-heading">Markdown body</h3>
      <label>
        Body
        <textarea
          bind:this={bodyTextarea}
          id="studio-body"
          name="body"
          rows="24"
          spellcheck="true"
          onkeydown={handleBodyKeyDown}>{visible.body}</textarea
        >
      </label>
      <div class="studio-editor__body-tools">
        <!-- type="button": an editing affordance, never a form submission. -->
        <button type="button" id="studio-insert-image" onclick={handleInsertImage}>
          Insert image
        </button>
        <span class="studio-editor__field-hint">
          Adds a standalone image paragraph keyed to this article's slug at the cursor.
        </span>
      </div>
      <details class="studio-editor__dialect" id="studio-markdown-dialect">
        <summary>Allowed Markdown</summary>
        <ul class="studio-editor__dialect-list">
          {#each MARKDOWN_DIALECT_REFERENCE as entry (entry.id)}
            <li>
              <p>{entry.rule}</p>
              {#if entry.examples}
                <ul>
                  {#each entry.examples as example (example)}
                    <li><code>{example}</code></li>
                  {/each}
                </ul>
              {/if}
            </li>
          {/each}
        </ul>
      </details>
      <p>Unsaved text stays in this form. Save draft is the only commit action.</p>
      <p>Reading time is generated by the compiler and is not editable.</p>
      <!-- #114: live count beside the reading-time note, in its own reactive scope. -->
      <StudioWordCount initial={visible.body} />
    </section>

    <input type="hidden" name="baseMainSha" value={concurrency.baseMainSha} />
    {#if concurrency.draftHeadSha}
      <input type="hidden" name="draftHeadSha" value={concurrency.draftHeadSha} />
    {/if}
    {#if concurrency.expectedBlobSha}
      <input type="hidden" name="expectedBlobSha" value={concurrency.expectedBlobSha} />
    {/if}
    <div class="studio-editor__actions">
      <button bind:this={previewSubmitButton} type="submit" id="studio-preview-submit">
        Preview
      </button>
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
      {#if save.draftExists !== undefined}
        <h3 id="save-conflict-heading">
          Save blocked: a Studio draft for this slug already exists
        </h3>
        <p>
          A Studio draft for this slug already exists on GitHub{#if save.draftExists.pullRequestNumber !== undefined}
            (Draft PR #{save.draftExists.pullRequestNumber}){/if}, so saving here would collide with
          it. Nothing was written.
        </p>
        <p>
          Open the existing draft to resume it, pick a different slug for this text and save again,
          or discard the existing draft. Your candidate stays in this form for copying.
        </p>
      {:else}
        <h3 id="save-conflict-heading">Save blocked: this draft moved on GitHub</h3>
        <p>
          What you loaded no longer matches what is currently on GitHub. Reload the editor to pick
          up the current state before saving again; your unsaved text above is not lost until you
          do.
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
      {/if}
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
  .studio-editor label span,
  .studio-editor__field-hint {
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
  .studio-editor output,
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

  /* Lifecycle status is presented, never edited here (#111): the muted
     value styling signals read-only alongside the publication-panel hint. */
  .studio-editor output {
    color: var(--studio-text-muted);
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

  /* Collapsible allowed-Markdown reference (#113). */
  .studio-editor__dialect {
    background: var(--studio-surface-subtle);
    border-radius: var(--studio-radius-control);
    padding: var(--studio-space-3);
  }

  .studio-editor__dialect summary {
    cursor: pointer;
    font-weight: 700;
  }

  .studio-editor__dialect-list {
    display: grid;
    gap: var(--studio-space-3);
    margin: var(--studio-space-3) 0 0;
    padding-inline-start: var(--studio-space-4);
  }

  .studio-editor__dialect-list code,
  .studio-editor__dialect-list li ul {
    margin-top: var(--studio-space-1);
  }

  .studio-editor__dialect-list code {
    display: block;
    white-space: pre-wrap;
    font-family: var(--studio-font-evidence);
    color: var(--studio-text-primary);
  }

  .studio-editor__body-tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--studio-space-2);
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
