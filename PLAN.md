# M3 — Access-Protected Publishing Studio

## Scope decision

- **Tier:** Standard
- **Risk:** critical protected
- **Delivery:** local
- **Evidence:** one repository; four bounded sequential outcomes; architecture approved in `docs/specs/2026-08-13-m3-publishing-studio-design.md`; authentication, repository-write credentials, concurrency, destructive draft cleanup, and false-Live prevention are protected boundaries; rollback and deterministic local verification are defined; no unresolved architecture fork or second repository.
- **Allowed ceremony:** compact outcome map; planner used because the protected multi-package file surface and dependencies required an exact first-slice DAG; one risk-dominant combined review at each independently verifiable protected boundary; at most one blocker-only delta follow-up; operator checkpoints A–D remain outside worker DAGs.
- **Grill:** additional Crew grill explicitly skipped by Darko on 2026-08-13 because the approved spec already passed collaborative design, high-risk sidecar critique, and independent blocker review with a PASS follow-up.
- **Started-at:** 2026-08-13T14:14:49+02:00
- **Promotion triggers:** a second repository; unresolved authentication/publishing architecture fork; required migration or new persistent state; inability to prove repository or production integrity deterministically; materially broader Studio/CMS scope.
- **Run branch:** `crew/m3-publishing-studio`

## M3 — Access-Protected Publishing Studio

**Counters:** worker-dispatches: 1/14 · replans: 0/2 · burned: 0 · review-dispatches: 0/2 default · oracle: 0 · worker-retries: 0 · direct-edits: 0

- [ ] **M3.1 — Lock pure authoring, Studio envelope, and production content-evidence contracts**
- [ ] **M3.2 — Deliver the Access-protected Studio read, edit, and immediate-preview surface**
- [ ] **M3.3 — Deliver the conflict-safe GitHub draft, publish, unpublish, and discard lifecycle**
- [ ] **M3.4 — Prove deployment status, false-Live prevention, full regression safety, and operator readiness**

The dependency chain is `M3.1 → M3.2 → M3.3 → M3.4`. Checkpoints A–D from the approved spec are user-controlled remote boundaries, not worker tasks and not implied by `Delivery: local`.

## Crew v2 active DAG

```json
{
  "baseRevision": "db8ed71",
  "budgets": {
    "dispatch": {
      "limit": 14,
      "used": 1
    },
    "replan": {
      "limit": 2,
      "used": 0
    }
  },
  "scheduler": {
    "ceilings": {
      "hard": 1,
      "readers": 1,
      "writers": 2
    },
    "mode": "hard",
    "ordering": "outcome-task-id-v1"
  },
  "tasks": [
    {
      "contract": {
        "acceptance": [
          "Add failing tests before production code and record the RED command/output in the child result.",
          "Round-trip every current frontmatter field, including optional publishedAt, audio duration, reference publisher, and reference accessedAt.",
          "Lock field order, YAML quoting, LF line endings, one frontmatter/body separator, final newline behavior, and repeated-call byte equality.",
          "Prove valid reconstructed source compiles to the intended ArticleDocument and invalid or unsupported body syntax still returns structured source-located compiler issues.",
          "Run pnpm exec vitest run packages/content-compiler/test/article-source.test.ts packages/content-compiler/test/compiler.test.ts.",
          "Run pnpm typecheck."
        ],
        "dependsOn": [],
        "invariant": "Every supported Studio metadata field and Markdown body serializes to one deterministic canonical article source without weakening compileArticle validation or introducing filesystem, environment, SvelteKit, GitHub, or Cloudflare ownership into the compiler.",
        "kind": "implementation",
        "milestone": "M3",
        "outcome": "M3.1",
        "ownershipLocks": [
          "compiler.article-source-serialization",
          "compiler.public-api"
        ],
        "readSet": [
          "content/articles/tristan-da-cunha.md",
          "packages/article-model/src/schema.ts",
          "packages/content-compiler/package.json",
          "packages/content-compiler/src/index.ts",
          "packages/content-compiler/test/compiler.test.ts"
        ],
        "replanTriggers": [
          "An equivalent deterministic public serializer already exists.",
          "Deterministic serialization requires an unapproved dependency or article-model schema change.",
          "Implementation needs any write path outside the frozen writeSet.",
          "Round-trip behavior cannot preserve the current compiler contract."
        ],
        "reviewProperties": [
          "Compiler ownership remains pure and framework-neutral.",
          "No metadata field is silently dropped, normalized differently, or made editable when compiler-owned.",
          "The public serializer API is the smallest discoverable surface needed by Studio.",
          "Unsupported Markdown and schemaVersion invariants remain unchanged."
        ],
        "risk": "protected",
        "route": {
          "role": "worker"
        },
        "writeSet": [
          "packages/content-compiler/src/article-source.ts",
          "packages/content-compiler/src/index.ts",
          "packages/content-compiler/test/article-source.test.ts"
        ]
      },
      "contractHash": "sha256:114b291308a6c1a3cdb65ca64f0c859786c884ca42d7896765e24bcc9e09b8fc",
      "id": "M3-T1",
      "state": {
        "attempts": 1,
        "baseRevision": "e3924ff",
        "ceiling": 2,
        "effort": "hard",
        "receipt": {
          "artifactPath": "/home/quzma/code/jelementi/.pi/subagents/artifacts/handoffs/b8a82bb1.json",
          "basisDagHash": "sha256:c0ec2ec11628b8109061cd23d12949ed17ce5dad5dd29219b6e1e32c28ece285",
          "capabilityHash": "sha256:ce3b879c7678f904bec795a0781d7d3024dc1d18f557ec78098f11332171d0bc",
          "model": "deepseek/deepseek-v4-flash:max",
          "outputState": "present",
          "receiptClass": "child_result",
          "requestedRoute": {
            "role": "worker"
          },
          "runId": "b8a82bb1",
          "source": "foreground",
          "success": true,
          "waveId": "sha256:f632b793c7220579f47e74f16ddbfa870d9b156dccd598ff0c8531fee10620f4"
        },
        "status": "accepted",
        "supersedes": null
      }
    },
    {
      "contract": {
        "acceptance": [
          "Add failing tests before contract implementation and record the RED command/output in the child result.",
          "Runtime-validate editor metadata/body input, base/head/blob concurrency evidence, preview results, conflicts, sanitized failures, lifecycle evidence, and every approved presentation status.",
          "Reject unknown keys, malformed or path-like slugs, malformed SHAs, missing required concurrency evidence, and impossible status/evidence combinations.",
          "Keep credentials, raw upstream bodies, stack traces, and article bodies outside client-visible status envelopes except the explicit editor/preview boundary.",
          "Prove live cannot decode without content-version and production-index evidence.",
          "Run pnpm exec vitest run apps/web/src/lib/studio/contracts.test.ts.",
          "Run pnpm typecheck."
        ],
        "dependsOn": [
          "M3-T1"
        ],
        "invariant": "Every untrusted Studio request or result decodes to a bounded internal value or an explicit sanitized rejection before any future repository or production side effect.",
        "kind": "implementation",
        "milestone": "M3",
        "outcome": "M3.1",
        "ownershipLocks": [
          "studio.client-contracts"
        ],
        "readSet": [
          "apps/web/package.json",
          "packages/article-model/src/index.ts",
          "packages/article-model/src/schema.ts",
          "packages/content-compiler/src/article-source.ts",
          "packages/content-compiler/src/index.ts"
        ],
        "replanTriggers": [
          "A safe discriminated contract cannot represent an approved spec state.",
          "A new runtime dependency is required.",
          "GitHub upstream response types must leak into the client contract.",
          "Implementation needs Studio routes, external I/O, or any write path outside the frozen writeSet."
        ],
        "reviewProperties": [
          "ArticleStatusSchema remains draft, published, or archived.",
          "Client contracts cannot carry GitHub tokens, Access assertions, private keys, or raw upstream response types.",
          "Conflict results expose only bounded loaded/current identities.",
          "Lifecycle discriminants prevent generic success from representing live."
        ],
        "risk": "critical",
        "route": {
          "role": "worker"
        },
        "writeSet": [
          "apps/web/src/lib/studio/contracts.test.ts",
          "apps/web/src/lib/studio/contracts.ts"
        ]
      },
      "contractHash": "sha256:a34fabd878a930ae8ed9c3edbd28cb77c7b4c2a9659624f38131f40019975404",
      "id": "M3-T2",
      "state": {
        "attempts": 0,
        "baseRevision": "db8ed71",
        "ceiling": 2,
        "effort": "normal",
        "receipt": null,
        "status": "ready",
        "supersedes": null
      }
    },
    {
      "contract": {
        "acceptance": [
          "Add failing canonicalization, digest, and rendered-meta tests before production code and record the RED command/output in the child result.",
          "Recursively sort object keys, preserve array order, serialize without insignificant whitespace, encode UTF-8, and emit lowercase 64-character SHA-256 hex.",
          "Prove insertion-order independence, Unicode byte determinism, array-order sensitivity, and meaningful-document-change sensitivity.",
          "Use one framework-neutral helper compatible with Node and Cloudflare runtime; do not import node:crypto into browser-reachable article-model code.",
          "Render exactly one meta element named jelementi-content-version with the computed digest.",
          "Do not add the digest to ArticleDocumentSchema, ArticleIndexEntrySchema, generated article JSON, or generated index JSON.",
          "Run pnpm exec vitest run packages/article-model/test/article-model.test.ts scripts/content-canonical.test.ts apps/web/src/routes/generated-routes.test.ts.",
          "Run pnpm typecheck.",
          "Run pnpm content:validate."
        ],
        "dependsOn": [
          "M3-T1"
        ],
        "invariant": "A validated ArticleDocument has one cross-runtime lowercase SHA-256 fingerprint derived from the approved canonical UTF-8 JSON bytes, and prerendered article HTML exposes exactly that digest without changing public article or index schemas.",
        "kind": "implementation",
        "milestone": "M3",
        "outcome": "M3.1",
        "ownershipLocks": [
          "article-model.content-fingerprint",
          "content-generation.article-json",
          "reader.article-content-version"
        ],
        "readSet": [
          "apps/web/src/lib/generated-content.server.ts",
          "apps/web/src/routes/articles/[slug]/+page.server.ts",
          "apps/web/src/routes/articles/[slug]/+page.svelte",
          "apps/web/src/routes/generated-routes.test.ts",
          "packages/article-model/src/index.ts",
          "packages/article-model/src/schema.ts",
          "packages/article-model/test/article-model.test.ts",
          "scripts/content-canonical.test.ts",
          "scripts/content.test.ts",
          "scripts/content.ts"
        ],
        "replanTriggers": [
          "No framework-neutral SHA-256 path works in both Node and Cloudflare runtime.",
          "The only viable implementation imports node:crypto into browser-reachable code.",
          "Fingerprint persistence requires a new generated schema field or sidecar.",
          "Implementation needs any write path outside the frozen writeSet."
        ],
        "reviewProperties": [
          "Canonical bytes exactly match the approved recursive sort and array-preservation contract.",
          "Fingerprint code is cross-runtime and does not contaminate public client bundles with Node-only APIs.",
          "No public article/index schema, reader hydration, noindex, generated-data validation, or route behavior drifts.",
          "No generated artifact is committed and no merge/build signal can substitute for this content proof."
        ],
        "risk": "critical",
        "route": {
          "role": "worker"
        },
        "writeSet": [
          "apps/web/src/routes/articles/[slug]/+page.server.ts",
          "apps/web/src/routes/articles/[slug]/+page.svelte",
          "apps/web/src/routes/generated-routes.test.ts",
          "packages/article-model/src/content-fingerprint.ts",
          "packages/article-model/src/index.ts",
          "packages/article-model/test/article-model.test.ts",
          "scripts/content-canonical.test.ts",
          "scripts/content.ts"
        ]
      },
      "contractHash": "sha256:f921f5d83c80aae8837f82ba9ee6a6a1a976d6a652b8be63f80a314f8489a474",
      "id": "M3-T3",
      "state": {
        "attempts": 0,
        "baseRevision": "db8ed71",
        "ceiling": 2,
        "effort": "hard",
        "receipt": null,
        "status": "ready",
        "supersedes": null
      }
    }
  ],
  "version": 3
}
```

## Grill decisions

- GitHub is the sole Studio publishing source of truth; D1 and Actions brokerage were rejected.
- One active branch and one draft PR per article; one article per PR.
- Invalid drafts may be saved but Publish revalidates and blocks them.
- Publish uses squash auto-merge with `expectedHeadOid` behind strict required `verify`.
- Access JWT signature, issuer, audience, time claims, and exact allowed email are verified on every Studio read/write boundary.
- `Live` requires the exact public content fingerprint and matching production index evidence.
- Unpublish cannot overwrite a differing active content draft; Discard deletes only the expected draft branch after head verification.
- Access must exist and pass identity probes before Studio deployment; state-changing canary work is a later separate checkpoint.

## Open questions

- None for M3.1. Later outcomes must re-check current Cloudflare Access and GitHub App API documentation at their recorded runway seams.

## Conventions

- Run every project command from `/home/quzma/code/jelementi`.
- `generated/` is reproducible and must not be committed.
- Keep `.pi/`, `.pi-subagents/`, and `.superpowers/` untracked through `.git/info/exclude`.
- Workers add tests first and report the exact failing RED command before production changes.
- No task may edit outside its frozen writeSet; scope expansion is a successful stop and parent replan trigger.
- Use framework-neutral Web Crypto for cross-runtime SHA-256; a Node-only import in browser-reachable article-model code is a stop signal.
- Remote GitHub/Cloudflare mutations and checkpoint actions are forbidden in worker tasks.

## Deferred

- None.

## Documentation evidence

- **M3.1:** pending. Reconcile `README.md` for user-facing behavior and `AGENTS.md` for architecture/invariants before the outcome gate; “no delta” requires explicit evidence.

## Gate log

- **2026-08-13 — design gate:** approved spec committed as `3204451` plus invariant-tightening commit `e3924ff`; high-risk critique resolved; fresh reviewer blocker resolved; delta follow-up PASS.
- **2026-08-13 — Crew front gate:** Darko skipped a duplicate additional grill, confirmed Standard + critical protected, and selected Delivery `local`.
- **2026-08-13 — planner:** fresh-context planner proposed four sequential outcomes and the M3.1 task surface; parent normalized IDs, schema-v3 fields, hashes, budgets, and exact ownership.

## Run metrics

- **Started-at:** 2026-08-13T14:14:49+02:00
- **First-worker-at:** 2026-08-13T14:20:20+02:00
- **Completed-at:** pending
- **Dispatches:** 1
- **Burned:** 0
- **Review-dispatches:** 0
- **Worker-retries:** 0
- **Replans:** 0
- **Oracle consults:** 0
- **Child-runtime-minutes:** planner 4.2; M3-T1 worker 5.8; design reviewer 3.4; design sidecar not counted as Crew dispatch

## Confidence gaps

- Current files show no existing deterministic article-source serializer and no content fingerprint helper.
- M3-T1 must confirm serializer absence across the compiler before editing; discovery of an equivalent helper triggers replan.
- M3-T3 must prove one Web Crypto implementation works in Node 20+ and Cloudflare runtime without a client-bundle regression.

## Rejected alternatives

- D1 publishing state machine: rejected because it duplicates GitHub truth and adds reconciliation state.
- GitHub Actions write broker: rejected because it makes interactive Save slow and still needs a read channel.
- Full tier: rejected because one repository, four bounded outcomes, resolved architecture, and deterministic rollback do not justify broader ceremony.
- Draft PR delivery: rejected for this run; remote delivery remains separately authorized at spec Checkpoint C.
