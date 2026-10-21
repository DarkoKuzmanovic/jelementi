---
status: accepted
---

# Article series as explicit frontmatter metadata

## Context

Some articles form ordered series, but article titles are presentation copy rather than a reliable relationship. Inferring membership or order from title prefixes would fail when wording changes and could not validate category consistency, unique parts, or missing installments.

## Decision

Add an optional strict `series` object to canonical article frontmatter with a kebab-case `slug`, non-empty display `title`, and positive integer `part`. Published articles sharing a series slug must share the same title and category, have unique part numbers, and form a contiguous sequence beginning at part 1. Draft and archived articles validate the object shape without participating in published-series consistency checks.

The field remains backward-compatible with `schemaVersion: 1`. It is carried by compiled documents and the internal article index, but does not extend the public `/index.json` field set.

## Consequences

- Series membership, display title, and order are explicit, validated metadata instead of title-derived conventions.
- Studio can preserve and edit series metadata through the canonical source serializer.
- Published content validation rejects inconsistent, duplicated, or gapped series before generated content is built.
- Reader navigation can be projected from validated metadata without changing the public index contract.

## Rejected alternative

Deriving series membership and part order from title prefixes was rejected because titles are editorial copy, can be revised independently, and do not provide structured fields for reliable consistency checks.
