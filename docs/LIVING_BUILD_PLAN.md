# KRISTOU SCHOOL — LIVING BUILD PLAN

Status: **ACTIVE BUILD DISCIPLINE**

This document defines how work is performed; it is not a feature backlog or product-requirements file. Read `AGENTS.md` and this document for every task.

## 1. Permanent authorities

- `requirements.md` — accepted product behavior and acceptance rules.
- `structure.md` — architecture, runtime boundaries, and domain ownership.
- `docs/CANONICAL_MODEL.md` — canonical data, write ownership, and invariants.
- `docs/DECISIONS.md` — accepted and proposed architecture decisions.
- `docs/SUPABASE_BACKEND_IMPLEMENTATION_PLAN.md` — ordered Supabase implementation steps.
- `progress.md` — verified implementation evidence only.

The product owner's newest explicit instruction overrides older project documents. This plan controls execution quality, not product scope. The old `funmarket/Kristou` repository is historical reference and is not current implementation or deployment evidence. The current product scope is one dedicated school per deployment; agents must not introduce multi-tenant platform concepts or cross-school data unless the owner explicitly changes the decision.

When present, agents must also read `docs/CONTINUATION_HANDOFF_2026-11-10.md` and `docs/SUPABASE_CONTINUATION_PLAN.md` before implementation. Those documents provide current collaboration context and the ordered Supabase work plan, but neither overrides the product-owner/source-of-truth order above.

## 2. Build loop for every task

### A. Understand and inspect

Before editing, state the exact outcome; confirm repo, branch, and HEAD; inspect uncommitted and overlapping work; read relevant authorities; identify product/UI/backend/data/infrastructure scope; and separate facts from assumptions. Trace the actual source through every affected consumer:

```text
UI/state -> contract/transport -> verified identity -> server authorization
-> domain operation -> migration/constraint/RLS -> storage/outbox/realtime
-> deployment/runtime, only when in scope
```

Search for existing models, policies, functions, routes, components, environment variables, scripts, and tests. Do not edit until the source owner and smallest complete change are clear.

### B. Scope and implement

Solve one requested issue end-to-end. Do not add speculative tables/features, unrelated cleanup, broad refactors, duplicate owners, or another contributor's work. Use narrow domain ownership and explicit application orchestration for cross-domain behavior. Test-first development is preferred when practical. Never weaken tests to force a pass.

### C. Update documentation

Reconcile every affected authority in the same task:

- product behavior -> `requirements.md`;
- architecture/ownership -> `structure.md`;
- canonical data authority -> `docs/CANONICAL_MODEL.md`;
- durable architectural choice -> `docs/DECISIONS.md`;
- execution discipline -> `AGENTS.md` / this file;
- verified implementation evidence -> `progress.md`.

Do not create a second document competing with an existing authority.

### D. Verify and report

Run relevant checks and report the exact branch/HEAD, files changed, docs updated, tests/checks actually run, results, unverified gaps, risks, and next decision/task. A successful build is not evidence of secure authorization or deployed behavior. Do not automatically start the next task.

## 3. Non-drift rules

Do not guess missing product behavior; silently alter identity or architecture; create duplicate models/tables/routes/policies/auth state/API clients; mix unrelated domains in monolithic modules; use catch-all business `shared`, `common`, `utils`, or `management` modules; implement frontend-only authorization; hardcode secrets; patch production data directly; present mock or partial behavior as complete; or alter unrelated files because they look old.

PostgreSQL is durable business truth. Redis or another cache is transient only unless explicitly decided otherwise. Object storage owns bytes. Browser and Telegram WebView are contexts of the same product and canonical data.

## 4. Supabase safety gates

1. Supabase is an accepted provider direction, not a verified deployment. Inspect the actual target project and environment before any remote operation.
2. Use Supabase CLI local development and committed migrations as the schema source of truth. Avoid dashboard-only schema changes.
3. Do not create protected auth flows until ADR-015 is resolved. The current accepted login identifier is username, while Supabase Auth password sign-in documents email/phone identifiers.
4. Before exposing any table/view/function/storage path, document access rules and explicitly inspect grants and RLS. Test allowed and denied operations with pgTAP and function/API tests.
5. Do not put service-role keys or database credentials in browser code. For any server-side RLS bypass, show why it is necessary and implement independent server-side identity/resource authorization and deny-case tests.
6. Prefer local synthetic data; never import child/family data into development fixtures.
7. Safety-critical pickup release must be staff-authorized, atomic, auditable, and distinct from parent arrival.
8. Keep local, staging, and production credentials/data isolated. Do not link or migrate production without explicit owner authorization and a verified recovery plan.

## 5. One-product topology gate

For changes to frontend entry, routing, auth transport, Telegram runtime, API transport, build, or deployment, verify that Browser and Telegram use the same canonical frontend and canonical backend/data authority; Telegram code is host/runtime adaptation only; no duplicate feature/state/API/asset owner is introduced; the selected build/deployment path is current; and the change follows move -> prove -> remove rather than copy -> hide -> retain.

## 6. Parallel work and repository safety

Snapshot HEAD before work. Re-check before consequential writes or commits. If HEAD changes, stop and inspect the new diff; stop when overlap or ownership is unclear. Never force-push, hard-reset shared branches, overwrite another writer, commit directly to `main`, or merge without explicit approval. No long-lived integration branch is asserted yet; use the latest reviewed default branch for focused work until the owner approves a different workflow.

## 7. Completion standard

A task is complete only to the extent that source, tests, docs, and runtime evidence prove. For database work, verify local migrations from a clean state, integrity constraints, RLS grants/policies, allow/deny tests, function authorization, and secret boundaries. For UI work, verify responsive/RTL/theme behavior and denied/error/empty states as applicable. Record checks and gaps honestly in `progress.md`.
