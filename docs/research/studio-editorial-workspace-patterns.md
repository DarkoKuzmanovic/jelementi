# Research: Jelementi Studio editorial-workspace patterns

## Decision summary

Studio should be a **server-first form workflow with a persistent, evidence-bearing status rail**: editing remains the primary task, while Save, Preview, Publish, lifecycle facts, and recovery evidence stay available beside it on wide screens. The rail may collapse or move below the editor at small widths, but must not remove actions, evidence, or keyboard access. Preview is an inspection action; Save is the only commit action; Publish is a separate, head-bound approval of the committed draft. No client enhancement may imply success before the server returns authoritative evidence.

This follows Jelementi's current constraints: GitHub is the sole source of truth; Save may persist invalid work; Publish revalidates the exact committed draft and never unsaved text; the production and change axes remain separate; Live requires public fingerprint and index evidence; there is no autosave or browser-local recovery; destructive operations require confirmation; and the redesign is desktop-first but must remain WCAG AA, keyboard-complete, and usable on smaller screens (`CONTEXT.md`, `specs/m3-studio.md`, `AGENTS.md`).

## Constraints for [Prototype the resume-work Studio home](https://github.com/DarkoKuzmanovic/jelementi/issues/66) and [Prototype the editing, preview, and status workspace](https://github.com/DarkoKuzmanovic/jelementi/issues/67)

### 1. Persistent editor/status-sidebar relationship

- On desktop, use a stable two-region layout: the editor is the main region; a semantic complementary/status region contains lifecycle facts, concurrency evidence, validation summary, and available actions. Keep the relationship visible while editing, but do not make status depend on color or transient toasts.
- Treat the two lifecycle axes as separate labeled facts: **Production** (absent/live/pending deployment/pending removal) and **Change** (none/draft/ready/checking/merged). Lead each axis with a plain-language safety interpretation and the next action the operator can take before disclosing technical lifecycle facts or evidence. Never present merge, deployment, or a successful request as Live; show the sanitized evidence and failed phase that justify each state.
- A status update such as “Preview ready”, “Saved invalid draft”, “Checking”, or “Live not proven” is a non-focus-changing status message. Expose it programmatically (for example, a correctly scoped `role="status"` region) while retaining visible text. WCAG 4.1.3 specifically requires status messages about action results, waiting, progress, or errors to be programmatically determinable without taking focus. [W3C WCAG 2.2 — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
- Do not use a live region for every incidental editor keystroke. Announce meaningful operation transitions and errors; keep the visual evidence persistent so the operator can review it.
- If the rail is collapsible, use a real button with an accessible name and exposed expanded/collapsed state. Collapsing is disclosure, not navigation: keep the editor and action order understandable, and make the complete status/action content reachable by keyboard.

### 2. Explicit Preview / Save / Publish hierarchy

- Make the hierarchy explicit in both labels and adjacent explanatory text:
  - **Preview**: server-compile the current unsaved input and show the reader renderer; it has no GitHub or generated-output effect.
  - **Save draft**: commit exactly one article file to the deterministic Studio branch; it may succeed with compiler issues, and the response must identify the committed head/evidence.
  - **Publish**: approve only the exact committed draft head after server revalidation; it changes PR readiness/auto-merge, never the unsaved textarea.
- Do not disable Save merely because content is invalid (the spec explicitly permits invalid saves). Instead, make the invalid state and its consequence (“cannot Publish”) prominent. Publish can be unavailable while invalid or stale, but the reason must be text and programmatically associated.
- Keep Preview visually subordinate to Save and Publish, and keep Publish visually distinct as the head-bound approval boundary. Do not place a generic “Submit” action where its server effect is ambiguous.
- GitHub's first-party workflow supports the same staged distinction: a draft PR is not mergeable until marked ready for review, and changing it to ready is an explicit action. [GitHub Docs — Changing the stage of a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/changing-the-stage-of-a-pull-request)

### 3. Validation, recovery, and progressive disclosure

- Show a compact always-visible summary (count, severity, and phase) and provide a disclosure to the full structured issue list. Each issue must include source location, plain-text description, and a correction suggestion when known; each issue should link/focus its corresponding metadata control or body location. WCAG 3.3.1 requires identifying the erroneous item and describing the error in text; 3.3.3 requires known correction suggestions. [Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html), [Error Suggestion](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html)
- Progressive disclosure should hide detail, not facts or safety boundaries: the operator must see that validation failed, that Publish is blocked, and which phase failed without opening a panel. Expandable details can contain compiler diagnostics, SHAs, PR/check/deployment links, comparison data, and safe-retry or draft-replacement instructions. Draft replacement must state its conservative preconditions: the loaded draft head still matches, the target article blob on `main` is unchanged, and the Studio draft changes exactly that article.
- Recovery controls must describe what they preserve and what they mutate. For stale concurrency evidence, show main SHA, draft head SHA, expected blob SHA, and the comparison before offering recovery. Preserve the submitted/local candidate on conflict; never silently overwrite or “refresh” it.
- Use native labeled controls and server-returned errors as the correctness baseline. Client validation can give faster feedback, but MDN explicitly warns never to trust client data and recommends robust HTML features first, with JavaScript enhancing them. [MDN — Client-side form validation](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Form_validation)
- Enhancement may replace a full navigation with an in-place response, but the same server endpoint, authorization, CSRF/origin checks, validation, concurrency checks, and evidence contract must run. Without JavaScript, ordinary form submission must still preserve server correctness and expose recoverable errors.

### 4. Destructive-action confirmation

- Unpublish and Discard draft must be explicit state-changing POST/form actions, never GET links or accidental single clicks. Put the action's exact effect in the confirmation text: Unpublish archives and requires the exact slug; Discard closes only the Draft PR and deletes only its Studio branch; `main` is unchanged.
- Use an alert dialog only for an interruption that genuinely requires confirmation. It must have an accessible name and description, `aria-modal="true"` only when outside content is actually inert for every user, and keyboard behavior from the modal dialog pattern. For destructive or hard-to-reverse actions, initial focus should generally be on the least destructive option (Cancel), not the destructive button. [WAI-ARIA APG — Alert and Message Dialogs](https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/), [WAI-ARIA APG — Dialog (Modal)](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- Dialog keyboard contract: move focus inside on open; Tab/Shift+Tab cycle within; Escape closes; return focus to the invoking control (or a logical successor if it no longer exists). Always provide a visible Cancel/close button. [WAI-ARIA APG — Dialog (Modal)](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- Confirmation is not a substitute for server preconditions: re-read GitHub topology and compare expected heads immediately before mutation, and show partial-failure evidence with a safe retry path.

### 5. Keyboard and focus behavior

- All editor, disclosure, Preview, Save, Publish, refresh, recovery, evidence links, and destructive actions must have keyboard equivalents. WCAG 2.1.1 requires all functionality to be operable through a keyboard interface without timing-dependent keystrokes. Prefer native HTML links, buttons, labels, and form controls over custom clickable containers. [W3C WCAG 2.2 — Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html)
- Make DOM/focus order reflect the workflow: article identity/metadata, body editor, Preview, Save, then Publish/status and recovery links is one plausible order; test the actual layout rather than assuming CSS columns define the order. WCAG 2.4.3 requires a sequential focus order that preserves meaning and operability. [W3C WCAG 2.2 — Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)
- Keep a visible, high-contrast focus indicator and ensure sticky headers/rails do not obscure the focused control. WCAG 2.4.7 requires visible focus; WCAG 2.4.11 requires the focused component not be entirely obscured. [Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html), [WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/)
- After Preview/Save/Publish responses, preserve editor focus and selection unless moving focus is necessary to expose an error. For a server error, move focus to a concise error summary or first invalid control only when that improves recovery, and provide a route back to the body location. Do not steal focus for routine status updates.
- Avoid single-character global shortcuts in the editor unless they can be turned off/remapped; typing Markdown must remain typing, not trigger actions. WCAG 2.1.4 addresses character-key shortcuts; [WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/).

### 6. Desktop-first degradation on smaller screens

- Desktop may show editor plus persistent status rail. At narrow widths or high zoom, stack regions or turn the rail into an explicitly labeled disclosure/drawer; keep the action group reachable without horizontal page scrolling. Do not simply shrink the editor until text and controls become unusable.
- Target WCAG AA Reflow: non-exempt content must work at a 320 CSS-pixel viewport (equivalent to 400% zoom from 1280 CSS pixels) without loss of information/functionality or two-dimensional scrolling. A persistent editing toolbar can be a two-dimensional-layout exception when needed for editing, but the surrounding metadata, headings, actions, errors, and status must still reflow. [W3C — Understanding Reflow (1.4.10)](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
- Limit horizontal scrolling to genuinely two-dimensional content such as a code/text comparison; contain it locally rather than making the whole page scroll in two directions. The W3C reflow guidance specifically illustrates side-by-side editing comparisons and persistent editing toolbars while requiring surrounding content to remain usable.
- At smaller widths preserve the same semantic sequence and capabilities: editor first, then status/actions (or a clearly triggered status disclosure), then evidence/details. Do not create a mobile-only action model that bypasses server checks.

## Prototype acceptance probes

The [resume-work home prototype](https://github.com/DarkoKuzmanovic/jelementi/issues/66) and [editing, preview, and status workspace prototype](https://github.com/DarkoKuzmanovic/jelementi/issues/67) should test at least:

1. Keyboard-only traversal from metadata through body, Preview, Save, Publish, status details, and recovery; no trap; visible focus remains unobscured.
2. Save invalid input: server commits/persists it, visible summary identifies errors, screen reader receives a meaningful status, and Publish explains why it is unavailable.
3. Preview unsaved input: rendered response is clearly labeled preview and does not alter GitHub state.
4. Publish after an editor change but before Save: impossible; UI and server both reject unsaved content.
5. Stale main/draft head: comparison and preserved candidate are visible; no blind retry or silent overwrite.
6. Failed check/deployment/probe: phase and sanitized evidence remain visible; merge/build is not labeled Live.
7. Unpublish/Discard: keyboard-opened confirmation, Cancel has safe initial focus, Escape/Cancel restore focus, exact-slug requirement works, and server mutation is not reachable by GET.
8. 400% zoom / approximately 320 CSS px: no page-level two-axis scroll for ordinary text, metadata, status, errors, or actions; rail stacks/discloses without loss.
9. JavaScript disabled or enhancement failure: server form actions still authenticate, enforce Origin/CSRF and concurrency, validate, and return recoverable results.

## Local authority consulted

- `CONTEXT.md` — Jelementi vocabulary, two-axis lifecycle, committed draft vs unsaved text, Live evidence, destructive-action semantics.
- `specs/m3-studio.md` — desktop-first Studio scope, explicit Preview/Save/Publish behavior, invalid-save allowance, concurrency/recovery, no autosave, and security/server contracts.
- `AGENTS.md` — repository invariants and quality floor; no implementation files were changed.
- `docs/adr/0001-single-operator-studio-boundary.md` — one configured operator and independent per-endpoint authorization.
- `docs/adr/0004-publish-approval-head-bound.md` — Publish approves one exact committed head and freezes subsequent branch mutation.
- `docs/adr/0006-replace-stale-studio-drafts.md` — stale recovery preserves the candidate and replaces the Draft PR conservatively.
- `docs/adr/0007-self-binding-production-probes.md` — Refresh proves Live through the Worker’s self-bound production evidence path.
- `docs/adr/0008-discard-unmerged-approved-studio-pr.md` — Discard safely abandons an unchanged, unmerged approved candidate after check failure.

## Unresolved questions

- Will [Prototype the resume-work Studio home](https://github.com/DarkoKuzmanovic/jelementi/issues/66) use a native `<dialog>` or an equivalent custom modal? Either is acceptable only if the APG focus/inertness contract is met and tested with supported assistive technologies.
- What is the minimum supported browser/screen-reader matrix for the Studio? This determines whether native form validation, live-region behavior, and enhanced editor interactions are accessibility-supported in practice.
- How should source-located body diagnostics map to a textarea/editor selection without making a custom editor a keyboard or reflow liability?
- At what width should the rail stack, and should status details be inline disclosure or a modal/drawer? This is a prototype decision, constrained by preserving the semantic order and no-loss small-screen behavior above.

## Sources consulted

- [W3C WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/) — normative AA baseline, keyboard, focus, reflow, status, and input-assistance criteria.
- [W3C Understanding Status Messages (4.1.3)](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) — non-focus-changing operation feedback and live-region expectations.
- [W3C Understanding Error Identification (3.3.1)](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html) — textual, item-specific errors.
- [W3C Understanding Error Suggestion (3.3.3)](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html) — known correction guidance.
- [W3C Understanding Keyboard (2.1.1)](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html) — keyboard-complete operation.
- [W3C Understanding Focus Order (2.4.3)](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) — logical sequential order.
- [W3C Understanding Reflow (1.4.10)](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) — 320 CSS-pixel/400% zoom behavior and persistent-toolbar/two-dimensional exceptions.
- [WAI-ARIA APG Dialog (Modal)](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) and [Alert Dialogs](https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/) — focus containment, Escape, restoration, labeling, and safe confirmation focus.
- [GitHub Docs — Changing the stage of a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/changing-the-stage-of-a-pull-request) — first-party staged draft/ready workflow.
- [MDN — Client-side form validation](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Form_validation) — enhancement guidance and warning that client input cannot be trusted.
