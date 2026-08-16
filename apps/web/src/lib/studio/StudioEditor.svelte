<script lang="ts">
  import type {
    StudioEditorData,
    StudioPreviewInput,
    StudioSaveResult,
  } from '$lib/server/studio/editor.server';
  import type { StudioPreviewResult } from '$lib/studio/contracts';
  import ArticleRenderer from '$lib/article/ArticleRenderer.svelte';

  let {
    editor,
    submitted,
    preview,
    save,
  }: {
    editor: StudioEditorData;
    submitted?: StudioPreviewInput;
    preview?: StudioPreviewResult;
    save?: StudioSaveResult;
  } = $props();

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
    save?.kind === 'saved'
      ? save.concurrency
      : (save?.kind === 'save_failed' ? save.concurrency : undefined) ?? editor.concurrency,
  );
  // The slug becomes immutable the moment a draft branch exists. On an
  // established article route the server already enforces this on every
  // submit; this only keeps the field itself from inviting a change.
  const slugLocked = $derived(!editor.slugEditable || save?.kind === 'saved');
</script>

<section aria-labelledby="studio-editor-heading">
  <p class="eyebrow">{metadata.status === 'draft' ? 'Draft article' : 'Canonical article'}</p>
  <h2 id="studio-editor-heading">{metadata.title}</h2>
  <p>Preview is compiled on the server from the current form. No draft is saved automatically.</p>

  <form method="POST" action="?/preview" class="studio-editor-form">
    <fieldset>
      <legend>Article metadata</legend>
      <label>
        Title
        <input name="title" value={metadata.title} required />
      </label>
      <label>
        Slug
        <input name="slug" value={metadata.slug} readonly={slugLocked} required />
      </label>
      <label>
        Excerpt
        <textarea name="excerpt" rows="3" required>{metadata.excerpt}</textarea>
      </label>
      <label>
        Updated date
        <input name="updatedAt" value={metadata.updatedAt} required />
      </label>
      <label>
        Published date
        <input name="publishedAt" value={metadata.publishedAt ?? ''} />
      </label>
      <label>
        Status
        <select name="status" value={metadata.status}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </label>
      <label>
        Category
        <input name="category" value={metadata.category} required />
      </label>
      <label>
        Tags <span>(comma-separated)</span>
        <input name="tags" value={metadata.tags.join(', ')} />
      </label>
      <label>
        Author
        <input name="author" value={metadata.author} required />
      </label>
    </fieldset>

    <fieldset>
      <legend>Cover</legend>
      <label>
        Media key
        <input name="coverSrc" value={metadata.cover.src} required />
      </label>
      <label>
        Alt text
        <input name="coverAlt" value={metadata.cover.alt} />
      </label>
    </fieldset>

    <fieldset>
      <legend>Audio (optional)</legend>
      <label>
        Media key
        <input name="audioSrc" value={metadata.audio?.src ?? ''} />
      </label>
      <label>
        Duration in seconds
        <input
          name="audioDurationSeconds"
          type="number"
          min="1"
          value={metadata.audio?.durationSeconds ?? ''}
        />
      </label>
    </fieldset>

    <fieldset>
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

    <fieldset>
      <legend>Markdown body</legend>
      <label>
        Body
        <textarea name="body" rows="18">{visible.body}</textarea>
      </label>
      <p>Reading time is generated by the compiler and is not editable.</p>
    </fieldset>

    <input type="hidden" name="baseMainSha" value={concurrency.baseMainSha} />
    {#if concurrency.draftHeadSha}
      <input type="hidden" name="draftHeadSha" value={concurrency.draftHeadSha} />
    {/if}
    {#if concurrency.expectedBlobSha}
      <input type="hidden" name="expectedBlobSha" value={concurrency.expectedBlobSha} />
    {/if}
    <button type="submit">Preview</button>
    <button type="submit" formaction="?/save">Save draft</button>
  </form>

  {#if save?.kind === 'saved'}
    <section aria-labelledby="save-result-heading">
      <h3 id="save-result-heading">Draft saved</h3>
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
  {:else if save?.kind === 'save_conflict'}
    <section aria-labelledby="save-conflict-heading">
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
    </section>
  {:else if save?.kind === 'save_rejected'}
    <section aria-labelledby="save-rejected-heading">
      <h3 id="save-rejected-heading">Save could not read this form</h3>
      <ul>
        {#each save.compileIssues as issue, index (index)}
          <li>
            {issue.code}: {issue.message} ({issue.sourcePath}:{issue.line ?? 1}:{issue.column ??
              1})
          </li>
        {/each}
      </ul>
    </section>
  {:else if save?.kind === 'save_failed'}
    <section aria-labelledby="save-failed-heading">
      <h3 id="save-failed-heading">Save failed</h3>
      {#if save.reason === 'topology'}
        <p>
          This article's Draft PR is not in the state Studio expects (more than one open pull
          request, or it is no longer a draft). Check <code
            >studio/article/{metadata.slug}</code
          > on GitHub directly before retrying.
        </p>
      {:else if save.concurrency}
        <p>
          Your draft was committed to <code>studio/article/{metadata.slug}</code>, but opening the
          pull request failed. Save again to retry; it will not create a duplicate branch or
          commit.
        </p>
      {:else}
        <p>GitHub could not be reached. Nothing was changed; try again.</p>
      {/if}
    </section>
  {/if}

  {#if preview?.kind === 'preview_issues'}
    <section aria-labelledby="preview-issues-heading">
      <h3 id="preview-issues-heading">Preview needs attention</h3>
      <ul>
        {#each preview.compileIssues as issue, index (index)}
          <li>
            {issue.code}: {issue.message} ({issue.sourcePath}:{issue.line ?? 1}:{issue.column ?? 1})
          </li>
        {/each}
      </ul>
    </section>
  {:else if preview?.kind === 'preview_ok'}
    <section aria-labelledby="preview-heading">
      <h3 id="preview-heading">Preview</h3>
      <ArticleRenderer document={preview.document} />
    </section>
  {/if}
</section>
