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

## Telegram linking foundation deployment (2026-11-10)

- Verified the authorized live project `KRISTOUSCHOOL` with ref `ofppapwofhovhroyjtkc` and URL `https://ofppapwofhovhroyjtkc.supabase.co`.
- Applied live migration `authentication_foundation` (recorded by Supabase as version `20261110212125`). It created the canonical profiles, role assignments, Telegram identities, and one-time account-link challenge tables with RLS. The role enum includes `SCHOOL_STAFF` and `ADMINISTRATIVE_PERSONNEL`, and profiles include `staff_id` and `admission_id`.
- Deployed active Edge Functions `auth-username-signin`, `telegram-auth`, and `telegram-link-challenge`. The link-challenge function requires JWT; the two self-validating functions do not.
- Applied live hardening migrations `revoke_auth_trigger_execute` and `revoke_auth_trigger_execute_public`, revoking role-specific and default PUBLIC API/RPC execution of the Auth trigger security-definer function. The final Supabase security advisor re-check returned no lints.
- Non-destructive HTTP smoke checks: all three function OPTIONS routes returned 200; username empty POST returned 400; Telegram auth empty POST returned 503 because `TELEGRAM_BOT_TOKEN` is not configured in Supabase Function Secrets; link-challenge empty POST returned 401 as expected without a session.
- Supabase security advisor initially reported only the publicly executable Auth trigger; after the corrected PUBLIC revoke, the re-check returned an empty lint list. No valid Telegram `initData` test was performed because no test Telegram session/token was supplied.
- GitHub repository secrets `TELEGRAM_BOT_ID` and `TELEGRAM_BOT_TOKEN` do not automatically become Supabase Edge Function secrets. The remaining deployment action is to add `TELEGRAM_BOT_TOKEN`, `SERVICE_ROLE_KEY`, and `ALLOWED_ORIGIN` to the Supabase project Function Secrets. `TELEGRAM_BOT_ID` is not currently read by the deployed validation code.

## Telegram WebApp verifier correction (2026-11-11)

- Refreshed PR #9 immediately before this work: it was OPEN and MERGEABLE on `feature/supabase-telegram-deployment` at `8a93e96b4d68facc110e349f0dfbf0b87568db60`. The focused local change is on `work/telegram-hmac-fix` at `9a16841` (based on that PR head); it has not yet been deployed.
- Corrected an earlier inference: an empty JSON object returning `503 telegram_unavailable` does **not** prove a secret is absent because the function also returns 503 when `initData` is not a string. A safe request with `initData: ""` returned `401 invalid_telegram_auth`, reaching validation and indicating the function's required environment variables were present; no credential or Telegram identity was sent.
- Source inspection of deployed `telegram-auth` v5 found an implementation mismatch with Telegram's official WebApp validation instructions: it used plain SHA-256 of the bot token instead of HMAC-SHA-256 with `WebAppData` as the key. The shared validator now uses Telegram's two-stage HMAC derivation and Web Crypto verification; endpoint composition is unchanged.
- Added synthetic-only unit coverage for a known valid signature, modified signed data, missing hash, and an expired signed payload. `npm run test:telegram-auth` passed all 4 tests; `git diff --check` passed. No build, migration, or production deployment was run.
- Live CORS verification after the user reported saving the origin still observed `Access-Control-Allow-Origin: https://kristouschool.vercel.app/` (trailing slash), which does not match the browser Origin `https://kristouschool.vercel.app`. Correct only `ALLOWED_ORIGIN` to the exact no-trailing-slash origin in the same Supabase project.
- The direct link `https://t.me/kristouschool_bot/dreambig` follows Telegram's direct-link format if `dreambig` is configured as the bot's Mini App short name. The current `src/` tree has no Telegram WebApp bridge or call to `telegram-auth`; opening the link alone therefore cannot complete app authentication. Keep that client integration in a separate UI PR, not PR #9.
- No valid live Telegram `initData` was supplied or tested. Deployed function version 5 remains unchanged; the corrected source must be reviewed and deployed before a real end-to-end test.
