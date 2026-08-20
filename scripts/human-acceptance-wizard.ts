/**
 * Human acceptance wizard for T104 final Reader acceptance — Chrome-only per #104#issuecomment-5353353146.
 *
 * This module defines the honest manual matrix for current stable Chrome only.
 * It automates NOTHING that requires a human: coarse-pointer/touch, contrast sampling,
 * keyboard-only, zoom/text-spacing, or structural/experiential approval are
 * recorded only when a human performs and records them in Chrome.
 *
 * Firefox, native Safari, Playwright WebKit proxy, and Orca/manual screen-reader
 * journeys are no longer gates (spec reduction per 5353353146) and are recorded
 * only as supplemental, non-blocking notes; final report must state reduced
 * cross-browser and real-AT coverage as residual limitation.
 *
 * The wizard is interactive: `pnpm tsx scripts/human-acceptance-wizard.ts`
 * walks the operator through each checkpoint and writes
 * `docs/evidence/reader-acceptance/manual-evidence.json`.
 *
 * Critical honesty boundary: the code never fabricates manual evidence.
 * Default evidence status is BLOCKED_PENDING_HUMAN.
 */
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export function getCurrentHead(): string {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
  if (result.status !== 0 || !result.stdout?.trim()) {
    throw new Error(
      'Failed to derive current HEAD — refusing to record stale base. Ensure git is available and this is a git worktree.',
    );
  }
  const sha = result.stdout.trim();
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`Invalid HEAD sha: ${sha}`);
  return sha;
}

export interface HumanCheckpoint {
  id: string;
  label: string;
  description: string;
  notes: string;
  requiredEvidence: string[];
}

export const HUMAN_CHECKPOINTS: readonly HumanCheckpoint[] = [
  {
    id: 'asset-ceilings',
    label: 'Frozen asset ceilings (automated, non-waivable)',
    description:
      'Verify representative HTML 70,885, Reader CSS 17,943, Search JS 167,513 via pnpm verify:reader:assets. Human cannot waive.',
    notes:
      'Ceilings are 17,943 (CSS), 167,513 (Search JS), 70,885 (representative HTML total). Content-only growth reported separately.',
    requiredEvidence: [
      'verify:reader:assets output',
      'representativeHtmlBytes',
      'uniqueReaderCssBytes',
      'searchJavaScriptBytes',
    ],
  },
  {
    id: 'chromium-stable',
    label: 'Manual Chrome stable desktop (visual 32-image matrix)',
    description:
      'Current stable Chrome desktop: wide and 320 CSS px, light and dark, reduced motion, keyboard, zoom 100/200/400, text spacing, no-JS behavior. Record Chrome version and outcome. Preserved evidence: Chrome 151.0.7922.169 visual 32-image matrix PASS (8 routes × 1280/320 × light/dark at representative fixture, width-verified).',
    notes:
      'Automate only Chromium JS/no-JS via Playwright; manual cell requires human visible verification in Chrome. Prior human PASS: Chrome 151.0.7922.169 — 32 PNGs verified.',
    requiredEvidence: [
      'Chrome version 151.0.7922.169',
      'viewport, theme, zoom, text-spacing outcomes',
      '32-image matrix paths',
    ],
  },
  {
    id: 'coarse-pointer-touch',
    label: 'Coarse-pointer / touch mobile viewport (Chrome Stage 2)',
    description:
      'At least one coarse-pointer / touch mobile viewport: viewport size, device, outcome. Preserved evidence: Chrome 151 Stage 2 320px touch PASS.',
    notes:
      'Requires touch-capable viewport; Chrome Stage 2 touch verified at 320px. Prior human PASS: Chrome 151.0.7922.169 Stage 2 touch.',
    requiredEvidence: ['Chrome 151.0.7922.169', 'device/viewport 320px touch outcome'],
  },
  {
    id: 'zoom-100-200-400',
    label: 'Representative 100%, 200%, 400% zoom cells (Chrome Stage 2)',
    description:
      'Capture 100%, 200%, 400% zoom at representative routes. Verify no page-level 2D scrolling, reflow preserved. Preserved evidence: Chrome 151 Stage 2 200%/400% zoom PASS.',
    notes:
      'Automated 320px + text-spacing covers part; Chrome Stage 2 manual zoom verified. Prior human PASS: Chrome 151.0.7922.169 Stage 2 zoom.',
    requiredEvidence: [
      'Chrome 151.0.7922.169',
      'screenshots or notes per zoom level',
      'reflow outcome',
    ],
  },
  {
    id: 'text-spacing',
    label: 'Text spacing (WCAG 1.4.12) overrides (Chrome Stage 3)',
    description:
      'Apply WCAG text-spacing overrides and verify no loss of content or functionality. Preserved evidence: Chrome 151 Stage 3 text-spacing PASS.',
    notes:
      'Requires manual injection or browser setting; Chrome Stage 3 verified. Prior human PASS: Chrome 151.0.7922.169 Stage 3 text-spacing.',
    requiredEvidence: ['Chrome 151.0.7922.169', 'spacing values applied', 'outcome per route'],
  },
  {
    id: 'reduced-motion-manual',
    label: 'Reduced motion manual verification (Chrome Stage 3)',
    description:
      'Verify prefers-reduced-motion removes smooth scrolling and non-essential transitions; state changes immediate. Preserved evidence: Chrome 151 Stage 3 reduced-motion PASS.',
    notes:
      'Automated CSS assertion exists; Chrome Stage 3 verified. Prior human PASS: Chrome 151.0.7922.169 Stage 3 reduced-motion.',
    requiredEvidence: ['Chrome 151.0.7922.169', 'reduced-motion emulation', 'observed transitions'],
  },
  {
    id: 'keyboard-only-traversal',
    label: 'Keyboard-only traversal (Chrome Stage 1)',
    description:
      'Tab through every Reader route, verify logical order, visible unobscured focus, descriptive names, no nested controls. Preserved evidence: Chrome 151 Stage 1 keyboard interaction PASS.',
    notes:
      'Playwright keyboard assertions exist; Chrome Stage 1 verified. Prior human PASS: Chrome 151.0.7922.169 Stage 1.',
    requiredEvidence: ['Chrome 151.0.7922.169', 'tab order notes', 'focus visibility per route'],
  },
  {
    id: 'no-javascript-manual',
    label: 'No-JavaScript behavior (Chrome Stage 3)',
    description:
      'Disable JS and verify Search shows complete catalog with conventional links, all routes recover correctly. Preserved evidence: Chrome 151 Stage 3 no-JS PASS.',
    notes:
      'Automated reader-no-js project exists; Chrome Stage 3 no-JS verified. Prior human PASS: Chrome 151.0.7922.169 Stage 3 no-JS.',
    requiredEvidence: ['Chrome 151.0.7922.169', 'JS-disabled outcomes per route'],
  },
  {
    id: 'contrast-sampling',
    label: 'Manual contrast sampling (WCAG 2.2 AA) — BLOCKED',
    description:
      'Sample semantic text, links and visited links, focus, controls, borders, metadata, every callout state (fact/note/warning) in light and dark. Thresholds 4.5:1 text, 3:1 large/non-text. No exception. Preserved: contrast remains BLOCKED_PENDING_HUMAN per scope amendment — not waived.',
    notes:
      'Requires human tool (e.g., colour picker / axe contrast); rich article now exposes all three callout variants fact/note/warning for light/dark sampling. Do not mark PASS yet.',
    requiredEvidence: [
      'sample list per theme (including fact/note/warning callouts)',
      'ratio results',
      'tool version',
    ],
  },
  // firefox-stable, webkit-proxy, orca-firefox-journey removed per Chrome-only amendment #104#issuecomment-5353353146 — residual limitation: no Firefox/Safari/WebKit/Orca gate; Firefox Dev 155.0b1 noted supplemental only; Orca installed then removed.
  // lighthouse-mobile is NOT a human checkpoint — it is agent-run, validated via
  // `pnpm tsx scripts/run-lighthouse.ts` and recorded in
  // docs/evidence/reader-acceptance/lighthouse.json (Accessibility 100,
  // Best Practices 100, Performance >=90, every applicable SEO audit PASS
  // and is-crawlable sole failed with raw SEO 60; future SEO 100). The wizard
  // does not prompt for it and never fabricates its outcome.
  {
    id: 'human-fidelity-approval',
    label: 'Explicit human fidelity approval (after every preceding green)',
    description:
      'After every preceding criterion passes, human explicitly approves structural and experiential fidelity. Recorded; never inferred; cannot waive failed invariant.',
    notes:
      'Blocked until all other checkpoints PASS and invariantsGreen true. This is the final gate.',
    requiredEvidence: ['approver name', 'date', 'statement of fidelity'],
  },
] as const;

export type ManualOutcome = 'PASS' | 'FAIL' | 'BLOCKED_PENDING_HUMAN';

export interface ManualEntry {
  id: string;
  outcome: ManualOutcome;
  browserVersion?: string;
  notes?: string;
  evidencePath?: string;
}

export interface ManualEvidence {
  status: 'BLOCKED_PENDING_HUMAN' | 'PASS' | 'FAIL';
  generatedAt: string;
  worktreeCommit: string;
  invariantsGreen: boolean;
  entries: ManualEntry[];
  humanFidelityApproval?: {
    approved: boolean;
    approver: string;
    date: string;
    notes: string;
  };
}

export function buildManualEvidenceTemplate(): ManualEvidence {
  return {
    status: 'BLOCKED_PENDING_HUMAN',
    generatedAt: new Date().toISOString(),
    worktreeCommit: getCurrentHead(),
    invariantsGreen: true,
    entries: HUMAN_CHECKPOINTS.filter((c) => c.id !== 'human-fidelity-approval').map((c) => ({
      id: c.id,
      outcome: 'BLOCKED_PENDING_HUMAN' as const,
      notes: `BLOCKED: requires human execution. ${c.description}`,
    })),
  };
}

export const MANUAL_EVIDENCE_TEMPLATE: ManualEvidence = buildManualEvidenceTemplate();

export function isManualMatrixComplete(evidence: ManualEvidence): boolean {
  if (!evidence.invariantsGreen) return false;
  if (evidence.status !== 'PASS') return false;
  const expectedIds = new Set(
    HUMAN_CHECKPOINTS.filter((c) => c.id !== 'human-fidelity-approval').map((c) => c.id),
  );
  const expectedCount = expectedIds.size;
  if (evidence.entries.length !== expectedCount) return false;
  const seen = new Set<string>();
  for (const entry of evidence.entries) {
    if (!expectedIds.has(entry.id)) return false;
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    if (entry.outcome !== 'PASS') return false;
    if (!entry.notes || entry.notes.trim().length === 0) return false;
  }
  if (seen.size !== expectedCount) return false;
  const approval = evidence.humanFidelityApproval;
  if (!approval?.approved) return false;
  if (!approval.approver.trim() || !approval.date.trim() || !approval.notes.trim()) return false;
  return true;
}

async function prompt(question: string, rl: ReturnType<typeof createInterface>): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function runWizard(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log('\n=== T104 Human Acceptance Wizard ===');
  console.log(
    'Honesty boundary: manual steps require a human. This wizard records, never fabricates.\n',
  );
  console.log(
    'Frozen ceilings: Reader CSS 17,943 | Search JS 167,513 | Representative HTML 70,885',
  );
  const currentHead = getCurrentHead();
  console.log(`Worktree commit: ${currentHead} (t104-final-reader-acceptance)\n`);

  const evidence: ManualEvidence = {
    status: 'BLOCKED_PENDING_HUMAN',
    generatedAt: new Date().toISOString(),
    worktreeCommit: currentHead,
    invariantsGreen: false,
    entries: [],
  };
  console.log('First, confirm automated invariants are green for this revision:');
  console.log('  Run: PUBLIC_MEDIA_BASE_URL=https://media.jelementi.quz.ma/ pnpm verify:deploy');
  const invariantsAnswer = (
    await prompt('Were all automated invariants GREEN for this revision? (yes/no) [no]: ', rl)
  )
    .trim()
    .toLowerCase();
  evidence.invariantsGreen = invariantsAnswer === 'yes' || invariantsAnswer === 'y';
  if (!evidence.invariantsGreen) {
    console.log('Invariants not confirmed green — wizard will remain BLOCKED_PENDING_HUMAN.');
  }

  for (const checkpoint of HUMAN_CHECKPOINTS) {
    if (checkpoint.id === 'human-fidelity-approval') continue;
    console.log(`\n[${checkpoint.id}] ${checkpoint.label}`);
    console.log(`  ${checkpoint.description}`);
    console.log(`  Required: ${checkpoint.requiredEvidence.join(', ')}`);
    console.log(`  Notes: ${checkpoint.notes}`);
    const outcome = (await prompt('  Outcome (PASS/FAIL/BLOCKED) [BLOCKED]: ', rl))
      .trim()
      .toUpperCase();
    const valid =
      outcome === 'PASS' || outcome === 'FAIL' || outcome === 'BLOCKED' || outcome === '';
    const normalized = valid
      ? outcome === ''
        ? 'BLOCKED_PENDING_HUMAN'
        : outcome === 'BLOCKED'
          ? 'BLOCKED_PENDING_HUMAN'
          : outcome
      : 'BLOCKED_PENDING_HUMAN';
    const notes = await prompt('  Notes / version / evidence path (required if PASS): ', rl);
    if (normalized === 'PASS' && !notes.trim()) {
      console.log(
        '  PASS requires evidence notes — marking as BLOCKED_PENDING_HUMAN until notes are provided.',
      );
      evidence.entries.push({
        id: checkpoint.id,
        outcome: 'BLOCKED_PENDING_HUMAN',
        notes: 'BLOCKED: PASS requires non-empty evidence notes.',
      });
      continue;
    }
    evidence.entries.push({
      id: checkpoint.id,
      outcome: normalized as ManualOutcome,
      notes: notes || undefined,
    });
  }

  const allPass = evidence.entries.every((e) => e.outcome === 'PASS');
  console.log('\n=== Final fidelity approval ===');
  console.log(
    'This can be PASS only after every preceding checkpoint is PASS and invariants are green.',
  );
  console.log(
    `Current: ${allPass ? 'all preceding PASS' : 'NOT all PASS — approval must remain blocked'}.`,
  );
  if (allPass) {
    const approver = await prompt('Approver name (or leave blank to remain blocked): ', rl);
    if (approver.trim()) {
      const date = await prompt(`Date [${new Date().toISOString().slice(0, 10)}]: `, rl);
      const notes = await prompt('Approval statement (required): ', rl);
      if (!notes.trim()) {
        console.log('Approval statement is required — remaining BLOCKED_PENDING_HUMAN.');
        evidence.status = 'BLOCKED_PENDING_HUMAN';
        evidence.humanFidelityApproval = {
          approved: false,
          approver: approver.trim(),
          date: (date.trim() || new Date().toISOString().slice(0, 10))!,
          notes: 'BLOCKED: explicit fidelity statement is required.',
        };
      } else {
        evidence.humanFidelityApproval = {
          approved: true,
          approver: approver.trim(),
          date: (date.trim() || new Date().toISOString().slice(0, 10))!,
          notes: notes.trim(),
        };
        const complete = isManualMatrixComplete({ ...evidence, status: 'PASS' });
        if (!complete) {
          console.log(
            'Not all preceding checks are PASS with evidence — approval remains blocked.',
          );
          evidence.status = 'BLOCKED_PENDING_HUMAN';
          evidence.humanFidelityApproval.approved = false;
        } else {
          evidence.status = 'PASS';
        }
      }
    } else {
      evidence.status = 'BLOCKED_PENDING_HUMAN';
    }
  } else {
    evidence.status = 'BLOCKED_PENDING_HUMAN';
    console.log('Human fidelity approval remains BLOCKED_PENDING_HUMAN.');
  }

  const outDir = join(process.cwd(), 'docs/evidence/reader-acceptance');
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, 'manual-evidence.json');
  await writeFile(outPath, JSON.stringify(evidence, null, 2), 'utf8');
  console.log(`\nWrote ${outPath}`);
  console.log(
    'Next: commit this file only after human completes all checks; do not fabricate outcomes.',
  );
  rl.close();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runWizard();
}
