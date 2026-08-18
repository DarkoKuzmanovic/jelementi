import { decodeStudioPreview, type StudioPreviewResult } from './contracts';
import {
  decodeStudioWorkspaceProjection,
  type StudioWorkspaceProjection,
} from './workspace-projection';
// Type-only: erased at build time (no runtime reference survives
// compilation), so this never crosses the $lib/server boundary into a
// built bundle — confirmed by scripts/verify-web.ts's client-bundle scan.
// `StudioSaveResult` is the existing domain result Save already nests here
// per #72's action-response envelope contract ("Save nests the existing
// Save result plus refreshed workspace projection/concurrency").
import type { StudioSaveResult } from '../server/studio/editor.server';

/**
 * Internal action-response envelope for the Studio Preview / Save / Check
 * status route actions (#72: "Add one decoded Studio action-response
 * envelope with discriminants for Preview, Save, and Check status. Every
 * envelope carries an operation id and submitted-snapshot id; Preview
 * nests the existing Preview result, Save nests the existing Save result
 * plus refreshed workspace projection/concurrency, and Check status
 * carries the refreshed workspace projection. Full-navigation rendering
 * and enhanced rendering consume the same envelope; only delivery
 * differs."). This slice (#73) only establishes and tests the envelope
 * shape; it is not yet wired to any live route action or to client JS
 * (deferred to the later enhancement slice, #72's slice 4).
 *
 * Preview nests the existing `StudioPreviewResult` domain contract
 * unchanged (decoded via the same `decodeStudioPreview` the rest of the
 * codebase trusts). Save nests the existing `StudioSaveResult` domain
 * result. Save and Check status both carry a refreshed
 * `StudioWorkspaceProjection` so the caller always has the latest
 * two-axis facts without a second round trip. The existing public route
 * action results (`preview`/`save`/`status` keys on `form`) are untouched
 * by this module — it composes them, it does not replace them.
 */

const MAX_ID = 200;
const ID_PATTERN = /^[A-Za-z0-9._-]{1,200}$/;
const STUDIO_SAVE_RESULT_KINDS = [
  'saved',
  'save_conflict',
  'save_failed',
  'save_rejected',
] as const;

export interface StudioActionEnvelopeBase {
  operationId: string;
  submittedSnapshotId: string;
}

export type StudioActionEnvelope =
  | (StudioActionEnvelopeBase & { kind: 'preview'; preview: StudioPreviewResult })
  | (StudioActionEnvelopeBase & {
      kind: 'save';
      save: StudioSaveResult;
      workspace: StudioWorkspaceProjection;
    })
  | (StudioActionEnvelopeBase & { kind: 'check_status'; workspace: StudioWorkspaceProjection });

export function buildStudioActionEnvelope(
  base: StudioActionEnvelopeBase,
  payload:
    | { kind: 'preview'; preview: StudioPreviewResult }
    | { kind: 'save'; save: StudioSaveResult; workspace: StudioWorkspaceProjection }
    | { kind: 'check_status'; workspace: StudioWorkspaceProjection },
): StudioActionEnvelope {
  return { ...base, ...payload } as StudioActionEnvelope;
}

export interface DecodeSuccess<T> {
  ok: true;
  value: T;
}
export interface DecodeFailure {
  ok: false;
  issues: string[];
}
export type DecodeResult<T> = DecodeSuccess<T> | DecodeFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function issue(path: string, issues: string[], code: string): void {
  issues.push(`${path}.${code}`);
}

function idValue(value: unknown, path: string, issues: string[]): string | undefined {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_ID ||
    !ID_PATTERN.test(value)
  ) {
    issue(path, issues, 'id');
    return undefined;
  }
  return value;
}

/**
 * A bounded discriminant check for the nested `StudioSaveResult`: its
 * `kind` must be one of the four literals Save can actually produce.
 * Deeper field validation is deliberately not duplicated here — like
 * every other Studio route action result in this codebase (e.g.
 * `StudioPublishActionData`, `StudioUnpublishActionData`), `StudioSaveResult`
 * is always constructed by trusted server code within the same request,
 * never decoded from untrusted wire input; #72 explicitly warns nested
 * results "must not [be] reinterpret[ed]", so this checks the shape is the
 * one the domain actually produces without re-deriving its meaning.
 */
function saveResultKindValue(value: unknown, path: string, issues: string[]): boolean {
  if (
    typeof value !== 'string' ||
    !(STUDIO_SAVE_RESULT_KINDS as readonly string[]).includes(value)
  ) {
    issue(path, issues, 'kind');
    return false;
  }
  return true;
}

export function decodeStudioActionEnvelope(input: unknown): DecodeResult<StudioActionEnvelope> {
  const issues: string[] = [];
  if (!isRecord(input)) return { ok: false, issues: ['envelope.object'] };

  const kind = input.kind;
  if (kind !== 'preview' && kind !== 'save' && kind !== 'check_status') {
    return { ok: false, issues: ['envelope.kind'] };
  }

  const allowedByKind: Readonly<Record<string, readonly string[]>> = {
    preview: ['kind', 'operationId', 'submittedSnapshotId', 'preview'],
    save: ['kind', 'operationId', 'submittedSnapshotId', 'save', 'workspace'],
    check_status: ['kind', 'operationId', 'submittedSnapshotId', 'workspace'],
  };
  const allowed = allowedByKind[kind];
  if (allowed === undefined) return { ok: false, issues: ['envelope.kind'] };

  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) issue('envelope', issues, 'unknownKey');
  }
  if (issues.length > 0) return { ok: false, issues };

  const operationId = idValue(input.operationId, 'envelope.operationId', issues);
  const submittedSnapshotId = idValue(
    input.submittedSnapshotId,
    'envelope.submittedSnapshotId',
    issues,
  );
  if (issues.length > 0 || operationId === undefined || submittedSnapshotId === undefined) {
    return { ok: false, issues };
  }

  if (kind === 'preview') {
    const preview = decodeStudioPreview(input.preview);
    if (!preview.ok) {
      return { ok: false, issues: preview.issues.map((code) => `envelope.${code}`) };
    }
    return {
      ok: true,
      value: { kind: 'preview', operationId, submittedSnapshotId, preview: preview.value },
    };
  }

  const workspace = decodeStudioWorkspaceProjection(input.workspace);
  if (!workspace.ok) {
    return { ok: false, issues: workspace.issues.map((code) => `envelope.${code}`) };
  }

  if (kind === 'save') {
    if (
      !isRecord(input.save) ||
      !saveResultKindValue(input.save.kind, 'envelope.save.kind', issues)
    ) {
      return { ok: false, issues: issues.length > 0 ? issues : ['envelope.save.object'] };
    }
    return {
      ok: true,
      value: {
        kind: 'save',
        operationId,
        submittedSnapshotId,
        save: input.save as StudioSaveResult,
        workspace: workspace.value,
      },
    };
  }

  return {
    ok: true,
    value: { kind: 'check_status', operationId, submittedSnapshotId, workspace: workspace.value },
  };
}
