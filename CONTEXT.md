# Jelementi

The Jelementi content platform: Markdown articles compiled into a prerendered reader site for a single operator.

## Language

**Article**:
A unit of published content with canonical Markdown at `content/articles/<slug>.md` on `main`. Has status `draft | published | archived`.
_Avoid_: Post, piece, content item

**Series**:
An explicitly identified group of articles sharing a stable slug, display title, and category. Each article declares a positive part number; published parts are unique and contiguous starting at 1.
_Avoid_: Inferring membership or order from title wording

**Canonical article**:
The article as it exists on `main`. A branch or pull request is not the article; it is canonical only when its blob is on `main`.

**Draft (status)**:
The canonical article status meaning "not yet published".

**Ship**:
Publishing approved content with `pnpm ship`: validate, open a PR, wait for the `verify` check, merge. The merge deploys.
_Avoid_: Release

**Check**:
The required GitHub `verify` check on a pull request; failure leaves the PR open.
_Avoid_: Test, CI, build

**Fingerprint**:
The lowercase SHA-256 hex digest of a published article's canonical JSON, exposed as `<meta name="jelementi-content-version">` on its page. Used to confirm a shipped article is live.
_Avoid_: Hash, checksum, version
