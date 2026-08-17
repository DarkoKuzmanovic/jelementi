<script lang="ts">
  import { dev } from '$app/environment';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // Prototype Types
  type Variant = 'A' | 'B' | 'C';
  type DemoState = 'active' | 'blocked' | 'live' | 'empty';

  type ProductionAxis = 'live' | 'absent' | 'pending_deployment' | 'pending_removal';
  type ChangeAxis = 'none' | 'draft' | 'ready' | 'checking' | 'check_failed' | 'merged';

  interface ArticleEvidence {
    publicUrl?: string;
    branchName?: string;
    branchUrl?: string;
    prNumber?: number;
    prUrl?: string;
    prHeadSha?: string;
    baseMainSha?: string;
    checkName?: string;
    checkStatus?: 'success' | 'failure' | 'in_progress';
    checkUrl?: string;
    checkErrorDetails?: string;
    branchPreviewUrl?: string;
    buildUrl?: string;
    contentFingerprint?: string;
    probeTimestamp?: string;
  }

  interface StudioArticle {
    slug: string;
    title: string;
    excerpt: string;
    canonicalStatus?: 'published' | 'draft' | 'archived';
    updatedAt: string;
    production: ProductionAxis;
    change: ChangeAxis;
    statusPhrase:
      | 'Ready to publish'
      | 'Checks failed'
      | 'Live and verified'
      | 'No changes in progress'
      | 'Not published'
      | 'In progress';
    recommendedAction: string;
    actionType: 'publish' | 'edit' | 'fix_check' | 'none' | 'create';
    readerEffect: string;
    safetyStatement: string;
    evidence: ArticleEvidence;
  }

  // Reactive state using Svelte 5 runes
  let variant = $state<Variant>('A');
  let demoState = $state<DemoState>('active');

  $effect(() => {
    if (data.initialVariant) variant = data.initialVariant;
    if (data.initialState) demoState = data.initialState;
  });

  // Interactive filters and selection
  let searchQuery = $state<string>('');
  let selectedArticleSlug = $state<string>('');
  let expandedEvidenceSlugs = $state<Record<string, boolean>>({});

  // Sync state with URL without full page reload
  function updateUrl(newVariant: Variant, newState: DemoState) {
    variant = newVariant;
    demoState = newState;
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('variant', newVariant);
      url.searchParams.set('state', newState);
      window.history.replaceState({}, '', url.toString());
    }
  }

  // Mock datasets for each demo state
  const mockDatasets: Record<DemoState, StudioArticle[]> = {
    active: [
      {
        slug: 'the-250-people-at-the-end-of-the-world',
        title: 'The 250 People at the End of the World',
        excerpt:
          'A remote settlement in the South Atlantic, life on Tristan da Cunha, and the logistics of single-operator publishing.',
        canonicalStatus: 'published',
        updatedAt: '2026-08-15',
        production: 'live',
        change: 'ready',
        statusPhrase: 'Ready to publish',
        recommendedAction: 'Publish saved version',
        actionType: 'publish',
        readerEffect:
          'Readers still see the verified July 26 version. They will see no change until the saved version passes checks, merges, and is verified Live.',
        safetyStatement:
          'Your saved work is safe and ready. Publish approves only this exact saved version; unsaved form text is never merged.',
        evidence: {
          publicUrl: 'https://jelementi.quz.ma/articles/the-250-people-at-the-end-of-the-world',
          branchName: 'studio/article/the-250-people-at-the-end-of-the-world',
          branchUrl:
            'https://github.com/DarkoKuzmanovic/jelementi/tree/studio/article/the-250-people-at-the-end-of-the-world',
          prNumber: 42,
          prUrl: 'https://github.com/DarkoKuzmanovic/jelementi/pull/42',
          prHeadSha: 'c8f42d1e901a8b7c6d5e4f3a2b1c0d9e8f7a6b5c',
          baseMainSha: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
          checkName: 'verify',
          checkStatus: 'success',
          checkUrl: 'https://github.com/DarkoKuzmanovic/jelementi/actions/runs/1049281',
          branchPreviewUrl:
            'https://preview.jelementi.quz.ma/the-250-people-at-the-end-of-the-world',
          buildUrl: 'https://dash.cloudflare.com/workers/builds/jelementi-web/runs/8821',
          contentFingerprint: '9f2a81b70c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f',
          probeTimestamp: '2026-08-17T21:40:12Z',
        },
      },
      {
        slug: 'archipelago-radio-frequencies',
        title: 'Archipelago Radio Frequencies & Maritime Logs',
        excerpt:
          'High-frequency spectrum management in isolated island clusters and emergency beacon monitoring.',
        canonicalStatus: undefined,
        updatedAt: '2026-08-16',
        production: 'absent',
        change: 'draft',
        statusPhrase: 'Not published',
        recommendedAction:
          'Continue editing working copy on branch studio/article/archipelago-radio-frequencies',
        actionType: 'edit',
        readerEffect:
          'Readers receive a custom HTTP 404. Content is absent from main and the public article index.',
        safetyStatement:
          'Safety: Working copy exists exclusively on Studio branch. No public edge route is active.',
        evidence: {
          branchName: 'studio/article/archipelago-radio-frequencies',
          branchUrl:
            'https://github.com/DarkoKuzmanovic/jelementi/tree/studio/article/archipelago-radio-frequencies',
          prNumber: 44,
          prUrl: 'https://github.com/DarkoKuzmanovic/jelementi/pull/44',
          prHeadSha: 'f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0',
          baseMainSha: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
          checkName: 'verify',
          checkStatus: 'in_progress',
          checkUrl: 'https://github.com/DarkoKuzmanovic/jelementi/actions/runs/1049302',
          branchPreviewUrl: 'https://preview.jelementi.quz.ma/archipelago-radio-frequencies',
        },
      },
      {
        slug: 'weather-stations-of-the-south-atlantic',
        title: 'Weather Stations of the South Atlantic',
        excerpt:
          'Automated telemetry, weather gathering, and satellite downlinks across sub-Antarctic outposts.',
        canonicalStatus: 'published',
        updatedAt: '2026-07-10',
        production: 'live',
        change: 'none',
        statusPhrase: 'Live and verified',
        recommendedAction: 'Live and verified in production. No changes in progress.',
        actionType: 'none',
        readerEffect:
          'Readers view the verified live version. Public HTML matches content fingerprint 7e2f91a3...',
        safetyStatement:
          'Safety: Production worker binding probed and verified matching main content SHA.',
        evidence: {
          publicUrl: 'https://jelementi.quz.ma/articles/weather-stations-of-the-south-atlantic',
          baseMainSha: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
          contentFingerprint: '7e2f91a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1',
          probeTimestamp: '2026-08-17T21:44:00Z',
        },
      },
      {
        slug: 'sub-antarctic-flora-survey',
        title: 'Sub-Antarctic Flora & Moss Taxonomy',
        excerpt: 'Botanical field survey notes from South Georgia and Gough Island ecosystems.',
        canonicalStatus: 'published',
        updatedAt: '2026-08-17',
        production: 'live',
        change: 'checking',
        statusPhrase: 'In progress',
        recommendedAction: 'Awaiting GitHub verify check completion for draft PR #46',
        actionType: 'none',
        readerEffect:
          'Readers continue to view existing live version while GitHub automated verify runs on PR #46.',
        safetyStatement:
          'Safety: Merge gate active. Auto-merge remains disabled until verify check succeeds.',
        evidence: {
          publicUrl: 'https://jelementi.quz.ma/articles/sub-antarctic-flora-survey',
          branchName: 'studio/article/sub-antarctic-flora-survey',
          branchUrl:
            'https://github.com/DarkoKuzmanovic/jelementi/tree/studio/article/sub-antarctic-flora-survey',
          prNumber: 46,
          prUrl: 'https://github.com/DarkoKuzmanovic/jelementi/pull/46',
          prHeadSha: 'd4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5',
          baseMainSha: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
          checkName: 'verify',
          checkStatus: 'in_progress',
          checkUrl: 'https://github.com/DarkoKuzmanovic/jelementi/actions/runs/1049310',
          branchPreviewUrl: 'https://preview.jelementi.quz.ma/sub-antarctic-flora-survey',
        },
      },
    ],
    blocked: [
      {
        slug: 'the-250-people-at-the-end-of-the-world',
        title: 'The 250 People at the End of the World',
        excerpt:
          'A remote settlement in the South Atlantic, life on Tristan da Cunha, and single-operator publishing.',
        canonicalStatus: 'published',
        updatedAt: '2026-08-17',
        production: 'live',
        change: 'check_failed',
        statusPhrase: 'Checks failed',
        recommendedAction:
          'Investigate failed check: verify (frontmatter validation error on line 12)',
        actionType: 'fix_check',
        readerEffect:
          'Readers see untouched live version from July 26. Failed draft edit is blocked from main.',
        safetyStatement:
          'Safety: Required verify check failed. Pull request auto-merge is blocked; main branch is protected.',
        evidence: {
          publicUrl: 'https://jelementi.quz.ma/articles/the-250-people-at-the-end-of-the-world',
          branchName: 'studio/article/the-250-people-at-the-end-of-the-world',
          branchUrl:
            'https://github.com/DarkoKuzmanovic/jelementi/tree/studio/article/the-250-people-at-the-end-of-the-world',
          prNumber: 42,
          prUrl: 'https://github.com/DarkoKuzmanovic/jelementi/pull/42',
          prHeadSha: 'e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6',
          baseMainSha: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
          checkName: 'verify',
          checkStatus: 'failure',
          checkUrl: 'https://github.com/DarkoKuzmanovic/jelementi/actions/runs/1049299',
          checkErrorDetails:
            'Compiler Error: Invalid frontmatter key `updated_at`. Did you mean `updatedAt`?',
          branchPreviewUrl:
            'https://preview.jelementi.quz.ma/the-250-people-at-the-end-of-the-world',
          contentFingerprint: '9f2a81b70c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f',
          probeTimestamp: '2026-08-17T21:40:12Z',
        },
      },
      {
        slug: 'south-atlantic-whaling-logbooks',
        title: 'South Atlantic Whaling Logbooks (1840-1890)',
        excerpt: 'Historical analysis of logbook telemetry and historical sea ice boundaries.',
        canonicalStatus: 'published',
        updatedAt: '2026-08-16',
        production: 'live',
        change: 'ready',
        statusPhrase: 'Ready to publish',
        recommendedAction: 'Publish saved version',
        actionType: 'publish',
        readerEffect:
          'Readers still see the verified published version. They see no change until this saved version is verified Live.',
        safetyStatement: 'Your saved work is safe and ready to publish.',
        evidence: {
          publicUrl: 'https://jelementi.quz.ma/articles/south-atlantic-whaling-logbooks',
          branchName: 'studio/article/south-atlantic-whaling-logbooks',
          branchUrl:
            'https://github.com/DarkoKuzmanovic/jelementi/tree/studio/article/south-atlantic-whaling-logbooks',
          prNumber: 45,
          prUrl: 'https://github.com/DarkoKuzmanovic/jelementi/pull/45',
          prHeadSha: '3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c',
          baseMainSha: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
          checkName: 'verify',
          checkStatus: 'success',
          checkUrl: 'https://github.com/DarkoKuzmanovic/jelementi/actions/runs/1049305',
          branchPreviewUrl: 'https://preview.jelementi.quz.ma/south-atlantic-whaling-logbooks',
        },
      },
      {
        slug: 'weather-stations-of-the-south-atlantic',
        title: 'Weather Stations of the South Atlantic',
        excerpt: 'Automated telemetry, weather gathering, and satellite downlinks.',
        canonicalStatus: 'published',
        updatedAt: '2026-07-10',
        production: 'live',
        change: 'none',
        statusPhrase: 'No changes in progress',
        recommendedAction: 'Live and verified in production. No action required.',
        actionType: 'none',
        readerEffect: 'Readers view verified production content.',
        safetyStatement: 'Safety: Verified live.',
        evidence: {
          publicUrl: 'https://jelementi.quz.ma/articles/weather-stations-of-the-south-atlantic',
          baseMainSha: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
          contentFingerprint: '7e2f91a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1',
          probeTimestamp: '2026-08-17T21:44:00Z',
        },
      },
    ],
    live: [
      {
        slug: 'the-250-people-at-the-end-of-the-world',
        title: 'The 250 People at the End of the World',
        excerpt: 'A remote settlement in the South Atlantic, life on Tristan da Cunha.',
        canonicalStatus: 'published',
        updatedAt: '2026-08-15',
        production: 'live',
        change: 'none',
        statusPhrase: 'Live and verified',
        recommendedAction: 'Live in production. Click edit to open a fresh Studio draft branch.',
        actionType: 'edit',
        readerEffect:
          'Readers view verified canonical content on main. Public index metadata matches live worker probe.',
        safetyStatement:
          'Safety: 0 pending draft branches. Edge probe verified at 2026-08-17 21:45:00 UTC.',
        evidence: {
          publicUrl: 'https://jelementi.quz.ma/articles/the-250-people-at-the-end-of-the-world',
          baseMainSha: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
          contentFingerprint: '9f2a81b70c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f',
          probeTimestamp: '2026-08-17T21:45:00Z',
        },
      },
      {
        slug: 'archipelago-radio-frequencies',
        title: 'Archipelago Radio Frequencies & Maritime Logs',
        excerpt: 'High-frequency spectrum management in isolated island clusters.',
        canonicalStatus: 'published',
        updatedAt: '2026-08-14',
        production: 'live',
        change: 'none',
        statusPhrase: 'Live and verified',
        recommendedAction: 'Live in production. No changes in progress.',
        actionType: 'none',
        readerEffect: 'Readers view verified canonical content on main.',
        safetyStatement: 'Safety: Fingerprint matched with worker probe.',
        evidence: {
          publicUrl: 'https://jelementi.quz.ma/articles/archipelago-radio-frequencies',
          baseMainSha: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
          contentFingerprint: 'f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0123456789abcdef012345678',
          probeTimestamp: '2026-08-17T21:45:00Z',
        },
      },
      {
        slug: 'weather-stations-of-the-south-atlantic',
        title: 'Weather Stations of the South Atlantic',
        excerpt: 'Automated telemetry, weather gathering, and satellite downlinks.',
        canonicalStatus: 'published',
        updatedAt: '2026-07-10',
        production: 'live',
        change: 'none',
        statusPhrase: 'Live and verified',
        recommendedAction: 'Live in production. No changes in progress.',
        actionType: 'none',
        readerEffect: 'Readers view verified canonical content on main.',
        safetyStatement: 'Safety: Edge probe verified.',
        evidence: {
          publicUrl: 'https://jelementi.quz.ma/articles/weather-stations-of-the-south-atlantic',
          baseMainSha: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
          contentFingerprint: '7e2f91a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1',
          probeTimestamp: '2026-08-17T21:45:00Z',
        },
      },
    ],
    empty: [],
  };

  // Derived state values using Svelte 5 $derived
  let currentArticles = $derived(mockDatasets[demoState]);

  let filteredArticles = $derived(
    currentArticles.filter(
      (art) =>
        searchQuery.trim() === '' ||
        art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        art.slug.toLowerCase().includes(searchQuery.toLowerCase()),
    ),
  );

  let priorityArticle = $derived.by(() => {
    if (currentArticles.length === 0) return null;
    const failed = currentArticles.find((a) => a.change === 'check_failed');
    if (failed) return failed;
    const ready = currentArticles.find((a) => a.change === 'ready');
    if (ready) return ready;
    const draft = currentArticles.find((a) => a.change === 'draft');
    if (draft) return draft;
    return currentArticles[0];
  });

  let selectedArticle = $derived.by(() => {
    if (!selectedArticleSlug && currentArticles.length > 0) {
      return priorityArticle ?? currentArticles[0];
    }
    return (
      currentArticles.find((a) => a.slug === selectedArticleSlug) ??
      priorityArticle ??
      currentArticles[0] ??
      null
    );
  });

  let activeDraftsCount = $derived(
    currentArticles.filter(
      (a) => a.change === 'draft' || a.change === 'ready' || a.change === 'checking',
    ).length,
  );
  let failedChecksCount = $derived(
    currentArticles.filter((a) => a.change === 'check_failed').length,
  );
  let liveVerifiedCount = $derived(
    currentArticles.filter((a) => a.production === 'live' && a.change === 'none').length,
  );

  let resumeArticles = $derived(
    filteredArticles.filter(
      (article) =>
        article.change === 'draft' ||
        article.change === 'checking' ||
        article.change === 'check_failed',
    ),
  );
  let decisionArticles = $derived(
    filteredArticles.filter(
      (article) =>
        article.change === 'ready' ||
        article.change === 'merged' ||
        article.production === 'pending_deployment',
    ),
  );
  let libraryArticles = $derived(
    filteredArticles.filter(
      (article) => article.change === 'none' && article.production !== 'pending_deployment',
    ),
  );

  function publishedVersionLabel(production: ProductionAxis) {
    if (production === 'live') return 'Live and verified';
    if (production === 'pending_deployment') return 'Updating the site';
    if (production === 'pending_removal') return 'Removing from the site';
    return 'Not published';
  }

  function workingChangeLabel(change: ChangeAxis) {
    if (change === 'draft') return 'Saved draft';
    if (change === 'ready') return 'Ready to publish';
    if (change === 'checking') return 'Checks running';
    if (change === 'check_failed') return 'Checks failed';
    if (change === 'merged') return 'Merged — site update pending';
    return 'No changes in progress';
  }

  function toggleEvidence(slug: string) {
    expandedEvidenceSlugs = {
      ...expandedEvidenceSlugs,
      [slug]: !expandedEvidenceSlugs[slug],
    };
  }

  function handleSelectArticle(slug: string) {
    selectedArticleSlug = slug;
  }

  function cycleVariant(direction: -1 | 1) {
    const next: Variant =
      direction === 1
        ? variant === 'A'
          ? 'B'
          : variant === 'B'
            ? 'C'
            : 'A'
        : variant === 'A'
          ? 'C'
          : variant === 'B'
            ? 'A'
            : 'B';
    updateUrl(next, demoState);
  }

  function handlePrototypeKeys(event: KeyboardEvent) {
    if (!dev) return;
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      return;
    }

    if (event.key === 'ArrowLeft') cycleVariant(-1);
    if (event.key === 'ArrowRight') cycleVariant(1);
  }
</script>

<svelte:window onkeydown={handlePrototypeKeys} />

<svelte:head>
  <title>Studio Home Prototype ({variant}) — Jelementi</title>
</svelte:head>

<div class="prototype-wrapper">
  <!-- PROTOTYPE Banner Header -->
  <header class="prototype-header">
    <div class="header-inner">
      <div class="header-branding">
        <span class="prototype-pill" aria-label="Prototype environment notice">PROTOTYPE</span>
        <div>
          <h1 class="header-title">Studio Home</h1>
          <p class="header-sub">Resume publishing work with the reader outcome always clear</p>
        </div>
      </div>

      <div class="header-actions">
        <span class="operator-badge">Operator: <code>darko@example.com</code></span>
        <a href="/studio/articles/new" class="btn btn-primary">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          New article
        </a>
      </div>
    </div>
  </header>

  <!-- Summary Ticker / Metrics bar -->
  <section class="metrics-bar" aria-label="Workspace metrics summary">
    <div class="metric-item">
      <span class="metric-label">Active Drafts</span>
      <span class="metric-value">{activeDraftsCount}</span>
    </div>
    <div class="metric-divider" aria-hidden="true"></div>
    <div class="metric-item">
      <span class="metric-label">Checks Failed</span>
      <span class="metric-value {failedChecksCount > 0 ? 'text-error' : ''}"
        >{failedChecksCount}</span
      >
    </div>
    <div class="metric-divider" aria-hidden="true"></div>
    <div class="metric-item">
      <span class="metric-label">Live &amp; Verified</span>
      <span class="metric-value text-success">{liveVerifiedCount}</span>
    </div>
    <div class="metric-divider" aria-hidden="true"></div>
    <div class="metric-item flex-grow">
      <span class="metric-label">Active Structure</span>
      <span class="metric-value text-accent"
        >Variant {variant}: {variant === 'A'
          ? 'Action Hub'
          : variant === 'B'
            ? 'Flowboard'
            : 'Inspection Deck'}</span
      >
    </div>
  </section>

  <!-- Main Body Content rendered by Variant -->
  <main id="main-content" class="main-body" tabIndex="-1">
    {#if demoState === 'empty' || currentArticles.length === 0}
      <section class="empty-workspace-card" aria-labelledby="empty-workspace-heading">
        <div class="empty-icon" aria-hidden="true">📝</div>
        <h2 id="empty-workspace-heading" class="empty-title">No articles found in workspace</h2>
        <p class="empty-desc">
          Your Studio environment has no canonical articles on <code>main</code> or active working drafts.
          Start by creating your first article to begin authoring and publishing.
        </p>
        <div class="empty-actions">
          <a href="/studio/articles/new" class="btn btn-primary btn-lg"> Create new article </a>
        </div>
      </section>
    {:else if variant === 'A'}
      <!-- ========================================== -->
      <!-- VARIANT A: Action Hub (Focused Workbench)  -->
      <!-- ========================================== -->
      <div class="variant-a-layout">
        <!-- Priority Hero Workbench -->
        {#if priorityArticle}
          <section class="hero-workbench" aria-labelledby="priority-action-heading">
            <div class="hero-workbench-header">
              <div class="hero-badge-wrap">
                <span class="badge-priority" role="status">Priority Action Recommended</span>
                <span class="hero-slug"><code>{priorityArticle.slug}</code></span>
              </div>
              <h2 id="priority-action-heading" class="hero-article-title">
                {priorityArticle.title}
              </h2>
            </div>

            <!-- Foreground One Recommended Next Action -->
            <div
              class="recommended-action-box {priorityArticle.change === 'check_failed'
                ? 'box-danger'
                : priorityArticle.change === 'ready'
                  ? 'box-publish'
                  : 'box-neutral'}"
            >
              <div class="action-box-content">
                <div class="action-box-icon" aria-hidden="true">
                  {#if priorityArticle.change === 'check_failed'}
                    ⚠️
                  {:else if priorityArticle.change === 'ready'}
                    🚀
                  {:else}
                    🖋️
                  {/if}
                </div>
                <div>
                  <p class="action-box-label">Recommended Next Action</p>
                  <p class="action-box-text">{priorityArticle.recommendedAction}</p>
                </div>
              </div>

              {#if priorityArticle.actionType === 'publish'}
                <button
                  type="button"
                  class="btn btn-publish btn-lg"
                  onclick={() =>
                    alert('PROTOTYPE: Publish action triggered for ' + priorityArticle?.slug)}
                >
                  Publish saved version
                </button>
              {:else if priorityArticle.actionType === 'fix_check'}
                <a
                  href={priorityArticle.evidence.checkUrl ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                  class="btn btn-danger btn-lg"
                >
                  Investigate check logs &rarr;
                </a>
              {:else if priorityArticle.actionType === 'edit'}
                <a href={`/studio/articles/${priorityArticle.slug}`} class="btn btn-primary btn-lg">
                  Open Studio editor
                </a>
              {/if}
            </div>

            <!-- Dual Axis Lifecycle Indicators -->
            <div class="dual-axis-panel">
              <div class="axis-item">
                <span class="axis-title">Published version</span>
                <span class="status-pill prod-{priorityArticle.production}">
                  {priorityArticle.production === 'live'
                    ? 'Live'
                    : priorityArticle.production === 'absent'
                      ? 'Absent'
                      : priorityArticle.production}
                </span>
              </div>

              <div class="axis-item">
                <span class="axis-title">Working change</span>
                <span class="status-pill change-{priorityArticle.change}">
                  {priorityArticle.statusPhrase}
                </span>
              </div>
            </div>

            <!-- Plain English Reader Effect & State Safety -->
            <div class="impact-safety-grid">
              <div class="impact-box">
                <h3 class="impact-heading">Reader Effect</h3>
                <p class="impact-text">{priorityArticle.readerEffect}</p>
              </div>
              <div class="safety-box">
                <h3 class="safety-heading">State Safety Guarantee</h3>
                <p class="safety-text">{priorityArticle.safetyStatement}</p>
              </div>
            </div>

            <!-- Progressive Disclosure of Concurrency Evidence -->
            <details class="evidence-accordion" open={expandedEvidenceSlugs[priorityArticle.slug]}>
              <summary
                class="evidence-summary"
                onclick={() => toggleEvidence(priorityArticle?.slug ?? '')}
              >
                <span>Technical Concurrency &amp; Evidence Audit</span>
                <span class="accordion-icon" aria-hidden="true">&#9660;</span>
              </summary>

              <div class="evidence-content">
                <dl class="evidence-dl">
                  {#if priorityArticle.evidence.baseMainSha}
                    <div>
                      <dt>Base <code>main</code> SHA:</dt>
                      <dd><code>{priorityArticle.evidence.baseMainSha}</code></dd>
                    </div>
                  {/if}
                  {#if priorityArticle.evidence.prHeadSha}
                    <div>
                      <dt>Draft Head SHA:</dt>
                      <dd><code>{priorityArticle.evidence.prHeadSha}</code></dd>
                    </div>
                  {/if}
                  {#if priorityArticle.evidence.branchName}
                    <div>
                      <dt>Studio Branch:</dt>
                      <dd>
                        <a
                          href={priorityArticle.evidence.branchUrl}
                          target="_blank"
                          rel="noreferrer"><code>{priorityArticle.evidence.branchName}</code></a
                        >
                      </dd>
                    </div>
                  {/if}
                  {#if priorityArticle.evidence.prNumber}
                    <div>
                      <dt>Draft PR:</dt>
                      <dd>
                        <a href={priorityArticle.evidence.prUrl} target="_blank" rel="noreferrer"
                          >PR #{priorityArticle.evidence.prNumber}</a
                        >
                      </dd>
                    </div>
                  {/if}
                  {#if priorityArticle.evidence.checkName}
                    <div>
                      <dt>Verify Check:</dt>
                      <dd>
                        <span class="check-status status-{priorityArticle.evidence.checkStatus}">
                          {priorityArticle.evidence.checkName} ({priorityArticle.evidence
                            .checkStatus})
                        </span>
                        {#if priorityArticle.evidence.checkUrl}
                          &mdash; <a
                            href={priorityArticle.evidence.checkUrl}
                            target="_blank"
                            rel="noreferrer">View check logs</a
                          >
                        {/if}
                      </dd>
                    </div>
                  {/if}
                  {#if priorityArticle.evidence.checkErrorDetails}
                    <div
                      class="col-span-full text-error font-mono text-xs bg-red-50 dark:bg-red-950 p-2 rounded border border-red-200 dark:border-red-900"
                    >
                      <dt>Failure Reason:</dt>
                      <dd>{priorityArticle.evidence.checkErrorDetails}</dd>
                    </div>
                  {/if}
                  {#if priorityArticle.evidence.contentFingerprint}
                    <div>
                      <dt>Content Fingerprint:</dt>
                      <dd><code>{priorityArticle.evidence.contentFingerprint}</code></dd>
                    </div>
                  {/if}
                  {#if priorityArticle.evidence.probeTimestamp}
                    <div>
                      <dt>Live Worker Probe:</dt>
                      <dd>{priorityArticle.evidence.probeTimestamp}</dd>
                    </div>
                  {/if}
                </dl>
              </div>
            </details>
          </section>
        {/if}

        <!-- Complete Article Library Data Table -->
        <section class="library-section" aria-labelledby="library-heading">
          <div class="library-header">
            <div>
              <h2 id="library-heading" class="library-title">All articles</h2>
              <p class="library-sub">The complete library, including work in progress</p>
            </div>

            <div class="library-filter">
              <label for="table-search" class="sr-only">Search articles</label>
              <input
                id="table-search"
                type="search"
                placeholder="Filter by title or slug..."
                class="search-input"
                bind:value={searchQuery}
              />
            </div>
          </div>

          <div class="table-container">
            <table class="article-table">
              <thead>
                <tr>
                  <th scope="col">Article / Slug</th>
                  <th scope="col">Published version</th>
                  <th scope="col">Working change</th>
                  <th scope="col">Recommended Next Action</th>
                  <th scope="col">Evidence</th>
                  <th scope="col" class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each filteredArticles as article (article.slug)}
                  <tr>
                    <td>
                      <div class="table-article-cell">
                        <a href={`/studio/articles/${article.slug}`} class="table-article-link"
                          >{article.title}</a
                        >
                        <span class="table-article-slug"><code>{article.slug}</code></span>
                      </div>
                    </td>
                    <td>
                      <span class="status-pill prod-{article.production}">
                        {article.production === 'live'
                          ? 'Live'
                          : article.production === 'absent'
                            ? 'Absent'
                            : article.production}
                      </span>
                    </td>
                    <td>
                      <span class="status-pill change-{article.change}">
                        {article.statusPhrase}
                      </span>
                    </td>
                    <td>
                      <span class="table-action-text">{article.recommendedAction}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        class="btn-text-sm"
                        onclick={() => toggleEvidence(article.slug)}
                        aria-expanded={expandedEvidenceSlugs[article.slug] ?? false}
                        aria-controls={`evidence-drawer-${article.slug}`}
                      >
                        {expandedEvidenceSlugs[article.slug] ? 'Hide details' : 'Show evidence'}
                      </button>
                    </td>
                    <td class="text-right">
                      <a href={`/studio/articles/${article.slug}`} class="btn btn-secondary btn-sm">
                        Edit
                      </a>
                    </td>
                  </tr>

                  {#if expandedEvidenceSlugs[article.slug]}
                    <tr id={`evidence-drawer-${article.slug}`} class="drawer-row">
                      <td colspan="6">
                        <div class="table-evidence-drawer">
                          <p class="drawer-title">
                            Evidence &amp; Concurrency for <code>{article.slug}</code>
                          </p>
                          <div class="drawer-grid">
                            <p><strong>Reader Impact:</strong> {article.readerEffect}</p>
                            <p><strong>State Safety:</strong> {article.safetyStatement}</p>
                            <div class="drawer-links">
                              {#if article.evidence.publicUrl}<a
                                  href={article.evidence.publicUrl}
                                  target="_blank"
                                  rel="noreferrer">Public URL</a
                                >{/if}
                              {#if article.evidence.prUrl}<a
                                  href={article.evidence.prUrl}
                                  target="_blank"
                                  rel="noreferrer">Pull Request #{article.evidence.prNumber}</a
                                >{/if}
                              {#if article.evidence.branchUrl}<a
                                  href={article.evidence.branchUrl}
                                  target="_blank"
                                  rel="noreferrer">Studio Branch</a
                                >{/if}
                              {#if article.evidence.branchPreviewUrl}<a
                                  href={article.evidence.branchPreviewUrl}
                                  target="_blank"
                                  rel="noreferrer">Branch Preview</a
                                >{/if}
                              {#if article.evidence.checkUrl}<a
                                  href={article.evidence.checkUrl}
                                  target="_blank"
                                  rel="noreferrer">Verify Check Logs</a
                                >{/if}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  {/if}
                {/each}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    {:else if variant === 'B'}
      <!-- ========================================== -->
      <!-- VARIANT B: Editorial Flowboard (Kanban)    -->
      <!-- ========================================== -->
      <section class="variant-b-layout" aria-label="Editorial workflow pipeline board">
        <div class="flowboard-toolbar">
          <div class="flowboard-search">
            <label for="flowboard-search-input" class="sr-only">Search flowboard articles</label>
            <input
              id="flowboard-search-input"
              type="search"
              placeholder="Search flowboard articles..."
              class="search-input"
              bind:value={searchQuery}
            />
          </div>
          <p class="flowboard-hint">
            All articles · {filteredArticles.length} of {currentArticles.length} shown
          </p>
        </div>

        <div class="flowboard-grid">
          <!-- Column 1: Working Drafts & In Progress -->
          <div class="flowboard-col">
            <div class="col-header col-header-working">
              <h2 class="col-title">Resume work</h2>
              <span class="col-count">{resumeArticles.length}</span>
            </div>

            <div class="col-cards">
              {#if resumeArticles.length === 0}<p class="col-empty">No work needs resuming.</p>{/if}
              {#each resumeArticles as article (article.slug)}
                <article
                  class="flowboard-card {article.change === 'check_failed'
                    ? 'card-border-danger'
                    : 'card-border-neutral'}"
                >
                  <div class="card-top">
                    <span class="card-date">Updated {article.updatedAt}</span>
                  </div>

                  <h3 class="card-title">
                    <a href={`/studio/articles/${article.slug}`}>{article.title}</a>
                  </h3>
                  <p class="card-slug"><code>{article.slug}</code></p>
                  <dl class="card-facts">
                    <div>
                      <dt>Published version</dt>
                      <dd>
                        <span class="status-pill prod-{article.production}"
                          >{publishedVersionLabel(article.production)}</span
                        >
                      </dd>
                    </div>
                    <div>
                      <dt>Working change</dt>
                      <dd>
                        <span class="status-pill change-{article.change}"
                          >{workingChangeLabel(article.change)}</span
                        >
                      </dd>
                    </div>
                  </dl>
                  <p class="card-reader"><strong>Readers:</strong> {article.readerEffect}</p>

                  <div class="card-action-box">
                    <span class="card-action-label">Recommended Action:</span>
                    <p class="card-action-val">{article.recommendedAction}</p>
                  </div>

                  <div class="card-footer">
                    {#if article.actionType === 'fix_check'}
                      <a class="btn btn-danger btn-sm" href={article.evidence.checkUrl}
                        >Open failed check</a
                      >
                    {:else if article.actionType === 'edit'}
                      <a class="btn btn-primary btn-sm" href={`/studio/articles/${article.slug}`}
                        >Continue editing</a
                      >
                    {:else if article.evidence.checkUrl}
                      <a
                        class="btn btn-secondary btn-sm"
                        href={article.evidence.checkUrl}
                        target="_blank"
                        rel="noreferrer">View check status</a
                      >
                    {:else}
                      <a class="btn btn-secondary btn-sm" href={`/studio/articles/${article.slug}`}
                        >Open draft</a
                      >
                    {/if}
                    <button
                      type="button"
                      class="btn-text-sm"
                      onclick={() => toggleEvidence(article.slug)}
                    >
                      {expandedEvidenceSlugs[article.slug] ? 'Close' : 'Evidence'}
                    </button>
                  </div>

                  {#if expandedEvidenceSlugs[article.slug]}
                    <div class="card-evidence-box">
                      <p class="text-xs text-muted mb-1">
                        <strong>Safety:</strong>
                        {article.safetyStatement}
                      </p>
                      {#if article.evidence.checkErrorDetails}
                        <p class="text-xs text-error font-mono mb-1">
                          {article.evidence.checkErrorDetails}
                        </p>
                      {/if}
                      <div class="card-links">
                        {#if article.evidence.prUrl}<a
                            href={article.evidence.prUrl}
                            target="_blank"
                            rel="noreferrer">PR #{article.evidence.prNumber}</a
                          >{/if}
                        {#if article.evidence.checkUrl}<a
                            href={article.evidence.checkUrl}
                            target="_blank"
                            rel="noreferrer">Check</a
                          >{/if}
                        {#if article.evidence.branchPreviewUrl}<a
                            href={article.evidence.branchPreviewUrl}
                            target="_blank"
                            rel="noreferrer">Preview</a
                          >{/if}
                      </div>
                    </div>
                  {/if}
                </article>
              {/each}
            </div>
          </div>

          <!-- Column 2: Action Needed & Ready to Publish -->
          <div class="flowboard-col">
            <div class="col-header col-header-ready">
              <h2 class="col-title">Ready for your decision</h2>
              <span class="col-count">{decisionArticles.length}</span>
            </div>

            <div class="col-cards">
              {#if decisionArticles.length === 0}<p class="col-empty">
                  Nothing is waiting for approval.
                </p>{/if}
              {#each decisionArticles as article (article.slug)}
                <article class="flowboard-card card-border-publish">
                  <div class="card-top">
                    <span class="card-date">Updated {article.updatedAt}</span>
                  </div>

                  <h3 class="card-title">
                    <a href={`/studio/articles/${article.slug}`}>{article.title}</a>
                  </h3>
                  <p class="card-slug"><code>{article.slug}</code></p>
                  <dl class="card-facts">
                    <div>
                      <dt>Published version</dt>
                      <dd>
                        <span class="status-pill prod-{article.production}"
                          >{publishedVersionLabel(article.production)}</span
                        >
                      </dd>
                    </div>
                    <div>
                      <dt>Working change</dt>
                      <dd>
                        <span class="status-pill change-{article.change}"
                          >{workingChangeLabel(article.change)}</span
                        >
                      </dd>
                    </div>
                  </dl>
                  <p class="card-reader"><strong>Readers:</strong> {article.readerEffect}</p>

                  <div class="card-action-box box-publish">
                    <span class="card-action-label text-publish">Recommended action:</span>
                    <p class="card-action-val">{article.recommendedAction}</p>
                  </div>

                  <div class="card-footer">
                    <button
                      type="button"
                      class="btn btn-publish btn-sm"
                      onclick={() => alert('PROTOTYPE: Publish triggered for ' + article.slug)}
                    >
                      Publish saved version
                    </button>
                    <button
                      type="button"
                      class="btn-text-sm"
                      onclick={() => toggleEvidence(article.slug)}
                    >
                      {expandedEvidenceSlugs[article.slug] ? 'Close' : 'Evidence'}
                    </button>
                  </div>

                  {#if expandedEvidenceSlugs[article.slug]}
                    <div class="card-evidence-box">
                      <p class="text-xs text-muted mb-1">
                        <strong>Safety:</strong>
                        {article.safetyStatement}
                      </p>
                      <div class="card-links">
                        {#if article.evidence.prUrl}<a
                            href={article.evidence.prUrl}
                            target="_blank"
                            rel="noreferrer">PR #{article.evidence.prNumber}</a
                          >{/if}
                        {#if article.evidence.branchPreviewUrl}<a
                            href={article.evidence.branchPreviewUrl}
                            target="_blank"
                            rel="noreferrer">Branch preview</a
                          >{/if}
                      </div>
                    </div>
                  {/if}
                </article>
              {/each}
            </div>
          </div>

          <!-- Column 3: Canonical Main & Live Library -->
          <div class="flowboard-col">
            <div class="col-header col-header-live">
              <h2 class="col-title">Library</h2>
              <span class="col-count">{libraryArticles.length}</span>
            </div>

            <div class="col-cards">
              {#if libraryArticles.length === 0}<p class="col-empty">No other articles.</p>{/if}
              {#each libraryArticles as article (article.slug)}
                <article class="flowboard-card card-border-live">
                  <div class="card-top">
                    <span class="card-date">Updated {article.updatedAt}</span>
                  </div>

                  <h3 class="card-title">
                    <a href={`/studio/articles/${article.slug}`}>{article.title}</a>
                  </h3>
                  <p class="card-slug"><code>{article.slug}</code></p>
                  <dl class="card-facts">
                    <div>
                      <dt>Published version</dt>
                      <dd>
                        <span class="status-pill prod-{article.production}"
                          >{publishedVersionLabel(article.production)}</span
                        >
                      </dd>
                    </div>
                    <div>
                      <dt>Working change</dt>
                      <dd>
                        <span class="status-pill change-{article.change}"
                          >{workingChangeLabel(article.change)}</span
                        >
                      </dd>
                    </div>
                  </dl>
                  <p class="card-reader"><strong>Readers:</strong> {article.readerEffect}</p>

                  <div class="card-footer">
                    <a href={`/studio/articles/${article.slug}`} class="btn btn-secondary btn-sm"
                      >Edit article</a
                    >
                    {#if article.evidence.publicUrl}<a
                        href={article.evidence.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        class="btn-text-sm">Public article</a
                      >{/if}
                    <button
                      type="button"
                      class="btn-text-sm"
                      onclick={() => toggleEvidence(article.slug)}
                    >
                      {expandedEvidenceSlugs[article.slug] ? 'Close' : 'Evidence'}
                    </button>
                  </div>

                  {#if expandedEvidenceSlugs[article.slug]}
                    <div class="card-evidence-box">
                      <p class="text-xs font-mono">
                        Fingerprint: {article.evidence.contentFingerprint?.slice(0, 16)}...
                      </p>
                      <p class="text-xs text-muted">Probed: {article.evidence.probeTimestamp}</p>
                    </div>
                  {/if}
                </article>
              {/each}
            </div>
          </div>
        </div>
      </section>
    {:else if variant === 'C'}
      <!-- ========================================== -->
      <!-- VARIANT C: Streamlined Feed & Inspection   -->
      <!-- ========================================== -->
      <div class="variant-c-layout">
        <!-- Left Pane: Article Stream -->
        <section class="stream-pane" aria-labelledby="stream-heading">
          <div class="stream-header">
            <h2 id="stream-heading" class="stream-title">Article Stream</h2>
            <input
              type="search"
              placeholder="Search stream..."
              class="search-input input-sm"
              bind:value={searchQuery}
            />
          </div>

          <ul class="stream-list">
            {#each filteredArticles as article (article.slug)}
              <li>
                <button
                  type="button"
                  class="stream-item {selectedArticle?.slug === article.slug
                    ? 'stream-item-selected'
                    : ''}"
                  onclick={() => handleSelectArticle(article.slug)}
                >
                  <div class="stream-item-top">
                    <h3 class="stream-item-title">{article.title}</h3>
                    <span class="status-pill change-{article.change}">{article.statusPhrase}</span>
                  </div>

                  <p class="stream-item-slug"><code>{article.slug}</code></p>
                  <p class="stream-item-action">{article.recommendedAction}</p>

                  <div class="stream-item-meta">
                    <span>Prod: {article.production}</span>
                    <span>Updated {article.updatedAt}</span>
                  </div>
                </button>
              </li>
            {/each}
          </ul>
        </section>

        <!-- Right Pane: Sticky Article Inspection Deck -->
        {#if selectedArticle}
          <aside class="inspection-deck" aria-labelledby="inspector-heading">
            <div class="deck-sticky-content">
              <div class="deck-header">
                <span class="badge-inspector">ARTICLE INSPECTION DECK</span>
                <h2 id="inspector-heading" class="deck-title">{selectedArticle.title}</h2>
                <p class="deck-slug"><code>{selectedArticle.slug}</code></p>
              </div>

              <!-- Recommended Next Action -->
              <div
                class="deck-action-banner {selectedArticle.change === 'check_failed'
                  ? 'box-danger'
                  : selectedArticle.change === 'ready'
                    ? 'box-publish'
                    : 'box-neutral'}"
              >
                <p class="deck-action-title">Recommended Action</p>
                <p class="deck-action-desc">{selectedArticle.recommendedAction}</p>

                <div class="deck-action-btns">
                  {#if selectedArticle.actionType === 'publish'}
                    <button
                      type="button"
                      class="btn btn-publish"
                      onclick={() => alert('PROTOTYPE: Published ' + selectedArticle?.slug)}
                    >
                      Publish saved version
                    </button>
                  {:else if selectedArticle.actionType === 'fix_check'}
                    <a
                      href={selectedArticle.evidence.checkUrl ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                      class="btn btn-danger"
                    >
                      View failed check logs
                    </a>
                  {:else}
                    <a href={`/studio/articles/${selectedArticle.slug}`} class="btn btn-primary">
                      Open Studio Editor
                    </a>
                  {/if}
                </div>
              </div>

              <!-- Dual Axis Matrix Inspection -->
              <div class="matrix-grid">
                <div class="matrix-card">
                  <h3 class="matrix-card-title">Published version</h3>
                  <p class="status-pill prod-{selectedArticle.production}">
                    {selectedArticle.production === 'live'
                      ? 'Live'
                      : selectedArticle.production === 'absent'
                        ? 'Absent'
                        : selectedArticle.production}
                  </p>
                  <p class="matrix-card-desc">
                    Status of article on <code>main</code> branch &amp; public edge router.
                  </p>
                </div>

                <div class="matrix-card">
                  <h3 class="matrix-card-title">Working change</h3>
                  <p class="status-pill change-{selectedArticle.change}">
                    {selectedArticle.statusPhrase}
                  </p>
                  <p class="matrix-card-desc">
                    Status of active Studio draft branch &amp; GitHub pull request.
                  </p>
                </div>
              </div>

              <!-- Reader Effect & Safety -->
              <div class="deck-audit-box">
                <div class="audit-section">
                  <h4 class="audit-heading">Public Reader Effect</h4>
                  <p class="audit-body">{selectedArticle.readerEffect}</p>
                </div>
                <div class="audit-section mt-3">
                  <h4 class="audit-heading">State Safety Guarantee</h4>
                  <p class="audit-body">{selectedArticle.safetyStatement}</p>
                </div>
              </div>

              <!-- Full Progressive Evidence Log -->
              <div class="deck-evidence-log">
                <h4 class="evidence-log-title">Progressive Evidence Audit</h4>
                <ul class="evidence-log-list font-mono text-xs">
                  {#if selectedArticle.evidence.publicUrl}
                    <li>
                      <span class="text-muted">Public Route:</span>
                      <a href={selectedArticle.evidence.publicUrl} target="_blank" rel="noreferrer"
                        >View Live Article</a
                      >
                    </li>
                  {/if}
                  {#if selectedArticle.evidence.branchName}
                    <li>
                      <span class="text-muted">Studio Branch:</span>
                      <code>{selectedArticle.evidence.branchName}</code>
                    </li>
                  {/if}
                  {#if selectedArticle.evidence.prNumber}
                    <li>
                      <span class="text-muted">Draft PR:</span>
                      <a href={selectedArticle.evidence.prUrl} target="_blank" rel="noreferrer"
                        >Pull Request #{selectedArticle.evidence.prNumber}</a
                      >
                    </li>
                  {/if}
                  {#if selectedArticle.evidence.prHeadSha}
                    <li>
                      <span class="text-muted">Head SHA:</span>
                      <code>{selectedArticle.evidence.prHeadSha.slice(0, 12)}</code>
                    </li>
                  {/if}
                  {#if selectedArticle.evidence.baseMainSha}
                    <li>
                      <span class="text-muted">Base Main SHA:</span>
                      <code>{selectedArticle.evidence.baseMainSha.slice(0, 12)}</code>
                    </li>
                  {/if}
                  {#if selectedArticle.evidence.checkName}
                    <li>
                      <span class="text-muted">Check ({selectedArticle.evidence.checkName}):</span>
                      <span class="status-{selectedArticle.evidence.checkStatus}"
                        >{selectedArticle.evidence.checkStatus}</span
                      >
                    </li>
                  {/if}
                  {#if selectedArticle.evidence.contentFingerprint}
                    <li>
                      <span class="text-muted">Content Fingerprint:</span>
                      <code>{selectedArticle.evidence.contentFingerprint.slice(0, 16)}...</code>
                    </li>
                  {/if}
                </ul>
              </div>
            </div>
          </aside>
        {/if}
      </div>
    {/if}
  </main>

  {#if dev}
    <!-- Development-only controls: ←/→ cycle variants; state buttons swap scenarios. -->
    <aside class="prototype-switcher" aria-label="Prototype configuration toolbar">
      <div class="switcher-inner">
        <button
          type="button"
          class="switcher-btn"
          aria-label="Previous variant"
          onclick={() => cycleVariant(-1)}>←</button
        >
        <div class="switcher-group" role="radiogroup" aria-label="Structural variant">
          <span class="switcher-label"
            >{variant === 'A'
              ? 'A — Action Hub'
              : variant === 'B'
                ? 'B — Flowboard'
                : 'C — Inspection Deck'}</span
          >
          <div class="switcher-btns">
            {#each ['A', 'B', 'C'] as option (option)}
              <button
                type="button"
                class="switcher-btn {variant === option ? 'active' : ''}"
                aria-checked={variant === option}
                role="radio"
                onclick={() => updateUrl(option as Variant, demoState)}>{option}</button
              >
            {/each}
          </div>
        </div>
        <button
          type="button"
          class="switcher-btn"
          aria-label="Next variant"
          onclick={() => cycleVariant(1)}>→</button
        >

        <div class="switcher-divider" aria-hidden="true"></div>

        <div class="switcher-group" role="radiogroup" aria-label="Demo state">
          <span class="switcher-label">State</span>
          <div class="switcher-btns">
            {#each ['active', 'blocked', 'live', 'empty'] as option (option)}
              <button
                type="button"
                class="switcher-btn {demoState === option ? 'active' : ''}"
                aria-checked={demoState === option}
                role="radio"
                onclick={() => updateUrl(variant, option as DemoState)}>{option}</button
              >
            {/each}
          </div>
        </div>
      </div>
    </aside>
  {/if}
</div>

<style>
  /* Base Scoped Design Tokens & Editorial Styling */
  :host,
  .prototype-wrapper {
    --bg-page: #fcfcfc;
    --fg-main: #171717;
    --fg-muted: #666666;
    --border-color: #e5e5e5;
    --border-dark: #262626;
    --bg-card: #ffffff;
    --bg-muted: #f5f5f5;

    --accent-blue: #2563eb;
    --accent-green: #16a34a;
    --accent-red: #dc2626;
    --accent-amber: #d97706;

    --font-serif: ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif;
    --font-sans: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

    font-family: var(--font-sans);
    color: var(--fg-main);
    background-color: var(--bg-page);
    min-height: 100vh;
    padding-bottom: 5rem;
  }

  .prototype-wrapper {
    position: relative;
    left: 50%;
    width: min(96rem, calc(100vw - 2rem));
    transform: translateX(-50%);
  }

  @media (prefers-color-scheme: dark) {
    .prototype-wrapper {
      --bg-page: #0d0d0d;
      --fg-main: #ededed;
      --fg-muted: #a3a3a3;
      --border-color: #262626;
      --border-dark: #404040;
      --bg-card: #171717;
      --bg-muted: #1f1f1f;

      --accent-blue: #60a5fa;
      --accent-green: #4ade80;
      --accent-red: #f87171;
      --accent-amber: #fbbf24;
    }
  }

  .prototype-header {
    background: var(--bg-card);
    border-bottom: 1px solid var(--border-color);
    padding: 1.25rem 2rem;
  }

  .header-inner {
    max-width: 80rem;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  .header-branding {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .prototype-pill {
    background: #fef3c7;
    color: #92400e;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 0.25rem 0.6rem;
    border-radius: 9999px;
    border: 1px solid #fde68a;
  }

  @media (prefers-color-scheme: dark) {
    .prototype-pill {
      background: #78350f;
      color: #fef3c7;
      border-color: #92400e;
    }
  }

  .header-title {
    font-family: var(--font-serif);
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    line-height: 1.2;
  }

  .header-sub {
    font-size: 0.85rem;
    color: var(--fg-muted);
    margin: 0.15rem 0 0 0;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .operator-badge {
    font-size: 0.8rem;
    color: var(--fg-muted);
  }

  /* Buttons & Utilities */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    text-decoration: none;
    cursor: pointer;
    border: 1px solid transparent;
    transition:
      background 0.15s ease,
      border-color 0.15s ease;
  }

  .btn:focus-visible {
    outline: 2px solid var(--accent-blue);
    outline-offset: 2px;
  }

  .btn-primary {
    background: var(--fg-main);
    color: var(--bg-card);
  }
  .btn-primary:hover {
    opacity: 0.9;
  }

  .btn-secondary {
    background: var(--bg-muted);
    color: var(--fg-main);
    border-color: var(--border-color);
  }
  .btn-secondary:hover {
    border-color: var(--fg-muted);
  }

  .btn-publish {
    background: #15803d;
    color: #ffffff;
  }
  .btn-publish:hover {
    background: #166534;
  }

  .btn-danger {
    background: #b91c1c;
    color: #ffffff;
  }
  .btn-danger:hover {
    background: #991b1b;
  }

  .btn-lg {
    padding: 0.65rem 1.25rem;
    font-size: 0.95rem;
  }

  .btn-sm {
    padding: 0.3rem 0.6rem;
    font-size: 0.8rem;
  }

  .btn-text-sm {
    background: none;
    border: none;
    color: var(--accent-blue);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
  }
  .btn-text-sm:hover {
    text-decoration: underline;
  }

  /* Metrics Bar */
  .metrics-bar {
    background: var(--bg-muted);
    border-bottom: 1px solid var(--border-color);
    padding: 0.6rem 2rem;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 1.5rem;
    max-width: 80rem;
    margin: 0 auto;
  }

  .metric-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.825rem;
  }

  .metric-label {
    color: var(--fg-muted);
    font-weight: 500;
  }

  .metric-value {
    font-weight: 700;
    font-family: var(--font-mono);
  }

  .metric-divider {
    width: 1px;
    height: 1.2rem;
    background: var(--border-color);
  }

  @media (max-width: 640px) {
    .metrics-bar {
      flex-wrap: wrap;
      gap: 0.5rem 1rem;
      padding: 0.75rem 1rem;
    }

    .metric-divider {
      display: none;
    }

    .metric-item {
      min-width: 0;
    }
  }

  .flex-grow {
    flex-grow: 1;
  }

  .text-error {
    color: var(--accent-red);
  }
  .text-success {
    color: var(--accent-green);
  }
  .text-accent {
    color: var(--accent-blue);
  }

  /* Main Body Container */
  .main-body {
    max-width: 80rem;
    margin: 1.5rem auto;
    padding: 0 1.5rem;
  }

  /* Empty Workspace Card */
  .empty-workspace-card {
    background: var(--bg-card);
    border: 1px dashed var(--border-dark);
    border-radius: 0.5rem;
    padding: 4rem 2rem;
    text-align: center;
    max-width: 36rem;
    margin: 3rem auto;
  }

  .empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .empty-title {
    font-family: var(--font-serif);
    font-size: 1.5rem;
    margin: 0 0 0.5rem 0;
  }

  .empty-desc {
    color: var(--fg-muted);
    font-size: 0.95rem;
    line-height: 1.6;
    margin-bottom: 1.5rem;
  }

  /* VARIANT A: Action Hub Layout */
  .variant-a-layout {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .hero-workbench {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-top: 4px solid var(--fg-main);
    border-radius: 0.5rem;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .hero-workbench-header {
    margin-bottom: 1.25rem;
  }

  .hero-badge-wrap {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.4rem;
  }

  .badge-priority {
    background: #ef4444;
    color: #ffffff;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.2rem 0.5rem;
    border-radius: 0.25rem;
  }

  .hero-slug {
    font-size: 0.8rem;
    color: var(--fg-muted);
  }

  .hero-article-title {
    font-family: var(--font-serif);
    font-size: 1.65rem;
    font-weight: 700;
    margin: 0;
  }

  .recommended-action-box {
    border-radius: 0.375rem;
    padding: 1.25rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1.5rem;
    margin-bottom: 1.25rem;
    flex-wrap: wrap;
  }

  .box-neutral {
    background: var(--bg-muted);
    border: 1px solid var(--border-color);
  }
  .box-publish {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
  }
  @media (prefers-color-scheme: dark) {
    .box-publish {
      background: #052e16;
      border-color: #14532d;
    }
  }

  .box-danger {
    background: #fef2f2;
    border: 1px solid #fecaca;
  }
  @media (prefers-color-scheme: dark) {
    .box-danger {
      background: #450a0a;
      border-color: #7f1d1d;
    }
  }

  .action-box-content {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .action-box-icon {
    font-size: 1.75rem;
  }

  .action-box-label {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--fg-muted);
    margin: 0 0 0.15rem 0;
  }

  .action-box-text {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
  }

  .dual-axis-panel {
    display: flex;
    gap: 2rem;
    margin-bottom: 1.25rem;
    padding: 0.75rem 1rem;
    background: var(--bg-muted);
    border-radius: 0.375rem;
  }

  .axis-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .axis-title {
    font-weight: 600;
    color: var(--fg-muted);
  }

  /* Status Pills */
  .status-pill {
    display: inline-flex;
    align-items: center;
    padding: 0.15rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .prod-live {
    background: #dcfce7;
    color: #166534;
  }
  .prod-absent {
    background: #fef3c7;
    color: #92400e;
  }
  .change-ready {
    background: #dbeafe;
    color: #1e40af;
  }
  .change-check_failed {
    background: #fee2e2;
    color: #991b1b;
  }
  .change-draft {
    background: #fef3c7;
    color: #92400e;
  }
  .change-none {
    background: #f3f4f6;
    color: #374151;
  }
  .change-checking {
    background: #e0e7ff;
    color: #3730a3;
  }

  @media (prefers-color-scheme: dark) {
    .prod-live {
      background: #14532d;
      color: #dcfce7;
    }
    .prod-absent {
      background: #78350f;
      color: #fef3c7;
    }
    .change-ready {
      background: #1e3a8a;
      color: #dbeafe;
    }
    .change-check_failed {
      background: #7f1d1d;
      color: #fee2e2;
    }
    .change-draft {
      background: #78350f;
      color: #fef3c7;
    }
    .change-none {
      background: #374151;
      color: #f3f4f6;
    }
  }

  .impact-safety-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1.25rem;
  }
  @media (max-width: 640px) {
    .impact-safety-grid {
      grid-template-columns: 1fr;
    }
  }

  .impact-box,
  .safety-box {
    background: var(--bg-muted);
    border: 1px solid var(--border-color);
    padding: 0.85rem 1rem;
    border-radius: 0.375rem;
  }

  .impact-heading,
  .safety-heading {
    font-size: 0.8rem;
    font-weight: 700;
    margin: 0 0 0.25rem 0;
    color: var(--fg-muted);
  }

  .impact-text,
  .safety-text {
    font-size: 0.85rem;
    margin: 0;
    line-height: 1.4;
  }

  /* Accordion */
  .evidence-accordion {
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
  }

  .evidence-summary {
    padding: 0.75rem 1rem;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--bg-muted);
  }

  .evidence-content {
    padding: 1rem;
    border-top: 1px solid var(--border-color);
    background: var(--bg-card);
  }

  .evidence-dl {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 0.75rem 1.5rem;
    font-size: 0.8rem;
    margin: 0;
  }

  .evidence-dl dt {
    font-weight: 600;
    color: var(--fg-muted);
  }

  .evidence-dl dd {
    margin: 0 0 0.4rem 0;
    word-break: break-all;
  }

  /* Library Section & Table */
  .library-section {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
  }

  .library-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.25rem;
    flex-wrap: wrap;
  }

  .library-title {
    font-family: var(--font-serif);
    font-size: 1.35rem;
    margin: 0;
  }

  .library-sub {
    font-size: 0.85rem;
    color: var(--fg-muted);
    margin: 0.15rem 0 0 0;
  }

  .search-input {
    padding: 0.45rem 0.8rem;
    font-size: 0.85rem;
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    background: var(--bg-card);
    color: var(--fg-main);
    width: 16rem;
  }

  .search-input:focus {
    outline: 2px solid var(--accent-blue);
  }

  .table-container {
    overflow-x: auto;
  }

  .article-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
    text-align: left;
  }

  .article-table th {
    padding: 0.75rem 1rem;
    border-bottom: 2px solid var(--border-color);
    color: var(--fg-muted);
    font-weight: 600;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .article-table td {
    padding: 0.85rem 1rem;
    border-bottom: 1px solid var(--border-color);
    vertical-align: top;
  }

  .table-article-link {
    font-weight: 600;
    color: var(--fg-main);
    text-decoration: none;
  }
  .table-article-link:hover {
    color: var(--accent-blue);
  }

  .table-article-slug {
    display: block;
    font-size: 0.75rem;
    color: var(--fg-muted);
  }

  .table-action-text {
    font-size: 0.8rem;
    color: var(--fg-muted);
  }

  .drawer-row td {
    background: var(--bg-muted);
    padding: 1rem;
  }

  .table-evidence-drawer {
    font-size: 0.8rem;
  }

  .drawer-title {
    font-weight: 600;
    margin: 0 0 0.5rem 0;
  }

  .drawer-links {
    display: flex;
    gap: 1rem;
    margin-top: 0.5rem;
  }

  .drawer-links a {
    color: var(--accent-blue);
    font-weight: 600;
  }

  /* VARIANT B: Flowboard Layout */
  .variant-b-layout {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .flowboard-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .flowboard-search {
    min-width: 0;
  }

  .flowboard-hint {
    font-size: 0.8rem;
    color: var(--fg-muted);
  }

  .flowboard-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.25rem;
  }

  @media (max-width: 1024px) {
    .flowboard-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .flowboard-toolbar {
      align-items: stretch;
      flex-direction: column;
    }

    .flowboard-search .search-input {
      width: 100%;
    }
  }

  .flowboard-col {
    background: var(--bg-muted);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .col-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 0.75rem;
    border-bottom: 2px solid var(--border-color);
  }

  .col-header-working {
    border-bottom-color: var(--accent-amber);
  }
  .col-header-ready {
    border-bottom-color: var(--accent-blue);
  }
  .col-header-live {
    border-bottom-color: var(--accent-green);
  }

  .col-title {
    font-size: 0.9rem;
    font-weight: 700;
    margin: 0;
  }

  .col-count {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    padding: 0.1rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .col-cards {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .col-empty {
    color: var(--fg-muted);
    font-size: 0.825rem;
    margin: 0;
  }

  .flowboard-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    padding: 1rem;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  }

  .card-border-danger {
    border-left: 4px solid var(--accent-red);
  }
  .card-border-publish {
    border-left: 4px solid var(--accent-blue);
  }
  .card-border-live {
    border-left: 4px solid var(--accent-green);
  }
  .card-border-neutral {
    border-left: 4px solid var(--border-dark);
  }

  .card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .card-date {
    font-size: 0.75rem;
    color: var(--fg-muted);
  }

  .card-title {
    font-size: 1.05rem;
    font-weight: 700;
    margin: 0 0 0.25rem 0;
  }
  .card-title a {
    color: var(--fg-main);
    text-decoration: none;
  }
  .card-title a:hover {
    color: var(--accent-blue);
  }

  .card-slug {
    font-size: 0.75rem;
    color: var(--fg-muted);
    margin: 0 0 0.5rem 0;
  }

  .card-excerpt {
    font-size: 0.8rem;
    color: var(--fg-muted);
    margin: 0 0 0.75rem 0;
    line-height: 1.4;
  }

  .card-facts {
    display: grid;
    gap: 0.5rem;
    margin: 0 0 0.75rem;
  }

  .card-facts div {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .card-facts dt {
    color: var(--fg-muted);
    font-size: 0.7rem;
    font-weight: 700;
  }

  .card-facts dd {
    margin: 0;
    text-align: right;
  }

  .card-reader {
    color: var(--fg-muted);
    font-size: 0.75rem;
    line-height: 1.45;
    margin: 0 0 0.75rem;
  }

  .card-action-box {
    background: var(--bg-muted);
    padding: 0.6rem;
    border-radius: 0.25rem;
    margin-bottom: 0.75rem;
    font-size: 0.8rem;
  }

  .card-action-label {
    font-weight: 700;
    font-size: 0.7rem;
    text-transform: uppercase;
    display: block;
    color: var(--fg-muted);
  }

  .card-action-val {
    margin: 0.2rem 0 0 0;
    font-weight: 600;
  }

  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border-color);
  }

  .card-evidence-box {
    margin-top: 0.75rem;
    padding-top: 0.5rem;
    border-top: 1px dashed var(--border-color);
  }

  .card-links {
    display: flex;
    gap: 0.75rem;
    font-size: 0.75rem;
  }

  /* VARIANT C: Streamlined Feed & Inspection Deck */
  .variant-c-layout {
    display: grid;
    grid-template-columns: 1fr 420px;
    gap: 1.5rem;
  }

  @media (max-width: 900px) {
    .variant-c-layout {
      grid-template-columns: 1fr;
    }
  }

  .stream-pane {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.25rem;
  }

  .stream-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .stream-title {
    font-family: var(--font-serif);
    font-size: 1.25rem;
    margin: 0;
  }

  .input-sm {
    padding: 0.35rem 0.6rem;
    font-size: 0.8rem;
    width: 12rem;
  }

  .stream-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .stream-item {
    width: 100%;
    text-align: left;
    background: var(--bg-muted);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    padding: 1rem;
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      background 0.15s ease;
  }

  .stream-item:hover {
    border-color: var(--accent-blue);
  }

  .stream-item-selected {
    border-color: var(--accent-blue);
    background: var(--bg-card);
    box-shadow: 0 0 0 2px var(--accent-blue);
  }

  .stream-item-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .stream-item-title {
    font-size: 1rem;
    font-weight: 700;
    margin: 0;
  }

  .stream-item-slug {
    font-size: 0.75rem;
    color: var(--fg-muted);
    margin: 0 0 0.4rem 0;
  }

  .stream-item-action {
    font-size: 0.8rem;
    margin: 0 0 0.5rem 0;
    color: var(--fg-main);
  }

  .stream-item-meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--fg-muted);
  }

  /* Right Inspection Deck */
  .inspection-deck {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.25rem;
    position: sticky;
    top: 1.5rem;
    max-height: calc(100vh - 8rem);
    overflow-y: auto;
  }

  .badge-inspector {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: var(--accent-blue);
    display: block;
    margin-bottom: 0.25rem;
  }

  .deck-title {
    font-family: var(--font-serif);
    font-size: 1.35rem;
    margin: 0 0 0.2rem 0;
  }

  .deck-slug {
    font-size: 0.75rem;
    color: var(--fg-muted);
    margin: 0 0 1rem 0;
  }

  .deck-action-banner {
    padding: 1rem;
    border-radius: 0.375rem;
    margin-bottom: 1.25rem;
  }

  .deck-action-title {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    margin: 0 0 0.25rem 0;
    color: var(--fg-muted);
  }

  .deck-action-desc {
    font-size: 0.875rem;
    font-weight: 600;
    margin: 0 0 0.75rem 0;
  }

  .deck-action-btns {
    display: flex;
    gap: 0.5rem;
  }

  .matrix-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
  }

  .matrix-card {
    background: var(--bg-muted);
    border: 1px solid var(--border-color);
    padding: 0.75rem;
    border-radius: 0.375rem;
  }

  .matrix-card-title {
    font-size: 0.75rem;
    font-weight: 700;
    margin: 0 0 0.4rem 0;
    color: var(--fg-muted);
  }

  .matrix-card-desc {
    font-size: 0.7rem;
    color: var(--fg-muted);
    margin: 0.4rem 0 0 0;
    line-height: 1.3;
  }

  .deck-audit-box {
    background: var(--bg-muted);
    border: 1px solid var(--border-color);
    padding: 0.85rem;
    border-radius: 0.375rem;
    margin-bottom: 1.25rem;
  }

  .audit-heading {
    font-size: 0.75rem;
    font-weight: 700;
    margin: 0 0 0.2rem 0;
    color: var(--fg-muted);
  }

  .audit-body {
    font-size: 0.8rem;
    margin: 0;
    line-height: 1.4;
  }

  .mt-3 {
    margin-top: 0.75rem;
  }

  .deck-evidence-log {
    border-top: 1px solid var(--border-color);
    padding-top: 1rem;
  }

  .evidence-log-title {
    font-size: 0.8rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
  }

  .evidence-log-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .evidence-log-list li {
    word-break: break-all;
  }

  /* Floating Bottom Switcher Toolbar */
  .prototype-switcher {
    position: fixed;
    bottom: 1rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    background: #171717;
    color: #ffffff;
    border: 1px solid #404040;
    border-radius: 9999px;
    padding: 0.5rem 1rem;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
    max-width: calc(100vw - 2rem);
  }

  .switcher-inner {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .badge-mini {
    font-size: 0.65rem;
    font-weight: 800;
    background: #2563eb;
    color: #ffffff;
    padding: 0.15rem 0.4rem;
    border-radius: 0.25rem;
    letter-spacing: 0.05em;
  }

  .switcher-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .switcher-label {
    font-size: 0.75rem;
    font-weight: 700;
    color: #a3a3a3;
  }

  .switcher-btns {
    display: flex;
    gap: 0.25rem;
  }

  .switcher-btn {
    background: #262626;
    color: #d4d4d4;
    border: 1px solid #404040;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.65rem;
    border-radius: 9999px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .switcher-btn:hover {
    background: #404040;
    color: #ffffff;
  }

  .switcher-btn.active {
    background: #ffffff;
    color: #171717;
    border-color: #ffffff;
    font-weight: 700;
  }

  .switcher-btn:focus-visible {
    outline: 2px solid #60a5fa;
  }

  .switcher-divider {
    width: 1px;
    height: 1.25rem;
    background: #404040;
  }

  @media (max-width: 850px), (max-height: 500px) {
    .prototype-switcher {
      position: static;
      transform: none;
      margin: 1rem auto 0;
      width: fit-content;
    }
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
</style>
