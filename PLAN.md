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

**Counters:** worker-dispatches: 4/14 · replans: 0/2 · burned: 0 · review-dispatches: 2/2 default · oracle: 0 · worker-retries: 0 · direct-edits: 0

- [x] **M3.1 — Lock pure authoring, Studio envelope, and production content-evidence contracts** (`6eb8c87`)
- [ ] **M3.2 — Deliver the Access-protected Studio read, edit, and immediate-preview surface**
- [ ] **M3.3 — Deliver the conflict-safe GitHub draft, publish, unpublish, and discard lifecycle**
- [ ] **M3.4 — Prove deployment status, false-Live prevention, full regression safety, and operator readiness**

The dependency chain is `M3.1 → M3.2 → M3.3 → M3.4`. Checkpoints A–D from the approved spec are user-controlled remote boundaries, not worker tasks and not implied by `Delivery: local`.

## Crew v2 active DAG

```json
{
  "baseRevision": "2e5aeaa",
  "budgets": {
    "dispatch": {
      "limit": 14,
      "used": 8
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
        "attempts": 1,
        "baseRevision": "db8ed71",
        "ceiling": 2,
        "effort": "normal",
        "receipt": {
          "artifactPath": "/home/quzma/code/jelementi/.pi/subagents/artifacts/handoffs/55316670.json",
          "basisDagHash": "sha256:34ebded9465f8d60950485717df2e30988ff64a5f1174fc928ad4c133e540aa2",
          "capabilityHash": "sha256:ce3b879c7678f904bec795a0781d7d3024dc1d18f557ec78098f11332171d0bc",
          "model": "deepseek/deepseek-v4-flash:max",
          "outputState": "present",
          "receiptClass": "child_result",
          "requestedRoute": {
            "role": "worker"
          },
          "runId": "55316670",
          "source": "foreground",
          "success": true,
          "waveId": "sha256:af5801432399ee7ec250c8594e917e26d93cebe9d605fe85bba0d64bf14eff34"
        },
        "status": "accepted",
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
        "attempts": 1,
        "baseRevision": "db8ed71",
        "ceiling": 2,
        "effort": "hard",
        "receipt": null,
        "status": "accepted",
        "supersedes": null
      }
    },
    {
      "contract": {
        "acceptance": [
          "Add failing focused tests for all three review findings before production edits and record exact RED evidence.",
          "A Live envelope carries both expected and observed complete index evidence, including excerpt, and decoding rejects any mismatch across slug, title, excerpt, publishedAt, updatedAt, category, categorySlug, tags, author, cover, or readingTimeMinutes.",
          "decodeStudioPreview validates the complete document through ArticleDocumentSchema and rejects the prior minimal-object false positive.",
          "An SSR-level test renders the article route/component boundary and proves exactly one meta element named jelementi-content-version whose content equals the computed 64-hex digest.",
          "Run pnpm exec vitest run apps/web/src/lib/studio/contracts.test.ts apps/web/src/routes/generated-routes.test.ts.",
          "Run pnpm typecheck.",
          "Run pnpm lint."
        ],
        "dependsOn": [
          "M3-T2",
          "M3-T3"
        ],
        "invariant": "Studio runtime decoding and rendered article evidence cannot admit a false Live state or malformed preview document, and the prerendered page contract proves exactly one content-version meta element with the computed digest.",
        "kind": "implementation",
        "milestone": "M3",
        "outcome": "M3.1",
        "ownershipLocks": [
          "reader.article-content-version",
          "studio.client-contracts",
          "studio.live-evidence"
        ],
        "readSet": [
          "apps/web/package.json",
          "apps/web/src/lib/studio/contracts.test.ts",
          "apps/web/src/lib/studio/contracts.ts",
          "apps/web/src/routes/articles/[slug]/+page.server.ts",
          "apps/web/src/routes/articles/[slug]/+page.svelte",
          "apps/web/src/routes/generated-routes.test.ts",
          "packages/article-model/src/index.ts",
          "packages/article-model/src/schema.ts"
        ],
        "replanTriggers": [
          "Complete Live comparison requires a public article/index schema change.",
          "SSR rendering cannot be exercised within the existing test infrastructure without adding a dependency or editing outside the writeSet.",
          "ArticleDocumentSchema cannot be imported at the Studio boundary without client-bundle or dependency leakage.",
          "Any required write path falls outside the frozen writeSet."
        ],
        "reviewProperties": [
          "No well-shaped but mismatched production index evidence can decode as Live.",
          "Preview validation uses the owning public ArticleDocument runtime schema rather than a cast or duplicate schema.",
          "Rendered-meta proof exercises SSR output rather than source-text inspection.",
          "The correction does not add credentials, raw upstream types, client hydration, public schema fields, or external I/O."
        ],
        "risk": "critical",
        "route": {
          "role": "worker"
        },
        "writeSet": [
          "apps/web/src/lib/studio/contracts.test.ts",
          "apps/web/src/lib/studio/contracts.ts",
          "apps/web/src/routes/generated-routes.test.ts"
        ]
      },
      "contractHash": "sha256:d14b2a24a32e47fd6e1fad8178d55df7e44d08a164fa19c85dbfd73601b67c90",
      "id": "M3-T4",
      "state": {
        "attempts": 1,
        "baseRevision": "9336946",
        "ceiling": 1,
        "effort": "hard",
        "receipt": {
          "artifactPath": "/home/quzma/code/jelementi/.pi/subagents/artifacts/handoffs/8c6dee64.json",
          "basisDagHash": "sha256:6fb1602384cd4d849a8a21bfbff21c09a197ceffb326d3b3ddec2390dbfdba52",
          "capabilityHash": "sha256:ce3b879c7678f904bec795a0781d7d3024dc1d18f557ec78098f11332171d0bc",
          "model": "deepseek/deepseek-v4-flash:max",
          "outputState": "present",
          "receiptClass": "child_result",
          "requestedRoute": {
            "role": "worker"
          },
          "runId": "8c6dee64",
          "source": "foreground",
          "success": true,
          "waveId": "sha256:faea73fb0b19d7441d91bb90756de754f265bb32454538b6b55553594a209dd7"
        },
        "status": "accepted",
        "supersedes": null
      }
    },
    {
      "contract": {
        "milestone": "M3",
        "outcome": "M3.2",
        "invariant": "Canonical article source loaded from GitHub decodes through one compiler-owned pure boundary into complete editable frontmatter plus the exact body bytes, without weakening compileArticle validation or moving Markdown ownership into Studio.",
        "dependsOn": [
          "M3-T4"
        ],
        "readSet": [
          "content/articles/tristan-da-cunha.md",
          "packages/content-compiler/src/article-source.ts",
          "packages/content-compiler/src/index.ts",
          "packages/content-compiler/test/article-source.test.ts"
        ],
        "writeSet": [
          "packages/content-compiler/src/article-source.ts",
          "packages/content-compiler/src/index.ts",
          "packages/content-compiler/test/article-source.test.ts"
        ],
        "acceptance": [
          "Add a focused failing parser test before production code and record exact RED evidence.",
          "Expose the smallest pure public parser needed by Studio, returning every current editable frontmatter field and preserving the Markdown body byte-for-byte after the canonical separator, including empty bodies and LF-normalized serialized sources.",
          "Reject malformed delimiters, duplicate or unknown frontmatter keys, invalid field shapes, and path/body ambiguity with structured source-located ContentCompileIssue evidence rather than casts or silent normalization.",
          "Prove serialize -> parse -> serialize byte equality for valid canonical sources and prove invalid or unsupported body syntax remains compileArticle-owned rather than silently flattened.",
          "Run pnpm exec vitest run packages/content-compiler/test/article-source.test.ts packages/content-compiler/test/compiler.test.ts.",
          "Run pnpm typecheck."
        ],
        "reviewProperties": [
          "Compiler ownership remains pure and framework-neutral.",
          "The parser does not perform filesystem, environment, GitHub, Cloudflare, or SvelteKit work.",
          "No current frontmatter field is dropped or reinterpreted and body text is not reformatted.",
          "Unsupported Markdown and ArticleDocument invariants remain enforced by compileArticle."
        ],
        "replanTriggers": [
          "The existing compiler cannot expose editable source without changing ArticleDocument or index schemas.",
          "Invalid saved drafts require a materially different source contract than bounded valid metadata plus arbitrary body text.",
          "A new dependency or write path outside the frozen writeSet is required.",
          "Round-trip parsing cannot preserve canonical source bytes."
        ],
        "kind": "implementation",
        "risk": "protected",
        "route": {
          "role": "worker"
        },
        "ownershipLocks": [
          "compiler.article-source-parsing",
          "compiler.public-api"
        ]
      },
      "contractHash": "sha256:a4960a80cbedf9305a7b0152669ca9920dba5677b9d728784490fb5485b2b9b1",
      "id": "M3-T5",
      "state": {
        "attempts": 1,
        "baseRevision": "6eb8c87",
        "ceiling": 2,
        "effort": "normal",
        "receipt": {
          "artifactPath": "/home/quzma/code/jelementi/.pi/subagents/artifacts/handoffs/c10e9c7b.json",
          "basisDagHash": "sha256:d3c41a97549540f0bf7a53bf04d7221664b1c1f9edddb5839199feb04cae4aa3",
          "capabilityHash": "sha256:c1a6168094ea9b0a3215a04925670987a0650660361216e3e81014a60cbbd05a",
          "model": "deepseek/deepseek-v4-flash:max",
          "outputState": "present",
          "receiptClass": "child_result",
          "requestedRoute": {
            "role": "worker"
          },
          "runId": "c10e9c7b",
          "source": "foreground",
          "success": true,
          "waveId": "sha256:94b96e236e3735942597ce57836414e31d4105340963ec0baea5e2db303daa32"
        },
        "status": "accepted",
        "supersedes": null
      }
    },
    {
      "contract": {
        "milestone": "M3",
        "outcome": "M3.2",
        "invariant": "Every Studio server boundary obtains typed runtime configuration and accepts a request only after complete Cloudflare Access JWT verification plus exact normalized operator-email authorization, while credentials and verification details remain server-only and sanitized.",
        "dependsOn": [
          "M3-T4"
        ],
        "readSet": [
          ".env.example",
          "apps/web/package.json",
          "apps/web/src/app.d.ts",
          "docs/specs/2026-08-13-m3-publishing-studio-design.md",
          "package.json",
          "pnpm-lock.yaml",
          "wrangler.jsonc",
          "wrangler.m2.jsonc"
        ],
        "writeSet": [
          ".env.example",
          "apps/web/package.json",
          "apps/web/src/app.d.ts",
          "apps/web/src/lib/server/studio/access-auth.server.test.ts",
          "apps/web/src/lib/server/studio/access-auth.server.ts",
          "apps/web/src/lib/server/studio/config.server.test.ts",
          "apps/web/src/lib/server/studio/config.server.ts",
          "package.json",
          "pnpm-lock.yaml",
          "worker-configuration.d.ts",
          "wrangler.jsonc",
          "wrangler.m2.jsonc"
        ],
        "acceptance": [
          "Add failing configuration and Access tests before production code and record exact RED evidence for missing assertion, bad signature, wrong issuer, wrong audience, expired/not-yet-valid token, missing/wrong email, and missing configuration.",
          "Use the current Cloudflare-recommended jose verification path with the configured team-domain JWKS, exact issuer and audience, normal time-claim validation, and a non-empty email claim.",
          "Document one email normalization rule and compare the normalized claim with the configured operator email through fixed-length digest bytes without early exit.",
          "Declare all required Studio/GitHub runtime bindings in both Wrangler contracts, generate binding types from Wrangler rather than handwriting Env, and keep private keys/tokens/Access assertion values out of client-visible modules and errors.",
          "Pin jose to an exact audited version, install with scripts disabled, and keep dependency/lockfile changes limited to the approved package boundary.",
          "Run pnpm exec vitest run apps/web/src/lib/server/studio/access-auth.server.test.ts apps/web/src/lib/server/studio/config.server.test.ts.",
          "Run pnpm exec wrangler types --check worker-configuration.d.ts --include-runtime false.",
          "Run pnpm audit --prod.",
          "Run pnpm lint and pnpm typecheck."
        ],
        "reviewProperties": [
          "Access header presence is never treated as authentication without signature and claim verification.",
          "Missing config and JWKS/network failures fail closed with no token, key, upstream body, or stack disclosure.",
          "Generated binding types, not handwritten duplicate Env fields, own runtime configuration shape.",
          "The verifier and config modules are server-only and reusable by every Studio read/write boundary."
        ],
        "replanTriggers": [
          "Current Cloudflare docs no longer support Cf-Access-Jwt-Assertion plus team-domain JWKS validation.",
          "The pinned jose release is incompatible with the Cloudflare runtime or requires Node-only compatibility beyond the approved config.",
          "Wrangler cannot declare required secret names or generate the required binding types from both deployment contracts.",
          "Implementation requires a security decision, remote secret provisioning, or a write path outside the frozen writeSet."
        ],
        "kind": "implementation",
        "risk": "critical",
        "route": {
          "role": "worker"
        },
        "ownershipLocks": [
          "studio.access-authorization",
          "studio.runtime-config",
          "web.cloudflare-bindings"
        ]
      },
      "contractHash": "sha256:c6bb377ae428aa65bc7cf84fa887bbdf83f4295cb51f2eb17a249e0ba72d5ddd",
      "id": "M3-T6",
      "state": {
        "attempts": 1,
        "baseRevision": "6eb8c87",
        "ceiling": 2,
        "effort": "hard",
        "receipt": {
          "artifactPath": "/home/quzma/code/jelementi/.pi/subagents/artifacts/handoffs/4daa9931.json",
          "basisDagHash": "sha256:d3c41a97549540f0bf7a53bf04d7221664b1c1f9edddb5839199feb04cae4aa3",
          "capabilityHash": "sha256:c1a6168094ea9b0a3215a04925670987a0650660361216e3e81014a60cbbd05a",
          "model": "deepseek/deepseek-v4-flash:max",
          "outputState": "present",
          "receiptClass": "child_result",
          "requestedRoute": {
            "role": "worker"
          },
          "runId": "4daa9931",
          "source": "foreground",
          "success": false,
          "waveId": "sha256:94b96e236e3735942597ce57836414e31d4105340963ec0baea5e2db303daa32"
        },
        "status": "accepted",
        "supersedes": null
      }
    },
    {
      "contract": {
        "milestone": "M3",
        "outcome": "M3.2",
        "invariant": "Authenticated Studio reads reconstruct the unique canonical main article and at most one deterministic active Studio draft from bounded repository-scoped GitHub App evidence, without mutation, hidden process state, credential leakage, or topology guessing.",
        "dependsOn": [
          "M3-T5",
          "M3-T6"
        ],
        "readSet": [
          "apps/web/src/lib/server/studio/config.server.ts",
          "apps/web/src/lib/studio/contracts.ts",
          "docs/specs/2026-08-13-m3-publishing-studio-design.md",
          "packages/content-compiler/src/article-source.ts",
          "packages/content-compiler/src/index.ts"
        ],
        "writeSet": [
          "apps/web/src/lib/server/studio/github-app.server.test.ts",
          "apps/web/src/lib/server/studio/github-app.server.ts"
        ],
        "acceptance": [
          "Add failing HTTP-boundary tests before production code and record exact RED evidence.",
          "Sign a short-lived RS256 GitHub App JWT with iat backdated for clock drift, exp no more than ten minutes ahead, and configured client ID issuer; normalize private-key line endings without logging key material.",
          "Exchange for a repository-scoped one-hour installation token with only metadata/read, contents/read, and pull-requests/read permissions, never assume a fixed token length, never persist it, and send an explicit current GitHub API version.",
          "List bounded top-level content/articles Markdown files from main in deterministic path order, fetch and decode bounded base64 content, parse it through the compiler-owned source parser, and discover only the deterministic studio/article/<slug> branch plus open pull request.",
          "Return one bounded server-owned list/load model with canonical SHA/blob/head evidence; multiple matching refs or pull requests, malformed responses, truncation, rate limits, and timeouts fail closed with sanitized categories rather than guessed state.",
          "Prove the adapter issues no GitHub mutation request and exposes no App JWT, installation token, private key, authorization header, or raw upstream body.",
          "Run pnpm exec vitest run apps/web/src/lib/server/studio/github-app.server.test.ts.",
          "Run pnpm lint and pnpm typecheck."
        ],
        "reviewProperties": [
          "GitHub is the sole read source and no filesystem or shadow persistence is introduced.",
          "Draft discovery is deterministic and ambiguous topology fails closed.",
          "Credential lifetime and repository/permission scope match current GitHub App documentation.",
          "The adapter is server-only, bounded, response-validated, read-only, and reusable by the later write lifecycle without exposing write methods now."
        ],
        "replanTriggers": [
          "Current GitHub App authentication or repository API contracts differ materially from the approved design.",
          "Reading an editable article requires a schema or compiler ownership change beyond M3-T5.",
          "Deterministic draft discovery cannot distinguish one canonical active draft without adopting M3.3 conflict-resolution behavior.",
          "A new dependency, GitHub mutation, remote provisioning step, or write path outside the frozen writeSet is required."
        ],
        "kind": "implementation",
        "risk": "critical",
        "route": {
          "role": "worker"
        },
        "ownershipLocks": [
          "studio.github-app-auth",
          "studio.github-read-adapter",
          "studio.github-topology"
        ]
      },
      "contractHash": "sha256:3c7196f87b6112d6325fa1b661934f1c599b06daa0840b3f4e5d683ef67cc914",
      "id": "M3-T7",
      "state": {
        "attempts": 1,
        "baseRevision": "2e5aeaa",
        "ceiling": 2,
        "effort": "hard",
        "receipt": {
          "artifactPath": null,
          "basisDagHash": "sha256:59103cf4d7bb44e3aaea2a1e1cadee28143bd3a433afc714fca53c055f7f133c",
          "capabilityHash": "sha256:c1a6168094ea9b0a3215a04925670987a0650660361216e3e81014a60cbbd05a",
          "outputState": "absent",
          "receiptClass": "no_child_result",
          "requestedRoute": {
            "role": "worker"
          },
          "runId": null,
          "source": "foreground",
          "success": null,
          "waveId": "sha256:203c7627db1cd9f2ed0d919299abd745a5bd74fdb7f62af6c33ca21e40463490"
        },
        "status": "dispatch_failed",
        "supersedes": null
      }
    },
    {
      "contract": {
        "milestone": "M3",
        "outcome": "M3.2",
        "invariant": "An authenticated immediate-preview request either returns a complete schema-valid ArticleDocument rendered from the submitted bounded metadata/body or stable source-located compiler issues, and performs no GitHub, filesystem, generated-output, or other mutation.",
        "dependsOn": [
          "M3-T6"
        ],
        "readSet": [
          "apps/web/src/lib/server/studio/access-auth.server.ts",
          "apps/web/src/lib/server/studio/config.server.ts",
          "apps/web/src/lib/studio/contracts.ts",
          "packages/content-compiler/src/article-source.ts",
          "packages/content-compiler/src/index.ts"
        ],
        "writeSet": [
          "apps/web/src/lib/server/studio/preview.server.test.ts",
          "apps/web/src/lib/server/studio/preview.server.ts",
          "apps/web/src/routes/studio/api/preview/+server.ts"
        ],
        "acceptance": [
          "Add failing focused helper/endpoint tests before production code and record exact RED evidence.",
          "Independently call the shared Access authorization boundary before parsing the request body or invoking compiler work.",
          "Decode only StudioEditorInput, deterministically serialize its metadata/body, compile with explicit content/articles/<slug>.md and configured media base URL, and return only the approved StudioPreviewResult envelope.",
          "Map expected ContentCompileIssue values to bounded source-located StudioCompileIssue values without stack traces; sanitize unexpected failures and never echo bodies, credentials, or raw exception text.",
          "Prove valid preview output decodes through decodeStudioPreview and invalid/unsupported Markdown remains an issue response, with no filesystem, generated output, GitHub call, or stateful side effect.",
          "Run pnpm exec vitest run apps/web/src/lib/server/studio/preview.server.test.ts apps/web/src/lib/studio/contracts.test.ts.",
          "Run pnpm lint and pnpm typecheck."
        ],
        "reviewProperties": [
          "Authorization, input decoding, serialization, compilation, and output decoding occur in the owning order.",
          "The endpoint is server-only and imports no GitHub adapter or runtime filesystem API.",
          "Author errors remain structured and source-located while unexpected failures remain secret-free.",
          "Only a complete ArticleDocument can reach the existing renderer."
        ],
        "replanTriggers": [
          "ContentCompileIssue cannot be safely distinguished from unexpected exceptions through the public compiler API.",
          "The endpoint requires a client-visible compiler import or a contract/schema change.",
          "SvelteKit request/platform behavior differs from the confirmed current documentation.",
          "Any required mutation, dependency, or write path falls outside the frozen writeSet."
        ],
        "kind": "implementation",
        "risk": "protected",
        "route": {
          "role": "worker"
        },
        "ownershipLocks": [
          "studio.immediate-preview",
          "studio.preview-endpoint"
        ]
      },
      "contractHash": "sha256:4e6241ac59b99f4574112cf410161788048a9679c8065a93c4eb1dd462f53173",
      "id": "M3-T8",
      "state": {
        "attempts": 1,
        "baseRevision": "2e5aeaa",
        "ceiling": 2,
        "effort": "normal",
        "receipt": {
          "artifactPath": null,
          "basisDagHash": "sha256:59103cf4d7bb44e3aaea2a1e1cadee28143bd3a433afc714fca53c055f7f133c",
          "capabilityHash": "sha256:c1a6168094ea9b0a3215a04925670987a0650660361216e3e81014a60cbbd05a",
          "outputState": "absent",
          "receiptClass": "no_child_result",
          "requestedRoute": {
            "role": "worker"
          },
          "runId": null,
          "source": "foreground",
          "success": null,
          "waveId": "sha256:203c7627db1cd9f2ed0d919299abd745a5bd74fdb7f62af6c33ca21e40463490"
        },
        "status": "dispatch_failed",
        "supersedes": null
      }
    },
    {
      "contract": {
        "milestone": "M3",
        "outcome": "M3.2",
        "invariant": "Only an independently Access-authorized operator can use dynamic Studio list/new/existing editor pages, whose complete metadata/body form previews unsaved input through the server boundary while public reader prerender, hydration, schemas, and bundles remain unchanged.",
        "dependsOn": [
          "M3-T7",
          "M3-T8"
        ],
        "readSet": [
          "apps/web/src/lib/article/ArticleRenderer.svelte",
          "apps/web/src/lib/server/studio/access-auth.server.ts",
          "apps/web/src/lib/server/studio/github-app.server.ts",
          "apps/web/src/lib/studio/contracts.ts",
          "apps/web/src/routes/+layout.svelte",
          "apps/web/src/routes/+layout.ts",
          "apps/web/src/routes/articles/[slug]/+page.svelte",
          "apps/web/src/routes/generated-routes.test.ts",
          "docs/specs/2026-08-13-m3-publishing-studio-design.md"
        ],
        "writeSet": [
          "apps/web/src/lib/studio/StudioArticleEditor.svelte",
          "apps/web/src/lib/studio/StudioPreview.svelte",
          "apps/web/src/routes/studio/+layout.server.ts",
          "apps/web/src/routes/studio/+layout.svelte",
          "apps/web/src/routes/studio/+layout.ts",
          "apps/web/src/routes/studio/+page.server.ts",
          "apps/web/src/routes/studio/+page.svelte",
          "apps/web/src/routes/studio/articles/[slug]/+page.server.ts",
          "apps/web/src/routes/studio/articles/[slug]/+page.svelte",
          "apps/web/src/routes/studio/articles/new/+page.server.ts",
          "apps/web/src/routes/studio/articles/new/+page.svelte",
          "apps/web/src/routes/studio/studio-routes.test.ts"
        ],
        "acceptance": [
          "Add failing route/load/component tests before production code and record exact RED evidence.",
          "Make /studio dynamic and non-prerendered without changing root/public route settings; every Studio server load independently calls the shared Access authorization helper before reading GitHub or returning draft metadata.",
          "Render a bounded article list with canonical status and active-draft/PR evidence, a new-article editor with editable slug, and an existing/resumed editor whose slug is immutable.",
          "Cover title, slug, excerpt, updatedAt, status, category, tags, author, cover key/alt, optional audio metadata, references, conditional publishedAt, and body-only Markdown; reading time remains absent from editable controls.",
          "Submit unsaved form state only to /studio/api/preview, decode the response, render valid documents through the existing exhaustive ArticleRenderer, and show stable source-located issues; label immediate preview as non-production and do not add Save/Publish mutations.",
          "Prove unauthenticated loads fail before GitHub reads, malformed slugs fail closed, and no Access/GitHub credential or raw upstream type enters page data or rendered HTML.",
          "Run pnpm exec vitest run apps/web/src/routes/studio/studio-routes.test.ts apps/web/src/routes/generated-routes.test.ts.",
          "Run pnpm build:web and prove public reader routes remain prerendered/non-hydrated, /search remains the sole hydrated reader route, Studio is dynamic, and no compiler/GitHub/private-key code appears in public reader client chunks.",
          "Run pnpm lint and pnpm typecheck."
        ],
        "reviewProperties": [
          "Every Studio page load independently enforces the same Access boundary and no GET performs a mutation.",
          "The editor exposes every approved field, keeps established slugs immutable, and never exposes compiler-owned reading time.",
          "Immediate preview uses only bounded validated data and the existing exhaustive renderer.",
          "Public reader prerender/CSR, noindex, generated-data, 404 fallback, and browser bundle boundaries do not drift."
        ],
        "replanTriggers": [
          "The approved read adapter cannot supply a bounded list or editable article without introducing M3.3 mutation/conflict behavior.",
          "SvelteKit prerender inheritance cannot isolate dynamic Studio routes without editing protected public route files.",
          "The existing renderer cannot be reused for interactive preview without changing public reader behavior.",
          "Implementation requires Save/Publish behavior, a new dependency, or any write path outside the frozen writeSet."
        ],
        "kind": "integration",
        "risk": "protected",
        "route": {
          "role": "worker"
        },
        "ownershipLocks": [
          "studio.editor-ui",
          "studio.route-authorization",
          "studio.route-surface",
          "web.reader-boundary"
        ]
      },
      "contractHash": "sha256:914eb1be7458a6560b6c9e1d6ed6eca493a99641d8d5ed6089dc14512b3ea66b",
      "id": "M3-T9",
      "state": {
        "attempts": 0,
        "baseRevision": "2e5aeaa",
        "ceiling": 2,
        "effort": "hard",
        "receipt": null,
        "status": "blocked",
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
- M3.2 runway is locked to current docs: Cloudflare requires `Cf-Access-Jwt-Assertion` verification against `${TEAM_DOMAIN}/cdn-cgi/access/certs` with exact issuer/audience; SvelteKit exposes Cloudflare bindings through server `event.platform.env`; Wrangler generated types and declared required secret names own the binding surface.
- M3.2 includes a read-only GitHub adapter because list/resume/editor reads are part of the approved read surface; M3.3 owns every repository mutation and conflict-resolution action. GitHub App JWT is RS256, short-lived (iat backdated, exp ≤10 minutes), installation tokens are repository/permission-scoped and one-hour, and no code may assume the legacy 40-character token format.

## Deferred

- None.

## Documentation evidence

- **M3.1:** README — no user-operable Studio surface, configuration, or command exists yet; no update required. AGENTS — no ownership boundary changed: serializer remains compiler-owned and pure, fingerprint remains article-model-owned/framework-neutral, and reader remains prerendered/non-hydrated; no update required.

## Gate log

- **2026-08-13 — design gate:** approved spec committed as `3204451` plus invariant-tightening commit `e3924ff`; high-risk critique resolved; fresh reviewer blocker resolved; delta follow-up PASS.
- **2026-08-13 — Crew front gate:** Darko skipped a duplicate additional grill, confirmed Standard + critical protected, and selected Delivery `local`.
- **2026-08-13 — planner:** fresh-context planner proposed four sequential outcomes and the M3.1 task surface; parent normalized IDs, schema-v3 fields, hashes, budgets, and exact ownership.
- **2026-08-13 — M3.1 deterministic gate:** serializer tests 34/34; combined Studio/fingerprint tests 60/60; focused fingerprint tests 26/26; Prettier, ESLint, root/workspace typecheck, Svelte diagnostics (0 errors/0 warnings), and read-only content validation passed. Generated artifacts absent. M3-T3 child acceptance-report JSON was malformed, but the child patch existed and parent independently reran every named check before acceptance.
- **2026-08-13 — M3.1 critical review:** HOLD. Blockers: Live accepted incomplete/mismatched index evidence; preview decoder cast incomplete objects to ArticleDocument. Should-fix: rendered meta lacked SSR-level proof. Corrective task M3-T4 added; review follow-up is delta-only.
- **2026-08-13 — M3.1 corrective gate:** M3-T4 integrated complete expected/observed Live evidence, owning-schema preview validation, and real SSR meta proof. Parent RED reproduced tagless Live rejection, then fixed the local validator; focused regression 1/1, affected tests 41/41, ESLint, root/workspace typecheck, Svelte diagnostics (0 errors/0 warnings), and `git diff --check` passed. Delta-only critical reviewer follow-up PASS (`0339a42b` → `5c74bacf`); no residual risk.
- **2026-08-13 — M3.2 runway:** fresh scout mapped missing Access/config/route/GitHub-read seams and existing compiler/contracts/renderer seams (`4e233a20`). Current Cloudflare, SvelteKit, Wrangler, and GitHub App documentation was rechecked. High-risk architecture critique selected a read-only GitHub adapter in M3.2 because article list/resume cannot exist without canonical GitHub reads; all mutations remain M3.3. Five contracts M3-T5..T9 locked with two independent ready tasks.
- **2026-08-13 — M3.2 foundation wave:** M3-T5 added the compiler-owned pure article-source parser with 44/44 compiler tests and root typecheck green. M3-T6 added generated Wrangler binding types, exact-pinned `jose` 6.2.8, fail-closed runtime config, and complete Access JWT/email verification. Parent completed the worker's two stale normalization assertions, regenerated types, and independently passed 72/72 focused tests, ESLint, root/workspace typecheck, Svelte diagnostics (0 errors/0 warnings), Wrangler types check, and `git diff --check`. `pnpm audit --prod` remains red only for pre-existing transitive Expo/SvelteKit findings unrelated to jose; jose adds no audit finding.
- **2026-08-13 — M3.2 service-wave launch failure:** M3-T7 and M3-T8 were accounted and committed, but the session reached the mandatory Crew wrap ceiling before the workflow could launch. No child result or source change exists; both dispatches remain spent and are recorded `dispatch_failed`. Resume must refresh capability and use each contract's one remaining bounded transport retry.

## Run metrics

- **Started-at:** 2026-08-13T14:14:49+02:00
- **First-worker-at:** 2026-08-13T14:20:20+02:00
- **Completed-at:** pending
- **Dispatches:** 6
- **Burned:** 2 (M3-T7/M3-T8 pre-launch session-wrap failure)
- **Review-dispatches:** 2
- **Worker-retries:** 0 (one bounded transport retry remains for each M3-T7/M3-T8)
- **Replans:** 0
- **Oracle consults:** 0
- **Child-runtime-minutes:** planner 4.2; M3-T1 worker 5.8; M3-T2 worker 9.3; M3-T3 worker 16.0; M3-T4 worker 7.0; M3-T5 worker 6.1; M3-T6 worker 9.8; M3.1 critical review and delta follow-up 3.9; design reviewer 3.4; M3-T7/M3-T8 launch failure 0.0; design sidecar not counted as Crew dispatch

## Confidence gaps

- M3-T1 confirmed no equivalent serializer existed before adding the compiler-owned helper.
- M3-T2 could not resolve Zod from `apps/web` under the current strict pnpm layout, so it used bounded zero-dependency validators; semantic article validation remains compiler/model-owned.
- M3-T3 proved Web Crypto and TextEncoder work under Node 20+ and Cloudflare-compatible runtime types without `node:crypto`; later build/bundle verification must continue guarding client leakage.
- M3.2 Access and GitHub App code depends on current external API contracts; task acceptance pins explicit docs-derived claims and treats any material drift as a replan trigger.
- Wrangler `secrets.required` and generated binding types are current 2026 behavior; the production and branch-upload configs must remain symmetric so preview and production builds fail closed on missing Studio secrets.

## Rejected alternatives

- D1 publishing state machine: rejected because it duplicates GitHub truth and adds reconciliation state.
- GitHub Actions write broker: rejected because it makes interactive Save slow and still needs a read channel.
- Full tier: rejected because one repository, four bounded outcomes, resolved architecture, and deterministic rollback do not justify broader ceremony.
- Draft PR delivery: rejected for this run; remote delivery remains separately authorized at spec Checkpoint C.
