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
