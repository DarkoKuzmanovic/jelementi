# Checkpoint C Decision Packet

**Status:** Stage S + local Stage I DONE; production remains dark; Stages P/A/drill NOT APPROVED  
**Prepared:** 2026-07-29  
**Scope:** Workers Builds credential repair, Checkpoint C approval, M2.3 implementation, production activation, verification, and correct-version rollback/restoration drill

This packet is a decision record, not authority to mutate Cloudflare, GitHub, DNS, Access, tokens, Worker traffic, or R2. Each remote stage below requires Darko's explicit approval at execution time.

## 1. Read-only readiness evidence

| Boundary | Current evidence | Result |
|---|---|---|
| Repository | Local `main` matches `origin/main` at `b0e317c`; tracked state clean after crew-migrate | PASS |
| Production darkness | `jelementi.quz.ma` returns DNS `ENOTFOUND`; `/` and `/not-found` are unreachable | PASS |
| Protected preview | Anonymous request to version preview returns HTTP 302 to the Cloudflare Access team origin | PASS |
| Content/assets | Darko explicitly re-approved `content/articles/tristan-da-cunha.md`, its Sources and English copy, plus `cover-v1.svg` and `map-v1.svg` for the test/unlisted beta | PASS |
| Indexing boundary | Global `noindex` remains mandatory; formal asset-rights evidence remains deferred | PASS |
| Workers Builds branch | Production branch is `main`; Stage S canary build `#87a95808` on `main` succeeded | PASS |
| Build command | `pnpm verify:deploy` | PASS |
| Current production deploy command | `pnpm exec wrangler deploy -c wrangler.m2.jsonc` | SAFE PRE-C STATE |
| Current non-production deploy command | `pnpm exec wrangler versions upload -c wrangler.m2.jsonc` | PASS |
| Active route-less deployment | Version `3f7efae6-c58c-45be-9684-5c4c182292e4` receives 100% of Worker deployment traffic but has no production route (`No targets deployed`) | RECORDED BASELINE |
| R2 | `jelementi-media` exists; live media verification passed on Stage S canary | PASS |
| Workers Builds deployment token | Selected token is `jelementi-workers-build` (Stage S scope; `quz.ma` only). Broad `quzma build token` retained for the separate `quz.ma` Worker Builds project — not revoked | PASS |
| Production probe tooling | `pnpm verify:remote -- --base-url <https-origin>` implemented on branch `crew/m2.3-verify-remote` with unit tests; not yet run against live production (domain still dark) | **IMPLEMENTED — AWAIT PRODUCTION** |

The OAuth credential used by local Wrangler is also write-capable and must remain read-only during preparation. It is not an approved substitute for the Workers Builds deployment token.

## 2. Stop conditions

Stop without production activation if any of the following remains true:

1. Workers Builds still uses `quzma build token` or another unexplained broad token.
2. The replacement token includes KV, unrelated products, or Workers Routes access outside `quz.ma`.
3. Cloudflare requires broader permissions than the locked minimum and Darko has not made a separate security decision.
4. `pnpm verify:remote -- --base-url <url>` is absent, untested, or cannot fail closed. *(implementation present as of Stage I; still must pass against live production before activation close-out.)*
5. The canonical local gate, GitHub `verify` check, Cloudflare build gate, protected preview, or live media verification is red.
6. `jelementi.quz.ma` becomes reachable before production activation is approved.
7. The production deploy command and non-production deploy command cannot be shown independently in the dashboard.
8. The prior version ID and candidate commit are not recorded before activation.
9. A `main` build is running, queued, retrying, or otherwise able to race the production-command change.

## 3. Stage S — Workers Builds credential repair

Stage S is a security remediation prerequisite, separate from Checkpoint C production approval.

### Intended permissions

Create a new **user API token** owned by Darko and dedicated exclusively to Jelementi Workers Builds and the bounded M2.3 operator drill, with only the locked runbook scope:

- Account — Account Settings: Read
- Account — Workers Scripts: Edit
- Account — Workers R2 Storage: Edit
- Zone — Workers Routes: Edit, restricted to `quz.ma` only
- User — Memberships: Read

Do not add Workers KV Storage, unrelated account products, or all-zone access. If Cloudflare or Wrangler requires another permission, stop and record the exact authorization failure before asking for a broader scope decision.

### Mutations, verification, and failure behavior

| Step | Intended mutation | Verification | Failure behavior |
|---|---|---|---|
| S1 | Create the dedicated scoped user token and securely retain its value outside Git, session transcripts, shell history, and repository env files | Dashboard permission/resource summary matches the list above; no token value is recorded | Revoke only the new token |
| S2 | Select the new token in `jelementi-web` Build configuration | Selected token name is visible; both deploy commands still use `wrangler.m2.jsonc` | Leave Builds fail-closed and select a corrected dedicated token; do not re-select the broad token without a separate security decision |
| S3 | Retry one known-green build while both deploy commands remain route-less | Build/deploy succeeds; production DNS remains absent; anonymous preview still returns Access 302; a new route-less Worker version is recorded | Preserve the authorization failure, keep production dark, and correct the dedicated token scope |
| S4 | Inventory every known Workers Builds project and external consumer of `quzma build token` | Ownership and consumer list proves whether the token is exclusive to Jelementi | If exclusivity is unknown or false, only deselect it from Jelementi and leave revocation to a separate security action |
| S5 | Revoke `quzma build token` only when S3 passes, the new dashboard policy proves `quz.ma`-only Workers Routes scope, and S4 proves no other consumer | Old token status is revoked; the dedicated token remains selected | If S4 is not conclusive, do not revoke; proceed only with the dedicated token selected for Jelementi |

The route-less canary proves authentication, Worker upload/deploy, bindings, and the current build path. It cannot safely exercise Workers Routes permission while production is dark. The `quz.ma`-only route capability is accepted from the token's declarative dashboard policy; any mismatch or unexplained extra permission keeps Checkpoint C closed.

No production route, Access policy, R2 object, CORS rule, or unrelated token changes belong to Stage S.

The dedicated token is also the only approved credential for local mutating M2.3 operator commands. Before the drill, Darko must inject it into `CLOUDFLARE_API_TOKEN` through an operator-controlled hidden/secure mechanism and run `wrangler whoami` without exposing the value; the reported permissions/resources must match this section. The existing local Wrangler OAuth credential must not execute `versions deploy`. If secure injection and scope verification are unavailable, the drill remains blocked.

## 4. Checkpoint C approval boundary

Checkpoint C occurs **before** M2.3 execution. Its approval must enumerate, rather than imply, authority for:

1. implementing M2.3 locally;
2. separately pushing the M2.3 branch and opening a protected pull request, which causes a route-less non-production Worker version upload;
3. changing only the production deploy command from `wrangler.m2.jsonc` to `wrangler.jsonc` after all activation preconditions pass;
4. allowing the accepted protected-`main` merge to trigger the first routed production deployment;
5. executing the exact first-launch emergency reversal in Section 8 if activation fails;
6. running the separately confirmed correct-version rollback/restoration drill.

Approval of one numbered action does not authorize later actions unless Darko explicitly approves them together.

## 5. M2.3 Stage I — local implementation

After Checkpoint C approval, create a fresh local branch from merged `main`. This local stage performs no GitHub or Cloudflare mutation.

Implement and test the missing root command:

```text
pnpm verify:remote -- --base-url https://jelementi.quz.ma
```

The probe must derive published article/category routes from validated generated data and verify:

- `/`, every published article route, every published category route, `/search`, and `/about` return the expected reader;
- a representative static asset succeeds;
- every HTML response carries global `noindex`;
- normal non-search pages have no normal client entry;
- `/search` has the expected hydration entry and `/search?query=tristan` resolves normally;
- the article contains the expected title, Sources, and Footnotes;
- an unknown path returns HTTP 404 with English Jelementi error copy, fallback bootstrap, and no redirect;
- referenced production media remains on `media.jelementi.quz.ma` and passes the existing read-only media contract;
- network errors, redirects to an unexpected origin, readiness timeout, or response/deployment mismatch fail closed.

The production probe is not run anonymously against the Access-protected preview, because that endpoint intentionally returns 302 and no preview automation credential exists. Local artifact/Worker tests provide executable coverage; preview acceptance uses an anonymous Access challenge plus Darko's authenticated browser check.

Local delivery gate:

1. RED tests for missing/incorrect remote response behavior;
2. implementation and focused GREEN tests;
3. `PUBLIC_MEDIA_BASE_URL=https://media.jelementi.quz.ma/ pnpm verify:deploy`;
4. review of the local diff and route-less config contract.

## 6. M2.3 Stage P — protected branch publication

Stage P is a remote mutation and requires explicit push/PR approval.

1. Confirm the production deploy command still uses `wrangler.m2.jsonc`.
2. Confirm the non-production deploy command still uses `wrangler.m2.jsonc`.
3. Push only the named M2.3 branch and open its pull request.
4. Allow Workers Builds to create the expected route-less version through `wrangler versions upload`.
5. Require GitHub `verify`, Cloudflare build/deploy, and the canonical gate to pass.
6. Require anonymous preview HTTP 302 to Access.
7. Require Darko's authenticated browser acceptance of the exact version preview, including reader routes and media.
8. Record the exact accepted preview version ID as rollback-drill candidate `A`; do not infer correctness from a branch alias alone.

The branch must not add the production route to `wrangler.m2.jsonc`. No production command change or custom-domain activation belongs to Stage P.

## 7. Stage A — production activation

Stage A requires fresh explicit confirmation after Stages S, I, and P pass.

### Exact remote configuration change

```text
Production branch: main                         (confirm; no change)
Build command: pnpm verify:deploy              (confirm; no change)
Production deploy command:
  FROM pnpm exec wrangler deploy -c wrangler.m2.jsonc
  TO   pnpm exec wrangler deploy -c wrangler.jsonc
Non-production deploy command:
  pnpm exec wrangler versions upload -c wrangler.m2.jsonc
                                                   (must not change)
```

The routed `wrangler.jsonc` declares exactly one production custom domain, `jelementi.quz.ma`, with `workers_dev: false` and `preview_urls: false`. The preview config remains route-less with `workers_dev: false` and `preview_urls: true` behind Access.

### Before-state record

Immediately before saving the production command:

- freeze all other pending/automatic `main` merges and disable auto-merge; authorize only the named M2.3 pull request merge;
- confirm there is no running, queued, or retrying `main` build and freeze manual retries;
- confirm production DNS/HTTP remains dark;
- record the selected dedicated token name and summarized scope;
- record both current deploy commands;
- record prior correct version `A`, its exact authenticated preview evidence, and current deployment ID;
- record the candidate commit SHA and both green checks;
- record the exact route/domain list for `jelementi-web`;
- pre-authorize and keep open the emergency reversal procedure in Section 8.

The candidate production version ID cannot exist before `wrangler deploy`. Record it as `B`, together with the new deployment ID, immediately after the build creates them and before application acceptance is claimed.

### Activation sequence

1. Freeze all other `main` merges/auto-merges and retries, leaving only the named M2.3 merge authorized.
2. Save only the production deploy-command change.
3. Reconfirm the build queue is idle and both dashboard commands have the intended independent values.
4. Merge the accepted named M2.3 pull request to protected `main`; do not use manual `deploy:web`.
5. Observe the single automatic `main` build and do not trigger retries concurrently.
6. Record candidate version `B`, deployment ID, build UUID, commit SHA, and timestamp.
7. Run bounded infrastructure readiness: require the expected custom domain to be active, DNS to resolve, TLS to validate, and `wrangler deployments status --json` to report 100% traffic on `B`.
8. Only after readiness passes, run `pnpm verify:remote -- --base-url https://jelementi.quz.ma`.
9. Run live read-only media verification; confirm production is public, preview remains behind Access, and production `workers.dev` remains disabled.

A timeout or mismatch in domain, DNS, TLS, active deployment, or application response is a failed first launch and invokes Section 8.

## 8. First-launch emergency reversal

Checkpoint C approval must explicitly authorize this procedure before activation. Its default terminal safe state is **production dark**, because no previously accepted public production deployment exists.

If the routed command is saved but deployment has not started:

1. freeze/cancel retries and restore the production command to `pnpm exec wrangler deploy -c wrangler.m2.jsonc`;
2. verify the build queue is idle and production remains dark.

If the domain is activated unexpectedly or readiness/application verification fails:

1. freeze merges and cancel/disable manual retries or other in-flight deployment actions;
2. record the failing candidate, prior version, build/deployment IDs, and observed failure without changing traffic allocation;
3. disarm future routed deploys by restoring the production command to `pnpm exec wrangler deploy -c wrangler.m2.jsonc`;
4. remove only the `jelementi.quz.ma` Worker custom-domain binding through the Cloudflare dashboard;
5. verify DNS/HTTP is dark again and preview Access still returns anonymous 302;
6. diagnose `A` and `B` only through route-less/versioned preview evidence until a new activation is explicitly approved;
7. create a normal Git revert pull request when the failure is code/config owned.

A first-launch traffic rollback is intentionally omitted: detaching the only production route restores the last accepted safe state without serving another unaccepted version publicly. After production has passed acceptance once, later reader incidents use the established version-rollback-first incident procedure. Worker version rollback alone does not remove DNS/custom-domain state, change the build token, alter Access, or revert R2.

## 9. Correct-version rollback/restoration drill

The drill begins only after `B` passes the full production probe. It uses two functionally correct versions and never intentionally publishes broken behavior.

Preconditions:

- `A` has exact-version evidence from its Access-protected preview and the green canonical gate;
- `B` has a green production probe;
- current deployment status reports 100% traffic on `B`;
- version IDs `A` and `B` and the current deployment ID are recorded;
- restoration to `B` is treated as mandatory cleanup, even if the `A` probe fails.
- the dedicated scoped token is securely injected into `CLOUDFLARE_API_TOKEN`, and `wrangler whoami` confirms the expected account/zone scope without exposing the value;
- the existing local Wrangler OAuth credential is not used for any drill mutation.

Wrangler 4.114.0 locally confirms the supported syntax:

```text
pnpm exec wrangler versions deploy <version-id>@100% --name jelementi-web -c wrangler.jsonc -y
```

With separate drill approval:

1. deploy `A` at 100%; confirm deployment status reports 100% `A`;
2. run the production probe against `A` and preserve pass/fail evidence;
3. **regardless of step 2 outcome**, deploy `B` at 100% as mandatory restoration;
4. require deployment status to report 100% `B` before the final probe;
5. run the full production probe against restored `B`;
6. if restoration or final verification fails, enter the established production incident procedure and do not claim drill completion.

The custom domain, build token, Access, and R2 remain unchanged throughout the drill.

## 10. Post-production acceptance and review

After activation and the drill:

1. preserve build UUID, commit SHA, `A`/`B` version IDs, deployment IDs, timestamps, route state, readiness output, both drill transitions, and final 100% `B` state;
2. preserve production and media probe output without credentials, account IDs, or private identity literals;
3. run fresh post-production scrutiny;
4. run a separate fresh deep combined review;
5. correct accepted findings and repeat affected verification before marking M2.3 complete;
6. deliver `https://jelementi.quz.ma` to Jelena only after the final acceptance gate.

## 11. Primary risks

1. **Broad deployment credential:** mitigated for Jelementi by Stage S (`jelementi-workers-build`). Broad `quzma build token` remains only for the separate `quz.ma` project and was not revoked. Residual risk: never re-select the broad token on Jelementi.
2. **Wrong config promoted:** using `wrangler.m2.jsonc` leaves production dark; using `wrangler.jsonc` on a branch exposes production. Mitigation: independently locked commands and config-contract tests.
3. **Build race during command change:** an in-flight/retried `main` build could activate production early. Mitigation: idle-queue evidence, retry freeze, and immediate command recheck.
4. **Custom domain activates before approval:** saving/retrying the routed command can create DNS and traffic. Mitigation: Stage A approval and pre-authorized reversal before saving.
5. **Missing executable production proof:** manual spot checks can miss hydration, 404, or route regressions. Mitigation: tested fail-closed `verify:remote` before branch publication.
6. **First-launch reversal reattaches the route:** detaching before disarming future builds leaves a race. Mitigation: restore route-less command first, then detach.
7. **Preview protection regresses:** production changes must not alter Access or the non-production command. Mitigation: anonymous 302 checks before and after activation.
8. **Rollback drill strands `A`:** an `A` probe failure could skip restoration. Mitigation: unconditional `B` restoration, status confirmation, then final probe.

## 12. Approval asks

The execution asks are separate and may be approved together only if Darko names each one:

1. **Approve Stage S:** **DONE 2026-08-10** — see §13 (`jelementi-workers-build` selected; broad token retained for `quz.ma`).
2. **Approve Checkpoint C + local Stage I:** **DONE 2026-08-10** — local `verify:remote` implementation authorized and delivered on `crew/m2.3-verify-remote` (no remote mutation).
3. **Approve Stage P:** push the named branch, open the PR, and allow the resulting route-less preview upload.
4. **Approve Stage A:** change only the production deploy command, merge the accepted PR, and pre-authorize the exact first-launch emergency reversal.
5. **Approve the drill:** shift traffic to exact proven `A`, unconditionally restore `B`, and verify final 100% `B`.

A rejection or failure at any stage leaves later stages closed.

## 13. Stage S completion record (2026-08-10)

Stage S executed as a security remediation only. Production remains dark. Checkpoint C local Stage I was approved 2026-08-10; later stages (P/A/drill) remain closed until separately approved.

| Step | Outcome |
|---|---|
| S1 | Dedicated user token `jelementi-workers-build` matches locked Stage S permissions (Account Settings Read, Workers Scripts Edit, Workers R2 Storage Edit, Zone Workers Routes Edit on `quz.ma` only, Memberships Read). No extras. |
| S2 | Token selected on `jelementi-web` Builds. Deploy and version commands unchanged (`wrangler.m2.jsonc`). Build command remains `pnpm verify:deploy`. |
| S3 | Retried `main` build `#87a95808` green. Deploy logged `No targets deployed for jelementi-web`. Current Version ID `3f7efae6-c58c-45be-9684-5c4c182292e4`. Anonymous preview `https://3f7efae6-jelementi-web.darko-kuzmanovic.workers.dev/` returns HTTP 302 to Access. `jelementi.quz.ma` DNS still absent. |
| S4 | Inventory: broad `quzma build token` still selected on the separate `quzma` Worker Builds project (`github.com/DarkoKuzmanovic/quz.ma`). Not exclusive to Jelementi. |
| S5 | **Not revoked.** Broad token retained for `quz.ma`. Jelementi uses only `jelementi-workers-build`. |

No production route, Access policy, R2, or DNS changes were made during Stage S. Token **values** are not recorded here.

## 14. Stage I completion record (2026-08-10)

Checkpoint C item 2 (local Stage I only) approved. No GitHub push, Cloudflare mutation, or production activation.

| Item | Outcome |
|---|---|
| Command | `pnpm verify:remote -- --base-url <https-origin>` |
| Implementation | `scripts/verify-remote.ts` + `scripts/verify-remote.test.ts` |
| Coverage | HTTPS origin parsing; readiness poll; all published article/category routes from `generated/index.json`; `/`, `/search`, `/search?query=tristan`, `/about`; static asset from home HTML; 404 fallback; global `noindex`; hydration boundaries; fail-closed on network error, unexpected-origin redirect, missing noindex, media contract failure |
| Media | Reuses `verifyPublishedMedia` against `PUBLIC_MEDIA_BASE_URL` / content batch |
| Gate | Local `PUBLIC_MEDIA_BASE_URL=https://media.jelementi.quz.ma/ pnpm verify:deploy` required green before Stage P |
| Not done | Stage P push/PR; production deploy-command flip; live `verify:remote` against `https://jelementi.quz.ma` (domain still dark) |
