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
