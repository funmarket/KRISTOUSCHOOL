# KRISTOU SCHOOL — AGENT AND CONTRIBUTOR RULES

Status: **MANDATORY REPOSITORY INSTRUCTIONS**

These rules apply to every developer, coding agent, automation, and delegated worker in `funmarket/KRISTOUSCHOOL`. The product is KRISTOU SCHOOL. The old `funmarket/Kristou` repository is read-only migration history; do not assume its branches, deployment, code, tests, or infrastructure are current here.

## 1. Mandatory onboarding gate

Before selecting an implementation task, editing files, creating a branch, delegating, committing, opening a pull request, or deploying:

1. Read this entire `AGENTS.md`.
2. Read `README.md`, `requirements.md`, `structure.md`, `docs/CANONICAL_MODEL.md`, `docs/DECISIONS.md`, `docs/LIVING_BUILD_PLAN.md`, `docs/SUPABASE_BACKEND_IMPLEMENTATION_PLAN.md`, and `progress.md` in full. Read any other relevant documents under `docs/` and inspect the actual repository tree.
3. Confirm the repository, branch, and HEAD. Inspect open changes and overlapping work.
4. Distinguish accepted product requirements, architecture/data-authority contracts, proposed/ordered plans, and currently verified implementation facts.
5. Trace the owning source and affected consumers. Search for existing tables, policies, functions, components, environment variables, tests, and docs before creating a parallel owner.
6. Resolve any contradictions using the source-of-truth order below. If a material decision is unresolved, stop before implementing behavior that depends on it.

A previous agent's summary, an old commit, a green build on another repository, or a plan checklist does not satisfy this gate.

## 2. Source-of-truth order

When documents disagree, use this order:

1. the product owner's latest explicit instruction;
2. `requirements.md` for accepted product behavior;
3. `structure.md` for architecture and ownership;
4. `docs/DECISIONS.md` for accepted/proposed architectural decisions;
5. `docs/CANONICAL_MODEL.md` for data and write authority;
6. `docs/LIVING_BUILD_PLAN.md` for execution discipline;
7. current repository code, database, and runtime as evidence of what is implemented—not permission to override a newer target rule;
8. `progress.md` for verified implementation evidence only.

The Supabase backend plan is an ordered proposal subordinate to the owner's instructions and accepted requirements. It is not proof of implementation or authorization to change product policy.

## 3. Non-negotiable safety and quality rules

- One canonical KRISTOU product, one canonical identity per person, and one authoritative owner per durable concept.
- Never treat frontend visibility, a client-supplied role, a publishable key, or a client-side check as authorization.
- Every exposed Supabase table/view/function/storage path must have least-privilege grants and appropriate, tested RLS/access controls. A Supabase service-role/secret key bypasses RLS and must remain server-side; never expose it to the browser.
- Do not put student, child, family, health, enrollment, or pickup data into public projections or production mock fixtures.
- Pickup arrival and child release are distinct. Parents/authorized pickup actors may announce arrival; only authorized staff may confirm physical release through server-verified policy and an atomic state transition.
- No heuristic identity merging. Never merge people by name, email, phone, username, or photo.
- Preserve the owner's confirmed Web username-plus-password and Telegram WebApp login/linking policy. Do not replace it with email/phone login or synthetic email aliases. The compatible server-side session/identity bridge and Postgres authorization design is the implementation gate in `docs/DECISIONS.md`; no auth implementation may bypass it.
- No secrets in source, browser bundles, examples, tests, logs, or screenshots. Use placeholders in `.env.example` and managed secrets for deployed functions.
- All schema changes must be reversible/reviewable migrations committed to `supabase/migrations/`; do not make dashboard-only production schema changes.
- Do not describe partial/demo behavior as secure, complete, tested, or deployed.
- Avoid monolithic services, handlers, SQL migrations, stores, or generic modules that own unrelated domains.

## 4. Change and verification discipline

For each task, make the smallest complete change from authoritative source through affected consumers and tests. Use test-first development where useful. Do not weaken tests to make a change pass. Update all affected authorities in the same task: product behavior in `requirements.md`, architecture in `structure.md`, data authority in `docs/CANONICAL_MODEL.md`, decisions in `docs/DECISIONS.md`, method in `docs/LIVING_BUILD_PLAN.md`, and evidence in `progress.md`.

Run relevant verification for the changed layer. Database work must include local migration/reset validation, pgTAP RLS policy tests for allow and deny cases, and function/API integration tests. Report exact commands and results; state explicitly what was not run. Never claim a remote migration, release, or deployment without fresh evidence.

Before consequential writes, re-check HEAD and inspect incoming changes. Never force-push, reset a shared branch, overwrite another contributor, commit directly to `main`, or merge a pull request without explicit owner approval. Use a focused branch and repository contribution conventions. The current repository has no verified long-lived integration branch; create work from the latest reviewed default branch unless the owner establishes another workflow.

## 5. Backend and Supabase boundaries

Supabase is the selected platform direction, not current implementation evidence. The intended source-controlled surface is `supabase/config.toml`, ordered migrations, seed data containing synthetic-only records, RLS tests, and separately scoped Edge Functions. Use Supabase CLI local development before linking a remote project. Keep schema/security behavior reproducible in migrations.

Edge Functions are server-side transport/orchestration boundaries, not cross-domain business authorities. Keep domain policy in small domain-owned application modules and database constraints/RLS. Use the caller's verified identity for ordinary user operations where the selected auth design permits it. Any use of a secret/service-role credential must be narrowly scoped, justified, and followed by explicit server-side authorization; RLS bypass is never a substitute for policy.

The product-policy choice is settled: retain username/password for Web and Telegram WebApp authentication/linking. Before protected user accounts, the secure Supabase-compatible implementation and database identity bridge must be designed, tested, and recorded. Until that technical gate is met, use only synthetic local fixtures and intentionally public data.
