import { describe, expect, it } from 'vitest';
import {
  STUDIO_FLOWBOARD_CHECK_KIND,
  buildStudioFlowboardCheckEnvelope,
  decodeStudioFlowboardCheckEnvelope,
  studioFlowboardCheckAnnouncement,
} from './flowboard-envelope';
import type { StudioFlowboardProjection } from './flowboard-projection';

const flowboard: StudioFlowboardProjection = {
  totalCount: 0,
  columns: {
    resumeWork: [],
    readyForDecision: [],
    library: [],
  },
};

describe('studioFlowboardCheckAnnouncement', () => {
  // #116: a check that could not complete is announced as a failure with
  // its cause category and retry guidance — never as success.
  it('announces success only for a checked outcome', () => {
    expect(studioFlowboardCheckAnnouncement('some-article', { outcome: 'checked' })).toBe(
      'Status checked for some-article.',
    );
  });

  it('announces an honest failure with cause category and retry guidance', () => {
    const github = studioFlowboardCheckAnnouncement('some-article', {
      outcome: 'failed',
      reason: 'github',
    });
    expect(github).toContain('Could not check some-article');
    expect(github).toContain('GitHub');
    expect(github.toLowerCase()).toContain('try again');

    const topology = studioFlowboardCheckAnnouncement('other-article', {
      outcome: 'failed',
      reason: 'topology',
    });
    expect(topology).toContain('Could not check other-article');
    expect(topology.toLowerCase()).not.toBe(github.toLowerCase());

    const canonical = studioFlowboardCheckAnnouncement('third-article', {
      outcome: 'failed',
      reason: 'invalid-canonical',
    });
    expect(canonical).toContain('Could not check third-article');
  });
});

describe('decodeStudioFlowboardCheckEnvelope with the check outcome token (#116)', () => {
  it('round-trips a checked outcome through the builder and decoder', () => {
    const envelope = buildStudioFlowboardCheckEnvelope(
      { operationId: 'op-1', submittedSnapshotId: 'snap-1' },
      'some-article',
      flowboard,
      { outcome: 'checked' },
    );
    const decoded = decodeStudioFlowboardCheckEnvelope(envelope);
    expect(decoded).toEqual({
      ok: true,
      value: {
        kind: STUDIO_FLOWBOARD_CHECK_KIND,
        operationId: 'op-1',
        submittedSnapshotId: 'snap-1',
        checkedSlug: 'some-article',
        check: { outcome: 'checked' },
        flowboard,
      },
    });
  });

  it('round-trips a failed outcome including its reason category', () => {
    const envelope = buildStudioFlowboardCheckEnvelope(
      { operationId: 'op-2', submittedSnapshotId: 'snap-2' },
      'some-article',
      flowboard,
      { outcome: 'failed', reason: 'github' },
    );
    expect(decodeStudioFlowboardCheckEnvelope(envelope)).toMatchObject({
      ok: true,
      value: { check: { outcome: 'failed', reason: 'github' } },
    });
  });

  it('rejects an unknown outcome token or reason instead of rendering it', () => {
    const base = buildStudioFlowboardCheckEnvelope(
      { operationId: 'op-3', submittedSnapshotId: 'snap-3' },
      'some-article',
      flowboard,
      { outcome: 'checked' },
    );
    expect(
      decodeStudioFlowboardCheckEnvelope({
        ...base,
        check: { outcome: 'totally-custom' },
      }).ok,
    ).toBe(false);
    expect(decodeStudioFlowboardCheckEnvelope({ ...base, check: undefined }).ok).toBe(false);
    expect(
      decodeStudioFlowboardCheckEnvelope({
        ...base,
        check: { outcome: 'failed', reason: 'nonsense' },
      }).ok,
    ).toBe(false);
  });
});
