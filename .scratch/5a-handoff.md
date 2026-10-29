# Slice 5a handoff → search (5b)

## Result and limit

- Local branch: `t158-reader-search`; base `67605a6558f4a022bc95ee3cd4c5afb9594f5800`.
- Built Reader CSS: **40,958 → 39,435 bytes**, saving **1,523**; fixed/live agree. Ceiling stays **40,960**, headroom **1,525**.
- **35,000 target not reached; neither was <37,000.** This is the best reached in this consolidation pass, not a proof that a broader rewrite cannot save more. The remaining large home/article/series compositions are different layouts, not duplicate full blocks. No minifier/tooling/dependency/asset changes or budget increases.

## What moved/merged

- Foundation defaults now hold the already-live second-edition neutral palette/type; removed duplicate surface overrides. Reader-specific band/hue roles stay in app.css.
- Card/Kicker styles moved to shared `reader/components.css`, loaded after compositions to preserve the scoped-chunk cascade. Public markup/classes remain intact; the two-class kicker specificity is deliberate. Lower specificity unintentionally changes existing mobile kicker sizes.
- Equal width, stack/grid, image, metadata and responsive-hide blocks grouped within their media contexts. Vendor-only details-marker selector remains isolated for non-WebKit parsing.
- Requested corrections only: section-block heading line-height 1; mobile Browse and repeated section-row category eyebrows weight 500. Effective kicker sizes otherwise unchanged.

## Reuse in 5b

- `ListItem` (default row mode), `.list-item > article.card`, `.card .title/.deck/.meta`, `.reader-kicker`, `.hue-dot`, `.reader-button` / `--secondary`.
- Search currently still imports `ArticleSummary`: migrate it before deleting `.article-summary*`, summary sizing tokens and legacy search-only styles.
- There is **no exact shared Try-chip class** yet. Nav chips differ from board 08 in padding/radius; reuse `--deep-paper`, `--ink`, `--font-sans`, button/dot primitives rather than copying nav rules or adding a speculative abstraction.

## Verification/evidence

Frozen install and `PUBLIC_MEDIA_BASE_URL=https://media.jelementi.quz.ma/ pnpm verify:full` passed; last line `}`. All 299 unit tests also pass with generated/ absent. New typography browser tests fail against the detached pre-change commit and pass after, with/without JS.

Consolidation-only: **28/28 AE=0**. Final: **22 zero pairs; six intended typography differences; zero unexplained differences**. Native audio buffers were stabilized with identical full MP3 bytes in the capture harness only. Initial pre-edit captures are retained.

Audit, all counts/routes, captures and 21 board comparisons: `/home/quzma/hermes/designs/jelementi/evolution/build-captures/5-search/{AUDIT.md,MANIFEST.md,pixel-comparison.json}`. Captures are not an independent visual review. No push, merge, deployment, content/media edits, external writes or extra-model review.
