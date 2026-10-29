---
status: accepted
---

# Case-preserved search text as a separate generated file

## Context

Search results need short body snippets with the original spelling and case. The index's `searchText` is folded for matching, so it cannot reproduce “Vinča”. Loading full article documents into search would carry rendering metadata, references and footnotes that snippets do not need.

## Decision

Root content generation projects compiled `ArticleDocument` bodies into `generated/search-text.json`, a slug-to-plain-text map. It preserves case and diacritics, includes paragraphs, headings, list items, quotes and callouts, and strips numeric citations and footnote markers. Drafts and archived articles are excluded. The file participates in the same atomic generated-directory swap as the index and article files; validation remains read-only.

A separate `SearchTextSchema` in `@jelementi/article-model` validates the map. The web app validates it against the exact published index slug set. Only the `/search` server load imports the generated map and passes it as page data. Article/index shapes and `schemaVersion: 1` do not change.

## Consequences

- Search can show safe, case-preserved snippets and folded highlights using text nodes, not injected HTML.
- `/search` has a larger prerendered page-data payload; reader routes do not load the additional text.
- Generation and boundary validation prevent missing, orphaned or unpublished search bodies.
- The projection intentionally omits image captions, reference lists and footnote bodies; these are not snippet sources.

## Rejected alternative

Reconstructing snippets from folded `searchText` loses original spelling. Importing complete article documents into the search client adds unrelated content and rendering data.
