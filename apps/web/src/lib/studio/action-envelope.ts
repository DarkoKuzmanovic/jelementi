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
import type {
  StudioValidationIssueView,
  StudioValidationProjection,
  StudioValidationTarget,
} from '../server/studio/validation-projection.server';

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
      validation?: StudioValidationProjection;
    })
  | (StudioActionEnvelopeBase & { kind: 'check_status'; workspace: StudioWorkspaceProjection });

export function buildStudioActionEnvelope(
  base: StudioActionEnvelopeBase,
  payload:
    | { kind: 'preview'; preview: StudioPreviewResult }
    | {
        kind: 'save';
        save: StudioSaveResult;
        workspace: StudioWorkspaceProjection;
        validation?: StudioValidationProjection;
      }
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

const VALIDATION_PHASES = ['metadata', 'media', 'body', 'model', 'compile'] as const;

function boundedText(
  value: unknown,
  path: string,
  issues: string[],
  max: number,
): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) {
    issue(path, issues, 'text');
    return undefined;
  }
  return value;
}

function validationTargetValue(
  value: unknown,
  path: string,
  issues: string[],
): StudioValidationTarget | undefined {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    issue(path, issues, 'target');
    return undefined;
  }
  const allowedByKind: Readonly<Record<string, readonly string[]>> = {
    field: ['kind', 'controlId', 'label'],
    body: ['kind', 'controlId', 'bodyLine', 'bodyColumn', 'selectionStart', 'selectionEnd'],
    source: ['kind'],
  };
  const allowed = allowedByKind[value.kind];
  if (allowed === undefined) {
    issue(path, issues, 'kind');
    return undefined;
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) issue(path, issues, 'unknownKey');
  }
  if (value.kind === 'source') return issues.length === 0 ? { kind: 'source' } : undefined;
  const controlId = boundedText(value.controlId, `${path}.controlId`, issues, 200);
  if (value.kind === 'field') {
    const label = boundedText(value.label, `${path}.label`, issues, 200);
    return controlId === undefined || label === undefined
      ? undefined
      : { kind: 'field', controlId, label };
  }
  const integers = ['bodyLine', 'bodyColumn', 'selectionStart', 'selectionEnd'] as const;
  for (const key of integers) {
    if (
      typeof value[key] !== 'number' ||
      !Number.isInteger(value[key]) ||
      value[key] < (key.startsWith('selection') ? 0 : 1) ||
      value[key] > 2_000_000
    ) {
      issue(`${path}.${key}`, issues, 'integer');
    }
  }
  if (controlId !== 'studio-body' || issues.length > 0) return undefined;
  return {
    kind: 'body',
    controlId: 'studio-body',
    bodyLine: value.bodyLine as number,
    bodyColumn: value.bodyColumn as number,
    selectionStart: value.selectionStart as number,
    selectionEnd: value.selectionEnd as number,
  };
}

function validationViewValue(
  value: unknown,
  path: string,
  issues: string[],
): StudioValidationIssueView | undefined {
  if (!isRecord(value)) {
    issue(path, issues, 'object');
    return undefined;
  }
  for (const key of Object.keys(value)) {
    if (!['issue', 'phase', 'location', 'target'].includes(key)) issue(path, issues, 'unknownKey');
  }
  const decodedIssue = decodeStudioPreview({
    kind: 'preview_issues',
    compileIssues: [value.issue],
  });
  if (!decodedIssue.ok || decodedIssue.value.kind !== 'preview_issues') {
    issue(`${path}.issue`, issues, 'issue');
  }
  const phase = value.phase;
  if (typeof phase !== 'string' || !(VALIDATION_PHASES as readonly string[]).includes(phase)) {
    issue(`${path}.phase`, issues, 'phase');
  }
  const location = boundedText(value.location, `${path}.location`, issues, 3_000);
  const target = validationTargetValue(value.target, `${path}.target`, issues);
  const compileIssue =
    decodedIssue.ok && decodedIssue.value.kind === 'preview_issues'
      ? decodedIssue.value.compileIssues[0]
      : undefined;
  if (
    issues.length > 0 ||
    compileIssue === undefined ||
    location === undefined ||
    target === undefined
  ) {
    return undefined;
  }
  return {
    issue: compileIssue,
    phase: phase as StudioValidationIssueView['phase'],
    location,
    target,
  };
}

function validationProjectionValue(
  value: unknown,
  path: string,
  issues: string[],
): StudioValidationProjection | undefined {
  if (!isRecord(value)) {
    issue(path, issues, 'object');
    return undefined;
  }
  for (const key of Object.keys(value)) {
    if (!['count', 'severity', 'phases', 'summary', 'first', 'issues'].includes(key)) {
      issue(path, issues, 'unknownKey');
    }
  }
  if (!Array.isArray(value.issues) || value.issues.length === 0 || value.issues.length > 100) {
    issue(`${path}.issues`, issues, 'array');
    return undefined;
  }
  const views: StudioValidationIssueView[] = [];
  for (const [index, entry] of value.issues.entries()) {
    const decoded = validationViewValue(entry, `${path}.issues[${index}]`, issues);
    if (decoded !== undefined) views.push(decoded);
  }
  const first = validationViewValue(value.first, `${path}.first`, issues);
  const phases = value.phases;
  if (
    !Array.isArray(phases) ||
    phases.length === 0 ||
    phases.length > VALIDATION_PHASES.length ||
    phases.some(
      (phase) =>
        typeof phase !== 'string' || !(VALIDATION_PHASES as readonly string[]).includes(phase),
    )
  ) {
    issue(`${path}.phases`, issues, 'phases');
  }
  const summary = boundedText(value.summary, `${path}.summary`, issues, 2_000);
  if (value.count !== views.length || value.severity !== 'blocking') {
    issue(path, issues, 'shape');
  }
  if (first === undefined || JSON.stringify(first) !== JSON.stringify(views[0])) {
    issue(`${path}.first`, issues, 'mismatch');
  }
  if (issues.length > 0 || first === undefined || summary === undefined || !Array.isArray(phases)) {
    return undefined;
  }
  return {
    count: views.length,
    severity: 'blocking',
    phases: phases as StudioValidationProjection['phases'],
    summary,
    first,
    issues: views,
  };
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
    save: ['kind', 'operationId', 'submittedSnapshotId', 'save', 'workspace', 'validation'],
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
    const validation =
      input.validation === undefined
        ? undefined
        : validationProjectionValue(input.validation, 'envelope.validation', issues);
    if (issues.length > 0) return { ok: false, issues };
    return {
      ok: true,
      value: {
        kind: 'save',
        operationId,
        submittedSnapshotId,
        save: input.save as StudioSaveResult,
        workspace: workspace.value,
        ...(validation === undefined ? {} : { validation }),
      },
    };
  }

  return {
    ok: true,
    value: { kind: 'check_status', operationId, submittedSnapshotId, workspace: workspace.value },
  };
}
