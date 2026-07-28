# Checkpoint B Change Record — 2026-07-27

## Approval

- Darko explicitly approved Checkpoint B on 2026-07-27 via interactive decision.
- Inventory complete: R2 enabled (0 buckets), DNS names `jelementi`/`media` absent, Access audited (`quzma.cloudflareaccess.com`, 0 apps, 0 groups), Workers `jelementi-web` absent.
- Preflight timestamp: 2026-07-27T07:01:24Z.

## Before-state

- R2 buckets: 0; `jelementi-media` absent.
- R2 custom domain `media.jelementi.quz.ma`: absent.
- R2 CORS: N/A (bucket absent).
- Workers: 2 existing (`gemini-cli-worker`, `quzma`); `jelementi-web` absent.
- Workers Builds token: absent.
- Access apps: 0; Access groups: 0.
- Access reusable "Cloudflare Workers Preview URLs" policy: not yet audited/attached.
- `wrangler.jsonc`: `workers_dev: false`, `preview_urls: false`, production route declared but NOT activated.
- DNS zone `quz.ma`: active, full, Free Website plan, zone id `97cc2421e988ebef7444a73c29dfc81a`.

## Security notes

- OAuth token (wrangler login) has broad write scopes; used here for R2/Workers mutations only.
- Workers Builds token: minimum viable scope (Workers Scripts, R2, account-read, membership-read, `quz.ma` Workers Routes); omit KV and unrelated-zone. If Workers Builds cannot operate with that scope, STOP for explicit security decision.
- Access attachment: may require manual dashboard action (OAuth token lacks Access write scope).
- R2 custom domain: may require DNS write scope internally; escalate if API fails.
- Production custom domain (`jelementi.quz.ma`): NOT activated in M2.2. Cloudflare docs state routes/custom domains CAN be applied on `versions upload` as well as `deploy`, so branch uploads use `wrangler.m2.jsonc`, which differs from `wrangler.jsonc` in two security-relevant ways: the production `routes` block is absent, and `preview_urls` is true only after the exact-email Access policy was attached and anonymously verified. `workers_dev` remains false in both configs. M2.3/Checkpoint C activates production via the full routed config.
- Preview Access bootstrap deviation (2026-07-28): Cloudflare's documented dashboard exposed the `Restricted` control only after Preview URLs were enabled. Execution stopped and escalated as designed; Darko explicitly approved a controlled one-click bootstrap because the route-less preview contained no secrets or embargoed content. Preview was enabled and immediately changed from `Public` to `Restricted`; failure to attach Access would have required immediate disablement. This is recorded evidence, not a default procedure for future Workers.
- No credentials or token values are recorded in this document.
- CORS schema fix (2026-07-27): `ops/cloudflare/r2-cors.json` was checked in by M2.1 as an S3-style bare array (`AllowedOrigins`/`AllowedMethods`/`AllowedHeaders`/`ExposeHeaders`/`MaxAgeSeconds`), which the R2 API rejects — it requires `{ "rules": [{ "allowed": { origins, methods, headers }, "exposeHeaders": [...], "maxAgeSeconds": N }] }`. M2.1 never applied the file, so the wire format was never API-validated. Corrected by verifying the `rules`/`allowed` camelCase schema against the live R2 API via a temporary test file, rewriting the repo file to that schema (policy content unchanged — same origins/methods/headers/exposed-headers/max-age per the M2.1 contract in PLAN.md), re-applying idempotently, and confirming `cors list` matches. No test references the file; focused local gate green (lint, typecheck, 95/95 tests, content:validate).

## Mutations (in order)

### 1. R2 bucket `jelementi-media`

- Before: absent (0 buckets)
- Command: `pnpm exec wrangler r2 bucket create jelementi-media`
- Verification: `pnpm exec wrangler r2 bucket list` shows `jelementi-media` — VERIFIED (creation_date 2026-07-27T07:10:07.192Z, Standard storage class)
- Reversal: `pnpm exec wrangler r2 bucket delete jelementi-media` (manual, not automatic per M2 rollback policy)
- Status: DONE (2026-07-27)

### 2. R2 CORS policy

- Before: N/A (bucket absent)
- Command: `pnpm exec wrangler r2 bucket cors set jelementi-media --file ops/cloudflare/r2-cors.json`
- Verification: `pnpm exec wrangler r2 bucket cors list jelementi-media` matches policy — VERIFIED (allowed_origins: `https://jelementi.quz.ma`, `http://localhost:5173`, `http://127.0.0.1:5173`; methods GET/HEAD; headers Range; exposed Accept-Ranges/Content-Length/Content-Range/Content-Type/ETag; max_age 3600)
- Reversal: `pnpm exec wrangler r2 bucket cors delete jelementi-media` (manual)
- Status: DONE (2026-07-27)

### 3. R2 custom domain `media.jelementi.quz.ma`

- Before: absent
- Command: `pnpm exec wrangler r2 bucket domain add jelementi-media --domain media.jelementi.quz.ma --zone-id 97cc2421e988ebef7444a73c29dfc81a --min-tls 1.2 -y` (pinned CLI, not raw API; OAuth scope proved sufficient — R2 creates the DNS record internally; `--min-tls 1.2` chosen over the 1.0 default as standard hardening for a public read-only media domain)
- Verification: `pnpm exec wrangler r2 bucket domain list jelementi-media` — VERIFIED connected and enabled at `media.jelementi.quz.ma`, minimum TLS 1.2, with ownership and SSL both active; live HTTPS media verification passes
- Reversal: detach custom domain via API or dashboard (manual)
- Status: DONE (2026-07-27; ownership/SSL later verified active)

### 4. Media upload (tristan-da-cunha)

- Before: no objects in bucket
- Command: `PUBLIC_MEDIA_BASE_URL=https://media.jelementi.quz.ma/ pnpm media:upload -- --file <path> --key articles/tristan-da-cunha/<asset>-v1.<ext> --content-type <mime>` (single author, no overwrite/delete/concurrent). The CLI input boundary accepts pnpm's literal separator before routing the upload arguments. Uploaded `cover-v1.svg` (378 B) and `map-v1.svg` (479 B), both `image/svg+xml`; no other media exists for this article.
- Verification: `PUBLIC_MEDIA_BASE_URL=https://media.jelementi.quz.ma/ pnpm media:verify` — PASSED (`Media verification succeeded.`, exit 0). The production edge zstd-compresses text assets and serves them chunked without `Content-Length`; the verifier therefore treats missing length as unknown, issues `Range: bytes=0-0`, requires valid 206/`Content-Range`, reads exactly one response byte to prove non-emptiness, and cancels the reader in `finally`. Regression tests cover valid image/audio ranges, empty bodies, oversized chunks with cancellation, malformed ranges, and ignored range requests.
- Reversal: delete object via dashboard or API (manual, not automatic)
- Status: DONE (uploaded, live-verified, and production-edge verifier correction included in the current M2.2 change set)

### 5. Workers Builds connection + token

- Before: absent
- Prerequisite: a public GitHub repository for the project (spec plans a public repo); create/confirm before connecting.
- Command (dashboard, Darko performs): Workers & Pages → **Create application** → **Get started** next to **Import a repository** → select the GitHub account → select the repo → on *Configure your project*, set the Worker name to **`jelementi-web`** (must match the Wrangler `name`, or the build fails — Cloudflare proposes the repo name, likely `jelementi`; change it) and enter the build settings below → **Save and Deploy**. Use *Import a repository* (the Workers Builds Git flow), NOT the Hello World / 'Deploy without code' starter. If Cloudflare offers autoconfig or a config PR, skip it — the repo already has Wrangler configs. Build settings:
  - Production branch `main`; non-production branch builds enabled
  - Build command `pnpm verify:deploy`
  - Deploy command `pnpm exec wrangler deploy -c wrangler.m2.jsonc`
  - Non-production deploy command `pnpm exec wrangler versions upload -c wrangler.m2.jsonc`
  - Build variable `PUBLIC_MEDIA_BASE_URL=https://media.jelementi.quz.ma/`; Node 24
- Deviation (decided 2026-07-27): the spec's literal deploy command (`pnpm exec wrangler deploy`, reading the routed `wrangler.jsonc`) would activate the `jelementi.quz.ma` production route (`custom_domain: true` auto-creates the DNS record) on the first `main` build, contradicting M2.2's "production not live yet". Both deploy commands therefore point at the route-less `wrangler.m2.jsonc` for M2.2; revert the production deploy command to the routed config at the M2.3 production checkpoint.
- Token: do NOT accept the auto-generated broad token. Create/select a USER-scoped token at dash.cloudflare.com/profile/api-tokens limited to Workers Scripts (Edit), R2 (Edit), Account Settings Read, Memberships Read, and Workers Routes scoped to the `quz.ma` zone only; omit KV and unrelated zones. If Builds cannot operate on that scope, STOP for an explicit security decision rather than broadening. Record ownership/scope/creation/revocation path — never the token value.
- Verification: Workers Builds connection active; a non-`main` branch push creates a preview version (not a production deploy); confirm no `main` build activated `jelementi.quz.ma`; token scope documented (no token value recorded)
- Reversal: revoke token via dashboard (manual)
- Status: DONE (2026-07-28) — Workers Builds is connected and the route-less branch build is green. A dashboard audit later found that the create flow had nevertheless attached `jelementi.quz.ma` to the initial `Hello world` production deployment; Darko removed only that custom-domain binding. Production `workers.dev` is off, no Worker custom domain remains, and external `/` plus `/not-found` probes no longer reach a production application.

### 6. Hidden Worker `jelementi-web` (initial version)

- Before: absent
- Command: `pnpm exec wrangler versions upload -c wrangler.m2.jsonc` (route-less config — Cloudflare can apply routes on upload, so the production `jelementi.quz.ma` custom domain must be absent from the config used here; `wrangler.jsonc` is reserved for M2.3 production deploy)
- Verification: `pnpm exec wrangler versions list` shows version; `workers_dev: false`, `preview_urls: false`
- Reversal: `pnpm exec wrangler delete jelementi-web` or rollback version (manual)
- Status: DONE (2026-07-28) — version `a30e06fa-6715-4eb9-8459-1afeda3706c2` contains the route-less Jelementi reader. Dashboard evidence confirms production `workers.dev` off and no custom domains; the accidental `jelementi.quz.ma` binding was removed without touching R2 or unrelated Workers.

### 7. Access policy (Preview URLs)

- Before: 0 apps, 0 groups; reusable "Cloudflare Workers Preview URLs" policy not attached
- Command: dashboard — audit and attach official reusable Preview URLs Access policy (Darko performs; OAuth token lacks Access write scope)
- Verification: Access application `jelementi-web - Cloudflare Workers` targets `*-jelementi-web.darko-kuzmanovic.workers.dev`; reusable policy `Cloudflare Workers Preview URLs` has one Allow rule selecting exactly Darko's manually verified authenticated email identity, whose literal value is not recorded; anonymous version probe returns HTTP 302 to `quzma.cloudflareaccess.com`.
- Reversal: detach Access policy via dashboard (manual)
- Status: DONE (2026-07-28) — policy attached and audited; no unrelated Access policy existed or was replaced

### 8. Preview enablement

- Before: `preview_urls: false`
- Command: after Access was attached through the controlled dashboard bootstrap, enable Preview URLs and reconcile **`wrangler.m2.jsonc`** to `preview_urls: true` — never use routed `wrangler.jsonc` during M2.2. Future branch uploads use `pnpm exec wrangler versions upload -c wrangler.m2.jsonc` and preserve the protected-preview state.
- Verification: anonymous `a30e06fa-jelementi-web.darko-kuzmanovic.workers.dev` request returns HTTP 302 to the Access team domain; authenticated Darko access renders the Jelementi reader; production `jelementi.quz.ma` remains unreachable.
- Reversal: set `preview_urls: false` + re-upload (manual)
- Status: DONE (2026-07-28) — protected preview enabled and authenticated reader verified; M2.2 accepted after scrutiny SHIP and fresh deep PASS; Checkpoint C remains closed

## Rollback policy

Per M2 spec: Worker rollback does NOT undo custom-domain/DNS, Access, Workers Builds settings/tokens, R2 bucket/domain/CORS, or R2 uploads. M2 rollback never deletes the bucket, Worker, domain, policy, token, DNS record, or media object automatically. Each reversal above is manual and documented.
