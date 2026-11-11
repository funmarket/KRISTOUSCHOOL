# KRISTOU SCHOOL — PROGRESS

Status: **CURRENT REPOSITORY EVIDENCE ONLY**

This file records verified state in `funmarket/KRISTOUSCHOOL`. It is not a product contract, architecture decision, or implementation plan. Historical claims from `funmarket/Kristou` are not evidence for this repository.

## Baseline recorded during canonical documentation migration

- Target repository: `funmarket/KRISTOUSCHOOL`.
- Starting branch/head before this documentation change: `main` at `4be9b83b8b1d09bd9d282d3c08eaa71b6699ce32`.
- Existing implementation is a Vite/React UI prototype with mock-driven in-memory state and a placeholder Supabase client configuration.
- No Supabase CLI project, committed migrations, database schema, RLS policies, Edge Functions, authentication integration, real-data connection, or deployed backend was found in the starting tree.
- Prototype authentication accepts mock/fallback identities and is not production authentication. Pickup state transitions are client-side and are not safe or authoritative.
- Documentation migration was committed as `9bacf69` and PR #3 was opened against `main`. GitHub now reports PR #3 merged by account `funmarket` at `2026-11-10 00:51:39 +01:00`, after its initial open-state check. This task did not issue a merge command.
- After that merge, the product owner reaffirmed that Web username/password, optional non-login email, Telegram WebApp authentication/linking, and one canonical User remain unchanged. The clarification is on follow-up commit `294b630`; it requires a separate review against `main` and has not been merged.
- `git diff --check` passed for the documentation changes. Application builds/tests were not run because no application code changed. No Supabase project has been provisioned or changed.

## Historical source note

Product and architecture material was migrated from `funmarket/Kristou` because the product owner requested `funmarket/KRISTOUSCHOOL` become the canonical source of truth. Old branch names, commit SHAs, CI/deployment outcomes, database status, and progress entries were intentionally not carried forward as current evidence. Refer to the old repository only for historical provenance, not current implementation status.

## Evidence discipline

For every future entry, record exact branch/HEAD, files changed, migrations, tests/builds, CI, and runtime/deployment proof actually observed. Clearly state what remains unverified. Do not convert plans, source presence, mock screens, or a successful build into proof of secure product behavior.

## Phase 1 implementation work (2026-11-10)

- Created local Supabase CLI configuration under `supabase/config.toml`, an empty synthetic-only `supabase/seed.sql`, and a committed canonical foundation migration under `supabase/migrations/20261110020000_canonical_foundation.sql`.
- A destructive legacy-table cleanup migration was intentionally **not retained** after the owner confirmed that no Supabase tables are to be deleted while the project is still being built.
- The foundation migration revokes browser-role table/sequence privileges, enables and forces RLS, and creates explicit deny-by-default policies for `anon` and `authenticated` until the verified identity bridge and feature-specific allow policies are implemented.
- Updated the frontend translation dictionary, stable LTR shell behavior for Arabic language changes, and mobile/Telegram-safe login modal viewport handling.
- Verified `npm run lint`, `npm run build`, and `git diff --check` locally. Supabase CLI reset and remote migration application were not run because the CLI is not installed in this environment and the remote cleanup is destructive.

## Continuation reconciliation (2026-11-10)

- Inspected the continuation handoff archive, the requested feature branch, the read-only `funmarket/Kristou` reference repository, and the current Supabase integration surface.
- Removed obsolete wording about shared or additional-school product scope from the current repository documents. The product boundary is stated directly as KRISTOU SCHOOL only.
- Updated `src/lib/supabase.ts` to remove the embedded project URL and mock key. The browser client is now unavailable until runtime URL and publishable/anon key configuration is supplied, and `requireSupabaseClient()` fails with an explicit configuration error.
- Added `docs/REMOTE_SCHEMA_INVENTORY.md`. It records the supplied handoff audit for `bzerboixpbwfvmbnbzxd` and the current authorized connector evidence for a different project, `ofppapwofhovhroyjtkc`, which currently reports no public tables. This mismatch blocks schema pull, generated types, migration baselining, and remote changes.
- No Supabase remote mutation was performed. No existing table, data, grant, policy, function, storage object, or migration history was changed.

## Telegram visitor, registration, and linking plan (2026-11-11)

- Created local branch `feature/telegram-visitor-linking` from clean `main` at `3e978d8955d18718d191e7eb438f424baf2d6622`; PR #9 remains a separate open database/function branch and was not modified.
- Added `docs/TELEGRAM_VISITOR_LINKING_PLAN.md` covering anonymous public browsing, Telegram-first app-account creation, explicit Web-account linking, later Web-credential attachment, security gates, sequence, and acceptance tests.
- Updated the product requirements and ADR-015 to record the owner's 2026-11-11 clarification: Telegram visitors may browse public content, and users may create an app account through the Telegram Mini App; app signup remains distinct from school admission, and all paths resolve to one canonical User.
- Clarified the canonical model that Telegram-first account creation still requires a compatible `auth.users`/profile mapping.
- This is planning/documentation only. No UI, function, migration, tests, commit, push, Supabase mutation, deployment, or real Telegram authentication was performed. The secure Telegram session/provisioning mechanism remains an explicit implementation gate.


## Telegram auth/session feasibility review (2026-11-11)

- Reviewed Telegram's official Mini App `initData` verification procedure, Telegram Login OIDC documentation, Supabase Auth `admin.createUser` documentation, the current feature-branch `telegram-auth` and `telegram-link-challenge` functions, and the source-controlled auth foundation migration.
- The feature-branch Mini App verifier uses `SHA-256(botToken)` instead of Telegram's documented `HMAC-SHA-256(key="WebAppData", message=botToken)` key derivation; it also does not reject future `auth_date` values. Telegram-first account creation inserts a profile without first creating its FK-required `auth.users` row and returns profile data rather than a Supabase session. The challenge lookup/consume sequence is not an atomic single-use claim.
- Supabase Admin `createUser` alone does not establish the client session the shared app/RLS path needs. Telegram Login OIDC is a separate flow from Mini App `initData`; current live Auth service version compatibility was not verified, and adopting OIDC would require an explicit product/ADR change.
- Accordingly, no backend/auth-bridge implementation, migration, test, commit, push, Supabase mutation, deployment, or genuine Telegram end-to-end test was performed. Public visitor mode remains unauthenticated. The session/provisioning design is still the blocking gate.
- Research sources: [Telegram Mini App validation](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app), [Telegram Login OIDC](https://core.telegram.org/bots/telegram-login), [Supabase Auth admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [Supabase Auth issue #2534](https://github.com/supabase/auth/issues/2534).


## Telegram identity model clarification (2026-11-11)

The owner clarified that Telegram access does not need a Supabase Auth session. Telegram Mini App `initData` may serve as the identity proof sent to protected Edge Functions, where the server must validate its Telegram signature, resolve the canonical KRISTOU user, and enforce every operation's authorization. Telegram's own login state does not by itself authorize access to KRISTOU database rows or bypass server-side checks.

A new source check found that Supabase Auth's GoTrue Admin Create User handler rejects requests with neither email nor phone. Telegram Mini App `initData` does not include a verified email/phone claim. This means the existing `profiles.id REFERENCES auth.users(id)` foundation still cannot create a Telegram-only canonical user without an unsupported synthetic contact. Supabase anonymous Auth users are not a substitute for persistent Telegram identity because they cannot sign back into the same account after sign-out.

The architecture now needs an owner-approved canonical `User` independent of `auth.users`, with an optional mapping for Web Auth users. Until then, do not implement Telegram-first provisioning against the current FK model. No source code, migration, test, commit, push, Supabase mutation, or deployment was made in response to this clarification. Evidence sources: [GoTrue Admin Create User handler](https://github.com/supabase/auth/blob/master/internal/api/admin.go), [Supabase Auth users](https://supabase.com/docs/guides/auth/users), [Telegram Mini App initData validation](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).

## Owner clarification — shared-app signup followed by Telegram linking (2026-11-11)

This entry supersedes contradictory Telegram-first account-creation/session-design assumptions in the earlier Telegram planning and feasibility entries above. The owner clarified the intended flow: create/sign into the existing app account through the shared app (also available inside Telegram WebView), then explicitly link Telegram to that same account. Public visitors may browse public content without signing in; school admission remains separate. The Telegram handler confirms a one-time link only and does not create an Auth account or issue a Supabase session. Source-of-truth updates are in `requirements.md`, `docs/DECISIONS.md`, `docs/CANONICAL_MODEL.md`, `structure.md`, and `docs/TELEGRAM_VISITOR_LINKING_PLAN.md`.

## Telegram account-linking implementation (2026-11-11)

- Branch: `feature/telegram-visitor-linking`; base/HEAD at start `3e978d8955d18718d191e7eb438f424baf2d6622`. At the implementation checkpoint, changes were local and uncommitted; see the publication update below for the subsequent push and PR.
- Implemented the approved signup/sign-in-then-link flow. The existing authenticated profile-menu action now asks `telegram-link-challenge` for a 10-minute challenge and presents the configured `https://t.me/kristouschool_bot/dreambig?startapp=...` link. The shared Telegram WebApp loads Telegram's SDK, detects the direct-link start parameter in raw `initData`, and invokes `telegram-auth` to confirm the link.
- Replaced the old Telegram account-provisioning path with link-confirmation only. The server validates Telegram's bot-token HMAC and a five-minute freshness window, rejects malformed/duplicate parameters and future timestamps, reads `start_param` only from validated data, and invokes a server-only atomic RPC. The RPC binds a Web-authenticated user's hashed challenge to the verified Telegram numeric ID, prevents cross-account conflicts/replays, and returns no profile or session.
- Added migration `20261111030000_atomic_telegram_account_link.sql`, restricted RPC execution to `service_role`, and removed authenticated SELECT on link challenges. Both Edge Functions support `SERVICE_ROLE_KEY` with compatibility for `SUPABASE_SERVICE_ROLE_KEY`, use configured CORS origins with a local-only fallback, and do not expose privileged credentials to browser code.
- Updated requirements, canonical model, ADR-015, architecture, backend/continuation plans, handoff, and the dedicated Telegram visitor/linking plan to supersede Telegram-first account-creation/session assumptions.
- Local dependency installation initially exposed a pre-existing peer mismatch (Vite 8 requires esbuild `^0.27.0 || ^0.28.0`, while the manifest requested `^0.25.0`). Updated the declared esbuild range to `^0.28.0`; installed dependencies locally without a lockfile (`--no-save --package-lock=false`). No lockfile was created.
- Verification passed: `npm run test:telegram-auth` (6 synthetic tests, including deep-link construction, valid signature/start_param, tampering, missing/malformed hash, stale/future timestamps, duplicates, and invalid IDs); `npm run lint`; `npm run build`; `git diff --check`. The build retains the existing Vite `__dirname`/native-loader warning and a >500 kB chunk warning.
- Not verified: Edge Functions were not run in a Deno/Supabase local runtime; the SQL migration was not applied or integration-tested because Supabase CLI/PostgreSQL tools are unavailable; no genuine Telegram WebApp session was used; no Supabase/Vercel/BotFather setting, production function, database, or remote repository was changed. The `dreambig` bot short name must be configured in BotFather. After completing the link, users still use the shared app's regular credentials in Telegram WebView; this slice does not implement Telegram-only session issuance or protected school-domain operations.


## GitHub publication update (2026-11-11)

The implementation was committed as `e7569ca87f50feebfbeefdf175cbd0319540d109` (`feat: add explicit Telegram account linking`) and pushed to `origin/feature/telegram-visitor-linking`. PR [#10](https://github.com/funmarket/KRISTOUSCHOOL/pull/10) was created against `main`. At initial verification, GitHub reported PR #10 open and mergeable, with 2 successful checks on that implementation commit. PR #9 was also open; its overlapping Telegram function/verifier/test paths and merge-order note are disclosed in PR #10. This publication did not merge either PR or change any Supabase/BotFather deployment state.


## Supabase reconciliation and Vercel configuration diagnosis (2026-11-11)

- Reconciliation branch: `chore/reconcile-live-auth-foundation`, based on `main` commit `aa72e117b83b9eb59444c633e88165c04d0ae336`; work remains local and uncommitted. PR #9 remains open/conflicting and was not merged or modified remotely.
- Read-only inspection confirms the live project `KRISTOUSCHOOL` (`ofppapwofhovhroyjtkc`) has four empty RLS-enabled public auth tables and three applied migration names. Their live version IDs (`20261110212125`, `20261110212204`, `20261110212239`) differ from repository filenames; the source atomic Telegram-link migration/RPC is absent remotely. Live `authenticated` still has SELECT on link challenges. Security advisor returned no lints.
- Live Edge Functions remain active at v5. The deployed Telegram auth handler is older than current link-only source (`linkCode` body, stale HMAC behavior, no atomic RPC). No Supabase migration, function, secret, or deployment was changed.
- Inspected the public Vercel JavaScript bundle read-only: it contains the reported Supabase configuration error path but not the expected project URL or an actual publishable/anon key token. This confirms the Production bundle is missing the public Supabase build configuration. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the applicable Vercel environment and redeploy; private Vercel settings were not inspected or changed. No signup request was submitted.
- Ported only the reviewed auth-trigger EXECUTE hardening migrations from PR #9, added `SERVICE_ROLE_KEY` compatibility to username sign-in, updated the placeholder-only environment template, pinned local Supabase CLI scripts to 3.1.0, added synthetic pgTAP allow/deny tests, and refreshed deployment/reconciliation documentation. The outdated PR #9 Telegram handler/verifier was not copied.
- Verification: Supabase CLI `npx --yes supabase@3.1.0 --version` returned `3.1.0`; live project and public bundle inspection were read-only. Clean migration reset and `npm run db:test` were not possible because Docker is unavailable. No live migration-history repair, Vercel setting change, function deployment, or public-directory implementation was performed.
- Immediate next task: run clean local reset + pgTAP tests with Docker; then review a non-destructive mapping for the live migration version mismatch and resolve PR #9 without merging it as-is. Production deployment requires separate explicit authorization. After reconciliation, implement the read-only public Teachers/Administration Directory only after the owner approves its exact public fields/content; exclude internal People/contact/identity data.


### Supplemental verification for reconciliation branch

After installing declared npm dependencies locally without saving a lockfile, `npm run test:telegram-auth` passed all 6 synthetic tests, `npm run lint` passed, and `npm run build` passed. The build still reports the existing Vite `__dirname`/native-loader warning and a large-chunk warning. `npm run db:reset` and `npm run db:test` were attempted after updating Auth config keys; both remain blocked because the local Supabase/Docker service is unavailable (`127.0.0.1:54322` refused connection). The CLI no longer reports the prior deprecated/unknown auth-config warnings. Final `git diff --check` passed. The SQL pgTAP file is present but is not claimed as executed.
