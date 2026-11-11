# KRISTOU SCHOOL

KRISTOU SCHOOL is the mobile-first school application for École Primaire Privée Kristou School in Tunisia. This repository, `funmarket/KRISTOUSCHOOL`, is the canonical source of truth for product requirements, architecture, data authority, implementation plans, and verified progress. It is only for one school: KRISTOU SCHOOL. Keep this repository dedicated to KRISTOU SCHOOL; do not add support for additional schools.

## Current state

The current application remains a mock-driven prototype for school-domain views; it is not a safe store of student/family data and does not provide production authorization for those domains. A Supabase Auth/profile foundation, source-controlled migrations, and Edge Function source now exist. The live Supabase migration history and deployed Telegram function still differ from current source, so source presence does not prove those flows are deployed or secure.

The production Vercel JavaScript bundle was read-only inspected on 2026-11-11: it contains the Supabase configuration error path but neither the configured project URL nor a publishable/anon key token. Signup/login therefore cannot initialize Supabase in that deployment. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the Vercel environment used for the deployment, then create a fresh deployment. These are public browser configuration values; never add a service-role key or Telegram bot token to Vercel `VITE_` variables.

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
- [`progress.md`](progress.md) — current repository implementation evidence only.

The old `funmarket/Kristou` repository is a read-only source of migrated product and architecture material. Its commits, branches, CI, deployments, database state, and progress entries are not evidence about this repository. HoomaUltimate is not a product or implementation authority.

## Platform direction

Supabase is the selected platform for managed PostgreSQL and Edge Functions; a hosted `KRISTOUSCHOOL` project is active. Its migration version IDs differ from repository migration filenames, its authenticated role can still read link challenges, and its active `telegram-auth` v5 is older than the merged one-time-link source. Do not deploy or repair migration history until a reviewed, non-destructive mapping and explicit owner authorization exist. Frontend hosting is Vercel; its missing browser build configuration is separately documented in `docs/EDGE_FUNCTION_DEPLOYMENT.md`.

## Development

Use `npm run db:start`, `npm run db:reset`, and `npm run db:test` with Docker available; these invoke the pinned Supabase CLI `3.1.0`. The database test uses synthetic fixtures only. See `docs/EDGE_FUNCTION_DEPLOYMENT.md` for deployment boundaries and secret names. No remote migration or Edge Function deployment is implied by these local commands.

## Security boundary

Never put Supabase secret/service-role keys, database passwords, signing secrets, or Telegram bot tokens into browser code, committed files, logs, screenshots, or test fixtures. A publishable/anon key is not authorization: exposed data must have least-privilege grants and tested Row Level Security policies. Do not connect real student or family data until server-side identity, scoped authorization, migrations, and access-control tests have passed.
