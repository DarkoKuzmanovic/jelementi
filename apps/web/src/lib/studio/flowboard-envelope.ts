import type { StudioFlowboardProjection } from './flowboard-projection';
import { decodeStudioWorkspaceProjection, type DecodeResult } from './workspace-projection';

/**
 * Strict client-safe discriminated envelope for the Flowboard Check status
 * action (#78). The existing `StudioActionEnvelope` intentionally carries
 * a single workspace projection; a Flowboard check must deliver the
 * complete server-assigned card set (all three columns + counts) so the
 * browser can replace the whole Flowboard region without reclassifying any
 * card (#72: "Its server response re-derives the complete list projection,
 * probes only the requested article, and may reassign that card from fresh
 * server facts; the browser never reclassifies it"). Rather than weakening
 * the workspace envelope's meaning, this is a separate discriminated
 * envelope with its own strict, never-throwing decoder in the same style as
 * `contracts.ts` / `workspace-projection.ts`.
 *
 * Full-navigation rendering and enhanced rendering consume the same shape:
 * the route action returns `flowboard` + `checkedSlug` (unchanged keys) and
 * additionally composes this envelope; the client decodes it before
 * application and only ever swaps the rendered Flowboard region.
 */

export const STUDIO_FLOWBOARD_CHECK_KIND = 'flowboard_check' as const;
const MAX_ID = 200;
const ID_PATTERN = /^[A-Za-z0-9._-]{1,200}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_TITLE = 200;
const MAX_TEXT = 2_000;
const MAX_LINK = 2_048;
const MAX_CARDS_PER_COLUMN = 500;
const MAX_TOTAL = 1_500;

export interface StudioFlowboardCheckEnvelope {
  kind: typeof STUDIO_FLOWBOARD_CHECK_KIND;
  operationId: string;
  submittedSnapshotId: string;
  checkedSlug: string;
  flowboard: StudioFlowboardProjection;
}

export function buildStudioFlowboardCheckEnvelope(
  base: { operationId: string; submittedSnapshotId: string },
  checkedSlug: string,
  flowboard: StudioFlowboardProjection,
): StudioFlowboardCheckEnvelope {
  return { kind: STUDIO_FLOWBOARD_CHECK_KIND, ...base, checkedSlug, flowboard };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function issue(path: string, issues: string[], code: string): void {
  issues.push(`${path}.${code}`);
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  issues: string[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) issue(path, issues, 'unknownKey');
  }
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

function boundedString(
  value: unknown,
  path: string,
  issues: string[],
  max: number,
  allowEmpty = false,
): string | undefined {
  if (typeof value !== 'string') {
    issue(path, issues, 'string');
    return undefined;
  }
  if (!allowEmpty && value.trim().length === 0) {
    issue(path, issues, 'empty');
    return undefined;
  }
  if (value.length > max) {
    issue(path, issues, 'max');
    return undefined;
  }
  return value;
}

type StudioFlowboardColumn = 'resume-work' | 'ready-for-decision' | 'library';

/**
 * Strict decode of the server-assigned Flowboard projection. Every card's
 * nested workspace projection is decoded through the canonical
 * `decodeStudioWorkspaceProjection`, the card column is a closed
 * discriminant, the primary action is a closed discriminant, and
 * `totalCount` must equal the sum of the three column arrays (a mismatch is
 * a malformed projection — the caller must not render it).
 */
export function decodeStudioFlowboardProjection(
  input: unknown,
): DecodeResult<StudioFlowboardProjection> {
  const issues: string[] = [];
  if (!isRecord(input)) return { ok: false, issues: ['flowboard.object'] };
  rejectUnknownKeys(input, ['totalCount', 'columns'], 'flowboard', issues);
  if (issues.length > 0) return { ok: false, issues };

  if (typeof input.totalCount !== 'number' || !Number.isInteger(input.totalCount)) {
    issue('flowboard.totalCount', issues, 'integer');
  }
  const totalCount = typeof input.totalCount === 'number' ? input.totalCount : -1;
  if (totalCount < 0 || totalCount > MAX_TOTAL) {
    issue('flowboard.totalCount', issues, 'bounds');
  }

  if (!isRecord(input.columns)) {
    issue('flowboard.columns', issues, 'object');
    return { ok: false, issues };
  }
  rejectUnknownKeys(
    input.columns,
    ['resumeWork', 'readyForDecision', 'library'],
    'flowboard.columns',
    issues,
  );
  if (issues.length > 0) return { ok: false, issues };

  const decodeCards = (
    raw: unknown,
    path: string,
    expectedColumn: StudioFlowboardColumn,
    issues: string[],
  ): StudioFlowboardProjection['columns']['resumeWork'] | undefined => {
    if (!Array.isArray(raw)) {
      issue(path, issues, 'array');
      return undefined;
    }
    if (raw.length > MAX_CARDS_PER_COLUMN) {
      issue(path, issues, 'max');
      return undefined;
    }
    const cards: StudioFlowboardProjection['columns']['resumeWork'] = [];
    let ok = true;
    for (const [index, item] of raw.entries()) {
      const card = decodeCard(item, `${path}[${index}]`, expectedColumn, issues);
      if (card === undefined) {
        ok = false;
        continue;
      }
      cards.push(card);
    }
    return ok ? cards : undefined;
  };

  const resumeWork = decodeCards(
    input.columns.resumeWork,
    'flowboard.columns.resumeWork',
    'resume-work',
    issues,
  );
  const readyForDecision = decodeCards(
    input.columns.readyForDecision,
    'flowboard.columns.readyForDecision',
    'ready-for-decision',
    issues,
  );
  const library = decodeCards(
    input.columns.library,
    'flowboard.columns.library',
    'library',
    issues,
  );

  if (
    issues.length > 0 ||
    totalCount < 0 ||
    totalCount > MAX_TOTAL ||
    resumeWork === undefined ||
    readyForDecision === undefined ||
    library === undefined
  ) {
    return { ok: false, issues };
  }
  const sum = resumeWork.length + readyForDecision.length + library.length;
  if (sum !== totalCount) {
    issue('flowboard.totalCount', issues, 'mismatch');
    return { ok: false, issues };
  }

  return {
    ok: true,
    value: {
      totalCount,
      columns: { resumeWork, readyForDecision, library },
    },
  };
}

function decodeCard(
  input: unknown,
  path: string,
  expectedColumn: StudioFlowboardColumn,
  issues: string[],
): StudioFlowboardProjection['columns']['resumeWork'][number] | undefined {
  if (!isRecord(input)) {
    issue(path, issues, 'object');
    return undefined;
  }
  rejectUnknownKeys(
    input,
    ['slug', 'title', 'updatedAt', 'column', 'projection', 'primaryAction', 'searchText'],
    path,
    issues,
  );
  if (issues.length > 0) return undefined;

  const slug = input.slug;
  if (
    typeof slug !== 'string' ||
    slug.length === 0 ||
    slug.length > 100 ||
    !SLUG_PATTERN.test(slug)
  ) {
    issue(`${path}.slug`, issues, 'slug');
  }
  const title = boundedString(input.title, `${path}.title`, issues, MAX_TITLE);
  const updatedAt =
    input.updatedAt === undefined
      ? undefined
      : boundedString(input.updatedAt, `${path}.updatedAt`, issues, 40);
  if (input.column !== expectedColumn) {
    issue(`${path}.column`, issues, 'column');
  }
  const projection = decodeStudioWorkspaceProjection(input.projection);
  if (!projection.ok) {
    for (const code of projection.issues) issues.push(`${path}.projection.${code}`);
  }
  const searchText = boundedString(input.searchText, `${path}.searchText`, issues, MAX_TEXT, true);

  let primaryAction:
    StudioFlowboardProjection['columns']['resumeWork'][number]['primaryAction'] | undefined;
  if (!isRecord(input.primaryAction)) {
    issue(`${path}.primaryAction`, issues, 'object');
  } else if (input.primaryAction.kind === 'check') {
    rejectUnknownKeys(input.primaryAction, ['kind', 'label'], `${path}.primaryAction`, issues);
    if (input.primaryAction.label !== 'Check status') {
      issue(`${path}.primaryAction.label`, issues, 'label');
    }
    if (issues.length === 0) primaryAction = { kind: 'check', label: 'Check status' };
  } else if (input.primaryAction.kind === 'link') {
    rejectUnknownKeys(
      input.primaryAction,
      ['kind', 'label', 'href'],
      `${path}.primaryAction`,
      issues,
    );
    const label = boundedString(
      input.primaryAction.label,
      `${path}.primaryAction.label`,
      issues,
      MAX_TITLE,
    );
    const href = boundedString(
      input.primaryAction.href,
      `${path}.primaryAction.href`,
      issues,
      MAX_LINK,
    );
    if (label !== undefined && href !== undefined) {
      primaryAction = { kind: 'link', label, href };
    }
  } else {
    issue(`${path}.primaryAction.kind`, issues, 'kind');
  }

  if (
    issues.length > 0 ||
    typeof slug !== 'string' ||
    title === undefined ||
    projection === undefined ||
    !projection.ok ||
    primaryAction === undefined ||
    searchText === undefined
  ) {
    return undefined;
  }
  return {
    slug,
    title,
    ...(updatedAt === undefined ? {} : { updatedAt }),
    column: expectedColumn,
    projection: projection.value,
    primaryAction,
    searchText,
  };
}

export function decodeStudioFlowboardCheckEnvelope(
  input: unknown,
): DecodeResult<StudioFlowboardCheckEnvelope> {
  const issues: string[] = [];
  if (!isRecord(input)) return { ok: false, issues: ['envelope.object'] };
  rejectUnknownKeys(
    input,
    ['kind', 'operationId', 'submittedSnapshotId', 'checkedSlug', 'flowboard'],
    'envelope',
    issues,
  );
  if (input.kind !== STUDIO_FLOWBOARD_CHECK_KIND) {
    issue('envelope.kind', issues, 'kind');
  }
  const operationId = idValue(input.operationId, 'envelope.operationId', issues);
  const submittedSnapshotId = idValue(
    input.submittedSnapshotId,
    'envelope.submittedSnapshotId',
    issues,
  );
  const checkedSlug = input.checkedSlug;
  if (
    typeof checkedSlug !== 'string' ||
    checkedSlug.length === 0 ||
    checkedSlug.length > 100 ||
    !SLUG_PATTERN.test(checkedSlug)
  ) {
    issue('envelope.checkedSlug', issues, 'slug');
  }
  const flowboard = decodeStudioFlowboardProjection(input.flowboard);
  if (!flowboard.ok) {
    for (const code of flowboard.issues) issues.push(`envelope.flowboard.${code}`);
  }
  if (
    issues.length > 0 ||
    operationId === undefined ||
    submittedSnapshotId === undefined ||
    typeof checkedSlug !== 'string' ||
    !flowboard.ok
  ) {
    return { ok: false, issues };
  }
  return {
    ok: true,
    value: {
      kind: STUDIO_FLOWBOARD_CHECK_KIND,
      operationId,
      submittedSnapshotId,
      checkedSlug,
      flowboard: flowboard.value,
    },
  };
}

// Re-exported so callers can type the projection without coupling to the
// presentation builder module's internals.
export type { StudioFlowboardProjection };
export type { DecodeResult };
