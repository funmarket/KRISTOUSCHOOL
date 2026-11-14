# KRISTOU SCHOOL

KRISTOU SCHOOL is the mobile-first school application for École Primaire Privée Kristou School in Tunisia. This repository, `funmarket/KRISTOUSCHOOL`, is the canonical source of truth for product requirements, architecture, data authority, implementation plans, and verified progress. It is only for one school: KRISTOU SCHOOL. Keep this repository dedicated to KRISTOU SCHOOL; do not add support for additional schools.

## Current state

**Source checkpoint (2026-11-14):** Owner published GOV-01 corrections and AUTH-LOGIN-02 at `main@32067aa961620facffe4ff906c5598f68d27d6ff`. Public sign-in uses username or email; registration with phone but no email requires a username. Private school-domain features beyond account governance remain largely prototypes.

**Hosted backend, read-only verified 2026-11-14:** existing Supabase project `ofppapwofhovhroyjtkc` has seven recorded migrations, including Unicode usernames and account governance; 3 Auth users/profiles, 1 approved active Owner and 1 Telegram link. Their presence does not prove end-to-end login or governance UI acceptance. See the latest `progress.md` entry and migration mapping in `docs/REMOTE_SCHEMA_INVENTORY.md`.

**Release limits:** Username sign-in remains deployed at v6; its newer source is not deployed by this reconciliation. Preserve deployed Telegram auth v9 and challenge v6. Do not replay historical SQL, run `db push` across unmapped migration IDs, or redeploy old Telegram source. Browser sign-in and current Vercel configuration need runtime verification; the old November 11 configuration diagnosis is historical.

## Canonical project documents

Read the following authorities before implementation:

- [`AGENTS.md`](AGENTS.md) — mandatory onboarding and contribution rules.
- [`requirements.md`](requirements.md) — product behavior and acceptance contract.
- [`structure.md`](structure.md) — repository architecture, runtime boundaries, and domain ownership.
- [`docs/CANONICAL_MODEL.md`](docs/CANONICAL_MODEL.md) — canonical data/write authority and invariants.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — accepted and proposed architecture decisions.
- [`docs/LIVING_BUILD_PLAN.md`](docs/LIVING_BUILD_PLAN.md) — task execution discipline.
- [`docs/SUPABASE_BACKEND_IMPLEMENTATION_PLAN.md`](docs/SUPABASE_BACKEND_IMPLEMENTATION_PLAN.md) — ordered plan for Supabase backend/database integration.
- [`docs/CONTINUATION_HANDOFF_2026-11-10.md`](docs/CONTINUATION_HANDOFF_2026-11-10.md) — current collaboration context and mandatory continuation handoff.
- [`docs/SUPABASE_CONTINUATION_PLAN.md`](docs/SUPABASE_CONTINUATION_PLAN.md) — detailed Supabase-first execution phases and agent work packets.
- [`progress.md`](progress.md) — dated verified implementation evidence only.
- [`docs/CURRENT_STATE_AND_HANDOFF_2026-11-13.md`](docs/CURRENT_STATE_AND_HANDOFF_2026-11-13.md) — fresh 2026-11-13 snapshot, document status index, current owner decisions and AI Studio/GitHub separation. It is not a replacement for the authorities above.

The old `funmarket/Kristou` repository is a read-only source of migrated product and architecture material. Its commits, branches, CI, deployments, database state, and progress entries are not evidence about this repository. HoomaUltimate is not a product or implementation authority.

## Platform direction

Supabase is the selected backend; Vercel hosts the frontend. Database migrations must precede dependent frontend changes. Source presence, a passing build and an applied migration are separate release facts. See current evidence before deployment.

## Development

Use `npm run db:start`, `npm run db:reset`, and `npm run db:test` with Docker available; these invoke the pinned Supabase CLI `3.1.0`. The database test uses synthetic fixtures only. See `docs/EDGE_FUNCTION_DEPLOYMENT.md` for deployment boundaries and secret names. No remote migration or Edge Function deployment is implied by these local commands.

## Security boundary

Never put Supabase secret/service-role keys, database passwords, signing secrets, or Telegram bot tokens into browser code, committed files, logs, screenshots, or test fixtures. A publishable/anon key is not authorization: exposed data must have least-privilege grants and tested Row Level Security policies. Do not connect real student or family data until server-side identity, scoped authorization, migrations, and access-control tests have passed.
