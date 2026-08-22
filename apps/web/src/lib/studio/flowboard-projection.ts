import type { StudioArticleListEntry, StudioLifecycle, StudioProductionState } from './contracts';
import {
  isConcludedSuccessfulCheck,
  statusObservationCopy,
  STUDIO_WORKING_CHANGE_CHECKS_PASSED_MERGING,
  studioChecksPassedMerging,
  STUDIO_WORKING_CHANGE_READY_AWAITING_CHECKS,
} from './evidence-copy';
import {
  buildStudioWorkspaceProjection,
  type StudioPublishedVersionLabel,
  type StudioWorkingChangeLabel,
  type StudioWorkspaceProjection,
} from './workspace-projection';

export type StudioFlowboardColumn = 'resume-work' | 'ready-for-decision' | 'library';

export type StudioFlowboardPrimaryAction =
  { kind: 'check'; label: 'Check status' } | { kind: 'link'; label: string; href: string };

export interface StudioFlowboardCard {
  slug: string;
  title: string;
  updatedAt?: string;
  column: StudioFlowboardColumn;
  projection: StudioWorkspaceProjection;
  primaryAction: StudioFlowboardPrimaryAction;
  searchText: string;
}

export interface StudioFlowboardProjection {
  totalCount: number;
  columns: {
    resumeWork: StudioFlowboardCard[];
    readyForDecision: StudioFlowboardCard[];
    library: StudioFlowboardCard[];
  };
}

function publishedVersionLabel(
  production: StudioProductionState,
  canonicalStatus: StudioArticleListEntry['canonicalStatus'],
): StudioPublishedVersionLabel {
  switch (production) {
    case 'live':
      return 'Live and verified';
    case 'pending_deployment':
      return 'Updating the site';
    case 'pending_removal':
      return 'Removing from the site';
    // #116: frontmatter alone is honestly neutral — never a perpetual
    // rollout. The label distinguishes the two steady states.
    case 'unverified':
      return canonicalStatus === 'archived'
        ? 'Archived — not verified'
        : 'Published — not verified';
    case 'absent':
      return 'Not published';
  }
}

function workingChangeLabel(entry: StudioArticleListEntry): StudioWorkingChangeLabel {
  if (entry.failure !== undefined || entry.draftValidity === 'unavailable') {
    return 'Status unavailable';
  }
  if (entry.change === 'draft') {
    if (entry.draftValidity === 'invalid') return 'Saved — needs fixes';
    if (entry.draftValidity === 'valid') return 'Ready to publish';
    return 'Status unavailable';
  }
  switch (entry.change) {
    case 'ready':
      // #117: a concluded-successful check pre-merge is factually past
      // waiting-to-start — GitHub is auto-merging it. The distinction uses
      // only the check-run evidence already fetched upstream; no new
      // lifecycle state exists.
      return isConcludedSuccessfulCheck(entry.check)
        ? STUDIO_WORKING_CHANGE_CHECKS_PASSED_MERGING
        : STUDIO_WORKING_CHANGE_READY_AWAITING_CHECKS;
    case 'checking':
      return 'Checks running';
    case 'check_failed':
      return 'Checks failed';
    case 'merged':
      return 'Merged — site update pending';
    case 'none':
      return 'No changes in progress';
  }
}

interface StudioWorkingChangePresentation {
  column: StudioFlowboardColumn;
  summary: string;
  recommendedAction: string;
}

const WORKING_CHANGE_PRESENTATION: Readonly<
  Record<StudioWorkingChangeLabel, StudioWorkingChangePresentation>
> = {
  'Not saved yet': {
    column: 'resume-work',
    summary: 'This working copy has not been saved.',
    recommendedAction: 'Save this working copy before continuing.',
  },
  'Saved — needs fixes': {
    column: 'resume-work',
    summary: 'This saved draft needs fixes before it can be published.',
    recommendedAction: 'Fix the first validation issue, then save the draft again.',
  },
  'Ready to publish': {
    column: 'ready-for-decision',
    summary: 'This saved draft is ready for your publication decision.',
    recommendedAction: 'Open the Editorial desk and review Publish saved version.',
  },
  [STUDIO_WORKING_CHANGE_READY_AWAITING_CHECKS]: {
    column: 'resume-work',
    summary: 'This approved change is waiting for checks to start.',
    recommendedAction: 'Check status to refresh the server evidence.',
  },
  [STUDIO_WORKING_CHANGE_CHECKS_PASSED_MERGING]: {
    column: 'resume-work',
    summary: studioChecksPassedMerging().summary,
    recommendedAction: studioChecksPassedMerging().recommendedAction,
  },
  'Checks running': {
    column: 'resume-work',
    summary: 'Checks are running on this approved change.',
    recommendedAction: 'Check status to refresh the server evidence.',
  },
  'Checks failed': {
    column: 'resume-work',
    summary: 'A required check failed on this change.',
    recommendedAction: 'Open the failed check and review its result.',
  },
  'Merged — site update pending': {
    column: 'ready-for-decision',
    summary: 'This merged change is waiting for public verification.',
    recommendedAction: 'Check status to refresh the server evidence.',
  },
  'No changes in progress': {
    column: 'library',
    summary: 'No working change needs attention.',
    recommendedAction: 'Edit the article when you are ready to make a change.',
  },
  'Changes need review': {
    column: 'resume-work',
    summary: 'Fresh evidence moved; review the comparison before continuing.',
    recommendedAction: 'Review the loaded and current evidence before continuing.',
  },
  'Status unavailable': {
    column: 'resume-work',
    summary: 'This article remains available, but its latest status could not be determined.',
    recommendedAction: 'Check status to refresh the server evidence.',
  },
};

function primaryAction(
  entry: StudioArticleListEntry,
  projection: StudioWorkspaceProjection,
): StudioFlowboardPrimaryAction {
  const label = projection.workingChange.label;
  switch (label) {
    case 'Saved — needs fixes':
      return {
        kind: 'link',
        label: 'Fix first issue',
        href: `/studio/articles/${entry.slug}#validation-summary`,
      };
    case 'Ready to publish':
      return {
        kind: 'link',
        label: 'Publish saved version',
        href: `/studio/articles/${entry.slug}#publication-center`,
      };
    case 'Checks failed':
      return entry.check?.url === undefined
        ? { kind: 'check', label: 'Check status' }
        : { kind: 'link', label: 'Open failed check', href: entry.check.url };
    case STUDIO_WORKING_CHANGE_READY_AWAITING_CHECKS:
    case 'Checks passed — merging':
    case 'Checks running':
    case 'Merged — site update pending':
    case 'Status unavailable':
      return { kind: 'check', label: 'Check status' };
    case 'Changes need review':
      return {
        kind: 'link',
        label: 'Review comparison',
        href: `/studio/articles/${entry.slug}#recovery`,
      };
    case 'Not saved yet':
      return { kind: 'link', label: 'Save draft', href: `/studio/articles/${entry.slug}` };
    case 'No changes in progress':
      return { kind: 'link', label: 'Edit article', href: `/studio/articles/${entry.slug}` };
  }
}

function readerEffectFor(
  published: StudioPublishedVersionLabel,
  working: StudioWorkingChangeLabel,
): string {
  if (published === 'Live and verified') {
    return working === 'No changes in progress'
      ? 'Readers see the verified published version.'
      : 'Readers still see the verified published version while this working change continues.';
  }
  if (published === 'Removing from the site') {
    return 'Readers may still see this article until removal is verified.';
  }
  if (published === 'Updating the site') {
    return 'The reader result is not verified yet.';
  }
  if (published === 'Published — not verified' || published === 'Archived — not verified') {
    // #116: honest neutral — what readers see is simply unverified here.
    return 'What readers currently see has not been verified on this screen.';
  }
  return 'Readers see no published version of this article.';
}

function listWorkspaceProjection(entry: StudioArticleListEntry): StudioWorkspaceProjection {
  // #116: a known-recent merged change (its merge is still observable on
  // the article's Draft PR) earns the transitional copy; the frontmatter
  // default stays honest neutral. Story 28 distinctions stay visible here:
  // merged-in-flight ≠ unverified steady state.
  const transitional = entry.change === 'merged' && entry.production === 'unverified';
  const publishedLabel: StudioPublishedVersionLabel = transitional
    ? entry.canonicalStatus === 'archived'
      ? 'Removing from the site'
      : 'Updating the site'
    : publishedVersionLabel(entry.production, entry.canonicalStatus);
  const workingLabel = workingChangeLabel(entry);
  const workingPresentation = WORKING_CHANGE_PRESENTATION[workingLabel];
  const evidence: StudioWorkspaceProjection['evidence'] = [
    { label: 'Base version', value: entry.mainSha },
  ];
  if (entry.publicUrl !== undefined) {
    evidence.push({ label: 'Public article', value: entry.slug, url: entry.publicUrl });
  }
  if (entry.branch !== undefined) {
    evidence.push({ label: 'Studio branch', value: entry.branch.name, url: entry.branch.url });
  }
  if (entry.pullRequest !== undefined) {
    evidence.push({
      label: 'Draft PR',
      value: `#${entry.pullRequest.number}`,
      url: entry.pullRequest.url,
    });
  }
  if (entry.check !== undefined) {
    evidence.push({
      label: 'Verify check',
      value: `${entry.check.status}${entry.check.conclusion === null ? '' : ` · ${entry.check.conclusion}`}`,
      ...(entry.check.url === undefined ? {} : { url: entry.check.url }),
    });
  }
  if (entry.failure !== undefined) {
    evidence.push({
      label: 'Status observation',
      // #117: a human sentence — internal phase/reason codes never surface.
      value: statusObservationCopy(entry.failure.phase, entry.failure.reason),
    });
  }

  const issueCount = entry.compileIssues?.length ?? 0;
  return {
    slug: entry.slug,
    title: entry.title,
    publishedVersion: { label: publishedLabel },
    workingChange: { label: workingLabel },
    summary: workingPresentation.summary,
    recommendedAction: workingPresentation.recommendedAction,
    readerEffect: readerEffectFor(publishedLabel, workingLabel),
    validationSummary:
      issueCount === 0
        ? 'No validation issues.'
        : `${issueCount} validation ${issueCount === 1 ? 'issue' : 'issues'} must be fixed before publishing.`,
    actions: {
      preview: { available: entry.change === 'draft' },
      save: { available: entry.change === 'draft' },
      publish: {
        available: workingLabel === 'Ready to publish',
        ...(workingLabel === 'Ready to publish'
          ? {}
          : { reason: 'The committed draft is not ready to publish.' }),
      },
      refresh: { available: true },
      unpublish: { available: publishedLabel === 'Live and verified' },
      discard: { available: entry.branch !== undefined },
    },
    concurrency: {
      baseMainSha: entry.mainSha,
      ...(entry.branch === undefined ? {} : { draftHeadSha: entry.branch.headSha }),
    },
    evidence,
  };
}

function projectionFor(
  entry: StudioArticleListEntry,
  checked: StudioLifecycle | undefined,
): StudioWorkspaceProjection {
  if (checked === undefined || checked.article.slug !== entry.slug) {
    return listWorkspaceProjection(entry);
  }
  return buildStudioWorkspaceProjection(checked, {
    baseMainSha: entry.mainSha,
    ...(entry.branch === undefined ? {} : { draftHeadSha: entry.branch.headSha }),
  });
}

export function buildStudioFlowboard(
  entries: readonly StudioArticleListEntry[],
  checked?: StudioLifecycle,
): StudioFlowboardProjection {
  const columns: StudioFlowboardProjection['columns'] = {
    resumeWork: [],
    readyForDecision: [],
    library: [],
  };

  for (const entry of [...entries].sort((left, right) => left.slug.localeCompare(right.slug))) {
    const projection = projectionFor(entry, checked);
    const column = WORKING_CHANGE_PRESENTATION[projection.workingChange.label].column;
    const card: StudioFlowboardCard = {
      slug: entry.slug,
      title: entry.title,
      ...(entry.updatedAt === undefined ? {} : { updatedAt: entry.updatedAt }),
      column,
      projection,
      primaryAction: primaryAction(entry, projection),
      searchText:
        `${entry.title} ${entry.slug} ${projection.publishedVersion.label} ${projection.workingChange.label}`.toLocaleLowerCase(),
    };
    if (column === 'resume-work') columns.resumeWork.push(card);
    else if (column === 'ready-for-decision') columns.readyForDecision.push(card);
    else columns.library.push(card);
  }

  return { totalCount: entries.length, columns };
}
