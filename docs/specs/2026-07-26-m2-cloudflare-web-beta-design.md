# M2 — Cloudflare Web Beta and R2 Media Design

**Status:** COMPLETE 2026-08-11 — M2.1–M2.3 and Checkpoints A/B/C accepted; production live; rollback drill waived by product owner<br>
**Date:** 2026-07-26<br>
**Owner:** Darko<br>
**Source of truth:** `handoff.md`, Phase 2, plus the approved M2 preflight decisions in this document; close-out recorded in `DECISIONS.md` and `ROADMAP.md`

## 1. Outcome

M2 makes the completed Phase 1 reader usable as a protected-preview and public-beta deployment:

```text
public GitHub branch
  → complete deploy gate
  → Access-protected Cloudflare Worker preview
  → Darko approval
  → main
  → automatic production deploy at jelementi.quz.ma
```

Article media is no longer a deployment-local concern:

```text
manual immutable upload
  → R2 bucket jelementi-media
  → media.jelementi.quz.ma/articles/<slug>/<asset>-vN.<ext>
  → build-time ArticleDocument URLs
  → web image or optional native browser audio player
```

M2 is complete when:

1. a public GitHub repository drives Cloudflare Workers Builds;
2. non-production branches receive preview versions visible only to Darko through Cloudflare Access;
3. a successful `main` build automatically deploys to `jelementi.quz.ma`;
4. a failed gate leaves the previous production version live;
5. `jelementi-media` serves immutable media through `media.jelementi.quz.ma`;
6. the reader preserves global `noindex`, its hydration boundary, and a custom HTTP 404;
7. an article with `audio` renders basic browser controls while an article without audio remains valid;
8. the production rollback procedure and a harmless version rollback drill are verified and recorded;
9. Jelena receives and can open the accepted production beta link.

## 2. Scope

### In scope

- replace `@sveltejs/adapter-static` with the supported Cloudflare adapter;
- add a pinned Wrangler 4 deployment toolchain and checked-in Wrangler configuration;
- preserve prerendered reader behavior on Cloudflare Workers Static Assets;
- create a public GitHub repository and connect it to Cloudflare Workers Builds;
- create the `jelementi-web` Worker and `jelementi-media` R2 bucket in Darko's existing Cloudflare account;
- attach `jelementi.quz.ma` to the Worker and `media.jelementi.quz.ma` to R2;
- protect every Worker preview URL with Cloudflare Access for Darko only;
- configure automatic production deployment from `main` and preview versions from all non-production branches;
- move canonical media keys from `media/articles/...` to `articles/...`;
- add a safe manual R2 upload and remote-verification workflow;
- render optional article audio with native browser controls;
- adapt local, GitHub CI, Cloudflare build, smoke, and production verification;
- document bootstrap, publishing, incident, rollback, and teardown procedures.

### Out of scope

- Studio, `/studio`, GitHub API publishing, or browser media upload;
- Cloudflare Access on the public reader;
- push notifications, Android WebView work, native/background audio, or lock-screen controls;
- D1, KV, Queues, Durable Objects, or server-side article APIs;
- R2 backup automation, lifecycle deletion, bulk migration, or asset-rights evidence tracking;
- Play Store distribution;
- public search indexing or removal of `noindex`;
- final visual redesign, Tailwind migration, analytics, or observability products;
- automatic deletion of Workers, buckets, custom domains, DNS records, Access policies, tokens, or R2 objects.

## 3. Locked decisions

- Deployment approach: public GitHub repository plus Cloudflare Workers Builds. The repository was initially created private, but Darko explicitly accepted irreversible source-history disclosure and changed it to public when GitHub Free blocked private-repository rulesets.
- Production branch: `main`.
- Every successful `main` build deploys automatically.
- Every non-production branch may produce a versioned preview URL.
- Preview URLs require Cloudflare Access and allow only Darko.
- Production is public but remains globally `noindex`.
- The existing `content/articles/tristan-da-cunha.md` is the single M2 beta article; Darko re-approves its English copy, claims, Sources, and media before production.
- Worker custom domain: `jelementi.quz.ma`.
- Worker name: `jelementi-web`.
- R2 bucket: `jelementi-media`.
- R2 custom domain: `media.jelementi.quz.ma`.
- Public media shape: `https://media.jelementi.quz.ma/articles/<slug>/<asset>-vN.<ext>`.
- Preview and production use the same public, immutable R2 objects.
- An R2 object becomes public before the article that references it is merged. This beta trade-off is accepted.
- R2 objects are never overwritten or deleted by M2 tooling.
- `R2_MEDIA` is configured as a server-side Worker binding for future Studio work but is not read or written by M2 application code.
- Optional web audio uses native `<audio controls preload="metadata">`; no autoplay or custom/background player is introduced.
- Incident rollback is Cloudflare version rollback first, verification second, and a normal Git revert commit third.
- DNS, Access, CORS, token, bucket, and custom-domain changes are not reverted by a Worker version rollback and therefore use a separate runbook.
- Remote resource mutations require an explicit checkpoint approval at execution time. Approval of this design is not permission to create, publish, push, or delete remote resources.

## 4. Preconditions and current repository state

At design time:

- the `quz.ma` zone is active in Darko's Cloudflare account;
- no Jelementi Worker or R2 bucket exists;
- the local repository has no Git remote;
- accepted M1 work is on `crew/m1-content-engine` at `2dd8045`;
- local `main` stops at `a3c0d93` and does not contain M1.1–M1.3;
- current deployment uses `@sveltejs/adapter-static` and has no Wrangler dependency or configuration.

At M2 Crew handoff, Darko explicitly approved this local-only branch preparation:

1. fast-forward local `main` to the current `crew/m1-content-engine` tip containing accepted M1 and the approved M2 spec, without rewriting history;
2. create `crew/m2-cloudflare-beta` from that updated local `main`.

This preparation creates no Git remote and performs no push. Checkpoint A later and separately authorizes creating the GitHub repository, adding its remote, pushing named branches, choosing the final approved visibility, and applying the `main` ruleset.

The GitHub owner is execution-time account data, not repository configuration. It must be confirmed from authenticated tooling before creation and must not be guessed or embedded in this spec.

The Cloudflare account ID and Darko's Access email are also execution-time account data. They are discovered at the relevant checkpoint and are never committed.

## 5. Runtime and resource topology

### Source and build ownership

```text
public GitHub
  ├─ non-production branch
  │    → Workers Builds full gate
  │    → wrangler versions upload
  │    → versioned workers.dev preview
  │    → Cloudflare Access
  │    → Darko
  └─ main
       → Workers Builds full gate
       → wrangler deploy
       → jelementi.quz.ma
       → public reader with noindex
```

GitHub Actions is the independent pre-merge gate and performs no deployment. A protected `main` requires a pull request and a successful GitHub CI check. Cloudflare Workers Builds then repeats the same gate and owns every remote Worker upload and production promotion after bootstrap.

### Media ownership

```text
Darko local source asset
  → media upload guard
  → R2 object articles/<slug>/<asset>-vN.<ext>
  → media.jelementi.quz.ma
  ├─ branch preview reader
  └─ production reader
```

The public reader fetches media through the custom domain. It does not proxy media through SvelteKit or the Worker. This keeps cache behavior simple and avoids spending Worker execution on public image/audio delivery.

### Static request handling

All current public reader routes stay prerendered. Cloudflare Static Assets serves matching files before the Worker. Unknown asset requests use the generated 404 document and return HTTP 404. The Worker exists because `adapter-cloudflare` targets Workers and because later milestones need server-side boundaries; M2 does not add a runtime article API.

## 6. Cloudflare adapter and Wrangler configuration

### Dependency changes

Pin exact direct development dependencies:

- `@sveltejs/adapter-cloudflare@7.2.9` in `apps/web`;
- `wrangler@4.114.0` at the workspace root.

Remove `@sveltejs/adapter-static`. Do not add `@sveltejs/adapter-cloudflare-workers`, which is deprecated. Do not add `@cloudflare/workers-types` until application code consumes `platform.env`.

### SvelteKit adapter

`apps/web/svelte.config.js` uses:

```js
adapter({ fallback: 'spa' })
```

The SPA fallback is used only to render the existing styled error experience into `404.html`. It does not turn reader routes into an SPA and does not change the locked hydration boundary.

### Final Wrangler configuration

The final checked-in `wrangler.jsonc` is rooted at the repository root and carries this contract:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "jelementi-web",
  "main": ".svelte-kit/cloudflare/_worker.js",
  "compatibility_date": "2026-07-26",
  "compatibility_flags": ["nodejs_als"],
  "workers_dev": false,
  "preview_urls": true,
  "assets": {
    "binding": "ASSETS",
    "directory": ".svelte-kit/cloudflare",
    "not_found_handling": "404-page"
  },
  "routes": [
    {
      "pattern": "jelementi.quz.ma",
      "custom_domain": true
    }
  ],
  "r2_buckets": [
    {
      "binding": "R2_MEDIA",
      "bucket_name": "jelementi-media"
    }
  ]
}
```

`assets.run_worker_first` is omitted. Static assets therefore remain the fast path. Runtime variables do not carry `PUBLIC_MEDIA_BASE_URL`; that value is a non-secret build variable.

### Preview bootstrap without a public exposure window

Preview URLs are public immediately when enabled unless Access protects them. M2 must not create a temporarily public preview.

The bootstrap sequence is therefore staged:

1. the initial M2.1 configuration uses `workers_dev: false` and `preview_urls: false`;
2. a successful version upload creates the Worker resource without a public preview URL or production route promotion;
3. Darko audits the account-wide reusable "Cloudflare Workers Preview URLs" Access policy;
4. Access is enabled for Jelementi preview URLs without replacing unrelated existing allow rules;
5. the final `preview_urls: true` configuration is pushed;
6. an unauthenticated probe must receive an Access challenge or denial before an authenticated preview is accepted.

If the dashboard cannot attach Cloudflare's official Preview URLs Access protection while preview URLs are disabled, execution stops and the decision is escalated; M2 does not guess a wildcard Access application. When the first real preview URL is generated, repeated unauthenticated probes begin immediately. Any anonymous 200 is a security failure: disable preview URLs, preserve evidence, and stop rollout before authenticated review. The bootstrap preview contains no secrets or embargoed content.

**Execution note (2026-07-28):** the live dashboard exposed the `Restricted` control only after Preview URLs were enabled. Execution stopped at the designed escalation boundary. Darko explicitly approved a controlled one-click deviation because the route-less bootstrap preview contained no secrets or embargoed content: Preview was enabled and immediately changed from `Public` to `Restricted`, with immediate disablement as the rollback if Access failed. The resulting reusable policy allows only Darko's email; an anonymous probe returned an Access redirect before authenticated reader acceptance. This deviation is recorded for this bootstrap and does not weaken the default Access-before-preview rule for future Workers.

## 7. Media key and URL contract

### Canonical keys

Markdown stores bucket-relative keys without a leading slash or a repeated `media/` segment:

```text
articles/<article-slug>/<semantic-name>-v<positive-integer>.<extension>
```

Examples:

```text
articles/tristan-da-cunha/cover-v1.svg
articles/tristan-da-cunha/map-v1.svg
articles/tristan-da-cunha/audio-v1.m4a
```

The extension is not globally fixed. M2 accepts the existing Tristan da Cunha SVG illustrations, prefers WebP for new raster images, and supports MP3 or M4A for audio. The upload contract maps `.svg`, `.webp`, `.png`, `.jpg`/`.jpeg`, `.mp3`, and `.m4a` to explicit non-generic MIME types. Article image blocks retain width and height whenever those values are known; the upload CLI does not invent dimensions.

The compiler continues to own traversal prevention and base-URL containment. Media keys remain relative and may not contain backslashes, encoded separators, dot segments, query strings, or fragments.

### Base URLs

Local fixture mode uses:

```text
PUBLIC_MEDIA_BASE_URL=http://localhost:5173/media/
```

Cloud builds use:

```text
PUBLIC_MEDIA_BASE_URL=https://media.jelementi.quz.ma/
```

The existing checked-in fixture files remain under `apps/web/static/media/articles/...`, while the canonical Markdown keys change to `articles/...`. Newly sourced production media is uploaded to R2 and is not committed to Git.

### Object immutability

Every replacement receives a new `-vN` key. The old object remains available so an old Worker/article version can be restored without a media rollback.

The Wrangler R2 object command does not provide an atomic create-only flag. M2 therefore uses a single-author guarded workflow:

1. validate the key convention and local file;
2. issue a cache-busted public `HEAD` request for the intended URL;
3. abort on every response except 404;
4. upload once;
5. verify the resulting public object;
6. prohibit direct dashboard upload and overwrite in the runbook.

This guard prevents ordinary accidental overwrite but is not a distributed lock. Concurrent media publishers are outside M2; Studio must later replace this assumption with a server-owned write boundary.

### Object metadata

Every M2 upload sets:

```text
Cache-Control: public, max-age=31536000, immutable
Content-Type: explicit and appropriate for the file
```

The upload command uses Wrangler argument arrays, never shell-concatenated user input. The underlying operation is equivalent to:

```text
wrangler r2 object put jelementi-media/<key>
  --file <path>
  --content-type <mime>
  --cache-control "public, max-age=31536000, immutable"
  --remote
```

### CORS

A checked-in `ops/cloudflare/r2-cors.json` allows only public read methods from the production and loopback reader origins:

- origins: `https://jelementi.quz.ma`, `http://localhost:5173`, and `http://127.0.0.1:5173`;
- methods: `GET`, `HEAD`;
- request header: `Range`;
- exposed headers: `Accept-Ranges`, `Content-Length`, `Content-Range`, `Content-Type`, and `ETag`;
- no credentials;
- one-hour CORS preflight cache.

CORS is a browser capability policy, not object authentication. Preview `<img>` and `<audio>` rendering does not rely on JavaScript CORS reads; preview behavior is nevertheless tested before acceptance. Future Studio writes use the server-side binding rather than browser-to-R2 CORS.

Apply the policy with the pinned CLI and verify after Cloudflare's documented propagation window:

```text
pnpm exec wrangler r2 bucket cors set jelementi-media --file ops/cloudflare/r2-cors.json
```

The `r2.dev` development URL is not enabled for production delivery.

## 8. Media tooling boundaries

### `media:upload`

A root TypeScript CLI owns guarded manual upload:

```text
pnpm media:upload -- --file <path> --key <key> --content-type <mime>
```

It must:

- accept only the locked `articles/<slug>/<name>-vN.<ext>` key shape;
- require a non-empty regular file;
- reject an unsupported or mismatched MIME/extension combination;
- require the production media origin for remote upload verification;
- reject an already reachable key;
- spawn the pinned Wrangler binary with an argument array;
- propagate Wrangler failures without hiding stderr;
- verify status, `Content-Type`, `Cache-Control`, and non-zero length after upload;
- verify `206 Partial Content` and consistent range headers for audio;
- print the final public URL on success;
- never expose credentials or copy source assets into the repository.

### `media:verify`

A separate read-only mode scans the generated published `ArticleDocument` set and verifies every unique:

- cover URL;
- `ImageBlock.src` URL;
- optional `audio.src` URL.

It fails on:

- a non-HTTPS production URL;
- a host other than `media.jelementi.quz.ma`;
- a redirect away from the media host;
- non-2xx image responses;
- missing, generic, or mismatched media types;
- absent immutable cache policy;
- empty content;
- failed byte-range audio playback.

Unit tests use injected fetch and process-runner boundaries. Unit tests never access Cloudflare.

## 9. Reader behavior

### Optional audio

When `article.audio` is absent, no audio region is rendered.

When it is present, a focused Svelte component renders:

```html
<audio controls preload="metadata" src="..."></audio>
```

The component includes an accessible article-specific label and a fallback source link. It may display `durationSeconds` when supplied. It does not autoplay, download eagerly, persist playback, register media-session controls, or communicate with Android.

A synthetic document drives the audio renderer test. The first production article does not need an audio object for M2 acceptance.

### Hydration boundary

The M1 contract remains:

- home, article, category, About, and normal reader pages set `csr = false`;
- `/search` is the only normal hydrated reader route;
- `404.html` loads client code only to render the custom fallback experience;
- adding basic audio controls does not add Svelte hydration to article pages.

### 404 behavior

`adapter-cloudflare({ fallback: 'spa' })` emits the rendered fallback document. Wrangler Static Assets uses `not_found_handling: "404-page"`. A request for an unknown path must therefore return:

- HTTP status 404;
- the English Jelementi error copy;
- global `noindex`;
- the expected fallback client bootstrap;
- no redirect to `/`.

## 10. Build and deployment commands

### Root scripts

M2 keeps one canonical gate and explicit lower-level commands:

```text
dev:web          content build + Vite development server
build:web        content build + Cloudflare adapter build
preview:web      build + Wrangler 4 local Worker preview
deploy:web       operator-only full gate + Wrangler production deploy
verify:web       inspect generated Cloudflare assets and locked HTML invariants
verify:worker    launch local Wrangler, probe HTTP behavior, then terminate cleanly
media:upload     guarded manual R2 object upload
media:verify     read-only verification of published remote media
verify:deploy    complete local/cloud deployment gate
verify:remote    post-deploy HTTP probe for a supplied base URL
```

`deploy:web` preserves the root-script contract from `handoff.md`. It runs `verify:deploy` before `wrangler deploy` and is reserved for an explicitly approved manual deployment or recovery. Normal GitHub/Cloudflare automation does not call it: Workers Builds runs the gate as its build step and invokes Wrangler directly as its separate deploy step, avoiding a duplicate gate.

`verify:deploy` runs in this order:

```text
format
→ lint
→ typecheck
→ content:validate
→ tests
→ build:web
→ verify:web
→ wrangler deploy --dry-run
→ verify:worker
→ media:verify
```

The gate requires `PUBLIC_MEDIA_BASE_URL=https://media.jelementi.quz.ma/` when it includes `media:verify`. M2.1 tests the remote verifier with fakes before R2 exists; the live media step joins the canonical gate only after M2.2 has created and verified the bucket/domain/assets.

### GitHub Actions

The existing workflow remains on Node 24 with the frozen `pnpm@11.1.3` lockfile. It invokes the canonical gate and performs no upload, deployment, promotion, DNS change, Access change, or R2 write.

### Cloudflare Workers Builds

Final build settings are:

```text
Production branch: main
Non-production branch builds: enabled
Build command: pnpm verify:deploy
Deploy command: pnpm exec wrangler deploy
Non-production deploy command: pnpm exec wrangler versions upload
Build variable: PUBLIC_MEDIA_BASE_URL=https://media.jelementi.quz.ma/
Node: 24
```

Cloudflare replaces the production deploy command with the non-production command for branch builds. A gate failure therefore creates no new version and never changes production traffic.

**M2.2 rollout deviation (decided 2026-07-27):** during M2.2 both Workers Builds deploy commands use the route-less `wrangler.m2.jsonc` (`pnpm exec wrangler deploy -c wrangler.m2.jsonc` and `pnpm exec wrangler versions upload -c wrangler.m2.jsonc`). The literal commands above read the routed `wrangler.jsonc`, whose `custom_domain: true` route for `jelementi.quz.ma` would be activated — and its DNS record auto-created — on the first successful `main` build, making production live before the M2.3 checkpoint. The routed production deploy command is restored at M2.3. Full details and the token scope are in `docs/runbooks/checkpoint-b-2026-07-27.md`, step 5.

The GitHub required check is the first gate; the Cloudflare build command is a redundant second gate, not the sole enforcement boundary. Changes to `wrangler.jsonc`, deployment scripts, or Cloudflare build settings follow the same protected PR path. Manual `deploy:web`, dashboard retries, and direct Wrangler deploys are prohibited in the normal path and require a separately approved runbook action.

The Workers Builds user token is stored and used by Cloudflare, not GitHub. Do not accept the automatically proposed broad token without review. Create or select a user token limited to the minimum viable Workers Scripts, R2, account-read, membership-read, and `quz.ma` Workers Routes permissions; omit KV and unrelated-zone access. If Workers Builds cannot operate with that scope, stop for an explicit security decision rather than silently broadening it. The runbook records token ownership, scope, creation date, and revocation path without recording the token value.

## 11. Access and security boundaries

### GitHub

- repository visibility is public after explicit confirmation and a 14-commit history secret-pattern audit;
- `main` has a ruleset requiring a pull request and the successful GitHub Actions check-run context `verify` (the CI workflow's `verify` job), with no routine Darko bypass;
- no Cloudflare token, R2 credential, account ID secret, Access identity, or `.dev.vars` file is committed;
- GitHub Actions receives no deployment credential;
- future Studio credentials are not created in M2.
- Phase 3 must explicitly design how Studio publish commits coexist with this ruleset; M2 grants Studio no bypass actor.

### Preview

- versioned preview URLs are enabled only after Access is attached;
- the reusable preview policy must include Darko without deleting unrelated existing rules;
- unauthenticated access must fail;
- authenticated Darko access must succeed;
- production remains outside this policy.

Cloudflare does not currently provide Worker logs for preview URLs. Preview diagnosis therefore uses Workers Build logs, browser/network evidence, and local Wrangler reproduction.

### Production

`jelementi.quz.ma` is intentionally public. `noindex` controls indexing intent and is never described or tested as authentication.

### R2

The R2 custom domain is public read-only. CORS does not make it private. The `R2_MEDIA` binding is available only inside the Worker runtime, and M2 application code contains no binding reads or writes. A test/search gate rejects accidental M2 imports or accesses to `R2_MEDIA` outside configuration and declarations.

### Claims and assets

Darko must approve the first beta article's English copy, key claims, Sources section, and selected assets before Checkpoint C. Formal asset-rights evidence remains deferred; the site remains `noindex` until that separate audit exists.

## 12. Failure behavior

### Build or validation failure

- no version is uploaded;
- no preview URL changes;
- no production traffic changes;
- Workers Builds and GitHub CI report the failing command;
- the previous production version remains live.

### Preview review failure

- do not merge;
- correct the same branch;
- produce a new immutable preview version;
- leave the rejected version available only under Access until Cloudflare retention removes it.

### Remote media failure

- `media:verify` blocks deployment;
- the existing production version remains live;
- a wrong new object is not overwritten or deleted;
- corrected bytes receive a new versioned key;
- Markdown changes on a branch and re-enters the normal preview flow.

### Production probe failure

1. freeze new merges plus manual/retry deploy actions, while leaving GitHub CI available to validate the revert;
2. identify the last known-good Worker version ID;
3. execute `pnpm exec wrangler rollback <version-id>` with an incident message;
4. run the complete production remote probe;
5. create a normal Git revert commit on an incident branch and obtain a green GitHub CI result;
6. merge the revert pull request and allow the aligned reverted `main` to pass the redundant Cloudflare gate and deploy;
7. record version IDs, commit IDs, timestamps, symptoms, and verification evidence.

A fix-forward is not the default for a reader outage. It requires an explicit incident decision after the known-good version is restored.

### Infrastructure failure

Worker rollback does not undo:

- custom-domain or DNS changes;
- Access applications or policies;
- Workers Builds settings or tokens;
- R2 bucket/domain/CORS changes;
- R2 uploads.

The runbook lists the previous value and reversal step before each remote infrastructure mutation. M2 rollback never deletes the bucket, Worker, domain, policy, token, DNS record, or media object automatically.

## 13. TDD and verification strategy

### Unit tests

Add RED → GREEN coverage for:

- canonical media key parsing and rejected traversal/encoding forms;
- key/extension/MIME consistency;
- pre-existing object rejection;
- safe child-process argument construction;
- upload failure propagation;
- image response status/type/cache/length checks;
- audio byte-range success and malformed-range failures;
- generated-document URL collection and de-duplication;
- redirect-host rejection;
- optional audio SSR output and no-audio omission;
- media key migration under both local and production base URLs.

### Build verification

A clean checkout with no `generated/` must pass:

- format;
- lint;
- strict typecheck;
- content validation;
- all tests;
- Cloudflare adapter build;
- artifact inspection;
- Wrangler dry-run bundle validation.

The artifact verifier must derive reader routes dynamically rather than hard-code the sample slug. It preserves the M1 checks for route coverage, `noindex`, representative content, non-search no-hydration, `/search` hydration, and the explicit 404 exception.

### Local Worker verification

A bounded script launches the built Worker with pinned Wrangler 4, waits for readiness by polling the HTTP endpoint rather than sleeping a fixed duration, probes it, and always terminates the child process.

It verifies:

- 200 responses for home, article, category, search, and About;
- expected English title/content;
- Sources and Footnotes;
- global `noindex`;
- no client entry on normal non-search pages;
- client entry on `/search`;
- a direct `/search?query=tristan` request resolves the prerendered search asset and does not rely on the 404 fallback;
- unknown route status 404 and error copy;
- valid static asset responses;
- optional audio markup through a focused fixture or SSR test.

### Remote R2 verification

The deployment gate verifies every published media URL. Network failures and unexpected 429/5xx responses fail the candidate deployment and preserve the current production version. The verifier reports the failing URL and invariant without printing credentials or response bodies.

### Preview acceptance

Manual and automated evidence must show:

- unauthenticated preview denial/challenge;
- authenticated Darko access;
- full reader smoke behavior;
- R2 image playback from the preview;
- browser audio playback if the candidate contains audio;
- no accidental production-domain change.

### Production acceptance

After deployment, `verify:remote` checks:

- `https://jelementi.quz.ma/`;
- every generated article and category route;
- `/search` and `/about`;
- an unknown route returning 404;
- `noindex` on all HTML responses;
- expected hydration boundaries;
- article Sources/Footnotes content;
- production R2 media headers and body availability;
- current custom-domain routing to the expected Worker deployment.

## 14. Delivery sequence and checkpoints

### M2.1 — Local Cloudflare target and media/audio tooling

No remote mutation is allowed.

Deliver:

- dependency and adapter migration;
- initial Wrangler configuration with preview URLs disabled;
- local/production media-key migration;
- optional web audio rendering;
- upload and verification tooling with mocked tests;
- Cloudflare build, artifact, dry-run, and local Worker smoke;
- draft operational runbook;
- complete local gate.

Acceptance:

- clean local gate passes;
- adapter-static is absent;
- Wrangler 4 builds and serves the complete reader locally;
- unknown routes return the custom HTTP 404;
- no M2 code accesses `R2_MEDIA`;
- no Git remote, Cloudflare, DNS, Access, or R2 state has changed.

### Checkpoint A — Git integration approval

Darko explicitly approves:

- verifying that local `main` contains the accepted M1 and approved M2 spec;
- creating the GitHub repository with the explicitly approved visibility;
- adding the remote;
- pushing named branches.
- creating a `main` ruleset that requires pull requests and the GitHub Actions check-run context `verify` before Workers Builds production activation.

No push or GitHub ruleset mutation occurs before this checkpoint.

Before Checkpoint B, perform and record a read-only Cloudflare inventory: authenticated account, `quz.ma` zone, conflicting resource names, the reusable preview Access policy, and existing Workers Builds token scope. This inventory changes no remote state.

### Checkpoint B — Cloudflare bootstrap approval

Darko explicitly approves:

- creating `jelementi-media` and attaching `media.jelementi.quz.ma`;
- applying the read-only CORS policy and uploading the versioned Tristan da Cunha assets;
- connecting Workers Builds and creating its reviewed user token;
- creating the hidden `jelementi-web` version with preview URLs disabled;
- attaching Access and then enabling protected preview URLs.

No Cloudflare, DNS, Access, token, Worker, or R2 mutation occurs before this checkpoint.

### M2.2 — R2 and protected preview

Deliver:

- read-only Cloudflare account/resource inventory;
- `jelementi-media` bucket;
- R2 CORS policy and `media.jelementi.quz.ma` custom domain;
- versioned upload of the approved `tristan-da-cunha` beta article media;
- live `media:verify` evidence;
- public GitHub and Workers Builds connection;
- initial hidden Worker version with preview URLs disabled;
- audited Access policy;
- final preview enablement;
- protected branch preview and acceptance evidence.

Acceptance:

- no `r2.dev` production use;
- media URLs use `articles/...` without duplicated `media/`;
- unauthenticated preview access fails;
- Darko's authenticated preview works;
- production custom domain is not live yet.

### Checkpoint C — Production approval

Darko explicitly approves:

- production branch setting;
- final Worker custom-domain activation;
- automatic `main` deployment.

This checkpoint requires accepted preview evidence and Darko's explicit re-approval of `content/articles/tristan-da-cunha.md`, its Sources, English copy, and selected assets.

### M2.3 — Production and rollback drill

Deliver:

- `main` automatic production deployment;
- `jelementi.quz.ma` custom domain and certificate;
- complete production acceptance probe;
- delivery of the verified production link to Jelena for the first beta feedback;
- two functionally correct Worker versions;
- rollback of 100% traffic to the previous correct version;
- verification of that version;
- restoration of 100% traffic to the current correct version with `wrangler versions deploy <current-version-id>@100%`;
- final runbook evidence and M2 documentation close-out.

The drill does not intentionally publish broken behavior and does not require a Git revert because both versions are correct. A real incident still requires the rollback-plus-revert procedure in Section 12.

## 15. Operational preflight checklist

Before any remote mutation:

- [ ] local working tree ownership and branch are understood;
- [ ] accepted M1 commits are identified relative to `main`;
- [ ] local M2.1 gate is green;
- [ ] Darko has approved the exact remote mutation checkpoint;
- [ ] authenticated GitHub owner and Cloudflare account are confirmed without guessing;
- [ ] `quz.ma` zone status and account match are confirmed;
- [ ] existing account-wide Workers preview Access policy is inventoried;
- [ ] existing Workers Builds token scope is inventoried;
- [ ] resource names do not collide;
- [ ] rollback/reversal instructions are written before mutation;
- [ ] no secret value is about to enter Git, terminal transcript, CI config, or a public environment variable.

Before production:

- [ ] public GitHub repository and branch/ruleset state are correct;
- [ ] R2 bucket, custom domain, CORS, object metadata, and asset URLs pass verification;
- [ ] branch preview is Access-protected and accepted;
- [ ] the first beta article, Sources, English copy, and assets are approved by Darko;
- [ ] `main` production branch and build commands are reviewed;
- [ ] custom 404 and global `noindex` pass remotely;
- [ ] the last known-good Worker version ID can be found;
- [ ] rollback and restoration commands are ready;
- [ ] no unrelated resource deletion or security-policy replacement is included.

## 16. Key risks and mitigations

### `main` does not contain completed M1

**Risk:** connecting current `main` as production would deploy Phase 0/early Phase 1 instead of the accepted reader.

**Mitigation:** the user-approved local handoff preparation fast-forwards `main` without rewriting history before `crew/m2-cloudflare-beta` is created; Checkpoint A verifies that updated branch before any production activation.

### A preview URL becomes public before Access

**Risk:** Cloudflare preview URLs are public immediately when enabled.

**Mitigation:** bootstrap the Worker with preview URLs disabled, attach/audit Access, then enable preview URLs and verify unauthenticated denial first.

### Account-wide reusable Access policy impact

**Risk:** Cloudflare preview Access policies may be shared across Workers in the account.

**Mitigation:** inventory existing rules, preserve unrelated access, and add the minimum Darko allow rule rather than replacing the policy.

### Workers Builds token breadth

**Risk:** Cloudflare's automatically created user token may include KV, R2 edit, and Workers Routes edit across all zones.

**Mitigation:** remove unused permissions and restrict zone scope before accepting the integration; document revocation without storing the token.

### Wrangler upload is not atomic create-only

**Risk:** a stale existence check or concurrent publisher could still overwrite a key.

**Mitigation:** cache-busted preflight, versioned keys, a single-author workflow, no dashboard uploads, and explicit residual-risk documentation. Studio later owns atomic publication policy.

### Public media precedes article publication

**Risk:** someone who knows the exact R2 URL can fetch an asset before its article is live.

**Mitigation:** accepted beta trade-off; do not upload secrets or embargoed media; use unlinked versioned paths; keep preview HTML behind Access.

### External R2 availability blocks deployment

**Risk:** a transient media-host failure can make a healthy candidate build red.

**Mitigation:** fail closed and retain the known-good production version; retry the build only after confirming the external failure, without weakening the gate.

### Adapter migration changes 404 or hydration behavior

**Risk:** Cloudflare output could silently turn the reader into an SPA, add client code, or lose HTTP 404 semantics.

**Mitigation:** preserve artifact checks and add local Worker HTTP tests for every hydration/status invariant.

### Preview runtime logs are unavailable

**Risk:** a preview-only runtime defect has less Cloudflare observability.

**Mitigation:** reproduce with pinned local Wrangler, retain Build logs, and gather browser/network evidence before merge.

### Asset-rights evidence remains incomplete

**Risk:** public assets lack formal provenance records during beta.

**Mitigation:** Darko approves each selected asset; production remains `noindex`; public indexing stays blocked until the separate evidence audit is complete.

## 17. Acceptance trace

| Requirement | Required evidence |
|---|---|
| Supported Cloudflare target | pinned adapter/Wrangler, successful build and dry-run |
| Reader invariants survive | artifact plus local Worker HTTP smoke |
| Stable media URLs | canonical-key tests and live R2 verification |
| No accidental overwrite | guarded CLI tests and recorded upload result |
| Optional web audio | SSR/component test and browser check when audio exists |
| One real beta article | Darko-approved `tristan-da-cunha` copy, Sources, R2 media, and production route |
| Private previews | unauthenticated denial plus authenticated Darko success |
| Automatic `main` production | Workers Builds record tied to the accepted commit |
| Failed gate preserves production | candidate build log shows the deploy step skipped and the active production deployment ID unchanged |
| Public noindex beta | remote meta assertions on every HTML route |
| Correct custom 404 | unknown production route returns expected body and status 404 |
| Safe incident rollback | completed correct-version rollback/restoration drill and runbook |
| No deferred-scope leakage | diff/search review for Studio, push, native audio, D1/KV, or indexing changes |

## 18. Rollback and teardown boundaries

### Application rollback

Use the last known-good Worker version, verify it, then align Git through a normal revert commit. Never use history rewriting, force push, or a destructive reset.

### Media rollback

Revert the Markdown reference to an older immutable key through the normal branch/preview/main flow. Do not delete or overwrite either media object.

### Infrastructure reversal

Reverse only the specific changed setting using the recorded before-state. Removing a custom domain, disabling a build integration, revoking a token, or changing Access is a separate user-approved action. Bucket or object deletion is never an automatic rollback step.

### M2 teardown

M2 does not define a destructive teardown command. If the beta is abandoned, a later teardown plan must inventory dependencies, export any needed state, identify DNS and certificate effects, and obtain explicit approval for each remote deletion.

## 19. Official references

- SvelteKit `adapter-cloudflare`: <https://svelte.dev/docs/kit/adapter-cloudflare>
- Cloudflare Workers Builds configuration: <https://developers.cloudflare.com/workers/ci-cd/builds/configuration/>
- Cloudflare Worker preview URLs and Access: <https://developers.cloudflare.com/workers/configuration/previews/>
- Cloudflare Workers Static Assets routing: <https://developers.cloudflare.com/workers/static-assets/routing/>
- Cloudflare Workers custom domains: <https://developers.cloudflare.com/workers/configuration/routing/custom-domains/>
- Cloudflare Worker versions and deployments: <https://developers.cloudflare.com/workers/versions-and-deployments/>
- Cloudflare R2 public buckets and custom domains: <https://developers.cloudflare.com/r2/buckets/public-buckets/>
- Cloudflare R2 CORS: <https://developers.cloudflare.com/r2/buckets/cors/>
