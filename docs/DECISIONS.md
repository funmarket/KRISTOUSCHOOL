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

## ADR-012 — Web login uses username + password; email is optional

**Status:** Accepted product-policy decision; Supabase implementation mapping is addressed by ADR-015.

**Decision:** KRISTOU Web authentication uses one unique normalized login username plus password. Email is optional, is not a Web login identifier, and is not password-recovery authority unless a separately implemented verified-email flow establishes ownership. A Telegram-originated canonical User may later attach a WebCredential to the same `User.id`; doing so must not create a second User.

**Reason:** Keep Web login deterministic and preserve one canonical identity. Optional contact data must not silently become authentication or recovery authority.

## ADR-013 — One canonical product frontend

**Status:** Accepted.

**Decision:** KRISTOU has one canonical React/TypeScript product frontend for normal Browser and Telegram WebView. In the current repository it is the application under `src/`; its route/shell may evolve without creating a second product. Telegram-specific code is limited to host/runtime adaptation such as validated `initData`, lifecycle, viewport/safe area, BackButton, haptics, and compatible deep links. No second router/shell, feature tree, product state, API client, asset authority, or business behavior is allowed.

**Reason:** Prevent Browser/Telegram drift and preserve one API/domain authority and canonical User.

## ADR-014 — Supabase is the selected backend/database platform direction

**Status:** Accepted direction; provisioning and implementation are pending.

**Context:** The product owner selected Supabase as the backend and database platform direction for `funmarket/KRISTOUSCHOOL`.

**Decision:** Use Supabase-managed PostgreSQL as durable business truth, source-controlled Supabase CLI migrations for schema/security changes, Supabase Edge Functions as the initial server-side HTTP/orchestration runtime, and private Supabase Storage for approved private media. Local development, staging, and production must be isolated. The frontend hosting provider is not decided by this ADR.

**Security consequences:** Exposed tables require least-privilege grants and tested RLS; Edge Functions verify identity and resource policy; any secret/service-role key remains server-side and every RLS-bypass path receives explicit authorization and deny-case tests. Do not use dashboard-only schema changes as the source of truth.

**Status consequence:** This decision does not prove that a Supabase project has been provisioned, connected, or deployed. Record those facts only in `progress.md` after verification.

## ADR-015 — Preserve Web and Telegram login policy on Supabase

**Status:** Accepted product policy; technical implementation design required before protected account implementation.

**Context:** The product owner confirmed that the accepted KRISTOU login and identity plan from `funmarket/Kristou` must remain unchanged in `funmarket/KRISTOUSCHOOL`: Web login remains username + password with optional email, and Telegram WebApp authentication/linking remains a separate verified transport to the same canonical User. Supabase is selected as the backend/database platform, not as permission to change product authentication. Supabase's documented password sign-in uses email or phone identifiers, so the backend needs an explicit compatible design.

**Decision:** Preserve the accepted product policy. Do not replace username login with email/phone, create synthetic email aliases, or remove Telegram login/account linking to fit a provider API. Before implementing protected account flows, document and threat-model the server-side credential/session/Telegram validation design and how its verified canonical actor is safely represented to Postgres authorization. Use strong one-way password hashing, short/rotatable sessions, revocation/expiry, rate limits, enumeration-resistant responses, explicit one-time account linking, and tests for conflicting identities. No browser-side username lookup or client-supplied role may establish identity. Supabase Auth may be used only if a reviewed design preserves these exact product rules; it is not assumed to be the credential authority.

**Until the technical design is accepted:** Do not implement production signup/login/recovery, protected RLS policies that assume an unverified identity mapping, or real/private school data flows. Local synthetic tooling and tests may proceed. Do not reopen the product-policy choice unless the owner explicitly changes it.

**Reference:** [Supabase password-based authentication](https://supabase.com/docs/guides/auth/passwords).

## ADR-016 — KRISTOUSCHOOL remains one-school only

**Status:** Accepted.

**Context:** The product owner considered turning KRISTOUSCHOOL into a shared multi-school platform with school signup, tenant routing, dedicated school homepages, and cross-school memberships, and rejected that scope as unnecessary responsibility for the current product.

**Decision:** KRISTOUSCHOOL remains only the single-school product for École Primaire Privée Kristou School. The current repository must not add a shared `Platform`, `Tenant`, `SchoolMembership`, school signup, global school registry, school switcher, cross-school user, or cross-school data model.

**Consequences:** School-specific configuration and branding remain local to KRISTOU SCHOOL. Any future scope change would require an explicit new product decision, requirements rewrite, architecture decision, threat model, migration plan, and authorization redesign before implementation.

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
