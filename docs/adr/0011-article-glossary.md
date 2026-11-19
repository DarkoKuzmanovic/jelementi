---
status: accepted
---

# Article glossary as optional frontmatter

## Context

Study articles need definitions beside terms and a complete list for revision. Definitions should remain structured and available to static readers without client JavaScript.

## Decision

Add an optional glossary list to article frontmatter. Each entry has a term, definition, and optional kebab-case ID, generated from the transliterated term when absent. The compiled document carries explicit unique IDs and remains schema version 1. Markdown links to `#glossary-<id>` are validated against the glossary; unused entries are allowed. The reader progressively enhances links with dismissible, hoverable definitions and renders a glossary list. External article serialization renders linked terms as text.

## Consequences

The compiler, model and source serializer preserve and validate glossary data. Existing articles remain valid. Authors control ambiguous or colliding IDs explicitly. No new inline node is required. Without JavaScript, terms remain links to the complete glossary; touch taps follow those links.
