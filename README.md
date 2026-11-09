# KRISTOU SCHOOL

KRISTOU SCHOOL is the mobile-first school platform for École Primaire Privée Kristou School in Tunisia. This repository, `funmarket/KRISTOUSCHOOL`, is the canonical source of truth for product requirements, architecture, data authority, implementation plans, and verified progress.

## Current state

The current application is a Vite/React prototype with mock-driven client state. It is not a production backend, authentication system, or safe store of student/family data. Supabase integration is planned, not yet implemented or verified. Do not treat any prototype login, role switch, pickup action, sample student record, or Supabase client placeholder as real security or production behavior.

## Canonical project documents

Read the following authorities before implementation:

- [`AGENTS.md`](AGENTS.md) — mandatory onboarding and contribution rules.
- [`requirements.md`](requirements.md) — product behavior and acceptance contract.
- [`structure.md`](structure.md) — repository architecture, runtime boundaries, and domain ownership.
- [`docs/CANONICAL_MODEL.md`](docs/CANONICAL_MODEL.md) — canonical data/write authority and invariants.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — accepted and proposed architecture decisions.
- [`docs/LIVING_BUILD_PLAN.md`](docs/LIVING_BUILD_PLAN.md) — task execution discipline.
- [`docs/SUPABASE_BACKEND_IMPLEMENTATION_PLAN.md`](docs/SUPABASE_BACKEND_IMPLEMENTATION_PLAN.md) — ordered plan for Supabase backend/database integration.
- [`progress.md`](progress.md) — current repository implementation evidence only.

The old `funmarket/Kristou` repository is a read-only source of migrated product and architecture material. Its commits, branches, CI, deployments, database state, and progress entries are not evidence about this repository. HoomaUltimate is not a product or implementation authority.

## Platform direction

Supabase is the selected platform direction for managed PostgreSQL, versioned database migrations, server-side Edge Functions, and private object storage. No Supabase project has been verified as connected by this documentation change. Railway is not the target hosting/database provider. See ADR-014 and the implementation plan for the auth-policy decision gate, security controls, setup order, and verification criteria.

## Development

The current prototype exposes Vite scripts in `package.json`. Backend-specific commands will be added only as their owners are implemented. Do not copy commands from old-repository documentation as proof that this repo has those workspaces or scripts.

## Security boundary

Never put Supabase secret/service-role keys, database passwords, signing secrets, or Telegram bot tokens into browser code, committed files, logs, screenshots, or test fixtures. A publishable/anon key is not authorization: exposed data must have least-privilege grants and tested Row Level Security policies. Do not connect real student or family data until server-side identity, scoped authorization, migrations, and access-control tests have passed.
