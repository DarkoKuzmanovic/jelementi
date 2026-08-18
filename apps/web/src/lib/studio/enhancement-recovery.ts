import {
  decodeStudioEditorInput,
  type DecodeResult,
  type StudioCompileIssue,
  type StudioConcurrencyEvidence,
  type StudioEditorInput,
  type StudioReference,
} from './contracts';

/**
 * Bounded, versioned session-scoped Recovery copy (#78, spec #72 slice 4).
 *
 * A Recovery copy is a temporary browser-held candidate for review. It is
 * never canonical, never a committed draft, never validation/concurrency/
 * lifecycle truth, and never publication evidence (CONTEXT.md "Recovery
 * copy"). This module is client-safe (no server imports, no I/O beyond the
 * injected storage adapter) and every read path is a bounded, never-
 * throwing decoder in the same style as `contracts.ts`.
 *
 * Record contract (#72 "Recovery-copy contract"): one record per article
 * workspace, namespaced and versioned by slug (`new` before the first
 * Save); contains only bounded form candidate data, the loaded concurrency
 * evidence, a capture timestamp, and a schema version. No credentials,
 * lifecycle claim, validation result, publication eligibility, or success
 * result. Storage failure is non-fatal and disables only recovery
 * convenience.
 */

export const STUDIO_RECOVERY_VERSION = 1 as const;
export const STUDIO_RECOVERY_KEY_PREFIX = 'jelementi.studio.recovery.';
export const STUDIO_RECOVERY_NEW_IDENTITY = 'new';
/** Upper bound on the serialized record; keeps sessionStorage writes safe. */
export const STUDIO_RECOVERY_MAX_JSON = 512_000;

export interface StudioRecoveryRecord {
  version: typeof STUDIO_RECOVERY_VERSION;
  candidate: StudioEditorInput;
  loadedConcurrency: StudioConcurrencyEvidence;
  capturedAt: string;
}

const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const SHA_PATTERN = /^[0-9a-f]{40,64}$/i;
const IDENTITY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type DecodeSuccess<T> = { ok: true; value: T };
export type DecodeFailure = { ok: false; issues: string[] };
export type RecoveryDecodeResult<T> = DecodeSuccess<T> | DecodeFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collectIssue(path: string, issues: string[], code: string): void {
  issues.push(`${path}.${code}`);
}

function concurrencyEvidenceValue(
  input: unknown,
  path: string,
  issues: string[],
): StudioConcurrencyEvidence | undefined {
  if (!isRecord(input)) {
    collectIssue(path, issues, 'object');
    return undefined;
  }
  const allowed = ['baseMainSha', 'draftHeadSha', 'expectedBlobSha'];
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) collectIssue(path, issues, 'unknownKey');
  }
  if (issues.length > 0) return undefined;
  const sha = (value: unknown, keyPath: string): string | undefined => {
    if (typeof value !== 'string' || !SHA_PATTERN.test(value)) {
      collectIssue(keyPath, issues, 'sha');
      return undefined;
    }
    return value;
  };
  const baseMainSha = sha(input.baseMainSha, `${path}.baseMainSha`);
  const draftHeadSha =
    input.draftHeadSha === undefined ? undefined : sha(input.draftHeadSha, `${path}.draftHeadSha`);
  const expectedBlobSha =
    input.expectedBlobSha === undefined
      ? undefined
      : sha(input.expectedBlobSha, `${path}.expectedBlobSha`);
  if (issues.length > 0 || baseMainSha === undefined) return undefined;
  return {
    baseMainSha,
    ...(draftHeadSha === undefined ? {} : { draftHeadSha }),
    ...(expectedBlobSha === undefined ? {} : { expectedBlobSha }),
  };
}

function capturedAtValue(input: unknown, path: string, issues: string[]): string | undefined {
  if (typeof input !== 'string' || input.length > 40 || !ISO_TIMESTAMP_PATTERN.test(input)) {
    collectIssue(path, issues, 'capturedAt');
    return undefined;
  }
  const datePart = input.slice(0, 10);
  const parsed = new Date(datePart);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== datePart) {
    collectIssue(path, issues, 'capturedAt');
    return undefined;
  }
  return input;
}

/**
 * Bounded, never-throwing decode of a stored Recovery record. Unknown keys,
 * a wrong version, an unbounded/malformed candidate, or a malformed
 * concurrency/timestamp all fail closed — the caller must treat a failure
 * exactly like an absent record (never apply anything automatically).
 */
export function decodeStudioRecoveryRecord(
  input: unknown,
): RecoveryDecodeResult<StudioRecoveryRecord> {
  const issues: string[] = [];
  if (!isRecord(input)) return { ok: false, issues: ['recovery.object'] };
  const allowed = ['version', 'candidate', 'loadedConcurrency', 'capturedAt'];
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) collectIssue('recovery', issues, 'unknownKey');
  }
  if (issues.length > 0) return { ok: false, issues };
  if (input.version !== STUDIO_RECOVERY_VERSION) {
    collectIssue('recovery.version', issues, 'version');
  }
  const candidate = decodeStudioEditorInput(input.candidate);
  if (!candidate.ok) {
    for (const code of candidate.issues) issues.push(`recovery.candidate.${code}`);
  }
  const loadedConcurrency = concurrencyEvidenceValue(
    input.loadedConcurrency,
    'recovery.loadedConcurrency',
    issues,
  );
  const capturedAt = capturedAtValue(input.capturedAt, 'recovery.capturedAt', issues);
  if (
    issues.length > 0 ||
    !candidate.ok ||
    loadedConcurrency === undefined ||
    capturedAt === undefined
  ) {
    return { ok: false, issues };
  }
  return {
    ok: true,
    value: {
      version: STUDIO_RECOVERY_VERSION,
      candidate: candidate.value,
      loadedConcurrency,
      capturedAt,
    },
  };
}

/** Bounded per-article workspace key (`new` before the first Save). */
export function studioRecoveryKey(identity: string): string {
  const bounded =
    identity === STUDIO_RECOVERY_NEW_IDENTITY || IDENTITY_PATTERN.test(identity)
      ? identity
      : STUDIO_RECOVERY_NEW_IDENTITY;
  return `${STUDIO_RECOVERY_KEY_PREFIX}${bounded}`;
}

export interface StudioStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StudioRecoveryStore {
  /** False when storage is unavailable; recovery convenience is disabled only. */
  readonly available: boolean;
  read(key: string): StudioRecoveryRecord | undefined;
  write(key: string, record: StudioRecoveryRecord): boolean;
  clear(key: string): void;
}

const UNAVAILABLE_STORE: StudioRecoveryStore = {
  available: false,
  read: () => undefined,
  write: () => false,
  clear: () => undefined,
};

/**
 * sessionStorage adapter. Every operation is guarded: quota errors,
 * disabled storage, or a throwing implementation disable only the recovery
 * convenience — never the full server workflow.
 */
export function createStudioRecoveryStore(
  storage: StudioStorageLike | undefined,
): StudioRecoveryStore {
  if (storage === undefined) return UNAVAILABLE_STORE;
  try {
    const probe = `${STUDIO_RECOVERY_KEY_PREFIX}probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
  } catch {
    return UNAVAILABLE_STORE;
  }
  return {
    available: true,
    read(key: string): StudioRecoveryRecord | undefined {
      try {
        const raw = storage.getItem(key);
        if (raw === null || raw === undefined) return undefined;
        if (raw.length > STUDIO_RECOVERY_MAX_JSON) return undefined;
        const decoded = decodeStudioRecoveryRecord(JSON.parse(raw));
        return decoded.ok ? decoded.value : undefined;
      } catch {
        return undefined;
      }
    },
    write(key: string, record: StudioRecoveryRecord): boolean {
      try {
        const json = JSON.stringify(record);
        if (json.length > STUDIO_RECOVERY_MAX_JSON) return false;
        storage.setItem(key, json);
        return true;
      } catch {
        return false;
      }
    },
    clear(key: string): void {
      try {
        storage.removeItem(key);
      } catch {
        // Non-fatal: a stuck stale record is re-decoded and re-reconciled on
        // the next load; the server workflow is never blocked by it.
      }
    },
  };
}

/**
 * Matching vs moved evidence decision. Matching fresh evidence may offer
 * explicit "Restore recovery copy"; moved evidence must render fresh server
 * content first and offer explicit "Compare/Restore" — never auto-apply.
 */
export type StudioRecoveryReconciliation = 'matching' | 'stale';

export function reconcileStudioRecovery(
  record: StudioRecoveryRecord,
  fresh: StudioConcurrencyEvidence,
): StudioRecoveryReconciliation {
  return concurrencyEquals(record.loadedConcurrency, fresh) ? 'matching' : 'stale';
}

function concurrencyEquals(
  left: StudioConcurrencyEvidence,
  right: StudioConcurrencyEvidence,
): boolean {
  return (
    left.baseMainSha === right.baseMainSha &&
    (left.draftHeadSha ?? undefined) === (right.draftHeadSha ?? undefined) &&
    (left.expectedBlobSha ?? undefined) === (right.expectedBlobSha ?? undefined)
  );
}

/**
 * Captures the immutable submitted candidate snapshot from the editor form
 * (the same named fields the server's `decodeStudioFormData` consumes) and
 * validates it through the canonical client-safe editor-input decoder.
 * Returns `undefined` for a malformed/oversized form — the caller must fall
 * through to ordinary form submission, never enhance a form it cannot bound.
 */
export function captureStudioSubmittedSnapshot(form: FormData): StudioEditorInput | undefined {
  const read = (name: string): string => {
    const value = form.get(name);
    return typeof value === 'string' ? value : '';
  };
  const status = read('status');
  if (status !== 'draft' && status !== 'published' && status !== 'archived') return undefined;

  const references: StudioReference[] = [];
  const titles = form.getAll('referenceTitle');
  const urls = form.getAll('referenceUrl');
  const publishers = form.getAll('referencePublisher');
  const accessed = form.getAll('referenceAccessedAt');
  const count = Math.min(titles.length, urls.length, publishers.length, accessed.length, 100);
  for (let index = 0; index < count; index += 1) {
    const title = typeof titles[index] === 'string' ? (titles[index] as string) : '';
    const url = typeof urls[index] === 'string' ? (urls[index] as string) : '';
    const publisher = typeof publishers[index] === 'string' ? (publishers[index] as string) : '';
    const accessedAt = typeof accessed[index] === 'string' ? (accessed[index] as string) : '';
    if (title === '' && url === '') continue;
    references.push({
      title,
      url,
      ...(publisher === '' ? {} : { publisher }),
      ...(accessedAt === '' ? {} : { accessedAt }),
    });
  }

  const audioSrc = read('audioSrc');
  const audioDuration = read('audioDurationSeconds');
  const publishedAt = read('publishedAt');
  const draftHeadSha = read('draftHeadSha');
  const expectedBlobSha = read('expectedBlobSha');

  const input = {
    metadata: {
      title: read('title'),
      slug: read('slug'),
      excerpt: read('excerpt'),
      status,
      ...(publishedAt === '' ? {} : { publishedAt }),
      updatedAt: read('updatedAt'),
      category: read('category'),
      tags: read('tags')
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
      author: read('author'),
      cover: { src: read('coverSrc'), alt: read('coverAlt') },
      ...(audioSrc === ''
        ? {}
        : {
            audio: {
              src: audioSrc,
              ...(audioDuration === '' || Number.isNaN(Number(audioDuration))
                ? {}
                : { durationSeconds: Number(audioDuration) }),
            },
          }),
      references,
    },
    body: read('body'),
    concurrency: {
      baseMainSha: read('baseMainSha'),
      ...(draftHeadSha === '' ? {} : { draftHeadSha }),
      ...(expectedBlobSha === '' ? {} : { expectedBlobSha }),
    },
  };

  const decoded = decodeStudioEditorInput(input);
  return decoded.ok ? decoded.value : undefined;
}

export function studioCompileIssueMessage(issue: StudioCompileIssue): string {
  return `${issue.code}: ${issue.message} (${issue.sourcePath}:${issue.line ?? 1}:${issue.column ?? 1})`;
}

export type { DecodeResult };
