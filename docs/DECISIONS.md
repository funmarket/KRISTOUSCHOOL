# KRISTOU SCHOOL — ARCHITECTURAL DECISIONS

Status: **ACTIVE ADR INDEX**

This file records explicit architecture decisions only. Product behavior belongs in `requirements.md`; implementation evidence belongs in `progress.md`. A provider decision is not evidence that a project is provisioned or deployed.

## ADR-001 — KRISTOUSCHOOL is the canonical implementation repository

**Status:** Accepted.

**Decision:** `funmarket/KRISTOUSCHOOL` is the canonical KRISTOU SCHOOL product, requirements, architecture, source, migration, and implementation-evidence repository. `funmarket/Kristou` is read-only migration history unless the product owner explicitly changes this decision. HoomaUltimate is read-only process/architecture reference material only.

**Reason:** A single source of truth prevents divergent product contracts, schemas, runtime, and progress claims.

## ADR-002 — One canonical User across Web and Telegram

**Status:** Accepted.

**Decision:** Web credentials/sessions and Telegram identities resolve to one canonical KRISTOU User. Account linking is explicit; heuristic identity merging is forbidden.

**Reason:** Prevent duplicate school profiles and identity collision/account-takeover risk.

## ADR-003 — Historical multi-runtime plan is superseded

**Status:** Superseded by ADR-013.

**Historical decision:** KRISTOU originally considered separate API, Web, Telegram Mini App facade, and Worker runtimes.

**Why superseded:** Separate source-owning frontends can diverge and create duplicate product authority. Browser and Telegram host mechanics must not own separate product implementations.

## ADR-004 — PostgreSQL is durable truth; binary media belongs in object storage

**Status:** Accepted.

**Decision:** Durable business truth is stored in PostgreSQL. Redis/another transient cache is optional and may not become durable authority. Binary bytes live in governed object storage; canonical descriptors and semantic attachment rules remain with the appropriate product owner.

**Reason:** Clear authority, recovery, retention, and outage semantics.

## ADR-005 — Server-side RBAC plus resource-scoped authorization

**Status:** Accepted.

**Decision:** Protected actions require server-side role/capability checks and the relevant child/class/resource scope. Frontend visibility never grants authority.

## ADR-006 — Pickup arrival and child release are separate authorities

**Status:** Accepted.

**Decision:** A parent/authorized pickup actor may announce arrival, but only authorized school staff may transition a child to `RELEASED` through a server-verified, auditable, atomic operation.

## ADR-007 — Transactional outbox for durable asynchronous side effects

**Status:** Accepted as a pattern when asynchronous delivery is implemented.

**Decision:** Where a durable business mutation requires asynchronous notification/realtime work, the mutation and outbox event commit atomically. Delivery retries are idempotent and cannot rewrite the originating business event.

## ADR-008 — Class Questions are class-wide; no private student DMs initially

**Status:** Accepted.

**Decision:** Students may ask and reply inside their own class-wide Class Questions space. Initial scope has no private student-to-student messaging.

## ADR-009 — Shared media infrastructure, domain-owned semantic attachment

**Status:** Accepted.

**Decision:** Generic media descriptor/byte lifecycle may be shared; each product domain retains authority over whether media may be attached, who may view it, and what it means.

## ADR-010 — Light-default, trilingual UI foundation

**Status:** Accepted.

**Decision:** Light is the initial/default theme; optional dark mode uses a pitch-black foundation with light/white text. Arabic, French, and English are foundational; Arabic text is supported in the same component system while the application shell remains stable LTR across language changes.

## ADR-011 — Security-sensitive environment selection is explicit

**Status:** Accepted.

**Decision:** Security-sensitive runtime behavior must use explicit application/environment configuration and must not be inferred from `NODE_ENV` alone.

## ADR-012 — Supabase Auth credentials plus canonical KRISTOU profile
**Status:** Accepted; implementation begins in the authentication foundation migration.
**Decision:** KRISTOU Web signup requires a unique username, password, full name, and either email or full international phone number. Web sign-in accepts email, phone, or username plus password. Supabase Auth verifies email/phone credentials; a server-side username resolver maps the unique KRISTOU profile username to the linked Auth identity without exposing contact identifiers to the browser. All application users are stored in Supabase through `auth.users` plus the linked KRISTOU profile and role-assignment tables.
**Reason:** Support the requested identifiers while keeping durable application identity and authorization in Supabase.

## ADR-013 — One canonical product frontend

**Status:** Accepted.

**Decision:** KRISTOU has one canonical React/TypeScript product frontend for normal Browser and Telegram WebView. In the current repository it is the application under `src/`; its route/shell may evolve without creating a second product. Telegram-specific code is limited to host/runtime adaptation such as validated `initData`, lifecycle, viewport/safe area, BackButton, haptics, and compatible deep links. No second router/shell, feature tree, product state, API client, asset authority, or business behavior is allowed.

**Reason:** Prevent Browser/Telegram drift and preserve one API/domain authority and canonical User.

## ADR-014 — Supabase is the selected backend/database platform direction

**Status:** Accepted; a hosted KRISTOUSCHOOL project and source-controlled authentication foundation exist. Migration/runtime reconciliation remains pending.

**Context:** The product owner selected Supabase as the backend and database platform direction for `funmarket/KRISTOUSCHOOL`.

**Decision:** Use Supabase-managed PostgreSQL as durable business truth, source-controlled Supabase CLI migrations for schema/security changes, Supabase Edge Functions as the initial server-side HTTP/orchestration runtime, and private Supabase Storage for approved private media. Local development, staging, and production must be isolated. The frontend hosting provider is not decided by this ADR.

**Security consequences:** Exposed tables require least-privilege grants and tested RLS; Edge Functions verify identity and resource policy; any secret/service-role key remains server-side and every RLS-bypass path receives explicit authorization and deny-case tests. Do not use dashboard-only schema changes as the source of truth.

**Status consequence:** This decision does not prove that repository migrations or Edge Function source match the hosted project. Record current project state only in `progress.md` after read-only verification; do not reconcile or deploy without explicit authorization.

## ADR-015 — Supabase Auth mapping and Telegram identity linking
**Status:** Accepted; source implements the shared-app Web account foundation and explicit Web-account-to-Telegram linking. The hosted Edge Function/schema do not yet match this source.
**Context:** Visitors may browse school-approved public content without an account. App accounts are created through the shared app's normal signup form using Web credentials, whether opened in Browser or Telegram WebView; school admission remains separate. A signed-in account holder may explicitly link Telegram to that same canonical User.
**Decision:** Use Supabase Auth as the credential verifier for Web credentials and link every Auth user one-to-one to a KRISTOU profile. Store the custom username and requested role in the profile created by the `auth.users` trigger. Resolve username sign-in only in a server-side Edge Function, then establish the normal Supabase Auth session. To link Telegram, create a short-lived, one-time challenge bound to the verified Web user, pass it as the `startapp` parameter to the configured KRISTOU Mini App, validate fresh Telegram `initData` server-side, and atomically attach the Telegram identity to that same canonical User. The Telegram linking handler does not create accounts or issue Supabase Auth sessions. Requested signup categories, including School Staff and Administrative Personnel, never grant privileged access by themselves. No profile-field-based account merging is allowed.

The implementation must use strong provider password handling, confirmation settings, generic authentication errors, rate limits at the Edge Function/provider boundary, no browser-side contact lookup, explicit conflict failure, and no service-role credential in browser code. Private school domains remain gated until their own access matrices and deny-case tests are implemented.

**Reference:** [Supabase password-based authentication](https://supabase.com/docs/guides/auth/passwords).

## ADR template

```markdown
## ADR-NNN — Short decision title
**Status:** Proposed | Accepted | Superseded
**Context:** What architectural problem requires a decision?
**Decision:** The exact chosen rule.
**Reason:** Why this choice is appropriate.
**Consequences:** Important costs, constraints, and follow-up requirements.
**Supersedes / Superseded by:** ADR reference when applicable.
```

Only create an ADR for a real architectural decision. Do not create placeholder ADRs for speculative future features.
