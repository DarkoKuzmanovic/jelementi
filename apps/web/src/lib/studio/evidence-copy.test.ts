import { describe, expect, it } from 'vitest';
import type { StudioDraftReplacementResult } from '../server/studio/draft-replacement.server';
import type { StudioSaveResult } from '../server/studio/editor.server';
import {
  STUDIO_SHA_SHORT_LENGTH,
  isConcludedSuccessfulCheck,
  publishStoppedCopy,
  replacementStoppedCopy,
  saveStoppedCopy,
  shortStudioSha,
  statusObservationCopy,
  statusUnavailableCopy,
  studioChecksPassedMerging,
  STUDIO_WORKING_CHANGE_READY_AWAITING_CHECKS,
} from './evidence-copy';
import { buildStudioSaveRecovery, buildStudioReplacementRecovery } from './recovery-projection';
import { buildStudioWorkspaceProjection } from './workspace-projection';
import type { StudioLifecycle, StudioCheckEvidence } from './contracts';

const fullSha = 'a'.repeat(40);
const otherSha = 'd'.repeat(40);

describe('shortStudioSha', () => {
  it('renders at most seven lowercase characters of a digest', () => {
    const short = shortStudioSha('ABCDEF' + '0'.repeat(34));
    expect(short).toBe('abcdef0');
    expect(short.length).toBeLessThanOrEqual(STUDIO_SHA_SHORT_LENGTH);
    expect(shortStudioSha(fullSha)).toBe(fullSha.slice(0, STUDIO_SHA_SHORT_LENGTH));
    expect(shortStudioSha('f'.repeat(64))).toBe('fffffff');
  });

  it('never invents a digest for absent or malformed input', () => {
    expect(shortStudioSha(undefined)).toBe('');
    expect(shortStudioSha('')).toBe('');
    expect(shortStudioSha('not-a-sha')).toBe('');
  });
});

/**
 * #117 acceptance scan: operational copy must never echo a FULL digest and
 * must never surface an internal phase/reason identifier verbatim. These
 * helpers collect every writer-facing string a projection carries.
 */
function operationalStringsOf(value: unknown): string[] {
  const strings: string[] = [];
  const visit = (node: unknown): void => {
    if (typeof node === 'string') {
      strings.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (typeof node === 'object' && node !== null) {
      for (const [key, item] of Object.entries(node)) {
        // Field NAMES are wire keys, not rendered copy.
        if (key === 'label' || key === 'url') continue;
        visit(item);
      }
    }
  };
  visit(value);
  return strings;
}

const PHASE_CODE_PATTERN =
  /\b(commit-candidate|moved-head|not-eligible|verify-target|verify-loaded-head|discover-main|discover-branch|discover-pull-request|close-pull-request|confirm-pull-request|delete-branch|recreate-branch|create-pull-request|confirm-replacement|decode-request|verify-diff|status-flip|auto-merge)\b/;

function expectNoFullDigests(strings: string[]): void {
  for (const text of strings) {
    expect(text).not.toMatch(new RegExp(`[0-9a-fA-F]{40}`));
  }
}

describe('operational surfaces show only short digests (#117)', () => {
  it('keeps the workspace evidence disclosure full while its prose stays free of digests', () => {
    const lifecycle: StudioLifecycle = {
      kind: 'merged',
      article: {
        slug: 's',
        title: 'S',
        status: 'published',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      mainSha: otherSha,
    };
    const projection = buildStudioWorkspaceProjection(lifecycle, { baseMainSha: fullSha });
    // The disclosure rows retain full values...
    expect(projection.evidence.some((row) => row.value === fullSha)).toBe(true);
    // ...while summary/action/effect prose never shows one.
    expectNoFullDigests([
      projection.summary,
      projection.recommendedAction,
      projection.readerEffect,
      projection.validationSummary,
    ]);
  });

  it('shows short digests in save-conflict comparison tables', () => {
    const conflict: StudioSaveResult = {
      kind: 'save_conflict',
      loaded: { baseMainSha: fullSha, draftHeadSha: 'b'.repeat(40) },
      current: { baseMainSha: otherSha, draftHeadSha: 'e'.repeat(40) },
    };
    const recovery = buildStudioSaveRecovery(conflict);
    expect(recovery).toBeDefined();
    const sentinels = new Set(['none', 'absent', 'not read']);
    for (const row of recovery?.comparison ?? []) {
      if (!sentinels.has(row.loaded)) {
        expect(row.loaded.length).toBeLessThanOrEqual(STUDIO_SHA_SHORT_LENGTH);
      }
      if (!sentinels.has(row.current)) {
        expect(row.current.length).toBeLessThanOrEqual(STUDIO_SHA_SHORT_LENGTH);
      }
    }
    expect(recovery?.comparison?.[0]?.loaded).toBe(fullSha.slice(0, STUDIO_SHA_SHORT_LENGTH));
    expectNoFullDigests(operationalStringsOf(recovery));
  });

  it('shows short digests in replacement evidence rows', () => {
    const conflict: StudioDraftReplacementResult = {
      kind: 'replacement_conflict',
      candidate: { metadata: {}, body: '' } as never,
      phase: 'verify-target',
      reason: 'not-eligible',
      mutation: 'none',
      evidence: { mainSha: otherSha },
    };
    const recovery = buildStudioReplacementRecovery(conflict);
    expect(recovery?.evidence.find((row) => row.label === 'Fresh main')?.value).toBe(
      otherSha.slice(0, STUDIO_SHA_SHORT_LENGTH),
    );
    expectNoFullDigests(operationalStringsOf(recovery));
  });
});

describe('internal phase identifiers never surface verbatim (#117)', () => {
  it('describes stopped saves in sentences without raw phase codes', () => {
    for (const phase of ['main', 'branch', 'commit', 'pull-request'] as const) {
      const copy = saveStoppedCopy(phase);
      expect(copy).toMatch(/\.$/);
      // Single-word phases overlap ordinary English ("draft branch"); the
      // ban is on internal compound codes, asserted by the pattern below.
      expect(PHASE_CODE_PATTERN.test(copy)).toBe(false);
      expect(copy.toLowerCase()).toContain('github could not be reached');
    }
  });

  it('describes stopped publishes in sentences without raw phase or reason codes', () => {
    for (const phase of [
      'branch',
      'revalidate',
      'status-flip',
      'pull-request',
      'ready',
      'auto-merge',
    ] as const) {
      const copy = publishStoppedCopy(phase, 'github');
      expect(copy.endsWith('.')).toBe(true);
      expect(PHASE_CODE_PATTERN.test(copy)).toBe(false);
      expect(PHASE_CODE_PATTERN.test(publishStoppedCopy(phase, 'topology'))).toBe(false);
      expect(PHASE_CODE_PATTERN.test(publishStoppedCopy(phase, 'transform'))).toBe(false);
    }
  });

  it('describes stopped replacements in sentences without raw phases or reasons', () => {
    for (const phase of [
      'decode-request',
      'discover-main',
      'discover-branch',
      'verify-loaded-head',
      'verify-target',
      'verify-diff',
      'discover-pull-request',
      'close-pull-request',
      'confirm-pull-request',
      'delete-branch',
      'recreate-branch',
      'commit-candidate',
      'create-pull-request',
      'confirm-replacement',
      'revalidate',
    ] as const) {
      const copy = replacementStoppedCopy(phase, 'github');
      expect(copy.endsWith('.')).toBe(true);
      expect(copy).not.toContain(phase);
      expect(PHASE_CODE_PATTERN.test(copy)).toBe(false);
      expect(copy).not.toContain('github');
    }
  });

  it('explains an unavailable status without echoing internal phase or category codes', () => {
    const copy = statusUnavailableCopy();
    expect(copy.endsWith('.')).toBe(true);
    expect(PHASE_CODE_PATTERN.test(copy)).toBe(false);
    expect(copy).toMatch(/^Status could not be determined/);
  });

  it('keeps recovery projections free of raw phase tokens', () => {
    const failedSave: StudioSaveResult = {
      kind: 'save_failed',
      phase: 'commit-candidate' as never,
      reason: 'github',
    };
    const strings = operationalStringsOf(buildStudioSaveRecovery(failedSave));
    for (const text of strings) expect(PHASE_CODE_PATTERN.test(text)).toBe(false);

    const failedReplacement: StudioDraftReplacementResult = {
      kind: 'replacement_failed',
      candidate: { metadata: {}, body: '' } as never,
      phase: 'commit-candidate',
      reason: 'github',
      mutation: 'partial',
      evidence: {},
    };
    for (const text of operationalStringsOf(buildStudioReplacementRecovery(failedReplacement))) {
      expect(PHASE_CODE_PATTERN.test(text)).toBe(false);
    }
  });

  it('names both exit paths after a failed check', () => {
    const lifecycle: StudioLifecycle = {
      kind: 'check_failed',
      article: {
        slug: 's',
        title: 'S',
        status: 'draft',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      pullRequest: {
        number: 5,
        url: 'https://github.com/example/example/pull/5',
        headSha: fullSha,
      },
      failedCheck: { name: 'verify' },
    };
    const projection = buildStudioWorkspaceProjection(lifecycle, { baseMainSha: fullSha });
    const advice = `${projection.recommendedAction} ${projection.summary}`;
    // Path one: fix content → Save → new Publish (new approval).
    expect(advice).toMatch(/save/i);
    expect(advice).toMatch(/publish/i);
    // Path two: leave content unchanged → re-run the check on GitHub; no
    // new approval needed because auto-merge completes on its own.
    expect(advice).toMatch(/without making any changes|unchanged/i);
    expect(advice).toMatch(/no new approval|without needing a new Publish approval/i);
  });
});

describe('checks-passed versus waiting-for-checks derivation (#117)', () => {
  const article = {
    slug: 's',
    title: 'S',
    status: 'draft' as const,
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const pullRequest = {
    number: 5,
    url: 'https://github.com/example/example/pull/5',
    headSha: fullSha,
  };

  const successCheck: StudioCheckEvidence = {
    name: 'verify',
    status: 'completed',
    conclusion: 'success',
  };

  it('labels a concluded-successful check pre-merge as merging, not waiting to start', () => {
    const lifecycle: StudioLifecycle = {
      kind: 'ready',
      article,
      pullRequest,
      check: successCheck,
    };
    const projection = buildStudioWorkspaceProjection(lifecycle, { baseMainSha: fullSha });
    expect(projection.workingChange.label).toBe(studioChecksPassedMerging().label);
    expect(projection.summary).toMatch(/passed/i);
    expect(projection.summary).not.toMatch(/waiting for checks to start/i);
    expect(projection.recommendedAction).toMatch(/merg/i);
    // No new publish is invited while auto-merge finishes.
    expect(projection.recommendedAction).toMatch(/nothing|wait|no action/i);
    expect(projection.actions.publish.available).toBe(false);
    expect(projection.actions.refresh.available).toBe(true);
  });

  it('keeps waiting-to-start copy when no check run exists yet', () => {
    const lifecycle: StudioLifecycle = {
      kind: 'ready',
      article,
      pullRequest,
    };
    const projection = buildStudioWorkspaceProjection(lifecycle, { baseMainSha: fullSha });
    expect(projection.workingChange.label).toBe(STUDIO_WORKING_CHANGE_READY_AWAITING_CHECKS);
    expect(projection.summary).toMatch(/waiting for checks to start/i);
  });

  it('keeps waiting-to-start copy for an unconcluded running check', () => {
    const lifecycle: StudioLifecycle = {
      kind: 'ready',
      article,
      pullRequest,
      check: { name: 'verify', status: 'in_progress', conclusion: null },
    };
    const projection = buildStudioWorkspaceProjection(lifecycle, { baseMainSha: fullSha });
    // A started-but-running check is `checking` upstream; if it ever arrives
    // under `ready` unconcluded, it must not claim passed.
    expect(projection.workingChange.label).toBe(STUDIO_WORKING_CHANGE_READY_AWAITING_CHECKS);
  });
});

describe('concluded-successful check predicate (#117)', () => {
  it('is true only for an observed completed successful check run', () => {
    expect(
      isConcludedSuccessfulCheck({ name: 'verify', status: 'completed', conclusion: 'success' }),
    ).toBe(true);
    expect(
      isConcludedSuccessfulCheck({ name: 'verify', status: 'in_progress', conclusion: null }),
    ).toBe(false);
    expect(isConcludedSuccessfulCheck({ name: 'verify', status: 'queued', conclusion: null })).toBe(
      false,
    );
    expect(
      isConcludedSuccessfulCheck({ name: 'verify', status: 'completed', conclusion: 'failure' }),
    ).toBe(false);
    expect(isConcludedSuccessfulCheck(undefined)).toBe(false);
  });
});

describe('status observation copy (#117)', () => {
  it('renders every observation failure as a sentence without internal codes', () => {
    for (const phase of ['branch', 'pull-request', 'check', 'compile'] as const) {
      for (const reason of ['github', 'topology', 'validation'] as const) {
        const copy = statusObservationCopy(phase, reason);
        expect(copy.endsWith('.')).toBe(true);
        expect(PHASE_CODE_PATTERN.test(copy)).toBe(false);
        // Reason identifiers never surface verbatim ("GitHub" the proper
        // noun is fine; the lowercase internal token is not).
        expect(copy).not.toContain(reason === 'github' ? 'github' : reason);
        expect(copy).not.toContain('unavailable');
      }
    }
    // Known shapes still name what could not be observed.
    expect(statusObservationCopy('check', 'github')).toMatch(/required verification/);
    expect(statusObservationCopy('pull-request', 'topology')).toMatch(/Draft PR/);
    expect(statusObservationCopy('compile', 'validation')).toMatch(/saved draft/);
    // Unknown shapes degrade to a safe generic sentence, never a raw code.
    expect(statusObservationCopy('mystery' as never, 'puzzle' as never)).toMatch(
      /reading the current state/,
    );
  });
});
