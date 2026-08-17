<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';

  type Variant = 'A' | 'B' | 'C';
  type ScenarioKey =
    'new' | 'dirty' | 'invalid' | 'ready' | 'conflict' | 'checking' | 'failed' | 'live';

  interface Scenario {
    label: string;
    eyebrow: string;
    summary: string;
    nextAction: string;
    publishedLabel: string;
    publishedDetail: string;
    changeLabel: string;
    changeDetail: string;
    tone: 'neutral' | 'attention' | 'danger' | 'success';
    saved: boolean;
    publishable: boolean;
    showDanger: boolean;
    validation: string[];
    evidence: Array<[string, string]>;
  }

  // PROTOTYPE — three variants of the Studio article workspace, switchable via
  // ?variant=A|B|C and exercised with fixture states via ?state=.
  const variants: Array<{ key: Variant; name: string }> = [
    { key: 'A', name: 'Writing room' },
    { key: 'B', name: 'Editorial desk' },
    { key: 'C', name: 'Focused canvas' },
  ];

  const scenarios: Record<ScenarioKey, Scenario> = {
    new: {
      label: 'New article',
      eyebrow: 'Not saved yet',
      summary: 'Your work exists only in this form. Readers see no change.',
      nextAction: 'Save the first Studio draft.',
      publishedLabel: 'Not published',
      publishedDetail: 'There is no canonical public article yet.',
      changeLabel: 'Not saved yet',
      changeDetail: 'No Studio branch or Draft PR exists.',
      tone: 'attention',
      saved: false,
      publishable: false,
      showDanger: false,
      validation: [],
      evidence: [['Loaded main', '546a08c…']],
    },
    dirty: {
      label: 'Unsaved edits',
      eyebrow: 'Latest edits not saved',
      summary:
        'The previous draft is safe. These form changes exist only here. Readers see no change.',
      nextAction: 'Save draft before publishing.',
      publishedLabel: 'Live and verified',
      publishedDetail: 'Readers still see the previously published version.',
      changeLabel: 'Unsaved edits',
      changeDetail: 'Draft PR #87 is safe; this form is newer than its committed head.',
      tone: 'attention',
      saved: true,
      publishable: false,
      showDanger: true,
      validation: [],
      evidence: [
        ['Draft PR', '#87'],
        ['Saved head', '6d2bc91…'],
        ['Expected blob', 'af18e54…'],
      ],
    },
    invalid: {
      label: 'Saved with issues',
      eyebrow: 'Saved — needs fixes',
      summary: 'Your draft is saved. The published version is unchanged. Publish is blocked.',
      nextAction: 'Fix the first validation issue and save again.',
      publishedLabel: 'Live and verified',
      publishedDetail: 'Readers still see the current published version.',
      changeLabel: 'Saved — needs fixes',
      changeDetail: 'Draft PR #87 is preserved and cannot merge as-is.',
      tone: 'danger',
      saved: true,
      publishable: false,
      showDanger: true,
      validation: [
        'Line 9: Cover alt text is required. Describe the image for readers who cannot see it.',
        'Line 24: The reference URL needs an https:// scheme.',
      ],
      evidence: [
        ['Draft PR', '#87'],
        ['Saved head', '70d184e…'],
        ['Validation', '2 compiler issues'],
      ],
    },
    ready: {
      label: 'Saved and ready',
      eyebrow: 'Ready to publish',
      summary: 'The draft is saved and valid. Readers still see the current published version.',
      nextAction: 'Publish this exact saved version.',
      publishedLabel: 'Live and verified',
      publishedDetail: 'Readers still see the previously verified version.',
      changeLabel: 'Ready to publish',
      changeDetail: 'Draft PR #87 is valid at saved head 9a821cf….',
      tone: 'success',
      saved: true,
      publishable: true,
      showDanger: true,
      validation: [],
      evidence: [
        ['Draft PR', '#87'],
        ['Saved head', '9a821cf…'],
        ['Validation', 'Passed'],
      ],
    },
    conflict: {
      label: 'Changes need review',
      eyebrow: 'Changes need review',
      summary: 'Your submitted candidate is preserved. GitHub moved; readers see no change.',
      nextAction: 'Review the comparison before replacing the stale Studio draft.',
      publishedLabel: 'Live and verified',
      publishedDetail: 'The published article is unchanged.',
      changeLabel: 'Changes need review',
      changeDetail: 'Loaded evidence no longer matches fresh GitHub evidence.',
      tone: 'danger',
      saved: true,
      publishable: false,
      showDanger: true,
      validation: [],
      evidence: [
        ['Loaded main', '546a08c…'],
        ['Current main', '72b93de…'],
        ['Loaded draft', '6d2bc91…'],
        ['Current draft', '8e093fc…'],
      ],
    },
    checking: {
      label: 'Checks running',
      eyebrow: 'Checks running',
      summary:
        'This exact saved version is approved and safe. Readers still see the current version.',
      nextAction: 'Check status after the required verify check finishes.',
      publishedLabel: 'Live and verified',
      publishedDetail: 'Readers still see the previously verified version.',
      changeLabel: 'Checks running',
      changeDetail: 'Draft PR #87 is approved for exact head c0f48b7….',
      tone: 'neutral',
      saved: true,
      publishable: false,
      showDanger: true,
      validation: [],
      evidence: [
        ['Draft PR', '#87'],
        ['Approved head', 'c0f48b7…'],
        ['Required check', 'verify — in progress'],
      ],
    },
    failed: {
      label: 'Checks failed',
      eyebrow: 'Checks failed',
      summary: 'The draft is preserved and the published version is unchanged.',
      nextAction: 'Open the failed verify check.',
      publishedLabel: 'Live and verified',
      publishedDetail: 'Readers still see the previously verified version.',
      changeLabel: 'Checks failed',
      changeDetail: 'Draft PR #87 remains open. Auto-merge cannot proceed.',
      tone: 'danger',
      saved: true,
      publishable: false,
      showDanger: true,
      validation: ['Required check “verify” failed. Open the check for the actionable failure.'],
      evidence: [
        ['Draft PR', '#87'],
        ['Approved head', 'c0f48b7…'],
        ['Required check', 'verify — failed'],
      ],
    },
    live: {
      label: 'Live article',
      eyebrow: 'Live and verified',
      summary:
        'The public article and index match the canonical version. No changes are in progress.',
      nextAction: 'Start a new edit only when another change is needed.',
      publishedLabel: 'Live and verified',
      publishedDetail: 'Public article fingerprint and index metadata match.',
      changeLabel: 'No changes in progress',
      changeDetail: 'There is no open Studio draft.',
      tone: 'success',
      saved: true,
      publishable: false,
      showDanger: true,
      validation: [],
      evidence: [
        ['Main', 'fd92ab4…'],
        ['Content version', '31ee63c…'],
        ['Checked', '17 Aug 2026, 21:46'],
      ],
    },
  };

  const variant = $derived(parseVariant(page.url.searchParams.get('variant')));
  const scenarioKey = $derived(parseScenario(page.url.searchParams.get('state')));
  const scenario = $derived(scenarios[scenarioKey]);
  const variantIndex = $derived(variants.findIndex((item) => item.key === variant));

  const initialTitle = 'How islands teach us to notice time';
  const initialExcerpt =
    'A field note on attention, distance, and the rhythms that shape remote places.';
  const initialBody =
    '## A slower measure\n\nOn an island, distance is not counted only in kilometres. It is counted in weather windows, supply ships, and the patience to wait.\n\n:::fact\nThe same crossing can feel entirely different depending on the season.\n:::';
  let title = $state(initialTitle);
  let excerpt = $state(initialExcerpt);
  let body = $state(initialBody);
  let previewedAt = $state('Not refreshed in this session');
  let previewTitle = $state(initialTitle);
  let previewExcerpt = $state(initialExcerpt);
  let previewBody = $state(initialBody);
  const previewHeading = $derived(previewBody.match(/^##\s+(.+)$/m)?.[1] ?? 'Article preview');
  const previewParagraphs = $derived(
    previewBody
      .split(/\n\s*\n/)
      .filter((part) => !part.startsWith('## ') && !part.startsWith(':::')),
  );
  let statusMessage = $state('');
  let dangerKind = $state<'discard' | 'unpublish'>('discard');
  let confirmation = $state('');
  let dialog: HTMLDialogElement;
  let cancelButton: HTMLButtonElement;
  let dangerOpener: HTMLElement | null = null;

  function parseVariant(value: string | null): Variant {
    return value === 'B' || value === 'C' ? value : 'A';
  }

  function parseScenario(value: string | null): ScenarioKey {
    return value !== null && value in scenarios ? (value as ScenarioKey) : 'dirty';
  }

  function updateQuery(next: { variant?: Variant; state?: ScenarioKey }): void {
    const url = new URL(page.url);
    if (next.variant !== undefined) url.searchParams.set('variant', next.variant);
    if (next.state !== undefined) url.searchParams.set('state', next.state);
    void goto(`${url.pathname}${url.search}`, {
      keepFocus: true,
      noScroll: true,
      replaceState: true,
    });
  }

  function cycleVariant(direction: -1 | 1): void {
    const next = (variantIndex + direction + variants.length) % variants.length;
    updateQuery({ variant: variants[next]?.key ?? 'A' });
  }

  function handleGlobalKeys(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (event.target !== document.body) return;
    event.preventDefault();
    cycleVariant(event.key === 'ArrowLeft' ? -1 : 1);
  }

  function refreshPreview(): void {
    previewTitle = title;
    previewExcerpt = excerpt;
    previewBody = body;
    previewedAt = new Intl.DateTimeFormat('en', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date());
    statusMessage = 'Preview refreshed from the current unsaved form. Nothing was saved.';
  }

  function simulateAction(action: string): void {
    statusMessage = `${action} is a prototype action. No repository or public state changed.`;
  }

  function openDanger(kind: 'discard' | 'unpublish', event: MouseEvent): void {
    dangerKind = kind;
    confirmation = '';
    dangerOpener = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    dialog.showModal();
    queueMicrotask(() => cancelButton.focus());
  }

  function closeDanger(): void {
    dialog.close();
  }

  function confirmDanger(event: SubmitEvent): void {
    if (confirmation !== 'island-time') {
      event.preventDefault();
      return;
    }
    simulateAction(dangerKind === 'discard' ? 'Discard draft' : 'Unpublish');
  }

  function publishReason(): string {
    if (scenarioKey === 'dirty') return 'Save the current form before publishing.';
    if (scenarioKey === 'invalid') return 'Fix validation issues and save again before publishing.';
    return 'Publish is available only for a valid, saved Studio draft.';
  }

  function restoreDangerFocus(): void {
    dangerOpener?.focus();
  }
</script>

<svelte:head>
  <title>Prototype — Studio editor and status workspace</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<svelte:window onkeydown={handleGlobalKeys} />

<div class="prototype-shell" data-tone={scenario.tone}>
  <header class="prototype-header">
    <a href="/studio" class="brand">Jelementi <strong>Studio</strong></a>
    <div class="article-identity">
      <span>Editing</span>
      <strong>{title}</strong>
    </div>
    <div class="axis-pills" aria-label="Article lifecycle summary">
      <span><small>Published:</small> {scenario.publishedLabel}</span>
      <span><small>Working change:</small> {scenario.changeLabel}</span>
    </div>
  </header>

  <section class="prototype-note" aria-label="Prototype instructions">
    <strong>Throwaway prototype.</strong> Change the scenario to inspect meaningful states. Buttons
    simulate feedback only; no GitHub or public action runs.
    <label>
      Scenario
      <select
        name="prototypeScenario"
        value={scenarioKey}
        onchange={(event) => updateQuery({ state: event.currentTarget.value as ScenarioKey })}
      >
        {#each Object.entries(scenarios) as [key, item] (key)}
          <option value={key}>{item.label}</option>
        {/each}
      </select>
    </label>
  </section>

  <p class="sr-status" role="status" aria-live="polite">{statusMessage}</p>

  {#snippet essentials(compact = false)}
    <section class:compact class="panel metadata-panel" aria-labelledby={`metadata-${variant}`}>
      <div class="section-heading">
        <div>
          <p class="kicker">Article setup</p>
          <h2 id={`metadata-${variant}`}>Essentials</h2>
        </div>
        <span>Required to understand the article</span>
      </div>
      <div class="field-grid">
        <label class="field field-wide">Title<input name="title" bind:value={title} /></label>
        <label class="field">Slug<input name="slug" value="island-time" readonly /></label>
        <label class="field"
          >Status<select name="status"><option>Published</option><option>Draft</option></select
          ></label
        >
        <label class="field field-wide"
          >Excerpt<textarea name="excerpt" rows="2" bind:value={excerpt}></textarea></label
        >
      </div>
      <details open={scenarioKey === 'invalid'}>
        <summary>More metadata <span>Dates, category, media, sources</span></summary>
        <div class="field-grid metadata-more">
          <label class="field">Category<input name="category" value="Places" /></label>
          <label class="field">Updated date<input name="updatedAt" value="2026-08-17" /></label>
          <label class="field field-wide"
            >Cover media key<input
              name="coverSrc"
              value="articles/island-time/harbour-v1.webp"
            /></label
          >
          <label class="field field-wide"
            >Cover alt text<input
              id="cover-alt-field"
              name="coverAlt"
              value="A small harbour seen through sea mist"
            /></label
          >
        </div>
      </details>
    </section>
  {/snippet}

  {#snippet editor()}
    <section class="panel editor-panel" aria-labelledby={`body-${variant}`}>
      <div class="section-heading">
        <div>
          <p class="kicker">Writing</p>
          <h2 id={`body-${variant}`}>Markdown body</h2>
        </div>
        <span>No autosave</span>
      </div>
      <textarea id="body-editor" name="body" class="body-editor" bind:value={body} spellcheck="true"
      ></textarea>
      <p class="field-help">
        Unsaved text stays in this form. Save draft is the only commit action.
      </p>
    </section>
  {/snippet}

  {#snippet preview()}
    <section class="panel preview-panel" aria-labelledby={`preview-${variant}`}>
      <div class="section-heading preview-heading">
        <div>
          <p class="kicker">Reader view</p>
          <h2 id={`preview-${variant}`}>Explicit preview</h2>
        </div>
        <button class="button subtle" type="button" onclick={refreshPreview}>Refresh preview</button
        >
      </div>
      <p class="preview-time">Current form · {previewedAt} · never saved by preview</p>
      <article class="article-preview">
        <p class="preview-category">Places</p>
        <h3>{previewTitle}</h3>
        <p class="preview-excerpt">{previewExcerpt}</p>
        <h4>{previewHeading}</h4>
        {#each previewParagraphs as paragraph, index (`${index}-${paragraph}`)}
          <p>{paragraph}</p>
        {/each}
      </article>
    </section>
  {/snippet}

  {#snippet validation()}
    {#if scenario.validation.length > 0}
      <section class="validation" aria-labelledby={`validation-${variant}`}>
        <p class="kicker">Actionable validation</p>
        <h3 id={`validation-${variant}`}>
          {scenario.validation.length} issue{scenario.validation.length === 1 ? '' : 's'} need attention
        </h3>
        <ol>
          {#each scenario.validation as issue, index (issue)}
            <li>
              <a
                href={scenarioKey === 'failed'
                  ? '#check-status-action'
                  : index === 0
                    ? '#cover-alt-field'
                    : '#body-editor'}>{issue}</a
              >
            </li>
          {/each}
        </ol>
      </section>
    {/if}
  {/snippet}

  {#snippet status(showActions = true)}
    <aside class="status-panel" aria-labelledby={`status-${variant}`}>
      <p class="kicker">What happens next</p>
      <h2 id={`status-${variant}`}>{scenario.eyebrow}</h2>
      <p class="status-summary">{scenario.summary}</p>
      <div class="next-action"><span>Recommended</span><strong>{scenario.nextAction}</strong></div>

      <div class="axis-cards">
        <section>
          <span class="axis-number">1</span>
          <div>
            <small>Published version</small><strong>{scenario.publishedLabel}</strong>
            <p>{scenario.publishedDetail}</p>
          </div>
        </section>
        <section>
          <span class="axis-number">2</span>
          <div>
            <small>Working change</small><strong>{scenario.changeLabel}</strong>
            <p>{scenario.changeDetail}</p>
          </div>
        </section>
      </div>

      {#if showActions}
        <div class="primary-actions" aria-label="Article actions">
          <button type="button" class="button subtle" onclick={refreshPreview}>Preview</button>
          <button type="button" class="button save" onclick={() => simulateAction('Save draft')}
            >Save draft</button
          >
          <button
            type="button"
            class="button publish"
            disabled={!scenario.publishable}
            aria-describedby={!scenario.publishable ? `publish-reason-${variant}` : undefined}
            onclick={() => simulateAction('Publish saved version')}>Publish saved version</button
          >
        </div>
        {#if !scenario.publishable}
          <p class="publish-reason" id={`publish-reason-${variant}`}>{publishReason()}</p>
        {/if}
      {/if}

      {#if scenarioKey === 'checking' || scenarioKey === 'failed'}
        <button
          id="check-status-action"
          class="button check"
          type="button"
          onclick={() => simulateAction('Check status')}>Check status</button
        >
      {/if}
      {#if scenarioKey === 'conflict'}
        <button
          class="button recovery"
          type="button"
          onclick={() => simulateAction('Replace stale Studio draft')}
          >Review and replace stale draft</button
        >
      {/if}

      {#if scenario.validation.length > 0}{@render validation()}{/if}

      <details class="evidence">
        <summary>Evidence <span>Technical details on demand</span></summary>
        <dl>
          {#each scenario.evidence as row (row[0])}
            <div>
              <dt>{row[0]}</dt>
              <dd><code>{row[1]}</code></dd>
            </div>
          {/each}
        </dl>
      </details>

      {#if scenario.showDanger}
        <details class="danger-zone">
          <summary>Danger zone</summary>
          <p>
            These actions are separate from ordinary writing and always re-check fresh server
            evidence.
          </p>
          {#if scenarioKey === 'live'}
            <button
              type="button"
              class="danger-link"
              onclick={(event) => openDanger('unpublish', event)}>Unpublish article…</button
            >
          {:else}
            <button
              type="button"
              class="danger-link"
              onclick={(event) => openDanger('discard', event)}>Discard Studio draft…</button
            >
          {/if}
        </details>
      {/if}
    </aside>
  {/snippet}

  {#snippet actionStrip()}
    <div class="action-strip" aria-label="Article actions">
      <div>
        <span>{scenario.eyebrow}</span><strong>{scenario.nextAction}</strong>
        {#if !scenario.publishable}<small id="publish-reason-C">{publishReason()}</small>{/if}
      </div>
      {#if scenarioKey === 'checking' || scenarioKey === 'failed'}
        <button type="button" class="button check" onclick={() => simulateAction('Check status')}
          >Check status</button
        >
      {:else if scenarioKey === 'conflict'}
        <button
          type="button"
          class="button recovery"
          onclick={() => simulateAction('Replace stale Studio draft')}>Review recovery</button
        >
      {/if}
      <button type="button" class="button subtle" onclick={refreshPreview}>Preview</button>
      <button type="button" class="button save" onclick={() => simulateAction('Save draft')}
        >Save draft</button
      >
      <button
        type="button"
        class="button publish"
        disabled={!scenario.publishable}
        aria-describedby={!scenario.publishable ? 'publish-reason-C' : undefined}
        onclick={() => simulateAction('Publish saved version')}>Publish saved version</button
      >
    </div>
  {/snippet}

  {#if variant === 'A'}
    <main class="variant-a">
      <div class="writing-column">
        {@render essentials()}
        <div class="editor-preview-split">{@render editor()}{@render preview()}</div>
      </div>
      <div class="sticky-rail">{@render status()}</div>
    </main>
  {:else if variant === 'B'}
    <main class="variant-b">
      <section class="desk-heading">
        <p class="kicker">Editorial desk</p>
        <h1>Write, inspect, decide</h1>
        <p>
          Three persistent panes make the boundaries between form, preview, and publication
          unmistakable.
        </p>
      </section>
      <div class="three-pane-desk">
        <div class="desk-editor">{@render essentials(true)}{@render editor()}</div>
        <div class="desk-preview">{@render preview()}</div>
        <div class="desk-status">{@render status()}</div>
      </div>
    </main>
  {:else}
    <main class="variant-c">
      <section class="focus-heading">
        <p class="kicker">Focused canvas</p>
        <h1>{title}</h1>
        <p>
          Writing stays quiet. Lifecycle facts remain visible above the action dock and expand when
          needed.
        </p>
      </section>
      <div class="focus-canvas">
        {@render essentials(true)}{@render editor()}{@render preview()}
      </div>
      <details class="focus-status" open={scenario.tone === 'danger' || scenarioKey === 'checking'}>
        <summary><span>{scenario.eyebrow}</span><strong>{scenario.summary}</strong></summary>
        {@render status(false)}
      </details>
      {@render actionStrip()}
    </main>
  {/if}

  <nav class="variant-switcher" aria-label="Prototype variants">
    <button type="button" aria-label="Previous variant" onclick={() => cycleVariant(-1)}>←</button>
    <span
      ><small>Prototype variant</small><strong>{variant} — {variants[variantIndex]?.name}</strong
      ></span
    >
    <button type="button" aria-label="Next variant" onclick={() => cycleVariant(1)}>→</button>
  </nav>
</div>

<dialog bind:this={dialog} onclose={restoreDangerFocus} class="danger-dialog">
  <form method="dialog" onsubmit={confirmDanger}>
    <p class="kicker">Confirm destructive action</p>
    <h2>{dangerKind === 'discard' ? 'Discard this Studio draft?' : 'Unpublish this article?'}</h2>
    <p>
      {dangerKind === 'discard'
        ? 'This closes only Draft PR #87 and deletes only studio/article/island-time. Main and the published article stay unchanged.'
        : 'This starts an archive change. Readers may continue to see the article until public absence is verified.'}
    </p>
    <label
      >Type <code>island-time</code> to confirm<input
        name="confirmation"
        bind:value={confirmation}
        autocomplete="off"
      /></label
    >
    <div class="dialog-actions">
      <button bind:this={cancelButton} type="button" class="button subtle" onclick={closeDanger}
        >Cancel</button
      >
      <button type="submit" class="button destructive" disabled={confirmation !== 'island-time'}>
        {dangerKind === 'discard' ? 'Discard Studio draft' : 'Unpublish article'}
      </button>
    </div>
  </form>
</dialog>

<style>
  :global(.layout:has(.prototype-shell)) {
    max-width: none;
    padding: 0;
  }
  :global(.site-header:has(+ .layout .prototype-shell)) {
    display: none;
  }
  :global(body:has(.prototype-shell)) {
    background: #f3f0e9;
    color: #20231f;
  }
  :global(*:focus-visible) {
    outline: 3px solid #2563eb;
    outline-offset: 3px;
  }
  :global(button),
  :global(input),
  :global(textarea),
  :global(select) {
    font: inherit;
  }

  .prototype-shell {
    --ink: #20231f;
    --muted: #62675e;
    --paper: #fffef9;
    --soft: #ede9df;
    --line: #d9d4c8;
    --green: #215c44;
    --green-dark: #174230;
    --blue: #315e73;
    min-height: 100vh;
    background: #f3f0e9;
    color: var(--ink);
    padding-bottom: 7rem;
  }
  .prototype-header {
    min-height: 4rem;
    padding: 0.75rem clamp(1rem, 3vw, 3rem);
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 2rem;
    background: #1f2b25;
    color: #fff;
  }
  .brand {
    color: #fff;
    text-decoration: none;
    letter-spacing: 0.02em;
  }
  .brand strong {
    color: #c8e3cf;
  }
  .article-identity {
    min-width: 0;
    display: flex;
    gap: 0.75rem;
    align-items: baseline;
  }
  .article-identity span {
    color: #aebbb3;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  .article-identity strong {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .axis-pills {
    display: flex;
    gap: 0.5rem;
  }
  .axis-pills span {
    display: grid;
    padding: 0.35rem 0.65rem;
    border: 1px solid #56655c;
    border-radius: 0.45rem;
    font-size: 0.78rem;
    line-height: 1.25;
  }
  .axis-pills small {
    color: #aebbb3;
  }
  .prototype-note {
    margin: 1rem clamp(1rem, 3vw, 3rem) 0;
    padding: 0.65rem 0.8rem;
    display: flex;
    align-items: center;
    gap: 0.45rem;
    border: 1px dashed #9b8e72;
    border-radius: 0.45rem;
    background: #fff7d9;
    font-size: 0.84rem;
  }
  .prototype-note label {
    margin-left: auto;
    display: flex;
    gap: 0.5rem;
    align-items: center;
    font-weight: 700;
  }
  .prototype-note select {
    min-height: 2.25rem;
    border: 1px solid #857c69;
    border-radius: 0.35rem;
    background: #fff;
    color: var(--ink);
    padding: 0 0.55rem;
  }
  .sr-status {
    position: fixed;
    left: 1rem;
    bottom: 6.5rem;
    z-index: 20;
    max-width: 30rem;
    margin: 0;
    padding: 0.55rem 0.8rem;
    border-radius: 0.4rem;
    background: #1f2b25;
    color: #fff;
    opacity: 0;
    pointer-events: none;
  }
  .sr-status:not(:empty) {
    opacity: 1;
  }
  .panel,
  .status-panel {
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: 0.65rem;
    box-shadow: 0 12px 30px rgba(55, 48, 35, 0.07);
  }
  .panel {
    padding: 1rem;
  }
  .section-heading {
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 1rem;
    margin-bottom: 0.85rem;
    border-bottom: 1px solid var(--line);
    padding-bottom: 0.7rem;
  }
  .section-heading h2,
  .status-panel h2 {
    margin: 0.05rem 0 0;
    font:
      700 1.15rem/1.2 Georgia,
      serif;
  }
  .section-heading > span,
  .field-help,
  .preview-time {
    color: var(--muted);
    font-size: 0.78rem;
  }
  .kicker {
    margin: 0;
    color: var(--blue);
    font-weight: 800;
    font-size: 0.68rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .field-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  .field {
    display: grid;
    gap: 0.3rem;
    color: #454a43;
    font-size: 0.78rem;
    font-weight: 700;
  }
  .field-wide {
    grid-column: 1 / -1;
  }
  .field input,
  .field textarea,
  .field select,
  .danger-dialog input {
    width: 100%;
    border: 1px solid #bbb5a8;
    border-radius: 0.35rem;
    background: #fff;
    color: var(--ink);
    padding: 0.58rem 0.65rem;
    font-weight: 500;
  }
  .field input[readonly] {
    background: var(--soft);
    color: var(--muted);
  }
  details {
    margin-top: 0.85rem;
  }
  summary {
    cursor: pointer;
    font-weight: 800;
  }
  summary span {
    margin-left: 0.35rem;
    color: var(--muted);
    font-size: 0.76rem;
    font-weight: 500;
  }
  .metadata-more {
    padding-top: 0.75rem;
  }
  .body-editor {
    display: block;
    width: 100%;
    min-height: 29rem;
    resize: vertical;
    border: 1px solid #aaa395;
    border-radius: 0.35rem;
    background: #fff;
    color: #242824;
    padding: 1rem;
    font:
      0.9rem/1.65 ui-monospace,
      SFMono-Regular,
      Menlo,
      monospace;
  }
  .article-preview {
    max-width: 35rem;
    margin: 0.5rem auto;
    padding: clamp(0.75rem, 3vw, 2rem);
    color: #2a2c28;
    font-family: Georgia, serif;
  }
  .article-preview h3 {
    margin: 0.2rem 0 0.65rem;
    font-size: clamp(1.5rem, 3vw, 2.35rem);
    line-height: 1.08;
  }
  .preview-category {
    margin: 0;
    color: var(--green);
    font: 800 0.7rem/1 system-ui;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  .preview-excerpt {
    color: #5b6058;
    font-size: 1.05rem;
  }
  .article-preview h4 {
    margin: 2rem 0 0.5rem;
    font-size: 1.25rem;
  }
  .status-panel {
    padding: 1.1rem;
    border-top: 5px solid var(--blue);
  }
  [data-tone='danger'] .status-panel {
    border-top-color: #a33b32;
  }
  [data-tone='success'] .status-panel {
    border-top-color: var(--green);
  }
  .status-summary {
    margin: 0.5rem 0 1rem;
    color: #444941;
    line-height: 1.45;
  }
  .next-action {
    display: grid;
    gap: 0.18rem;
    margin-bottom: 1rem;
    padding: 0.75rem;
    border-radius: 0.4rem;
    background: #e9f1ed;
  }
  .next-action span {
    color: var(--green);
    font-size: 0.69rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .axis-cards {
    display: grid;
    gap: 0.55rem;
  }
  .axis-cards section {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.65rem;
    padding: 0.7rem;
    border: 1px solid var(--line);
    border-radius: 0.4rem;
  }
  .axis-number {
    display: grid;
    place-items: center;
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 50%;
    background: #dce7e0;
    color: var(--green);
    font-weight: 900;
  }
  .axis-cards small,
  .axis-cards strong {
    display: block;
  }
  .axis-cards small {
    color: var(--muted);
  }
  .axis-cards p {
    margin: 0.25rem 0 0;
    color: #555b53;
    font-size: 0.79rem;
    line-height: 1.4;
  }
  .primary-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--line);
  }
  .primary-actions .publish {
    grid-column: 1 / -1;
  }
  .button {
    min-height: 2.65rem;
    border: 1px solid transparent;
    border-radius: 0.38rem;
    padding: 0.55rem 0.7rem;
    cursor: pointer;
    font-weight: 800;
  }
  .button:disabled {
    cursor: not-allowed;
    opacity: 0.52;
  }
  .subtle {
    border-color: #aaa397;
    background: #fff;
    color: #343a34;
  }
  .save {
    background: var(--green);
    color: #fff;
  }
  .publish {
    background: #162b21;
    color: #fff;
  }
  .check,
  .recovery {
    width: 100%;
    margin-top: 0.5rem;
    background: #315e73;
    color: #fff;
  }
  .publish-reason {
    margin: 0.55rem 0 0;
    color: var(--muted);
    font-size: 0.76rem;
  }
  .validation {
    margin-top: 0.8rem;
    padding: 0.75rem;
    border: 1px solid #d9a39d;
    border-radius: 0.4rem;
    background: #fff0ee;
  }
  .validation h3 {
    margin: 0.15rem 0 0.45rem;
    font-size: 0.93rem;
  }
  .validation ol {
    margin: 0;
    padding-left: 1.2rem;
  }
  .validation li {
    margin: 0.35rem 0;
    font-size: 0.78rem;
  }
  .validation a {
    color: #7d2922;
  }
  .evidence,
  .danger-zone {
    border-top: 1px solid var(--line);
    padding-top: 0.75rem;
  }
  .evidence dl {
    margin-bottom: 0;
  }
  .evidence dl div {
    display: grid;
    grid-template-columns: 7rem 1fr;
    gap: 0.5rem;
    padding: 0.25rem 0;
    font-size: 0.76rem;
  }
  .evidence dt {
    color: var(--muted);
  }
  .evidence dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
  .danger-zone {
    color: #752b25;
  }
  .danger-zone p {
    color: var(--muted);
    font-size: 0.76rem;
  }
  .danger-link {
    border: 0;
    background: transparent;
    color: #8d2f27;
    padding: 0.2rem 0;
    text-decoration: underline;
    cursor: pointer;
    font-weight: 800;
  }

  .variant-a {
    max-width: 96rem;
    margin: 0 auto;
    padding: 1rem clamp(1rem, 3vw, 3rem);
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(18rem, 23rem);
    gap: 1rem;
    align-items: start;
  }
  .writing-column {
    display: grid;
    gap: 1rem;
  }
  .editor-preview-split {
    display: grid;
    grid-template-columns: minmax(20rem, 1fr) minmax(18rem, 0.9fr);
    gap: 1rem;
    align-items: start;
  }
  .sticky-rail {
    position: sticky;
    top: 1rem;
  }

  .variant-b {
    max-width: 108rem;
    margin: 0 auto;
    padding: 1rem clamp(1rem, 2vw, 2rem);
  }
  .desk-heading {
    display: flex;
    align-items: baseline;
    gap: 1rem;
    margin: 0.5rem 0 1rem;
  }
  .desk-heading h1 {
    margin: 0;
    font:
      700 1.55rem Georgia,
      serif;
  }
  .desk-heading > p:last-child {
    margin: 0 0 0 auto;
    color: var(--muted);
    font-size: 0.84rem;
  }
  .three-pane-desk {
    display: grid;
    grid-template-columns: minmax(21rem, 1fr) minmax(21rem, 1fr) minmax(18rem, 0.72fr);
    gap: 0.75rem;
    align-items: start;
  }
  .desk-editor,
  .desk-preview {
    display: grid;
    gap: 0.75rem;
  }
  .desk-status {
    position: sticky;
    top: 0.75rem;
  }
  .variant-b .body-editor {
    min-height: 34rem;
  }
  .variant-b .article-preview {
    padding: 0.75rem;
  }

  .variant-c {
    max-width: 66rem;
    margin: 0 auto;
    padding: 2rem 1rem 8rem;
  }
  .focus-heading {
    max-width: 46rem;
    margin: 1rem auto 2rem;
    text-align: center;
  }
  .focus-heading h1 {
    margin: 0.3rem 0;
    font:
      700 clamp(2rem, 5vw, 3.4rem)/1.08 Georgia,
      serif;
  }
  .focus-heading > p:last-child {
    color: var(--muted);
  }
  .focus-canvas {
    display: grid;
    gap: 1rem;
  }
  .variant-c .body-editor {
    min-height: 36rem;
    border: 0;
    padding: 1.5rem;
    font-family: Georgia, serif;
    font-size: 1.05rem;
  }
  .focus-status {
    margin: 1rem 0;
    border: 1px solid var(--line);
    border-radius: 0.6rem;
    background: #fffef9;
    padding: 0.9rem;
  }
  .focus-status > summary {
    display: grid;
    gap: 0.2rem;
  }
  .focus-status > summary span {
    margin: 0;
    color: var(--blue);
    font-weight: 800;
  }
  .focus-status .status-panel {
    margin-top: 0.9rem;
    box-shadow: none;
  }
  .action-strip {
    position: fixed;
    z-index: 15;
    left: 50%;
    bottom: 4.8rem;
    transform: translateX(-50%);
    width: min(62rem, calc(100vw - 2rem));
    display: grid;
    grid-template-columns: minmax(12rem, 1fr) repeat(4, auto);
    gap: 0.5rem;
    align-items: center;
    padding: 0.65rem;
    border: 1px solid #68756d;
    border-radius: 0.7rem;
    background: #1f2b25;
    color: #fff;
    box-shadow: 0 15px 40px rgba(0, 0, 0, 0.24);
  }
  .action-strip > div {
    display: grid;
    line-height: 1.3;
  }
  .action-strip > div span {
    color: #b7c8bd;
    font-size: 0.7rem;
    text-transform: uppercase;
  }

  .variant-switcher {
    position: fixed;
    z-index: 30;
    left: 50%;
    bottom: 0.8rem;
    transform: translateX(-50%);
    display: grid;
    grid-template-columns: auto minmax(12rem, 1fr) auto;
    align-items: center;
    min-width: 20rem;
    border: 2px solid #fff;
    border-radius: 999px;
    overflow: hidden;
    background: #111714;
    color: #fff;
    box-shadow: 0 10px 35px rgba(0, 0, 0, 0.35);
  }
  .variant-switcher button {
    width: 3rem;
    height: 3rem;
    border: 0;
    background: #2c3a33;
    color: #fff;
    cursor: pointer;
    font-size: 1.25rem;
  }
  .variant-switcher span {
    display: grid;
    padding: 0.2rem 0.9rem;
    text-align: center;
    line-height: 1.25;
  }
  .variant-switcher small {
    color: #aebbb3;
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.09em;
  }
  .danger-dialog {
    width: min(32rem, calc(100vw - 2rem));
    border: 1px solid #8e342b;
    border-radius: 0.65rem;
    padding: 0;
    color: var(--ink);
  }
  .danger-dialog::backdrop {
    background: rgba(20, 25, 22, 0.72);
  }
  .danger-dialog form {
    padding: 1.25rem;
  }
  .danger-dialog h2 {
    font-family: Georgia, serif;
  }
  .danger-dialog label {
    display: grid;
    gap: 0.35rem;
    margin: 1rem 0;
    font-weight: 800;
  }
  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  .destructive {
    background: #8d2f27;
    color: #fff;
  }

  @media (max-width: 1120px) {
    .variant-a {
      grid-template-columns: 1fr;
    }
    .sticky-rail {
      position: static;
    }
    .three-pane-desk {
      grid-template-columns: 1fr 1fr;
    }
    .desk-status {
      position: static;
      grid-column: 1 / -1;
    }
  }
  @media (max-width: 760px) {
    .prototype-header {
      grid-template-columns: 1fr auto;
      gap: 0.75rem;
    }
    .article-identity {
      display: none;
    }
    .axis-pills {
      justify-content: end;
    }
    .axis-pills span {
      max-width: 9rem;
    }
    .prototype-note {
      align-items: stretch;
      flex-direction: column;
    }
    .prototype-note label {
      margin-left: 0;
      display: grid;
    }
    .editor-preview-split,
    .three-pane-desk {
      grid-template-columns: 1fr;
    }
    .desk-status {
      grid-column: auto;
    }
    .desk-heading {
      display: block;
    }
    .desk-heading > p:last-child {
      margin-top: 0.4rem;
    }
    .action-strip {
      position: static;
      transform: none;
      width: auto;
      margin-top: 1rem;
      grid-template-columns: 1fr 1fr;
    }
    .action-strip > div,
    .action-strip .publish {
      grid-column: 1 / -1;
    }
    .variant-c {
      padding-bottom: 1rem;
    }
  }
  @media (max-width: 640px) {
    .field-grid,
    .primary-actions {
      grid-template-columns: 1fr;
    }
    .field-wide,
    .primary-actions .publish {
      grid-column: auto;
    }
  }
  @media (max-width: 400px) {
    .prototype-header {
      display: block;
    }
    .axis-pills {
      margin-top: 0.6rem;
      display: grid;
    }
    .prototype-note,
    .variant-a,
    .variant-b,
    .variant-c {
      padding-left: 0.65rem;
      padding-right: 0.65rem;
    }
    .prototype-note {
      margin-left: 0.65rem;
      margin-right: 0.65rem;
    }
    .variant-switcher {
      min-width: 0;
      width: calc(100vw - 1rem);
    }
    .dialog-actions {
      display: grid;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    * {
      scroll-behavior: auto !important;
    }
  }
  @media print {
    .variant-switcher,
    .prototype-note {
      display: none;
    }
  }
</style>
