# KRISTOU SCHOOL — STRUCTURE AND ARCHITECTURE

Status: **PRIMARY ARCHITECTURE CONTRACT**
Repository: `funmarket/KRISTOUSCHOOL`
Backend platform direction: **Supabase** (planned; not yet verified as provisioned or integrated)
Deployment model: **KRISTOU SCHOOL only**

This document defines architecture, runtime boundaries, data ownership, and dependency rules. It is not a progress ledger, feature backlog, or permission to create speculative structures. Product behavior belongs in `requirements.md`; data authority belongs in `docs/CANONICAL_MODEL.md`; decisions belong in `docs/DECISIONS.md`; verified status belongs in `progress.md`.

## 1. Current state and target

The current repository contains one Vite/React frontend, mock-driven context state, and a placeholder Supabase client. It does not yet contain a Supabase CLI project, migrations, RLS policies, Edge Functions, production authentication, or a backend. UI data, login, roles, and pickup transitions are prototype-only.

The target is one canonical React/TypeScript product for Browser and Telegram WebView, backed by one Supabase project boundary for KRISTOU SCHOOL’s managed PostgreSQL, server-side functions, and private object storage. The product and Supabase boundary are dedicated to KRISTOU SCHOOL and its school community. Preserve the accepted Web username/password and Telegram WebApp authentication/linking requirements; the Supabase-compatible server-side implementation remains an engineering gate. Supabase is the selected provider direction. No live project, schema, secret, deployment, or production behavior is asserted by this document.

Start from the simplest repository topology that supports the product:

```text
KRISTOUSCHOOL/
  src/                         # one canonical product frontend
  supabase/
    config.toml                # local Supabase project configuration
    migrations/                # ordered schema, grants, RLS, functions, triggers
    seed.sql                   # synthetic local-only seed data
    functions/<capability>/    # narrow Deno Edge Function entry points
    tests/                     # pgTAP database/RLS tests
  tests/                      # frontend and Edge Function integration tests
  docs/                       # requirements, architecture, plans, evidence
```

Keep the repository focused on one canonical school product: do not add unrelated product registries, school-selection flows, or alternate data authorities. Supabase Edge Functions are the initial server-side HTTP/orchestration runtime. A future long-running worker or separate API is a distinct architecture decision, not a default prerequisite.

## 2. Runtime and data boundaries

### `src/` — canonical Web product

Owns the React application entry, routing, product shell, responsive/RTL/theme behavior, user-facing features, and client-side presentation state. It calls the approved Supabase client/API boundary. It must not own durable business truth, authorization policy, protected role grants, pickup release authority, private storage access decisions, or server secrets.

Browser and Telegram WebView must use the same frontend, feature implementations, API behavior, and canonical records. Telegram-specific work is limited to host/runtime adaptations such as validated `initData` transport, lifecycle, viewport/safe area, BackButton, haptics, and deep links. Do not create a second router, shell, feature tree, data store, API client, or source of business truth.

### `supabase/migrations/` — canonical schema and database security

Owns the versioned PostgreSQL schema, constraints, indexes, SQL functions/triggers, grants, RLS policies, and changes to Supabase-managed storage policies. Every schema/security change is reviewed and tested locally before remote deployment. The Supabase dashboard is not the authoritative schema editor for persistent changes.

PostgreSQL is durable business truth. Supabase Auth records, if selected after the explicit identity decision, are authentication authority; a separate canonical KRISTOU user/profile authority must map to them without duplicate identities. Storage holds binary bytes; product-owned rows hold semantic attachment, visibility, and lifecycle references.

### `supabase/functions/<capability>/` — server-side transport and orchestration

Owns request parsing, input validation, verified identity context, application orchestration, and calling domain-owned SQL operations. Functions are narrow by capability/domain; they must not become a single monolithic API handler or duplicate database business rules. Keep reusable policy in well-bounded domain modules and enforce invariants again in PostgreSQL where appropriate.

Use caller-scoped credentials and RLS for routine user-scoped operations when compatible with the selected identity model. Any privileged service credential is server-only and must be used only in a narrow, explicitly authorized operation. Since service-role credentials bypass RLS, every such path must perform server-side identity and resource authorization and have deny-case tests.

Prefer short, idempotent functions. Important business mutations and the durable outbox event must commit atomically in PostgreSQL. Use database transactions/RPC for indivisible multi-row state changes; do not rely on multiple HTTP calls being atomic. Long-running work, if later needed, requires a separate documented queue/worker choice.

### `supabase/storage`

Use private buckets for child/family/enrollment/class media and documents. Use storage policies or short-lived signed access generated only after resource authorization. Public buckets are limited to explicitly approved public school assets. Do not expose a storage path/URL as proof of permission.

### Local and hosted environments

Local development uses Supabase CLI and versioned migrations. Local, preview/staging, and production projects must be isolated by URL, keys, data, and authentication configuration. Seed files contain synthetic data only. No hosted project should be linked or mutated until project ownership, region, recovery, and secrets are confirmed.

## 3. Dependency direction and module shape

For a product capability, use the smallest clear ownership boundary. A substantial function may be organized as:

```text
supabase/functions/<capability>/index.ts       # transport/composition
src/server/<domain>/application/                # domain use-case orchestration, if needed
src/server/<domain>/domain/                     # policy/value rules
supabase/migrations/                            # schema, constraints, RLS, SQL primitives
```

Do not add folders merely to imitate a former repository. If server modules are introduced, preserve this direction:

```text
HTTP/Edge Function -> application -> domain
infrastructure/database adapter -> application/domain ports
composition root -> concrete adapters
```

Forbidden dependencies include:

```text
domain policy -> React, HTTP framework, or Supabase client
frontend -> service-role/secret key or privileged database connection
transport handler -> unreviewed cross-domain business SQL
one domain -> another domain's concrete persistence implementation
client-supplied role -> authorization decision
```

RLS and API authorization are separate layers with matching tests. Views, SQL functions, triggers, buckets, and realtime channels must be reviewed for policy bypasses, not just base tables.

## 4. Product-domain write ownership

Each durable concept has exactly one owner. These are product boundaries, not a demand to create a separate Edge Function or table for every line:

| Concept | Owner | Boundary |
|---|---|---|
| Canonical User, WebCredential/session, Telegram identity/link | Identity & Authentication | One user; explicit linking; no heuristic merges. Auth provider mapping is blocked on ADR-015. |
| Roles, capabilities, scoped grants | Access Control | Server-side RBAC and resource scope; frontend visibility is not authority. |
| Parent/student/teacher/manager profiles | People | Presentation/profile facts, not credentials. |
| Parent-child guardian relation | Family | Sole source for parent-to-child scope. |
| Academic year, level, class, teacher/student assignments | Academics | Sole class identity, active membership, and assignment authority. |
| Enrollment applications, review, enrollment | Enrollment | Acceptance alone does not grant class access. |
| Announcements, homework/classwork, class calendar/docs/gallery/questions | Class Community | Scoped to canonical class; no private student DMs initially. |
| Parent Notes | Parent Notes | Its own audience, time window, quota, and privacy policy. |
| Short operational message threads | Messaging | Must not bypass Parent Notes policy or safeguarding rules. |
| Dismissal config, pickup state and release confirmation | Pickup | Server-controlled transitions; only authorized staff release a child. |
| Authorized pickup people | Pickup | School-controlled authority distinct from Parent role. |
| School broadcasts | Broadcasts | One canonical broadcast; recipient projections are non-authoritative. |
| Inbox notifications/delivery | Notifications | Projection/delivery state; source event remains owned elsewhere. |
| Theme/language/sound preferences | Preferences | Presentation state only. |
| La Toque Gourmande weekly menu | Food Menu | Admin or explicit capability only. |
| Public teacher/board directory | School Directory | Public presentation; internal staff profiles remain People-owned. |
| Homepage, public pages, activities and public gallery | Public Content | Public-approved content only. |
| Media descriptor/byte lifecycle | Media | Generic media lifecycle; feature owns meaning and access. |
| Sensitive operation history | Audit | Minimize PII; never persist secrets or unnecessary private content. |
| Durable asynchronous handoff | Async Foundation | Outbox/queue is infrastructure, not a business domain. |
| AI assistant | TBD / later phase | API client only; no separate database authority. |
| Grades, attendance, transport, payments | TBD / out of initial scope | Do not create schema without explicit approval. |

Cross-domain workflows use narrow application operations and explicit reads, not duplicated tables, grants, or policies. Example: Pickup may verify Family, Academics, and Access Control facts, but Pickup owns its transition and release record.

## 5. Security and privacy architecture

- Enable RLS on every exposed table and applicable view; explicitly review grants as well as policies. Deny by default.
- Write a role/action/resource access matrix before each private data slice. Test both allowed and prohibited rows for `anon` and authenticated identities using pgTAP and relevant function integration tests.
- Scope parent access through active canonical ParentChildLink; student access through active enrollment/class membership; teacher access through assigned classes; manager access through explicit capability grants.
- Do not store authorization decisions only in client state or long-lived, stale role claims.
- Keep service-role and database credentials in managed server-side secrets. Never compile them into Vite or return them in JSON/errors.
- Avoid exposing private base tables directly through the Data API where a narrow function/RPC is safer. Carefully review views and `SECURITY DEFINER` functions, including ownership, fixed `search_path`, grants, and callers.
- Pickup release must be an atomic server-authorized state transition with auditable actor/time. Parent arrival must never cause release.
- Use `Africa/Tunis` as the business timezone where requirements specify it. Store instants with timezone-aware types and test daylight/date-boundary behavior.
- Private media access follows the same resource policy as its parent feature. Medical and child data remain excluded unless a separately approved use and precise access rule exist.

## 6. Browser and Telegram relationship

```text
Browser -------------------\
                             -> canonical React frontend -> Supabase-backed API/data
Telegram WebView -----------/                              -> same canonical User/data
host mechanics + validated auth transport ---------------->
```

The frontend delivery context may vary; business data and server-side authorization do not. No second frontend, role system, API owner, or durable product store is allowed.

## 7. Architecture completion gate

A backend/domain slice is acceptable only when its owner is explicit, dependencies follow this structure, migrations and grants are versioned, RLS and function authorization are tested against both allow and deny cases, sensitive data is scoped correctly, the frontend has no privileged credential, docs are reconciled, and the exact verification results are recorded in `progress.md`. A green UI/build does not prove backend security.
