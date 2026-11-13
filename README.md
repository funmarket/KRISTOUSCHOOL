# KRISTOU SCHOOL

KRISTOU SCHOOL is the mobile-first school application for École Primaire Privée Kristou School in Tunisia. This repository, `funmarket/KRISTOUSCHOOL`, is the canonical source of truth for product requirements, architecture, data authority, implementation plans, and verified progress. It is only for one school: KRISTOU SCHOOL. Keep this repository dedicated to KRISTOU SCHOOL; do not add support for additional schools.

## Current state

**Source snapshot (2026-11-13):** `main@5d9f95c4cd96a8c1b83662f4605ef0bf668acabd` contains the one React/Vite Web/Telegram product, seven-role registration UI and source-controlled Supabase auth foundation. School-domain views remain largely prototype/local-state only; they are not verified private data services. The connected hosted KRISTOUSCHOOL project has four public auth tables, five live migrations and three active Edge Functions. Deployed `telegram-auth` v9 differs from committed source. See the [current evidence and agent handoff](docs/CURRENT_STATE_AND_HANDOFF_2026-11-13.md); refresh mutable facts before changes.

**Historical deployment finding (2026-11-11):** a then-inspected Vercel bundle appeared to omit public Supabase build configuration. This was not reverified for the current deployment and must NOT be presented as a confirmed current outage or fixed status. Actual Browser sign-in needs a current build/browser check. Only public `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or an intentionally supported public alias) may enter a browser build; never a service-role key or Telegram bot token.

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

Supabase is the selected backend. The hosted `KRISTOUSCHOOL` project currently has five live migration versions (versus four source SQL files), an existing atomic link RPC and revoked `authenticated` SELECT on link challenges; `telegram-auth` is deployed at v9. The repository/source parity is still unresolved, so do NOT apply old SQL or redeploy committed handlers blindly. Frontend hosting uses Vercel; the current browser environment's login behavior has not been verified by this documentation task.

## Development

Use `npm run db:start`, `npm run db:reset`, and `npm run db:test` with Docker available; these invoke the pinned Supabase CLI `3.1.0`. The database test uses synthetic fixtures only. See `docs/EDGE_FUNCTION_DEPLOYMENT.md` for deployment boundaries and secret names. No remote migration or Edge Function deployment is implied by these local commands.

## Security boundary

Never put Supabase secret/service-role keys, database passwords, signing secrets, or Telegram bot tokens into browser code, committed files, logs, screenshots, or test fixtures. A publishable/anon key is not authorization: exposed data must have least-privilege grants and tested Row Level Security policies. Do not connect real student or family data until server-side identity, scoped authorization, migrations, and access-control tests have passed.
