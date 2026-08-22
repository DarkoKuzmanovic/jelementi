import type {
  StudioDraftReplacementEvidence,
  StudioDraftReplacementMutation,
  StudioDraftReplacementResult,
} from '../server/studio/draft-replacement.server';
import type { StudioSaveResult } from '../server/studio/editor.server';
import type { StudioPublishResult } from '../server/studio/publish.server';
import {
  publishStoppedCopy,
  replacementStoppedCopy,
  saveStoppedCopy,
  shortStudioSha,
} from './evidence-copy';

/**
 * Recovery projection for Studio conflict and failure presentations.
 *
 * Every projection answers the same four questions in the same order: what
 * happened, is the writer's work safe, did readers see anything change, and
 * what is the one deterministic next action. Comparison rows carry the
 * loaded-versus-current concurrency evidence; evidence rows carry sanitized
 * replacement observations. The replacement offer flag is set only when the
 * server already proved eligibility — the client never infers it.
 */

export interface StudioRecoveryComparisonRow {
  label: string;
  loaded: string;
  current: string;
}

export interface StudioRecoveryEvidenceRow {
  label: string;
  value: string;
  url?: string;
}

export interface StudioRecoveryProjection {
  operation: 'save' | 'publish' | 'replace';
  tone: 'conflict' | 'failure' | 'success';
  heading: string;
  whatHappened: string;
  workSafety: string;
  readerEffect: string;
  nextAction: string;
  offerReplacement: boolean;
  comparison?: StudioRecoveryComparisonRow[];
  evidence: StudioRecoveryEvidenceRow[];
}

const READERS_UNCHANGED = 'Readers saw no change; the published site was not touched.';
const NONE = 'none';
const COPY_BEFORE_RELOAD =
  'Copy your candidate from this form before any reload — reloading this editor discards it.';

function candidatePreserved(detail: string): string {
  return `Your submitted candidate is preserved in the form above. ${detail}`;
}

/**
 * #117: operational copy carries only the abbreviated digest; the sentinel
 * text ('none' / 'absent' / 'not read') passes through untouched.
 */
function shortOr(value: string | undefined, sentinel: string): string {
  if (value === undefined) return sentinel;
  const short = shortStudioSha(value);
  return short === '' ? sentinel : short;
}

export function buildStudioSaveRecovery(
  save: StudioSaveResult | undefined,
): StudioRecoveryProjection | undefined {
  if (!save || save.kind === 'saved' || save.kind === 'save_rejected') {
    return undefined;
  }
  if (save.kind === 'save_conflict') {
    // #109: an existing-draft collision observed from unbranched evidence is
    // not a moved draft — no draft was ever loaded here. The copy must name
    // the real situation and offer open / rename / discard paths.
    if (save.draftExists !== undefined) {
      const pr = save.draftExists.pullRequestNumber;
      return {
        operation: 'save',
        tone: 'conflict',
        heading: 'Save blocked: a Studio draft for this slug already exists',
        whatHappened: `A Studio draft for this slug already exists on GitHub${
          pr === undefined ? '' : ` (Draft PR #${pr})`
        }, so saving here would collide with it. Nothing was written.`,
        workSafety: candidatePreserved('Nothing you typed was lost.'),
        readerEffect: READERS_UNCHANGED,
        nextAction:
          'Open the existing draft to resume it, pick a different slug for this text and save again, or discard the existing draft. Your candidate stays in this form for copying.',
        offerReplacement: false,
        comparison: [
          {
            label: 'Main',
            loaded: shortOr(save.loaded.baseMainSha, NONE),
            current: shortOr(save.current.baseMainSha, NONE),
          },
          {
            label: 'Draft head',
            loaded: shortOr(save.loaded.draftHeadSha, NONE),
            current: shortOr(save.current.draftHeadSha, NONE),
          },
        ],
        evidence: [],
      };
    }
    const offer = save.replacementAvailable;
    const offerReplacement = offer !== undefined;
    return {
      operation: 'save',
      tone: 'conflict',
      heading: 'Save blocked: this draft moved on GitHub',
      whatHappened:
        'The draft moved on GitHub after this editor loaded, so the save was not applied. The committed Studio draft on GitHub is unchanged by this attempt.',
      workSafety: candidatePreserved('Nothing you typed was lost.'),
      readerEffect: READERS_UNCHANGED,
      nextAction: offerReplacement
        ? 'Replace the stale Studio draft: the server verified your loaded draft head still matches and the article on fresh main is unchanged. The replacement needs complete validation and a fresh Publish afterwards.'
        : 'Open the Studio draft in a new tab to review what changed, then reapply your edits there. Your candidate stays in this form for copying.',
      offerReplacement,
      comparison: [
        {
          label: 'Main',
          loaded: shortOr(save.loaded.baseMainSha, NONE),
          current: shortOr(save.current.baseMainSha, NONE),
        },
        {
          label: 'Draft head',
          loaded: shortOr(save.loaded.draftHeadSha, NONE),
          current: shortOr(save.current.draftHeadSha, NONE),
        },
        offer !== undefined
          ? {
              // The server read both blobs while proving eligibility — the
              // matching pair is the evidence that replacing cannot overwrite
              // an article change on main.
              label: 'Article on main',
              loaded: shortOr(offer.target.loadedBlobSha, 'absent'),
              current: shortOr(offer.target.freshBlobSha, 'absent'),
            }
          : {
              label: 'Article blob',
              loaded: shortOr(save.loaded.expectedBlobSha, NONE),
              current: 'not read',
            },
      ],
      evidence:
        offer !== undefined
          ? [
              { label: 'Article path', value: offer.target.path },
              // The loaded expected blob stays available beside the fresh
              // proof; it is not re-read because the matching draft head
              // above already proves the branch content is unchanged.
              {
                label: 'Draft article blob (expected)',
                value: shortOr(save.loaded.expectedBlobSha, NONE),
              },
            ]
          : [],
    };
  }
  // save_failed
  const committed = save.phase === 'pull-request' && save.concurrency !== undefined;
  if (save.reason === 'topology') {
    return {
      operation: 'save',
      tone: 'failure',
      heading: 'Save stopped: unexpected pull requests',
      // #117: no internal phase code — a sentence naming what happened.
      whatHappened:
        "Saving stopped because this article's Draft PR setup on GitHub is not the single-draft shape Studio expects. Nothing was overwritten.",
      workSafety: candidatePreserved('The committed Studio draft was not modified.'),
      readerEffect: READERS_UNCHANGED,
      nextAction:
        'Review the open pull requests for this draft branch on GitHub and close the unexpected ones, then Save again.',
      offerReplacement: false,
      evidence: [],
    };
  }
  if (committed) {
    return {
      operation: 'save',
      tone: 'failure',
      heading: 'Draft committed, Draft PR missing',
      whatHappened:
        'Your draft was committed to its branch, but GitHub could not be reached to open the Draft PR.',
      workSafety: candidatePreserved('The committed draft is safe on its branch.'),
      readerEffect: READERS_UNCHANGED,
      nextAction: 'Save again to retry; it will not create a duplicate branch or commit.',
      offerReplacement: false,
      evidence: [],
    };
  }
  return {
    operation: 'save',
    tone: 'failure',
    heading: 'Save failed',
    // #117: sentence-form phase explanation, never the raw code.
    whatHappened: saveStoppedCopy(save.phase),
    workSafety: candidatePreserved('The committed Studio draft was not modified.'),
    readerEffect: READERS_UNCHANGED,
    nextAction: 'Save again when GitHub is reachable.',
    offerReplacement: false,
    evidence: [],
  };
}

export function buildStudioPublishRecovery(
  publish: StudioPublishResult | undefined,
): StudioRecoveryProjection | undefined {
  if (!publish || publish.kind === 'published') {
    return undefined;
  }
  if (publish.kind === 'publish_conflict') {
    return {
      operation: 'publish',
      tone: 'conflict',
      heading: 'Publish blocked: the draft moved on GitHub',
      whatHappened:
        'The draft head on GitHub no longer matches what this editor loaded, so nothing was published.',
      workSafety:
        'The committed Studio draft on GitHub is untouched, and your submitted candidate is preserved in the form above.',
      readerEffect: READERS_UNCHANGED,
      nextAction: `Open the Studio draft in a new tab to review the current draft head, then run Publish again. ${COPY_BEFORE_RELOAD}`,
      offerReplacement: false,
      comparison: [
        {
          label: 'Draft head',
          loaded: shortOr(publish.expectedHeadSha, NONE),
          current:
            publish.currentHeadSha === null
              ? 'branch not found'
              : shortOr(publish.currentHeadSha, 'branch not found'),
        },
      ],
      evidence: [],
    };
  }
  if (publish.kind === 'publish_rejected') {
    const unsaved = publish.compileIssues.some((issue) => issue.code === 'UNSAVED_EDITOR_CHANGES');
    if (unsaved) {
      return {
        operation: 'publish',
        tone: 'conflict',
        heading: 'Publish blocked: unsaved form changes',
        whatHappened:
          'The form no longer matches the committed Studio draft, so Publish refused to ship a version you have not saved.',
        workSafety: candidatePreserved('The committed Studio draft was not modified.'),
        readerEffect: READERS_UNCHANGED,
        nextAction: 'Save the current form, then Publish the saved version.',
        offerReplacement: false,
        evidence: [],
      };
    }
    return {
      operation: 'publish',
      tone: 'failure',
      heading: 'Publish blocked: the draft is not valid',
      whatHappened: 'The committed draft failed revalidation, so nothing was published.',
      workSafety: candidatePreserved('The committed Studio draft was not modified.'),
      readerEffect: READERS_UNCHANGED,
      nextAction: 'Fix every issue in the validation summary above, Save, then Publish again.',
      offerReplacement: false,
      evidence: [],
    };
  }
  // publish_failed
  const late = publish.phase === 'ready' || publish.phase === 'auto-merge';
  return {
    operation: 'publish',
    tone: 'failure',
    heading: 'Publish did not complete',
    // #117: sentence-form phase/reason explanation, never the raw codes.
    whatHappened: publishStoppedCopy(publish.phase, publish.reason),
    workSafety:
      'The committed Studio draft is preserved on its branch; your submitted candidate stays in the form above.',
    readerEffect: late
      ? 'The Draft PR may have been marked ready before the failure; readers see a change only if GitHub merged it.'
      : READERS_UNCHANGED,
    nextAction: late
      ? 'Check status to rediscover where the publish stopped before retrying.'
      : 'Run Publish again when GitHub is reachable.',
    offerReplacement: false,
    evidence: [],
  };
}

function replacementEvidenceRows(
  evidence: StudioDraftReplacementEvidence,
): StudioRecoveryEvidenceRow[] {
  const rows: StudioRecoveryEvidenceRow[] = [];
  if (evidence.mainSha !== undefined) {
    rows.push({ label: 'Fresh main', value: shortStudioSha(evidence.mainSha) });
  }
  if (evidence.target) {
    rows.push({ label: 'Article path', value: evidence.target.path });
    rows.push({
      label: 'Article blob (loaded)',
      value: shortOr(evidence.target.loadedBlobSha, 'absent'),
    });
    rows.push({
      label: 'Article blob (fresh)',
      value: shortOr(evidence.target.freshBlobSha, 'absent'),
    });
  }
  if (evidence.branch) {
    rows.push({
      label: 'Branch',
      value: `${evidence.branch.name} @ ${shortStudioSha(evidence.branch.headSha)}`,
      url: evidence.branch.url,
    });
  }
  if (evidence.pullRequest) {
    rows.push({
      label: 'Draft PR',
      value: `#${evidence.pullRequest.number} (${evidence.pullRequest.state}, ${
        evidence.pullRequest.draft ? 'draft' : 'ready'
      })`,
      url: evidence.pullRequest.url,
    });
  }
  return rows;
}

const REPLACEMENT_CONFLICT_COPY: Record<
  'not-eligible' | 'moved-head' | 'merged' | 'topology',
  { whatHappened: string; nextAction: string }
> = {
  'not-eligible': {
    whatHappened:
      'the article on fresh main no longer matches what this editor loaded, so replacing the draft could overwrite a newer change to the article on main.',
    nextAction: `Open the article on GitHub in a new tab to review what changed on main, then reapply your edits. ${COPY_BEFORE_RELOAD}`,
  },
  'moved-head': {
    whatHappened:
      'the draft branch moved after this editor loaded, so the replacement would have discarded newer commits.',
    nextAction: `Open the Studio draft in a new tab to review the newer commits, then decide whether to reapply your edits. ${COPY_BEFORE_RELOAD}`,
  },
  merged: {
    whatHappened:
      'the Draft PR was already merged, so there is no stale Studio draft left to replace.',
    nextAction: `Open the published article in a new tab and start a new Studio draft from it if you still want your changes. ${COPY_BEFORE_RELOAD}`,
  },
  topology: {
    whatHappened:
      'the draft branch has an ambiguous pull-request topology, so the replacement stopped for a manual review.',
    nextAction: `Review the pull requests for this draft branch on GitHub and resolve the ambiguity. ${COPY_BEFORE_RELOAD}`,
  },
};

/**
 * Truthful work-safety line for a stopped replacement, derived from the
 * server-proven mutation state — never a global "nothing was touched" claim,
 * because a replacement can stop after the old Draft PR was closed and the
 * branch deleted, recreated, or re-committed.
 */
function replacementWorkSafety(mutation: StudioDraftReplacementMutation): string {
  return mutation === 'none'
    ? candidatePreserved('This replacement attempt changed nothing on GitHub.')
    : candidatePreserved(
        'The old Draft PR may already be closed and the draft branch deleted, recreated, or re-committed with your candidate; the evidence below shows the last state the server read.',
      );
}

const REDISCOVER_IN_NEW_TAB =
  'Open this Studio article in a new tab to rediscover the current draft state, then continue there. Keep this tab open — your candidate stays in this form for copying.';

export function buildStudioReplacementRecovery(
  replacement: StudioDraftReplacementResult | undefined,
): StudioRecoveryProjection | undefined {
  if (!replacement) {
    return undefined;
  }
  if (replacement.kind === 'replaced') {
    return {
      operation: 'replace',
      tone: 'success',
      heading: 'Studio draft replaced',
      whatHappened: `The stale draft was replaced: the old Draft PR was closed, the branch was recreated from fresh main ${shortStudioSha(replacement.concurrency.baseMainSha)}, and your candidate was committed.`,
      workSafety: 'Your candidate is now the committed Studio draft and stays in the form above.',
      readerEffect: READERS_UNCHANGED,
      nextAction:
        'Complete validation and run a fresh Publish \u2014 the previous approval was not carried forward.',
      offerReplacement: false,
      evidence: [
        {
          label: 'Branch',
          value: `${replacement.branch.name} @ ${shortStudioSha(replacement.branch.headSha)}`,
          url: replacement.branch.url,
        },
        {
          label: 'Draft PR',
          value: `#${replacement.pullRequest.number}`,
          url: replacement.pullRequest.url,
        },
      ],
    };
  }
  if (replacement.kind === 'replacement_conflict') {
    const copy = REPLACEMENT_CONFLICT_COPY[replacement.reason];
    return {
      operation: 'replace',
      tone: 'conflict',
      heading: 'Draft replacement stopped',
      // #117: the reason's plain-language sentence owns the explanation; no
      // internal phase identifier is echoed.
      whatHappened: `The replacement stopped: ${copy.whatHappened}`,
      workSafety: replacementWorkSafety(replacement.mutation),
      readerEffect:
        replacement.reason === 'merged'
          ? 'The Draft PR was merged, so readers may already see the draft — the replacement itself made no reader-visible change.'
          : READERS_UNCHANGED,
      nextAction: copy.nextAction,
      offerReplacement: false,
      evidence: replacementEvidenceRows(replacement.evidence),
    };
  }
  // replacement_failed
  const confirmOnly = replacement.phase === 'confirm-replacement';
  return {
    operation: 'replace',
    tone: 'failure',
    heading: 'Draft replacement did not complete',
    // #117: sentence-form phase/reason explanation, never the raw codes.
    whatHappened:
      replacementStoppedCopy(replacement.phase, replacement.reason) +
      (confirmOnly
        ? ' The replacement may even have completed — only the final confirmation could not prove it.'
        : ''),
    workSafety: replacementWorkSafety(replacement.mutation),
    readerEffect: READERS_UNCHANGED,
    nextAction:
      replacement.mutation === 'none'
        ? 'Save again when GitHub is reachable: Save re-checks the conflict and offers replacement again only when it is still safe.'
        : REDISCOVER_IN_NEW_TAB,
    offerReplacement: false,
    evidence: replacementEvidenceRows(replacement.evidence),
  };
}

export function buildStudioRecoveryProjection(results: {
  save?: StudioSaveResult;
  publish?: StudioPublishResult;
  replacement?: StudioDraftReplacementResult;
}): StudioRecoveryProjection | undefined {
  return (
    buildStudioReplacementRecovery(results.replacement) ??
    buildStudioPublishRecovery(results.publish) ??
    buildStudioSaveRecovery(results.save)
  );
}
