# KRISTOU SCHOOL — REMOTE SUPABASE SCHEMA INVENTORY
> **Fresh read-only delta — 2026-11-13:** The prior 2026-11-11 listings below are historical. Connected `KRISTOUSCHOOL` (`ofppapwofhovhroyjtkc`) currently has four RLS-enabled public tables (`profiles`, `role_assignments`, `telegram_identities`, `account_link_challenges`), five live migrations [`20261110212125`, `20261110212204`, `20261110212239`, `20261111150532`, `20261112190435`], seven canonical enum roles, one active APP_ADMIN, the atomic link RPC present and `authenticated` SELECT on link challenges **revoked**. Edge Functions: `auth-username-signin` v6; `telegram-auth` v9; `telegram-link-challenge` v6. No schema or function mutation was performed by this documentation check. GitHub contains only four SQL migrations; reconcile non-destructively. See `docs/CURRENT_STATE_AND_HANDOFF_2026-11-13.md`.


**Status:** 2026-11-11 historical inventory plus 2026-11-13 read-only delta; NOT a migration baseline
**Updated:** 2026-11-11
**Repository:** `funmarket/KRISTOUSCHOOL`

## Scope and safety boundary

Initial inventory work was read-only. Since then, the owner authorized and applied the atomic Telegram link migration, deployed `telegram-auth` v8, and saved the exact production `ALLOWED_ORIGIN`. No reset or user-data deletion was performed.

## Verified active project

- Project: `KRISTOUSCHOOL`
- Project ref: `ofppapwofhovhroyjtkc`
- Region: `eu-west-3`
- Status: `ACTIVE_HEALTHY`
- PostgreSQL: `17.11`

## Live schema and migration history

The authorized project contains these public tables, all with RLS enabled. The earlier zero-row observation predates owner account creation and Telegram linking and is not a current row-count statement:

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
| `20261111150532` | `atomic_telegram_account_link` | Owner-authorized application of `20261111030000_atomic_telegram_account_link.sql`; it creates the atomic claim RPC and revokes authenticated SELECT on link challenges. |

Do not run `supabase db push` or `migration repair` to reconcile the remaining version-ID differences. Never mark an unrelated migration applied merely to suppress a version mismatch.

## Grants, policies, and advisors

- RLS is enabled on the four public tables.
- The inspected `profiles`, `role_assignments`, and `telegram_identities` policies are self-scoped.
- The owner-authorized atomic-link migration revokes authenticated `SELECT` on `account_link_challenges` and grants the claim RPC only to `service_role`.
- The read-only Supabase security advisor returned no lints. This does not resolve the source/live drift or prove that every future access path is safe.
- Live public routines include `current_profile_id`, `handle_new_user`, `set_updated_at`, and `claim_telegram_account_link`.

## Live Edge Functions versus repository source

The last verified live list reports `telegram-auth` active at version 8; the other two functions remain at version 6:

- `auth-username-signin` (`verify_jwt=false`)
- `telegram-auth` (`verify_jwt=false`)
- `telegram-link-challenge` (`verify_jwt=true`)

The deployed `auth-username-signin` accepts `SERVICE_ROLE_KEY` with backward compatibility for `SUPABASE_SERVICE_ROLE_KEY`. The deployed `telegram-auth` v8 verifies signed `initData`, confirms explicit one-time links through the live RPC, and returns the linked account profile for a normal Mini App launch. The matching frontend auto-entry change is on the current feature branch and is not yet deployed to Vercel.

The owner completed a real successful Web-to-Telegram link against v7. Backend support for normal Mini App re-entry is now live in v8; the Vercel frontend change still needs review/merge and deployment before users can sign in automatically from Telegram.

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
