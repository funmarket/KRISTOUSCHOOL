# Packet D — isolated calendar cancellation verification

**Review-only.** This guide belongs to PR #21, which is **not merge-ready** until real PostgreSQL tests and the complete application checks have executed against its final revision. Do not apply its migration on production KRISTOUSCHOOL (`ofppapwofhovhroyjtkc`), alter hosted migration history, or use existing school accounts as fixtures.

## Required disposable database

Create a **new, empty, isolated local Supabase stack** with the repository's ordered migrations installed. The new forward migration `supabase/migrations/20261115213000_calendar_cancellation_serialization.sql` must be applied **only in that isolated stack**, after the earlier migrations. Do not edit historical migration files.

The test runner `tests/db/calendar_cancellation_concurrency.py` refuses targets with any existing `auth.users`, `public.profiles` or `public.school_calendar_events` rows. It creates and subsequently removes its own synthetic identities: an approved APP_ADMIN, approved unrelated PARENT, pending PARENT, suspended PARENT, a class and calendar events. The business RPCs are called with role `authenticated`, the actual synthetic `auth.uid()`, and PostgreSQL `READ COMMITTED`; a privileged connection is used only for fixture construction, observation and cleanup.

## Local execution (not performed in this PR)

Use a disposable Python environment with `psycopg[binary]` version 3, not an added frontend dependency. Use the repository's existing `db:start` and `db:reset` workflow only against the new local stack, then confirm the database is empty of user records and that the Packet D SQL function definitions have been installed locally.

```bash
export KRISTOU_D_ISOLATION_MODE=local
export KRISTOU_D_CONFIRM_ISOLATED=YES_DISPOSABLE_SYNTHETIC_ONLY
export KRISTOU_D_LOCAL_DEDICATED_SUPABASE=YES_NEW_EMPTY_LOCAL_STACK
export KRISTOU_D_ISOLATED_DSN='postgresql://postgres:<LOCAL_PASSWORD>@127.0.0.1:<LOCAL_PORT>/postgres'
python3 tests/db/calendar_cancellation_concurrency.py
```

A separately named empty database `kristou_packet_d_*` on loopback is accepted without the additional dedicated-stack marker. The runner verifies the installed RPC signatures, grant boundaries, row locks and cancellation guard before creating fixtures. Do not paste passwords, DSNs or identifiable account information into PR logs.

A `supabase_branch` mode is present for a future expressly authorized **disposable test project**: its project ref and direct database host must match and be different from production, and it must be empty. **That mode is not authorized by this packet**, because hosted SQL execution is explicitly forbidden.

## What the actual two-session test must prove

1. Active event: all three responses `ATTENDING`, `ACKNOWLEDGED`, `DECLINED` and a repeat update persist as a single response row. Invalid response rejected.
2. Cancelled event: new response denied; repeating cancellation preserves the first reason and timestamp; durable state read back.
3. Authorization: real pending and suspended profiles and anonymous callers denied; unrelated-class response, unauthorized global and class cancellation, missing events denied without writes.
4. Cancellation first: a transaction holds the event row; a second PostgreSQL session attempting RSVP is observed waiting via `pg_blocking_pids(waiter_pid)` containing the holder PID. After cancellation commits, response fails and no response row persists.
5. Response first: the RSVP transaction holds the event row; cancellation in a second session is observed waiting. After RSVP commits, cancellation succeeds, the prior response persists, and any later response update is denied.

The runner's `try/finally` cleanup records fixture IDs before insertion to accommodate partial failures. Check cleanup even on test failure. **Writing this test file or passing Python syntax compilation is not evidence that the database test was run.**

## Evidence still needed before review can advance

Record the exact PR revision, disposable database identifier and PostgreSQL version (without secrets), migration replay command and exit code, the exact Python/psycopg versions, unedited test output, actual test counts, and post-cleanup row counts. Then run the frozen Bun installation, complete application tests, TypeScript check and production build from the final branch checkout with raw logs.

When the isolated database cannot be provisioned or reached, leave the database scenarios **NOT RUN** and PR #21 **draft**, noting the exact environment prerequisite. Do not block unrelated frontend-only Notification work on this separate database prerequisite.

## Rollback policy

If a future deployment is explicitly authorized and rollback is needed, prepare a newly reviewed **forward correction** restoring the original two RPC definitions/grants from `20261114120000_broadcasts_calendar_class_community.sql`. Never rewrite or remove installed migration-history entries.
