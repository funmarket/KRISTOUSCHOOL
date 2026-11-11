# KRISTOU SCHOOL — REMOTE SUPABASE SCHEMA INVENTORY

**Status:** Read-only reconciliation evidence; not a migration baseline
**Updated:** 2026-11-11
**Repository:** `funmarket/KRISTOUSCHOOL`

## Scope and safety boundary

This document records read-only Supabase MCP and public Vercel bundle evidence. No remote SQL, migration, table, policy, grant, storage, function, secret, deployment, or data change was performed. Do not infer deployment authorization from this inventory.

## Verified active project

- Project: `KRISTOUSCHOOL`
- Project ref: `ofppapwofhovhroyjtkc`
- Region: `eu-west-3`
- Status: `ACTIVE_HEALTHY`
- PostgreSQL: `17.11`

## Live schema and migration history

The authorized project contains these public tables; all four were reported with RLS enabled and zero rows during the read-only inspection:

- `profiles`
- `role_assignments`
- `telegram_identities`
- `account_link_challenges`

The live migration history records:

| Live version | Live name | Repository filename / status |
|---|---|---|
| `20261110212125` | `authentication_foundation` | Local source is `20261110210000_authentication_foundation.sql`; version IDs differ. |
| `20261110212204` | `revoke_auth_trigger_execute` | Reviewed PR #9 source is `20261110222200_revoke_auth_trigger_execute.sql`; version IDs differ. |
| `20261110212239` | `revoke_auth_trigger_execute_public` | Reviewed PR #9 source is `20261110222300_revoke_auth_trigger_execute_public.sql`; version IDs differ. |
| — | — | `20261111030000_atomic_telegram_account_link.sql` is in repository source but absent from live history. |

Do not run `supabase db push`, `migration repair`, or apply the atomic-link migration until a non-destructive migration-history mapping/baseline has been reviewed and the owner explicitly authorizes the exact remote operation. Never mark a migration applied merely to suppress a version mismatch.

## Grants, policies, and advisors

- RLS is enabled on the four public tables.
- The inspected `profiles`, `role_assignments`, and `telegram_identities` policies are self-scoped.
- The live `authenticated` role still has `SELECT` on `account_link_challenges`, while the current source-controlled atomic-link migration revokes that grant.
- The read-only Supabase security advisor returned no lints. This does not resolve the source/live drift or prove that every future access path is safe.
- Live public routines included `current_profile_id`, `handle_new_user`, and `set_updated_at`; `claim_telegram_account_link` was absent.

## Live Edge Functions versus repository source

The live project reports these functions active at version 5:

- `auth-username-signin` (`verify_jwt=false`)
- `telegram-auth` (`verify_jwt=false`)
- `telegram-link-challenge` (`verify_jwt=true`)

The deployed `auth-username-signin` source accepts `SERVICE_ROLE_KEY` with backward compatibility for `SUPABASE_SERVICE_ROLE_KEY`; repository source is being reconciled to match. The deployed `telegram-auth` v5 is older than the merged PR #10 source: it accepts the legacy request-body `linkCode`, uses an older HMAC derivation, and does not call the atomic `claim_telegram_account_link` RPC. The link-challenge deployment also must be checked against source before any production flow is treated as verified.

Therefore source in `main` or this reconciliation branch is **not** evidence that the deployed Telegram linking path works. Do not use the live v5 endpoint for a real linking attempt until the migration and source-matched function deployments are separately approved and verified.

## Production Vercel Supabase configuration diagnosis

A read-only browser inspected `https://kristouschool.vercel.app/` and fetched its published JavaScript bundle without submitting signup or login data. The bundle contains the app's “Supabase is not configured” error path, but:

- it does not contain the expected project URL `ofppapwofhovhroyjtkc.supabase.co`;
- it contains no actual publishable-key-shaped token and no legacy JWT-shaped anon key;
- the source throws that error when the Supabase URL **or** publishable key is absent.

This strongly indicates the Production frontend was built without `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or a compatible legacy alias). The Vercel dashboard/environment values themselves were not inspected. Set the public URL and publishable key in the Vercel environment used for Production (and Preview if required), then create a fresh deployment. These values may be browser-visible; never place `SERVICE_ROLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or `TELEGRAM_BOT_TOKEN` in Vite/Vercel `VITE_` variables.

## Reconciliation decisions and next gates

1. Keep PR #9 open/conflicting until its changes are separated and reviewed; do not merge it as-is because it overlaps Telegram auth and predates PR #10's link-only design.
2. Preserve only the reviewed auth-trigger permission-hardening migrations, service-role secret-name compatibility, and still-correct deployment guidance. Do not copy its older Telegram auth verifier/handler over current source.
3. Run a clean local migration reset and pgTAP allow/deny tests using the pinned CLI before proposing a hosted migration-history mapping. Docker is required; it was unavailable in the inspection environment.
4. Obtain explicit owner authorization before any production migration, secret update, Edge Function deployment, migration-history repair, or Vercel setting change.
5. After the foundation is reconciled, the next user-facing backend slice remains the read-only public Teachers/Administration Directory, subject to owner approval of the exact fields and public content. Keep internal People records private and exclude contact/identity fields from the public projection.
