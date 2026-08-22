import { describe, expect, it } from 'vitest';
import type { StudioDraftReplacementResult } from '../server/studio/draft-replacement.server';
import type { StudioSaveResult } from '../server/studio/editor.server';
import type { StudioPublishResult } from '../server/studio/publish.server';
import {
  buildStudioPublishRecovery,
  buildStudioRecoveryProjection,
  buildStudioReplacementRecovery,
  buildStudioSaveRecovery,
} from './recovery-projection';

const slug = 'a-draft-article';
const loaded = {
  baseMainSha: 'a'.repeat(40),
  draftHeadSha: 'b'.repeat(40),
  expectedBlobSha: 'c'.repeat(40),
};

describe('buildStudioSaveRecovery', () => {
  it('returns undefined for saved and save_rejected results', () => {
    const saved: StudioSaveResult = {
      kind: 'saved',
      concurrency: loaded,
      pullRequest: { number: 7, url: 'https://github.com/x/pull/7' },
      compileIssues: [],
    };
    const rejected: StudioSaveResult = { kind: 'save_rejected', compileIssues: [] };
    expect(buildStudioSaveRecovery(saved)).toBeUndefined();
    expect(buildStudioSaveRecovery(rejected)).toBeUndefined();
  });

  it('presents a save conflict with comparison evidence and no replacement offer by default', () => {
    const conflict: StudioSaveResult = {
      kind: 'save_conflict',
      loaded,
      current: { baseMainSha: 'd'.repeat(40), draftHeadSha: 'e'.repeat(40) },
    };

    const recovery = buildStudioSaveRecovery(conflict);
    expect(recovery).toBeDefined();
    expect(recovery?.operation).toBe('save');
    expect(recovery?.tone).toBe('conflict');
    expect(recovery?.offerReplacement).toBe(false);
    expect(recovery?.whatHappened).toContain('moved on GitHub');
    expect(recovery?.workSafety).toContain('preserved');
    expect(recovery?.readerEffect).toContain('Readers');
    expect(recovery?.nextAction).toBeTruthy();
    const labels = recovery?.comparison?.map((row) => row.label);
    expect(labels).toEqual(['Main', 'Draft head', 'Article blob']);
    const main = recovery?.comparison?.[0];
    expect(main?.loaded).toBe(loaded.baseMainSha.slice(0, 7));
    expect(main?.current).toBe('d'.repeat(40).slice(0, 7));
  });

  it('names the existing draft and offers open/rename/discard paths for a draft-exists conflict', () => {
    const conflict: StudioSaveResult = {
      kind: 'save_conflict',
      loaded: { baseMainSha: 'a'.repeat(40) },
      current: { baseMainSha: 'a'.repeat(40), draftHeadSha: 'e'.repeat(40) },
      draftExists: { pullRequestNumber: 42 },
    };

    const recovery = buildStudioSaveRecovery(conflict);

    expect(recovery?.operation).toBe('save');
    expect(recovery?.tone).toBe('conflict');
    expect(recovery?.heading.toLowerCase()).toContain(
      'a studio draft for this slug already exists',
    );
    expect(recovery?.whatHappened).toContain('#42');
    expect(recovery?.workSafety).toContain('preserved');
    expect(recovery?.offerReplacement).toBe(false);
    const nextAction = recovery?.nextAction.toLowerCase() ?? '';
    expect(nextAction).toContain('open');
    expect(nextAction).toContain('discard');
    // The loaded-versus-current comparison stays available for review.
    const labels = recovery?.comparison?.map((row) => row.label);
    expect(labels).toEqual(['Main', 'Draft head']);
  });

  it('omits the pull-request reference for a draft-exists conflict without an open PR', () => {
    const conflict: StudioSaveResult = {
      kind: 'save_conflict',
      loaded: { baseMainSha: 'a'.repeat(40) },
      current: { baseMainSha: 'd'.repeat(40), draftHeadSha: 'e'.repeat(40) },
      draftExists: {},
    };

    const recovery = buildStudioSaveRecovery(conflict);

    expect(recovery?.heading.toLowerCase()).toContain(
      'a studio draft for this slug already exists',
    );
    expect(recovery?.whatHappened).not.toContain('#undefined');
    expect(recovery?.nextAction.toLowerCase()).toContain('discard');
  });

  it('shows "none" for absent loaded evidence in comparisons', () => {
    const conflict: StudioSaveResult = {
      kind: 'save_conflict',
      loaded: { baseMainSha: 'a'.repeat(40) },
      current: { baseMainSha: 'd'.repeat(40) },
    };

    const recovery = buildStudioSaveRecovery(conflict);
    const draftHead = recovery?.comparison?.[1];
    expect(draftHead?.loaded).toBe('none');
    expect(draftHead?.current).toBe('none');
  });

  it('offers replacement only with the server-read eligibility evidence attached', () => {
    const conflict: StudioSaveResult = {
      kind: 'save_conflict',
      loaded,
      current: { baseMainSha: 'd'.repeat(40), draftHeadSha: loaded.draftHeadSha },
      replacementAvailable: {
        target: {
          path: `content/articles/${slug}.md`,
          loadedBlobSha: '1'.repeat(40),
          freshBlobSha: '1'.repeat(40),
        },
      },
    };

    const recovery = buildStudioSaveRecovery(conflict);
    expect(recovery?.offerReplacement).toBe(true);
    expect(recovery?.nextAction).toContain('Replace');
    expect(recovery?.nextAction).toContain('fresh Publish');
    // The offered path shows the loaded-versus-fresh article blob the server
    // actually read — never an unread placeholder.
    const labels = recovery?.comparison?.map((row) => row.label);
    expect(labels).toEqual(['Main', 'Draft head', 'Article on main']);
    const articleRow = recovery?.comparison?.[2];
    // #117: operational comparison tables carry short digests only.
    expect(articleRow?.loaded).toBe('1'.repeat(40).slice(0, 7));
    expect(articleRow?.current).toBe('1'.repeat(40).slice(0, 7));
    expect(recovery?.comparison?.some((row) => row.current === 'not read')).toBe(false);
    expect(recovery?.evidence).toEqual([
      { label: 'Article path', value: `content/articles/${slug}.md` },
      { label: 'Draft article blob (expected)', value: loaded.expectedBlobSha.slice(0, 7) },
    ]);
  });

  it('shows absent article blobs as absent in an offered comparison', () => {
    const conflict: StudioSaveResult = {
      kind: 'save_conflict',
      loaded,
      current: { baseMainSha: 'd'.repeat(40), draftHeadSha: loaded.draftHeadSha },
      replacementAvailable: { target: { path: `content/articles/${slug}.md` } },
    };

    const recovery = buildStudioSaveRecovery(conflict);
    const articleRow = recovery?.comparison?.[2];
    expect(articleRow).toEqual({ label: 'Article on main', loaded: 'absent', current: 'absent' });
  });

  it('presents a committed pull-request failure as resumable', () => {
    const failed: StudioSaveResult = {
      kind: 'save_failed',
      phase: 'pull-request',
      reason: 'github',
      concurrency: { ...loaded, draftHeadSha: 'f'.repeat(40) },
    };

    const recovery = buildStudioSaveRecovery(failed);
    expect(recovery?.tone).toBe('failure');
    expect(recovery?.whatHappened).toContain('committed');
    expect(recovery?.workSafety).toContain('preserved');
    expect(recovery?.nextAction).toContain('Save');
    expect(recovery?.nextAction).toContain('duplicate');
    expect(recovery?.offerReplacement).toBe(false);
  });

  it('presents a pre-commit failure as leaving GitHub unchanged', () => {
    const failed: StudioSaveResult = {
      kind: 'save_failed',
      phase: 'commit',
      reason: 'github',
    };

    const recovery = buildStudioSaveRecovery(failed);
    expect(recovery?.whatHappened).toMatch(/nothing was changed/i);
    expect(recovery?.nextAction).toContain('Save');
  });

  it('presents a topology failure as requiring GitHub review', () => {
    const failed: StudioSaveResult = {
      kind: 'save_failed',
      phase: 'pull-request',
      reason: 'topology',
    };

    const recovery = buildStudioSaveRecovery(failed);
    // #117: the internal phase code is gone; the sentence names the real
    // situation instead.
    expect(recovery?.whatHappened).not.toContain(failed.phase);
    expect(recovery?.whatHappened).toContain('single-draft shape');
    expect(recovery?.nextAction).toContain('GitHub');
  });
});

describe('buildStudioPublishRecovery', () => {
  it('returns undefined for a successful publish', () => {
    const published: StudioPublishResult = {
      kind: 'published',
      pullRequest: { number: 3, url: 'https://github.com/x/pull/3' },
      headSha: 'b'.repeat(40),
    };
    expect(buildStudioPublishRecovery(published)).toBeUndefined();
  });

  it('presents a publish conflict with head comparison', () => {
    const conflict: StudioPublishResult = {
      kind: 'publish_conflict',
      expectedHeadSha: 'b'.repeat(40),
      currentHeadSha: 'e'.repeat(40),
    };

    const recovery = buildStudioPublishRecovery(conflict);
    expect(recovery?.operation).toBe('publish');
    expect(recovery?.tone).toBe('conflict');
    // The next action must never suggest a reload that would discard the
    // submitted candidate without warning.
    expect(recovery?.nextAction).toContain('new tab');
    expect(recovery?.nextAction).toContain('Copy your candidate');
    expect(recovery?.comparison?.[0]).toEqual({
      label: 'Draft head',
      loaded: 'b'.repeat(40).slice(0, 7),
      current: 'e'.repeat(40).slice(0, 7),
    });
    expect(recovery?.workSafety).toContain('draft');
    expect(recovery?.readerEffect).toContain('Readers');
  });

  it('describes a missing branch in a publish conflict', () => {
    const conflict: StudioPublishResult = {
      kind: 'publish_conflict',
      expectedHeadSha: 'b'.repeat(40),
      currentHeadSha: null,
    };

    const recovery = buildStudioPublishRecovery(conflict);
    expect(recovery?.comparison?.[0]?.current).toBe('branch not found');
  });

  it('directs unsaved-editor-changes rejections to Save first', () => {
    const rejected: StudioPublishResult = {
      kind: 'publish_rejected',
      compileIssues: [
        {
          code: 'UNSAVED_EDITOR_CHANGES',
          message: 'Save the current form before publishing.',
          sourcePath: `content/articles/${slug}.md`,
        },
      ],
    };

    const recovery = buildStudioPublishRecovery(rejected);
    expect(recovery?.tone).toBe('conflict');
    expect(recovery?.nextAction).toContain('Save');
    expect(recovery?.offerReplacement).toBe(false);
  });

  it('directs validation rejections to the validation summary', () => {
    const rejected: StudioPublishResult = {
      kind: 'publish_rejected',
      compileIssues: [
        {
          code: 'UNSUPPORTED_NODE',
          message: 'Unsupported heading level.',
          sourcePath: `content/articles/${slug}.md`,
        },
      ],
    };

    const recovery = buildStudioPublishRecovery(rejected);
    expect(recovery?.tone).toBe('failure');
    expect(recovery?.nextAction).toContain('validation');
  });

  it('sends late-phase publish failures to status rediscovery', () => {
    for (const phase of ['ready', 'auto-merge'] as const) {
      const failed: StudioPublishResult = { kind: 'publish_failed', phase, reason: 'github' };
      const recovery = buildStudioPublishRecovery(failed);
      expect(recovery?.tone).toBe('failure');
      expect(recovery?.nextAction).toContain('Check status');
    }
  });

  it('lets early-phase publish failures retry Publish', () => {
    const failed: StudioPublishResult = {
      kind: 'publish_failed',
      phase: 'branch',
      reason: 'github',
    };
    const recovery = buildStudioPublishRecovery(failed);
    expect(recovery?.nextAction).toContain('Publish');
  });
});

describe('buildStudioReplacementRecovery', () => {
  const candidate = { metadata: { title: 'T' }, body: 'Body.' } as never;

  it('presents a successful replacement requiring fresh validation and Publish', () => {
    const replaced: StudioDraftReplacementResult = {
      kind: 'replaced',
      candidate,
      concurrency: { baseMainSha: 'd'.repeat(40), draftHeadSha: 'f'.repeat(40) },
      branch: {
        name: `studio/article/${slug}`,
        headSha: 'f'.repeat(40),
        url: 'https://github.com/x/tree/b',
      },
      pullRequest: { number: 9, url: 'https://github.com/x/pull/9' },
      compileIssues: [],
    };

    const recovery = buildStudioReplacementRecovery(replaced);
    expect(recovery?.operation).toBe('replace');
    expect(recovery?.tone).toBe('success');
    expect(recovery?.nextAction).toContain('fresh Publish');
    expect(recovery?.nextAction).toContain('approval');
    expect(recovery?.workSafety).toContain('candidate');
    const prRow = recovery?.evidence.find((row) => row.label === 'Draft PR');
    expect(prRow?.url).toBe('https://github.com/x/pull/9');
  });

  it('presents fail-closed conflicts with sanitized evidence rows', () => {
    const conflict: StudioDraftReplacementResult = {
      kind: 'replacement_conflict',
      candidate,
      phase: 'verify-target',
      reason: 'not-eligible',
      mutation: 'none',
      evidence: {
        mainSha: 'd'.repeat(40),
        target: {
          path: `content/articles/${slug}.md`,
          loadedBlobSha: 'c'.repeat(40),
          freshBlobSha: '9'.repeat(40),
        },
      },
    };

    const recovery = buildStudioReplacementRecovery(conflict);
    expect(recovery?.tone).toBe('conflict');
    // #117: no internal phase identifier surfaces; the reason's plain
    // sentence owns the explanation.
    expect(recovery?.whatHappened).not.toContain(conflict.phase);
    expect(recovery?.whatHappened).toContain('a newer change to the article on main');
    expect(recovery?.whatHappened).not.toContain('someone else');
    expect(recovery?.workSafety).toContain('preserved');
    expect(recovery?.workSafety).toContain('changed nothing on GitHub');
    expect(recovery?.nextAction).toBeTruthy();
    const labels = recovery?.evidence.map((row) => row.label);
    expect(labels).toContain('Fresh main');
    expect(labels).toContain('Article blob (loaded)');
    expect(labels).toContain('Article blob (fresh)');
  });

  it('shows absent blobs as absent in evidence', () => {
    const conflict: StudioDraftReplacementResult = {
      kind: 'replacement_conflict',
      candidate,
      phase: 'verify-target',
      reason: 'not-eligible',
      mutation: 'none',
      evidence: {
        target: { path: `content/articles/${slug}.md` },
      },
    };

    const recovery = buildStudioReplacementRecovery(conflict);
    const loadedRow = recovery?.evidence.find((row) => row.label === 'Article blob (loaded)');
    expect(loadedRow?.value).toBe('absent');
  });

  it('describes moved-head conflicts with rediscovery guidance', () => {
    const conflict: StudioDraftReplacementResult = {
      kind: 'replacement_conflict',
      candidate,
      phase: 'verify-loaded-head',
      reason: 'moved-head',
      mutation: 'none',
      evidence: {},
    };

    const recovery = buildStudioReplacementRecovery(conflict);
    expect(recovery?.whatHappened).toContain('moved');
    expect(recovery?.nextAction).toContain('new tab');
    expect(recovery?.nextAction).toContain('Copy your candidate');
  });

  it('describes merged conflicts as already published work', () => {
    const conflict: StudioDraftReplacementResult = {
      kind: 'replacement_conflict',
      candidate,
      phase: 'discover-pull-request',
      reason: 'merged',
      mutation: 'none',
      evidence: {
        pullRequest: {
          number: 4,
          url: 'https://github.com/x/pull/4',
          state: 'closed',
          draft: false,
        },
      },
    };

    const recovery = buildStudioReplacementRecovery(conflict);
    expect(recovery?.whatHappened).toContain('merged');
    expect(recovery?.readerEffect).toContain('readers may already see the draft');
    const prRow = recovery?.evidence.find((row) => row.label === 'Draft PR');
    expect(prRow?.url).toBe('https://github.com/x/pull/4');
    expect(prRow?.value).toContain('closed');
  });

  it('presents post-mutation partial failures truthfully, without a Save-resume claim', () => {
    const failed: StudioDraftReplacementResult = {
      kind: 'replacement_failed',
      candidate,
      phase: 'commit-candidate',
      reason: 'github',
      mutation: 'partial',
      evidence: {
        branch: {
          name: `studio/article/${slug}`,
          headSha: 'd'.repeat(40),
          url: 'https://github.com/x/tree/b',
        },
      },
    };

    const recovery = buildStudioReplacementRecovery(failed);
    expect(recovery?.tone).toBe('failure');
    // #117: the phase becomes a sentence about committing the candidate.
    expect(recovery?.whatHappened).not.toContain(failed.phase);
    expect(recovery?.whatHappened).toContain('committed to the fresh draft branch');
    expect(recovery?.workSafety).toContain('preserved');
    expect(recovery?.workSafety).toContain('may already be closed');
    expect(recovery?.workSafety).not.toContain('No branch or Draft PR was deleted');
    expect(recovery?.nextAction).toContain('new tab');
    expect(recovery?.nextAction).toContain('your candidate stays in this form');
    expect(recovery?.nextAction).not.toContain('Save again');
    const branchRow = recovery?.evidence.find((row) => row.label === 'Branch');
    expect(branchRow?.url).toBe('https://github.com/x/tree/b');
  });

  it('offers the Save re-check retry only for failures that provably changed nothing', () => {
    const failed: StudioDraftReplacementResult = {
      kind: 'replacement_failed',
      candidate,
      phase: 'discover-main',
      reason: 'github',
      mutation: 'none',
      evidence: {},
    };

    const recovery = buildStudioReplacementRecovery(failed);
    expect(recovery?.workSafety).toContain('changed nothing on GitHub');
    expect(recovery?.nextAction).toContain('Save re-checks the conflict');
    expect(recovery?.nextAction).toContain('only when it is still safe');
  });

  it('hedges a failed final confirmation as possibly complete', () => {
    const failed: StudioDraftReplacementResult = {
      kind: 'replacement_failed',
      candidate,
      phase: 'confirm-replacement',
      reason: 'github',
      mutation: 'partial',
      evidence: {},
    };

    const recovery = buildStudioReplacementRecovery(failed);
    expect(recovery?.whatHappened).toContain('may even have completed');
    expect(recovery?.nextAction).toContain('new tab');
  });

  it('keeps partial conflicts truthful about prior mutations', () => {
    const conflict: StudioDraftReplacementResult = {
      kind: 'replacement_conflict',
      candidate,
      phase: 'delete-branch',
      reason: 'moved-head',
      mutation: 'partial',
      evidence: {},
    };

    const recovery = buildStudioReplacementRecovery(conflict);
    expect(recovery?.workSafety).toContain('may already be closed');
    expect(recovery?.workSafety).not.toContain('No branch or Draft PR was deleted');
  });

  it('never claims an ambiguous topology touched nothing', () => {
    const conflict: StudioDraftReplacementResult = {
      kind: 'replacement_conflict',
      candidate,
      phase: 'confirm-pull-request',
      reason: 'topology',
      mutation: 'partial',
      evidence: {},
    };

    const recovery = buildStudioReplacementRecovery(conflict);
    expect(recovery?.whatHappened).toContain('stopped for a manual review');
    expect(recovery?.whatHappened).not.toContain('was touched');
    expect(recovery?.nextAction).toContain('resolve the ambiguity');
  });
});

describe('buildStudioRecoveryProjection', () => {
  it('prefers replacement over publish over save', () => {
    const save: StudioSaveResult = {
      kind: 'save_failed',
      phase: 'commit',
      reason: 'github',
    };
    const publish: StudioPublishResult = {
      kind: 'publish_failed',
      phase: 'branch',
      reason: 'github',
    };
    const replacement: StudioDraftReplacementResult = {
      kind: 'replacement_failed',
      candidate: { metadata: {}, body: '' } as never,
      phase: 'delete-branch',
      reason: 'github',
      mutation: 'partial',
      evidence: {},
    };

    expect(buildStudioRecoveryProjection({ save, publish, replacement })?.operation).toBe(
      'replace',
    );
    expect(buildStudioRecoveryProjection({ save, publish })?.operation).toBe('publish');
    expect(buildStudioRecoveryProjection({ save })?.operation).toBe('save');
    expect(buildStudioRecoveryProjection({})).toBeUndefined();
  });
});
