# Cloudflare M2 Operations Runbook

This runbook is a future operational procedure. M2.1 does not create, upload, deploy, promote, route, or otherwise mutate any remote resource.

## Local preflight

Before asking for a checkpoint approval, record the current branch, working-tree ownership, accepted M1/M2 commits, and a green local gate:

```bash
PUBLIC_MEDIA_BASE_URL=https://media.jelementi.quz.ma/ pnpm verify:deploy
```

The gate is local-only: format, lint, typecheck, content validation, tests, Cloudflare build, artifact smoke, Wrangler `deploy --dry-run`, and a loopback Worker smoke. It does not run `media:verify` until M2.2.

Before every remote mutation, write a change record containing: the resource, exact intended change, before-state, operator, approval checkpoint, verification command, and one-step reversal. Do not place credentials or token values in the record.

## Checkpoint A — Git integration

Stop until Darko explicitly approves this exact checkpoint. Then and only then:

1. Confirm local `main` includes accepted M1 and the approved M2 design.
2. Create the private GitHub repository, add its remote, push named branches, and configure the `main` pull-request rule requiring `CI / verify`.
3. Record the prior Git state and each action's reversal (for example, remove only the newly added remote locally if the bootstrap is abandoned).

No Cloudflare mutation belongs to Checkpoint A.

### Read-only Cloudflare inventory

After A and before requesting B, perform only read operations. Record the authenticated account, active `quz.ma` zone, conflicting Worker/bucket/domain names, existing reusable Workers Preview URLs Access policy and rules, and existing Workers Builds token scope. Do not guess account IDs, email addresses, or token ownership. If inventory reveals a collision, an unclear policy, or scope that cannot be explained, stop and escalate instead of changing it.

## Checkpoint B — hidden Worker, R2, and protected preview

Stop until Darko explicitly approves this exact checkpoint and the inventory is recorded.

1. For every resource, record its before-state and one-step reversal before changing it. A Worker rollback does not reverse DNS, Access, token, R2, or CORS changes.
2. Create `jelementi-media`; apply only `ops/cloudflare/r2-cors.json`; attach `media.jelementi.quz.ma`; verify the configured value after propagation. Never use `r2.dev` for production delivery.
3. Upload media as a single author. Do not use the dashboard, overwrite, delete, or publish concurrently. Give a replacement new `-vN` key. Run `pnpm media:upload -- --file <path> --key articles/<slug>/<asset>-vN.<ext> --content-type <mime>` once; its cache-busted 404 preflight is a guard, not a distributed lock. Record the URL and verification result.
4. Review the Workers Builds user token before accepting it. It must be a user token with only the minimum viable Workers Scripts, R2, account-read, membership-read, and `quz.ma` Workers Routes scope; omit KV and unrelated-zone access. If Workers Builds cannot work with that scope, stop for an explicit security decision. Do not silently broaden permissions or store the token in Git, CI, `.dev.vars`, or terminal records.
5. Create the initial `jelementi-web` version with `workers_dev: false` and `preview_urls: false`. Record the version ID and reversal path.
6. Audit and attach the official reusable Preview URLs Access protection without replacing unrelated rules. Only after Access is attached and recorded may preview URLs be enabled. Immediately prove unauthenticated denial/challenge before Darko's authenticated preview test. Any anonymous 200 is a security failure: disable preview URLs, preserve evidence, and stop.

## Checkpoint C — production

Stop until Darko explicitly approves C after accepting the protected preview and re-approving the Tristan article's English copy, Sources, and assets.

1. Reconfirm the `main` branch setting, route target, last known-good Worker version ID, and every recorded reversal.
2. Enable the `jelementi.quz.ma` production custom-domain route through the approved Workers Builds flow.
3. Run the production probe against `/`, every generated article/category route, `/search`, `/about`, a static asset, and an unknown path. Require global `noindex`, normal-route no hydration, `/search` hydration, Sources and Footnotes, and an HTTP 404 with English Jelementi copy plus fallback bootstrap and no redirect.
4. Record the Worker version, commit, timestamp, probe output, and route state. Do not alter unrelated DNS, Access, tokens, or R2 settings.

## Incident rollback

For a reader outage, freeze merges and manual/retry deployment actions. Identify the recorded known-good Worker version, then execute the approved Cloudflare rollback first. Verify the production probe against the restored version. Next create a normal Git revert commit on an incident branch, obtain green CI, merge its pull request, and allow the aligned reverted `main` to deploy through Workers Builds.

A Worker rollback does not undo custom domains, DNS, Access, builds settings/tokens, R2 bucket/domain/CORS, or uploaded objects. Reverse such infrastructure only as a separately approved action using the recorded before-state. Never automatically delete a Worker, bucket, domain, policy, token, DNS record, or immutable media object.
