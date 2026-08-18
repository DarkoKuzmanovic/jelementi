import { describe, expect, it } from 'vitest';
import { buildStudioActionEnvelope, decodeStudioActionEnvelope } from './action-envelope';
import { buildStudioWorkspaceProjection } from './workspace-projection';
import type { StudioLifecycle } from './contracts';
import type { StudioSaveResult } from '../server/studio/editor.server';

const savedResult: StudioSaveResult = {
  kind: 'saved',
  concurrency: { baseMainSha: 'e'.repeat(40) },
  pullRequest: { number: 12, url: 'https://github.com/example/example/pull/12' },
  compileIssues: [],
};

const lifecycle: StudioLifecycle = {
  kind: 'draft_valid',
  article: {
    slug: 'tristan-da-cunha',
    title: 'Tristan da Cunha',
    status: 'draft',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  branch: {
    name: 'studio/article/tristan-da-cunha',
    url: 'https://github.com/example/example/tree/studio/article/tristan-da-cunha',
    headSha: 'a'.repeat(40),
  },
};

const concurrency = { baseMainSha: 'b'.repeat(40), draftHeadSha: 'c'.repeat(40) };
const base = { operationId: 'op-1', submittedSnapshotId: concurrency.draftHeadSha };

describe('buildStudioActionEnvelope / decodeStudioActionEnvelope', () => {
  it('round-trips a check_status envelope carrying the refreshed workspace projection', () => {
    const workspace = buildStudioWorkspaceProjection(lifecycle, concurrency);
    const envelope = buildStudioActionEnvelope(base, { kind: 'check_status', workspace });

    const decoded = decodeStudioActionEnvelope(envelope);
    expect(decoded).toEqual({ ok: true, value: envelope });
  });

  it('round-trips a save envelope nesting the existing Save result unchanged (#72: "Save nests the existing Save result plus refreshed workspace projection")', () => {
    const workspace = buildStudioWorkspaceProjection(lifecycle, concurrency);
    const envelope = buildStudioActionEnvelope(base, {
      kind: 'save',
      save: savedResult,
      workspace,
    });

    expect(decodeStudioActionEnvelope(envelope)).toEqual({ ok: true, value: envelope });
  });

  it('round-trips every Save result kind, not only the success case', () => {
    const workspace = buildStudioWorkspaceProjection(lifecycle, concurrency);
    const saveResults: StudioSaveResult[] = [
      savedResult,
      { kind: 'save_conflict', loaded: concurrency, current: { baseMainSha: 'f'.repeat(40) } },
      { kind: 'save_failed', phase: 'commit', reason: 'github' },
      { kind: 'save_rejected', compileIssues: [{ code: 'x', message: 'm', sourcePath: 'body' }] },
    ];
    for (const save of saveResults) {
      const envelope = buildStudioActionEnvelope(base, { kind: 'save', save, workspace });
      expect(decodeStudioActionEnvelope(envelope)).toEqual({ ok: true, value: envelope });
    }
  });

  it('rejects a save envelope whose nested Save result has an unrecognized kind', () => {
    const workspace = buildStudioWorkspaceProjection(lifecycle, concurrency);
    const result = decodeStudioActionEnvelope({
      kind: 'save',
      operationId: 'a',
      submittedSnapshotId: 'b',
      save: { kind: 'saved_but_made_up' },
      workspace,
    });
    expect(result.ok).toBe(false);
  });

  it('round-trips a preview envelope nesting the existing preview result unchanged', () => {
    const envelope = buildStudioActionEnvelope(base, {
      kind: 'preview',
      preview: {
        kind: 'preview_issues',
        compileIssues: [{ code: 'x', message: 'm', sourcePath: 'body' }],
      },
    });

    expect(decodeStudioActionEnvelope(envelope)).toEqual({ ok: true, value: envelope });
  });

  it('rejects a preview envelope through the real decodeStudioPreview decoder, not an unchecked cast', () => {
    const result = decodeStudioActionEnvelope({
      kind: 'preview',
      operationId: 'a',
      submittedSnapshotId: 'b',
      // A syntactically string `kind` that decodeStudioPreview still rejects:
      // proves the envelope actually decodes the nested preview result
      // rather than trusting any object with a string `kind` field.
      preview: { kind: 'preview_ok', document: { not: 'a real document' }, compileIssues: [] },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects non-object input', () => {
    expect(decodeStudioActionEnvelope(null).ok).toBe(false);
    expect(decodeStudioActionEnvelope(42).ok).toBe(false);
  });

  it('rejects an unrecognized discriminant', () => {
    const result = decodeStudioActionEnvelope({
      kind: 'unknown',
      operationId: 'a',
      submittedSnapshotId: 'b',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a key not permitted for the given kind', () => {
    const workspace = buildStudioWorkspaceProjection(lifecycle, concurrency);
    const result = decodeStudioActionEnvelope({
      kind: 'check_status',
      operationId: 'a',
      submittedSnapshotId: 'b',
      workspace,
      preview: { kind: 'preview_issues', compileIssues: [] },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects an operation id outside the bounded id grammar', () => {
    const workspace = buildStudioWorkspaceProjection(lifecycle, concurrency);
    const result = decodeStudioActionEnvelope({
      kind: 'check_status',
      operationId: 'has spaces',
      submittedSnapshotId: 'b',
      workspace,
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a malformed nested workspace projection, prefixing issue codes under envelope', () => {
    const result = decodeStudioActionEnvelope({
      kind: 'check_status',
      operationId: 'a',
      submittedSnapshotId: 'b',
      workspace: { bogus: true },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.every((code) => code.startsWith('envelope.workspace'))).toBe(true);
    }
  });
});
