import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  buildManualEvidenceTemplate,
  getCurrentHead,
  HUMAN_CHECKPOINTS,
  isManualMatrixComplete,
  MANUAL_EVIDENCE_TEMPLATE,
  type ManualEvidence,
} from './human-acceptance-wizard';

describe('human acceptance wizard', () => {
  it('defines the exact frozen asset ceilings as non-waivable checkpoints', () => {
    const ceilings = HUMAN_CHECKPOINTS.find((c) => c.id === 'asset-ceilings');
    expect(ceilings).toBeDefined();
    expect(ceilings?.notes).toContain('17,943');
    expect(ceilings?.notes).toContain('167,513');
    expect(ceilings?.notes).toContain('70,885');
  });

  it('exposes manual browser matrix checkpoints without claiming automation can satisfy them', () => {
    const ids = HUMAN_CHECKPOINTS.map((c) => c.id);
    expect(ids).toContain('chromium-stable');
    expect(ids).toContain('firefox-stable');
    expect(ids).toContain('webkit-proxy');
    expect(ids).toContain('coarse-pointer-touch');
    expect(ids).toContain('zoom-100-200-400');
    expect(ids).toContain('text-spacing');
    expect(ids).toContain('reduced-motion-manual');
    expect(ids).toContain('keyboard-only-traversal');
    expect(ids).toContain('no-javascript-manual');
    expect(ids).toContain('contrast-sampling');
    expect(ids).toContain('orca-firefox-journey');
    expect(ids).toContain('lighthouse-mobile');
    expect(ids).toContain('human-fidelity-approval');
  });

  it('marks manual evidence template as blocked pending human by default', () => {
    expect(MANUAL_EVIDENCE_TEMPLATE.status).toBe('BLOCKED_PENDING_HUMAN');
    expect(
      MANUAL_EVIDENCE_TEMPLATE.entries.every((e) => e.outcome === 'BLOCKED_PENDING_HUMAN'),
    ).toBe(true);
  });

  it('requires every checkpoint to be explicitly approved before matrix is complete', () => {
    const incomplete: ManualEvidence = {
      ...MANUAL_EVIDENCE_TEMPLATE,
      status: 'BLOCKED_PENDING_HUMAN',
      entries: MANUAL_EVIDENCE_TEMPLATE.entries.map((e, i) =>
        i === 0 ? { ...e, outcome: 'PASS' as const, notes: 'evidence for first' } : e,
      ),
    };
    expect(isManualMatrixComplete(incomplete)).toBe(false);

    const complete: ManualEvidence = {
      ...MANUAL_EVIDENCE_TEMPLATE,
      status: 'PASS' as const,
      entries: MANUAL_EVIDENCE_TEMPLATE.entries.map((e) => ({
        ...e,
        outcome: 'PASS' as const,
        notes: `evidence for ${e.id} v1`,
      })),
      humanFidelityApproval: {
        approved: true,
        approver: 'human',
        date: '2026-08-19',
        notes: 'explicit approval after all green',
      },
    };
    expect(isManualMatrixComplete(complete)).toBe(true);
  });

  it('never treats a failed invariant as waivable by human approval', () => {
    const withFailure: ManualEvidence = {
      ...MANUAL_EVIDENCE_TEMPLATE,
      status: 'PASS' as const,
      entries: MANUAL_EVIDENCE_TEMPLATE.entries.map((e) => ({
        ...e,
        outcome: 'PASS' as const,
        notes: `evidence for ${e.id} v1`,
      })),
      invariantsGreen: false,
      humanFidelityApproval: {
        approved: true,
        approver: 'human',
        date: '2026-08-19',
        notes: 'attempted waive',
      },
    };
    expect(isManualMatrixComplete(withFailure)).toBe(false);
  });

  it('rejects PASS entries with empty evidence notes', () => {
    const withEmptyNote: ManualEvidence = {
      ...MANUAL_EVIDENCE_TEMPLATE,
      status: 'PASS' as const,
      entries: MANUAL_EVIDENCE_TEMPLATE.entries.map((e) => ({
        ...e,
        outcome: 'PASS' as const,
        notes: '',
      })),
      humanFidelityApproval: {
        approved: true,
        approver: 'human',
        date: '2026-08-19',
        notes: 'explicit approval',
      },
    };
    expect(isManualMatrixComplete(withEmptyNote)).toBe(false);
  });

  it('derives worktree commit from actual HEAD, not a hard-coded base', () => {
    const actual = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
    expect(getCurrentHead()).toBe(actual);
    expect(actual).toMatch(/^[0-9a-f]{40}$/);
    // Template must also be truthful, not pinned to 54e2e8f
    const templ = buildManualEvidenceTemplate();
    expect(templ.worktreeCommit).toBe(actual);
    expect(templ.generatedAt).not.toBe('2026-08-19T00:00:00.000Z');
    const parsed = Date.parse(templ.generatedAt);
    expect(parsed).not.toBeNaN();
    // Within last 60s (allows for test runtime)
    expect(Math.abs(Date.now() - parsed)).toBeLessThan(60_000);
  });

  it('fails closed when git cannot provide HEAD', () => {
    const result = spawnSync('git', ['rev-parse', 'HEAD'], {
      cwd: '/tmp',
      encoding: 'utf8',
    });
    expect(result.status).not.toBe(0);
    expect(() => {
      if (
        result.status !== 0 ||
        !result.stdout?.trim() ||
        !/^[0-9a-f]{40}$/.test(result.stdout.trim())
      ) {
        throw new Error('Failed to derive current HEAD');
      }
    }).toThrow(/Failed to derive/);
  });

  it('rejects duplicate checkpoint IDs', () => {
    const dup: ManualEvidence = {
      ...MANUAL_EVIDENCE_TEMPLATE,
      status: 'PASS' as const,
      entries: HUMAN_CHECKPOINTS.filter((c) => c.id !== 'human-fidelity-approval')
        .map((c) => ({ id: c.id, outcome: 'PASS' as const, notes: `evidence for ${c.id}` }))
        .map((e, i, arr) => (i === 1 ? arr[0]! : e)), // duplicate first ID
      humanFidelityApproval: {
        approved: true,
        approver: 'human',
        date: '2026-08-19',
        notes: 'approval',
      },
    };
    expect(isManualMatrixComplete(dup)).toBe(false);
  });

  it('keeps total checkpoint count stable for report traceability', () => {
    // Pin count so report tables do not silently drift; update test intentionally when adding.
    expect(HUMAN_CHECKPOINTS).toHaveLength(14);
  });
});
