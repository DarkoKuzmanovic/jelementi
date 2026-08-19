# Research: Proven editorial-reader and accessibility patterns

**Issue #89 / Wayfinder #87 — decision input (2026-08-19)**

## Summary

Jelementi should make the article the primary object: a calm, single-column reading canvas with a bounded measure, explicit hierarchy, predictable landmarks, and low-chrome navigation. The public surface can share Studio’s warm palette, semantic roles, type family, spacing tokens, shape language, and focus treatment, but should use a slower, more generous rhythm and fewer simultaneous controls. This is not just aesthetic: WCAG requires operability, reflow, resizing, contrast, focus, and text-spacing behavior, while the existing static/non-hydrated route boundary is a strong performance and resilience choice.

The recommendations below distinguish **requirements** (standards or existing Jelementi contracts) from **optional patterns** (useful when validated against the catalog). They are recommendations, not production code.

## Findings

1. **Reading measure and typography: constrain the line length and establish a clear typographic hierarchy.**
   - **Recommendation:** use a readable, bounded article column (do not let body copy span the full viewport); keep headings, metadata, body, lists, quotes, code, and media visibly distinct; use comfortable line-height and paragraph spacing; preserve user text-spacing and 200% text resizing without clipping or loss of content. Prefer fluid sizing that settles into a deliberate maximum rather than a dense dashboard grid. These are the main ways to harmonize with Studio’s typography and spacing without importing its information density.
   - **Requirement:** WCAG 1.4.4 requires text to resize to 200% (with limited exceptions), and 1.4.12 requires author styles not to prevent specified text-spacing adjustments. [WCAG 1.4.4](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html), [WCAG 1.4.12](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html)
   - **Evidence/design-system guidance:** USWDS treats typography as a system of readable sizes, styles, and spacing rather than isolated decoration. [USWDS Typography](https://designsystem.digital.gov/components/typography/)
   - **Tradeoff:** a narrow measure improves scanning and sustained reading but can make wide tables/code awkward; allow an intentional wider block for media/code rather than widening every paragraph.

2. **Navigation: provide landmarks, skip access, and strong information scent; keep chrome subordinate to reading.**
   - **Requirement:** keyboard users need a way to bypass repeated navigation (WCAG 2.4.1), every interactive feature must work from the keyboard (2.1.1), and focus must remain visible (2.4.7). Use a semantic header/nav/main/footer structure, one clear page title, a “Skip to content” link, and descriptive link text that identifies destination or article title. [WCAG 2.4.1](https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html), [WCAG 2.1.1](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html), [WCAG 2.4.7](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)
   - **Recommendation:** persistent global navigation should expose only the few top-level reader destinations (for example, home/categories/search); article pages may offer breadcrumbs and a local table of contents only when the document has meaningful sections. Add previous/next or related-article links only when their labels provide context. Avoid tabs, dense toolbars, hover-only affordances, and “mystery meat” icon links in the reading path.
   - **Primary pattern evidence:** GOV.UK’s step-by-step navigation and pagination guidance treats navigation as explicit, labeled progression rather than a collection of controls. [GOV.UK step-by-step navigation](https://design-system.service.gov.uk/patterns/step-by-step-navigation/), [GOV.UK pagination](https://design-system.service.gov.uk/components/pagination/)
   - **Tradeoff:** more orientation aids improve wayfinding but consume vertical attention; condition them on document depth and keep them out of the first screen where they do not help.

3. **Listings and discovery: make metadata scannable, links unambiguous, and the index useful without JavaScript.**
   - **Requirement/contract:** published-only listings, category lists, route data, and prerender entries derive from the validated index; `/index.json` is a public, prerendered, non-hydrated contract and must remain stable (including its omission of `searchText`). Do not introduce a client-only discovery surface or derive public navigation from unvalidated article data.
   - **Recommendation:** present a simple ordered list/grid of article links with title as the primary link, short description/dek when available, category/date metadata, and consistent card/list structure. Keep cards as links (not nested interactive controls), expose result counts/status in a semantic way, and provide empty/no-results and not-found states with useful next actions. Category pages should answer “what is here?” before offering filters.
   - **Evidence:** USWDS documents cards as a collection of related subjects and supplies collection/pagination patterns and accessibility tests. [USWDS Card](https://designsystem.digital.gov/components/card/), [USWDS Pagination](https://designsystem.digital.gov/components/pagination/), [USWDS Collection accessibility tests](https://designsystem.digital.gov/components/collection/accessibility-tests/)
   - **Tradeoff:** cards improve scanning and imagery can add editorial character, but repeated large cards increase page length and visual noise; default to compact, text-first list rows for a small or writing-led catalog. Do not add pagination until catalog size or measured task performance justifies it; progressive disclosure can hide content from search and keyboard users.

4. **Responsive behavior: reflow the same content; do not make a separate mobile reading model.**
   - **Requirement:** WCAG 1.4.10 reflow requires content without two-dimensional scrolling at 320 CSS px wide (except content needing two-dimensional layout); 1.4.4 covers zoom/text resize. Test narrow widths, 200% zoom, and text-spacing overrides with long titles, links, footnotes, code, media captions, and navigation. [WCAG 1.4.10 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [WCAG 1.4.4 Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html)
   - **Recommendation:** use one responsive source order; collapse or wrap low-priority chrome, never hide article meaning; keep touch targets comfortably separated; permit images/media to scale within their container; use horizontal scrolling only for genuinely two-dimensional data such as code or tables and label it clearly.
   - **Tradeoff:** breakpoint-specific composition can improve hierarchy, but separate mobile markup increases maintenance and risks inaccessible divergence. Prefer CSS reflow and a small number of intentional layout changes.

5. **Contrast, focus, keyboard, and non-color cues are baseline—not Studio-only polish.**
   - **Requirement:** normal text must meet WCAG 1.4.3 contrast minimum (4.5:1; large text 3:1), non-text controls/focus indicators have their own contrast requirements, and meaning cannot rely on color alone (1.4.1). [WCAG contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [WCAG use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html), [WCAG focus appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html)
   - **Recommendation:** carry Studio’s semantic role tokens and warm palette only after contrast testing on text, muted metadata, links, visited links, borders, and focus against both light/dark surfaces. Use a persistent, high-contrast `:focus-visible` treatment with sufficient area/offset; never remove outlines without an equivalent. Ensure link affordance is not color-only (underline or another persistent cue), and preserve visible headings/labels for screen-reader and visual navigation.
   - **Tradeoff:** subdued metadata and low-contrast borders create a quiet editorial look but are frequent accessibility failures; make secondary information smaller or less prominent through size/spacing, not insufficient contrast.

6. **Reduced motion and dark theme: respect preferences, then offer restrained enhancement.**
   - **Requirement:** WCAG 2.3.3 (AAA) addresses animation from interactions; at minimum, avoid essential information conveyed only through motion and provide a mechanism to stop/pause applicable moving content under WCAG 2.2.2. [WCAG animation from interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html), [WCAG pause/stop/hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)
   - **Recommendation:** use `prefers-reduced-motion: reduce` to remove non-essential transitions/parallax and make state changes instantaneous; do not depend on motion for orientation. [MDN `prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
   - **Optional:** support `prefers-color-scheme` for a dark theme, but treat dark colors as a separately tested semantic token set, not an automatic inversion. Keep contrast, images, syntax highlighting, visited links, focus, and form controls legible. [MDN `prefers-color-scheme`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme)
   - **Tradeoff:** automatic dark mode respects platform preference but can surprise readers and expose untested palette combinations; a persisted explicit override is useful only if it remains accessible without script and does not block first paint.

7. **Static HTML and no-JS resilience are editorial features as well as performance choices.**
   - **Existing requirement:** normal reader routes remain prerendered and non-hydrated; `/search` is the sole normal hydrated reader route. Preserve this boundary and the static 404 behavior. `/index.json` remains prerendered/non-hydrated and carries `X-Robots-Tag: noindex`.
   - **Recommendation:** ship article title, metadata, headings, body, links, navigation, and listing content in server/prerendered HTML. Make every ordinary link and form understandable and usable when JavaScript is absent; enhance search only on `/search`, with an accessible static fallback or useful no-script message. Avoid client-side route transitions, content fetches, or layout-dependent hydration in normal reading pages.
   - **Evidence:** web.dev explains that client-side rendering delays HTML/content availability and that server-side/prerendered rendering improves initial experience; HTML performance guidance emphasizes minimizing critical work and unnecessary JavaScript. [Rendering on the Web](https://web.dev/articles/rendering-on-the-web), [Client-side rendering](https://web.dev/articles/client-side-rendering-of-html-and-interactivity), [General HTML performance](https://web.dev/learn/performance/general-html)
   - **Tradeoff:** static pages limit live personalization and animated interactions, but yield faster first content, better crawler/accessibility resilience, and simpler failure modes. Keep enhancements additive and isolated to the one intentionally hydrated route.

8. **Reader/Studio separation is a product rule, not merely a CSS variant.**
   - **Recommendation:** share foundations—semantic color roles, typography family/scale primitives, spacing units, corner/rule shape, and focus treatment—but define a reader-specific density mode: one dominant task (read), generous whitespace, restrained metadata, shallow navigation, and no operational status controls. Studio can retain compact rows, persistent context, dense controls, and lifecycle/status affordances because its task is operating content.
   - **Avoid:** importing Studio sidebars, toolbars, status badges, multi-column control panels, hover actions, or frequent separators into article pages. Do not “solve” coherence by making reader pages look like a disabled Studio. Coherence should be recognizable through tokens and voice while composition follows the task.
   - **Tradeoff:** separate compositions create two surfaces to test, but a single density/layout system would optimize for Studio’s throughput at the expense of reading focus, mobile reflow, and cognitive load. Shared tokens preserve maintainability without sharing the wrong information architecture.

## Decision-ready requirements vs optional patterns

**Must preserve / implement as acceptance gates:** WCAG keyboard and bypass behavior; visible focus; contrast and non-color cues; 200% text resize and text-spacing; 320 CSS px reflow; semantic landmarks/headings; published-only validated-index derivation; prerendered, non-hydrated ordinary routes; stable `/index.json` contract; no-JS article/listing HTML; reduced-motion-safe behavior for any motion added.

**Optional, validate with real catalog/content:** breadcrumbs; article table of contents for long documents; previous/next and related links; compact text-first cards; category filtering; pagination; automatic dark mode plus explicit override; typography controls (font size/measure). Each adds navigation, state, or testing surface and should be justified by content volume or reader tasks rather than assumed best practice.

## Residual uncertainty and validation plan

- No primary-source universal “ideal” line length, card density, or exact type scale exists; choose initial tokens from Studio’s foundation, then validate with representative long/short articles and user task evidence.
- The catalog size, category count, media mix, footnote frequency, and code/table prevalence determine whether TOCs, pagination, filters, or wider blocks are warranted.
- Verify behavior with keyboard-only navigation, screen reader landmarks/headings, 320 px/200% zoom/text spacing, light/dark contrast sampling, reduced-motion settings, JavaScript disabled, slow-network cold loads, and production route/index contract probes.
- Dark theme and client-enhanced search need product decisions; neither is required to establish the static reader baseline.

## Sources

- **Kept:** W3C WCAG 2.2 normative/Understanding pages — authoritative accessibility requirements for reflow, resize, contrast, focus, keyboard, bypass, animation, and text spacing.
- **Kept:** GOV.UK Design System pagination and step-by-step navigation — first-party, tested public-service navigation patterns.
- **Kept:** USWDS typography, card, pagination, and collection accessibility guidance — first-party design-system patterns for readable hierarchy and listings.
- **Kept:** web.dev rendering and HTML performance — Google-maintained browser/web performance guidance for static/server-rendered content and JavaScript cost.
- **Kept:** MDN media-feature references — platform behavior for `prefers-reduced-motion` and `prefers-color-scheme`.
- **Dropped:** SEO blogs, generic UX roundups, and unsourced “best line length/card” articles — not primary evidence and often prescribe context-free numbers.

## Acceptance report

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Created one decision-input research brief only; no production code, routes, models, compiler, or issue state changed."
    }
  ],
  "changedFiles": ["docs/research/public-reader-editorial-patterns.md"],
  "testsAddedOrUpdated": [],
  "commandsRun": [],
  "validationOutput": ["Markdown artifact written to the authoritative requested path."],
  "residualRisks": ["Exact measure, density, dark-theme, and discovery choices require validation against Jelementi's real catalog and representative content."],
  "noStagedFiles": true,
  "diffSummary": "Added a cited research brief covering editorial reading, navigation, listings, responsive behavior, accessibility, motion/theme, static performance, and reader/Studio separation.",
  "reviewFindings": ["no blockers"],
  "manualNotes": "Repository production code was not modified."
}
```