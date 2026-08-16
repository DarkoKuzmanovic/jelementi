import {
  compileArticle,
  ContentCompileError,
  serializeArticleSource,
} from '@jelementi/content-compiler';
import type {
  StudioCompileIssue,
  StudioConcurrencyEvidence,
  StudioMetadata,
} from '../../studio/contracts';
import type {
  GithubAdapter,
  GithubReadAdapter,
  StudioBranch,
  StudioFileContent,
  StudioPullRequest,
} from './github-adapter';

export interface StudioDraftCandidate {
  metadata: StudioMetadata;
  body: string;
}

export interface StudioDraftReplacementOptions {
  mediaBaseUrl: string;
}

export type StudioDraftReplacementPhase =
  | 'decode-request'
  | 'discover-main'
  | 'discover-branch'
  | 'verify-loaded-head'
  | 'verify-target'
  | 'verify-diff'
  | 'discover-pull-request'
  | 'close-pull-request'
  | 'confirm-pull-request'
  | 'delete-branch'
  | 'recreate-branch'
  | 'commit-candidate'
  | 'create-pull-request'
  | 'confirm-replacement'
  | 'revalidate';

export interface StudioDraftReplacementEvidence {
  mainSha?: string;
  target?: { path: string; loadedBlobSha?: string; freshBlobSha?: string };
  branch?: { name: string; headSha: string; url: string };
  pullRequest?: { number: number; url: string; state: StudioPullRequest['state']; draft: boolean };
}

export type StudioDraftReplacementResult =
  | {
      kind: 'replaced';
      candidate: StudioDraftCandidate;
      concurrency: StudioConcurrencyEvidence;
      branch: { name: string; headSha: string; url: string };
      pullRequest: { number: number; url: string };
      compileIssues: StudioCompileIssue[];
    }
  | {
      kind: 'replacement_conflict';
      candidate: StudioDraftCandidate;
      phase: StudioDraftReplacementPhase;
      reason: 'not-eligible' | 'moved-head' | 'merged' | 'topology';
      evidence: StudioDraftReplacementEvidence;
    }
  | {
      kind: 'replacement_failed';
      candidate: StudioDraftCandidate;
      phase: StudioDraftReplacementPhase;
      reason: 'github' | 'topology' | 'validation';
      evidence: StudioDraftReplacementEvidence;
    };

export async function isStudioDraftReplacementEligible(
  adapter: GithubReadAdapter,
  slug: string,
  loaded: StudioConcurrencyEvidence,
): Promise<boolean> {
  if (loaded.draftHeadSha === undefined) return false;
  const branchName = `studio/article/${slug}`;
  const path = `content/articles/${slug}.md`;
  const [main, branch] = await Promise.all([adapter.getMainRef(), adapter.getBranch(branchName)]);
  if (
    !main.ok ||
    !branch.ok ||
    main.value.sha === loaded.baseMainSha ||
    branch.value.sha !== loaded.draftHeadSha
  ) {
    return false;
  }
  const [loadedTarget, freshTarget, loadedFiles, branchFiles, pulls] = await Promise.all([
    optionalFile(adapter, loaded.baseMainSha, path),
    optionalFile(adapter, main.value.sha, path),
    adapter.listArticleFiles(loaded.baseMainSha),
    adapter.listArticleFiles(branch.value.sha),
    adapter.listPullRequests(branchName),
  ]);
  if (
    !loadedTarget.ok ||
    !freshTarget.ok ||
    !loadedFiles.ok ||
    !branchFiles.ok ||
    !pulls.ok ||
    !sameFile(loadedTarget.value, freshTarget.value) ||
    !changesExactlyPath(loadedFiles.value, branchFiles.value, path)
  ) {
    return false;
  }
  const openPulls = pulls.value.filter((pull) => pull.state === 'open');
  const pull = openPulls[0];
  return (
    openPulls.length === 1 &&
    pull !== undefined &&
    pull.draft &&
    pull.headRef === branchName &&
    pull.baseRef === 'main' &&
    pull.headSha === branch.value.sha
  );
}

/**
 * Replaces one stale Studio draft without ever mutating its approved head.
 * The submitted candidate is carried through every result path.
 */
export async function replaceStudioDraft(
  adapter: GithubAdapter,
  slug: string,
  candidate: StudioDraftCandidate,
  loaded: StudioConcurrencyEvidence,
  options: StudioDraftReplacementOptions,
): Promise<StudioDraftReplacementResult> {
  const branchName = `studio/article/${slug}`;
  const path = `content/articles/${slug}.md`;
  const evidence: StudioDraftReplacementEvidence = {};

  const main = await adapter.getMainRef();
  if (!main.ok) return failed(candidate, 'discover-main', 'github', evidence);
  evidence.mainSha = main.value.sha;

  const branchResult = await adapter.getBranch(branchName);
  if (!branchResult.ok) {
    if (branchResult.failure.reason === 'not-found') {
      return resumeAfterDeletedBranch(
        adapter,
        slug,
        candidate,
        loaded,
        main.value.sha,
        options,
        evidence,
      );
    }
    return failed(candidate, 'discover-branch', 'github', evidence);
  }
  const branch = branchResult.value;
  evidence.branch = branchEvidence(branch);
  if (loaded.draftHeadSha === undefined) {
    return conflict(candidate, 'verify-loaded-head', 'moved-head', evidence);
  }
  if (branch.sha !== loaded.draftHeadSha) {
    if (branch.sha === main.value.sha) {
      return resumeAfterDeletedBranch(
        adapter,
        slug,
        candidate,
        loaded,
        main.value.sha,
        options,
        evidence,
        branch,
      );
    }
    const [candidateFile, mainFiles, candidateFiles] = await Promise.all([
      optionalFile(adapter, branch.sha, path),
      adapter.listArticleFiles(main.value.sha),
      adapter.listArticleFiles(branch.sha),
    ]);
    const expectedSource = serializeArticleSource({
      frontmatter: candidate.metadata,
      body: candidate.body,
    });
    if (
      candidateFile.ok &&
      candidateFile.value?.content === expectedSource &&
      mainFiles.ok &&
      candidateFiles.ok &&
      changesExactlyPath(mainFiles.value, candidateFiles.value, path)
    ) {
      return resumeAfterDeletedBranch(
        adapter,
        slug,
        candidate,
        loaded,
        main.value.sha,
        options,
        evidence,
        branch,
        candidateFile.value,
      );
    }
    return conflict(candidate, 'verify-loaded-head', 'moved-head', evidence);
  }
  if (main.value.sha === loaded.baseMainSha) {
    return conflict(candidate, 'verify-target', 'not-eligible', evidence);
  }

  const loadedTarget = await optionalFile(adapter, loaded.baseMainSha, path);
  if (!loadedTarget.ok) return failed(candidate, 'verify-target', 'github', evidence);
  const freshTarget = await optionalFile(adapter, main.value.sha, path);
  if (!freshTarget.ok) return failed(candidate, 'verify-target', 'github', evidence);
  evidence.target = targetEvidence(path, loadedTarget.value, freshTarget.value);
  if (!sameFile(loadedTarget.value, freshTarget.value)) {
    return conflict(candidate, 'verify-target', 'not-eligible', evidence);
  }

  const loadedFiles = await adapter.listArticleFiles(loaded.baseMainSha);
  const branchFiles = await adapter.listArticleFiles(branch.sha);
  if (!loadedFiles.ok || !branchFiles.ok) {
    return failed(candidate, 'verify-diff', 'github', evidence);
  }
  if (!changesExactlyPath(loadedFiles.value, branchFiles.value, path)) {
    return conflict(candidate, 'verify-diff', 'not-eligible', evidence);
  }

  const pulls = await adapter.listPullRequests(branchName);
  if (!pulls.ok) return failed(candidate, 'discover-pull-request', 'github', evidence);
  const matchingPulls = pulls.value.filter(
    (pull) => pull.headRef === branchName && pull.baseRef === 'main' && pull.headSha === branch.sha,
  );
  const oldPull = matchingPulls[0];
  if (matchingPulls.length !== 1 || oldPull === undefined) {
    return conflict(candidate, 'discover-pull-request', 'topology', evidence);
  }
  evidence.pullRequest = pullEvidence(oldPull);
  if (oldPull.state === 'merged') {
    return conflict(candidate, 'discover-pull-request', 'merged', evidence);
  }

  let confirmedOldPull = oldPull;
  if (oldPull.state === 'open') {
    if (!oldPull.draft) {
      return conflict(candidate, 'discover-pull-request', 'topology', evidence);
    }
    const closed = await adapter.closePullRequest(oldPull.number);
    if (!closed.ok) return failed(candidate, 'close-pull-request', 'github', evidence);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const confirmedPulls = await adapter.listPullRequests(branchName);
      if (!confirmedPulls.ok) {
        return failed(candidate, 'confirm-pull-request', 'github', evidence);
      }
      const rediscovered = confirmedPulls.value.find((pull) => pull.number === oldPull.number);
      if (rediscovered === undefined) {
        return conflict(candidate, 'confirm-pull-request', 'topology', evidence);
      }
      confirmedOldPull = rediscovered;
      if (rediscovered.state === 'closed' || rediscovered.state === 'merged') break;
    }
  }
  if (confirmedOldPull.state === 'merged') {
    evidence.pullRequest = pullEvidence(confirmedOldPull);
    return conflict(candidate, 'confirm-pull-request', 'merged', evidence);
  }
  if (confirmedOldPull.state !== 'closed') {
    return conflict(candidate, 'confirm-pull-request', 'topology', evidence);
  }
  evidence.pullRequest = pullEvidence(confirmedOldPull);

  const deleted = await adapter.deleteBranch(branchName, branch.sha);
  if (!deleted.ok) {
    if (deleted.failure.reason === 'conflict') {
      const refreshed = await adapter.getBranch(branchName);
      if (refreshed.ok) evidence.branch = branchEvidence(refreshed.value);
      return conflict(candidate, 'delete-branch', 'moved-head', evidence);
    }
    return failed(candidate, 'delete-branch', 'github', evidence);
  }
  delete evidence.branch;
  return completeReplacement(adapter, slug, candidate, main.value.sha, options, evidence);
}

async function resumeAfterDeletedBranch(
  adapter: GithubAdapter,
  slug: string,
  candidate: StudioDraftCandidate,
  loaded: StudioConcurrencyEvidence,
  mainSha: string,
  options: StudioDraftReplacementOptions,
  evidence: StudioDraftReplacementEvidence,
  recreatedBranch?: StudioBranch,
  committedFile?: StudioFileContent,
): Promise<StudioDraftReplacementResult> {
  const branchName = `studio/article/${slug}`;
  const path = `content/articles/${slug}.md`;
  if (loaded.draftHeadSha === undefined || mainSha === loaded.baseMainSha) {
    return conflict(candidate, 'verify-loaded-head', 'moved-head', evidence);
  }
  const [loadedTarget, freshTarget, loadedFiles, oldDraftFiles, pulls] = await Promise.all([
    optionalFile(adapter, loaded.baseMainSha, path),
    optionalFile(adapter, mainSha, path),
    adapter.listArticleFiles(loaded.baseMainSha),
    adapter.listArticleFiles(loaded.draftHeadSha),
    adapter.listPullRequests(branchName),
  ]);
  if (!loadedTarget.ok || !freshTarget.ok) {
    return failed(candidate, 'verify-target', 'github', evidence);
  }
  if (!loadedFiles.ok || !oldDraftFiles.ok) {
    return failed(candidate, 'verify-diff', 'github', evidence);
  }
  if (!pulls.ok) return failed(candidate, 'confirm-pull-request', 'github', evidence);
  evidence.target = targetEvidence(path, loadedTarget.value, freshTarget.value);
  if (!sameFile(loadedTarget.value, freshTarget.value)) {
    return conflict(candidate, 'verify-target', 'not-eligible', evidence);
  }
  if (!changesExactlyPath(loadedFiles.value, oldDraftFiles.value, path)) {
    return conflict(candidate, 'verify-diff', 'not-eligible', evidence);
  }
  const priorPulls = pulls.value.filter(
    (pull) =>
      pull.headRef === branchName &&
      pull.baseRef === 'main' &&
      pull.headSha === loaded.draftHeadSha,
  );
  const priorPull = priorPulls[0];
  if (priorPulls.length !== 1 || priorPull === undefined) {
    return conflict(candidate, 'confirm-pull-request', 'topology', evidence);
  }
  evidence.pullRequest = pullEvidence(priorPull);
  if (priorPull.state === 'merged') {
    return conflict(candidate, 'confirm-pull-request', 'merged', evidence);
  }
  if (!priorPull.draft) {
    return conflict(candidate, 'confirm-pull-request', 'topology', evidence);
  }
  if (priorPull.state !== 'closed') {
    return conflict(candidate, 'confirm-pull-request', 'topology', evidence);
  }
  return completeReplacement(
    adapter,
    slug,
    candidate,
    mainSha,
    options,
    evidence,
    recreatedBranch,
    committedFile,
  );
}

async function completeReplacement(
  adapter: GithubAdapter,
  slug: string,
  candidate: StudioDraftCandidate,
  mainSha: string,
  options: StudioDraftReplacementOptions,
  evidence: StudioDraftReplacementEvidence,
  existingBranch?: StudioBranch,
  existingCommit?: StudioFileContent,
): Promise<StudioDraftReplacementResult> {
  const branchName = `studio/article/${slug}`;
  const path = `content/articles/${slug}.md`;
  let branch = existingBranch;
  if (branch === undefined) {
    const recreated = await adapter.createBranch(branchName, mainSha);
    if (!recreated.ok) return failed(candidate, 'recreate-branch', 'github', evidence);
    branch = recreated.value;
  }
  evidence.branch = branchEvidence(branch);

  const source = serializeArticleSource({ frontmatter: candidate.metadata, body: candidate.body });
  let committed:
    | { ok: true; value: { commitSha: string; commitUrl: string; blobSha: string } }
    | Awaited<ReturnType<GithubAdapter['commitFile']>>;
  if (existingCommit !== undefined) {
    committed = {
      ok: true,
      value: { commitSha: branch.sha, commitUrl: branch.url, blobSha: existingCommit.blobSha },
    };
  } else {
    committed = await adapter.commitFile({
      branch: branchName,
      path,
      content: source,
      message: `Studio: replace draft for ${slug}`,
      expectedHeadSha: branch.sha,
    });
    if (!committed.ok) {
      if (committed.failure.reason === 'conflict') {
        const refreshed = await adapter.getBranch(branchName);
        if (refreshed.ok) evidence.branch = branchEvidence(refreshed.value);
        return conflict(candidate, 'commit-candidate', 'moved-head', evidence);
      }
      return failed(candidate, 'commit-candidate', 'github', evidence);
    }
  }

  const existingPulls = await adapter.listPullRequests(branchName);
  if (!existingPulls.ok) return failed(candidate, 'create-pull-request', 'github', evidence);
  const existingMatches = matchingOpenDrafts(
    existingPulls.value,
    branchName,
    committed.value.commitSha,
  );
  const otherOpenPulls = existingPulls.value.filter(
    (pull) => pull.state === 'open' && !existingMatches.includes(pull),
  );
  let createdPull = existingMatches[0];
  if (existingMatches.length > 1 || otherOpenPulls.length > 0) {
    return failed(candidate, 'create-pull-request', 'topology', evidence);
  }
  if (createdPull === undefined) {
    const createdPullResult = await adapter.createPullRequest({
      title: `Studio draft: ${candidate.metadata.title}`.slice(0, 500),
      body: `Draft replacement for \`${path}\`. A fresh Publish is required.`,
      head: branchName,
      base: 'main',
      draft: true,
    });
    if (createdPullResult.ok) {
      createdPull = createdPullResult.value;
    } else if (createdPullResult.failure.reason === 'transport') {
      const rediscovered = await adapter.listPullRequests(branchName);
      if (!rediscovered.ok) {
        return failed(candidate, 'create-pull-request', 'github', evidence);
      }
      const matching = matchingOpenDrafts(
        rediscovered.value,
        branchName,
        committed.value.commitSha,
      );
      const rediscoveredPull = matching[0];
      if (matching.length === 0) {
        return failed(candidate, 'create-pull-request', 'github', evidence);
      }
      if (matching.length !== 1 || rediscoveredPull === undefined) {
        return failed(candidate, 'create-pull-request', 'topology', evidence);
      }
      createdPull = rediscoveredPull;
    } else {
      return failed(candidate, 'create-pull-request', 'github', evidence);
    }
  }
  evidence.pullRequest = pullEvidence(createdPull);

  const confirmedMain = await adapter.getMainRef();
  if (!confirmedMain.ok) return failed(candidate, 'confirm-replacement', 'github', evidence);
  const confirmedTarget = await optionalFile(adapter, confirmedMain.value.sha, path);
  if (!confirmedTarget.ok) return failed(candidate, 'confirm-replacement', 'github', evidence);
  const loadedBlobSha = evidence.target?.loadedBlobSha;
  evidence.mainSha = confirmedMain.value.sha;
  evidence.target = {
    path,
    ...(loadedBlobSha === undefined ? {} : { loadedBlobSha }),
    ...(confirmedTarget.value === undefined ? {} : { freshBlobSha: confirmedTarget.value.blobSha }),
  };
  if (confirmedMain.value.sha !== mainSha || confirmedTarget.value?.blobSha !== loadedBlobSha) {
    return conflict(candidate, 'confirm-replacement', 'not-eligible', evidence);
  }

  const [confirmedBranch, confirmedFile, replacementPulls, mainFiles, branchFiles] =
    await Promise.all([
      adapter.getBranch(branchName),
      adapter.getFileContent(committed.value.commitSha, path),
      adapter.listPullRequests(branchName),
      adapter.listArticleFiles(confirmedMain.value.sha),
      adapter.listArticleFiles(committed.value.commitSha),
    ]);
  if (
    !confirmedBranch.ok ||
    !confirmedFile.ok ||
    !replacementPulls.ok ||
    !mainFiles.ok ||
    !branchFiles.ok
  ) {
    return failed(candidate, 'confirm-replacement', 'github', evidence);
  }
  evidence.branch = branchEvidence(confirmedBranch.value);
  const openReplacementPulls = replacementPulls.value.filter((pull) => pull.state === 'open');
  const replacementPull = openReplacementPulls[0];
  if (replacementPull !== undefined) evidence.pullRequest = pullEvidence(replacementPull);
  if (
    confirmedBranch.value.sha !== committed.value.commitSha ||
    confirmedFile.value.blobSha !== committed.value.blobSha ||
    confirmedFile.value.content !== source ||
    !changesExactlyPath(mainFiles.value, branchFiles.value, path) ||
    openReplacementPulls.length !== 1 ||
    replacementPull === undefined ||
    replacementPull.number !== createdPull.number ||
    !replacementPull.draft ||
    replacementPull.headSha !== committed.value.commitSha
  ) {
    return conflict(candidate, 'confirm-replacement', 'topology', evidence);
  }

  const compileIssues = compileCandidate(confirmedFile.value.content, path, options.mediaBaseUrl);
  return {
    kind: 'replaced',
    candidate,
    concurrency: {
      baseMainSha: mainSha,
      draftHeadSha: committed.value.commitSha,
      expectedBlobSha: committed.value.blobSha,
    },
    branch: branchEvidence(confirmedBranch.value),
    pullRequest: { number: replacementPull.number, url: replacementPull.url },
    compileIssues,
  };
}

function matchingOpenDrafts(
  pulls: StudioPullRequest[],
  branchName: string,
  headSha: string,
): StudioPullRequest[] {
  return pulls.filter(
    (pull) =>
      pull.state === 'open' &&
      pull.draft &&
      pull.headRef === branchName &&
      pull.baseRef === 'main' &&
      pull.headSha === headSha,
  );
}

async function optionalFile(
  adapter: GithubReadAdapter,
  ref: string,
  path: string,
): Promise<{ ok: true; value: StudioFileContent | undefined } | { ok: false }> {
  const result = await adapter.getFileContent(ref, path);
  if (result.ok) return { ok: true, value: result.value };
  return result.failure.reason === 'not-found' ? { ok: true, value: undefined } : { ok: false };
}

function sameFile(
  left: StudioFileContent | undefined,
  right: StudioFileContent | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  return left.blobSha === right.blobSha;
}

function changesExactlyPath(
  base: StudioFileContent[],
  draft: StudioFileContent[],
  expectedPath: string,
): boolean {
  const baseByPath = new Map(base.map((file) => [file.path, file.blobSha]));
  const draftByPath = new Map(draft.map((file) => [file.path, file.blobSha]));
  const paths = new Set([...baseByPath.keys(), ...draftByPath.keys()]);
  const changed = [...paths].filter((path) => baseByPath.get(path) !== draftByPath.get(path));
  return changed.length === 1 && changed[0] === expectedPath;
}

function compileCandidate(
  markdown: string,
  sourcePath: string,
  mediaBaseUrl: string,
): StudioCompileIssue[] {
  try {
    compileArticle({ markdown, sourcePath, mediaBaseUrl });
    return [];
  } catch (cause) {
    if (cause instanceof ContentCompileError) return cause.issues;
    return [
      { code: 'COMPILER_FAILURE', message: 'The article could not be compiled.', sourcePath },
    ];
  }
}

function targetEvidence(
  path: string,
  loaded: StudioFileContent | undefined,
  fresh: StudioFileContent | undefined,
): NonNullable<StudioDraftReplacementEvidence['target']> {
  return {
    path,
    ...(loaded === undefined ? {} : { loadedBlobSha: loaded.blobSha }),
    ...(fresh === undefined ? {} : { freshBlobSha: fresh.blobSha }),
  };
}

function branchEvidence(
  branch: StudioBranch,
): NonNullable<StudioDraftReplacementEvidence['branch']> {
  return { name: branch.name, headSha: branch.sha, url: branch.url };
}

function pullEvidence(
  pull: StudioPullRequest,
): NonNullable<StudioDraftReplacementEvidence['pullRequest']> {
  return {
    number: pull.number,
    url: pull.url,
    state: pull.state,
    draft: pull.draft,
  };
}

function conflict(
  candidate: StudioDraftCandidate,
  phase: StudioDraftReplacementPhase,
  reason: Extract<StudioDraftReplacementResult, { kind: 'replacement_conflict' }>['reason'],
  evidence: StudioDraftReplacementEvidence,
): StudioDraftReplacementResult {
  return { kind: 'replacement_conflict', candidate, phase, reason, evidence: { ...evidence } };
}

function failed(
  candidate: StudioDraftCandidate,
  phase: StudioDraftReplacementPhase,
  reason: Extract<StudioDraftReplacementResult, { kind: 'replacement_failed' }>['reason'],
  evidence: StudioDraftReplacementEvidence,
): StudioDraftReplacementResult {
  return { kind: 'replacement_failed', candidate, phase, reason, evidence: { ...evidence } };
}
