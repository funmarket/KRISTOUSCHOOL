# KRISTOU SCHOOL — ARCHITECTURAL DECISIONS

Status: **ACTIVE ADR INDEX**
Revision: **2026-11-14 — DOC-D4**

This reconciliation follows the Owner-approved **KRISTOU SCHOOL Master Execution Plan, revision 3**, saved as `KRISTOU_MASTER_EXECUTION_PLAN(1).txt`, SHA-256 `d0213cd47d3cbf94d749a7234a9ab29cc965448c0c39850f9d234978b053e3cd`, and the accepted local [requirements.md](../requirements.md), [structure.md](../structure.md) and [CANONICAL_MODEL.md](CANONICAL_MODEL.md) revisions DOC-D1/D2/D3.

**Only docs/DECISIONS.md changes. Backend implementation remains paused.** These ADRs record accepted decisions, not implementation permission, schema installation, live verification or GitHub publication. Other authorities await their individual reconciliation; no commit, push, PR change/merge, account action, database write, setting enablement or deployment is authorized here.

## Reading and supersession

- Latest explicit Product Owner instructions prevail. Requirements own product behavior; structure owns architecture; this file records durable decisions; the canonical model owns data/write invariants; the master owns the single execution roadmap. None creates another active queue.
- **Accepted** means the decision is settled, not the implementation. School-policy details still blocked by DG-01…DG-19 remain open; do not change their status by assuming a code default.
- Keep ADR-001…015 identifiers stable. ADR-003 remains superseded by ADR-013. ADR-012/015 now contain one current policy each; their earlier text/review reports are retained below as historical material.
- Read-only inspection still finds existing account/governance objects, including the account-review RPC. The old absence/unapplied-schema statements in historical blocks are not current evidence. Source/live proof and release gaps belong in dated [progress.md](../progress.md), the master and [REMOTE_SCHEMA_INVENTORY.md](REMOTE_SCHEMA_INVENTORY.md).
- Preserve the Owner’s successful live login and non-impersonating oversight walkthrough as manual evidence. It neither disappears because an agent did not repeat it nor establishes every database authorization/concurrency gate.
- Upcoming document edits overlap PR #15. Any later authorized publication/rebase/merge must preserve newer Owner-approved decisions and the local DOC-D1/D2/D3 changes; do not restore obsolete phone-login, deferred Attendance or an older next task.

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

**Status:** Accepted; revised by Owner policy on 2026-11-14 (AUTH-LOGIN-02).

**Decision:** Supabase Auth owns password/contact verification and provider sessions; the canonical account uses the existing Auth/profile mapping. Public sign-in accepts chosen username **or email plus password**; direct phone input is rejected before provider/resolver calls. Phone-backed accounts keep their internal provider phone credential and sign in through the server-side username resolver.

Signup requires full name, password, requested role and email or phone. Phone without email requires a chosen valid username; with email it is optional. Username-only provisioning is unsupported. A typed secondary contact is not a verified Auth/recovery alias; phone verification never introduces direct public phone login. Full name is display data, not identity proof.

Preserve accepted Unicode/NFC username normalization/uniqueness, Arabic/Latin/accented French names, valid numeric-underscore handles such as `123_456` and existing valid handles. Keep current form design/password handling and localized guidance. No synthetic contacts, browser contact lookup, heuristic merge, custom password table or second session authority.

**Consequences:** Contact verification, app approval, admission, enrollment, guardian linking and pickup authorization remain separate. Provider/session/contact changes use their own approved packet and DG-10 when applicable. Types, handler releases and UI evidence remain distinct from this accepted policy.

**Supersession:** Earlier mandatory-username/public phone-login wording and the November 13 all-identifier-combinations proposal are superseded by this current rule. Their original text is retained below.

<details>
<summary>Historical ADR-012 text and November 13 proposal — not active policy</summary>

**Historical record only.** Earlier status/implementation statements below are reproduced for provenance, not current instructions or evidence. The current decision above supersedes conflicting wording.

**Status:** Accepted; implementation begins in the authentication foundation migration.
**Decision:** KRISTOU Web signup requires a unique username, password, full name, and either email or full international phone number. Web sign-in accepts email, phone, or username plus password. Supabase Auth verifies email/phone credentials; a server-side username resolver maps the unique KRISTOU profile username to the linked Auth identity without exposing contact identifiers to the browser. All application users are stored in Supabase through `auth.users` plus the linked KRISTOU profile and role-assignment tables.
**Reason:** Support the requested identifiers while keeping durable application identity and authorization in Supabase.

**ADR-012 dated Product Owner addendum (2026-11-13; supersedes the mandatory-username clause above):** Registration is intended to allow username, email or phone individually, in any pair or all three, along with password and full name; the chosen identifier must be securely provisioned and verified before it can be used to authenticate the same canonical User. Human-readable usernames must support ordinary Arabic, accented Latin and multiword names with safe normalization/uniqueness. Username-only sign-in needs a genuine supported server-side Auth mechanism; no synthetic email/phone aliases, unverified secondary login identifiers or public password tables. This is approved **desired behavior**, not proof of current schema/UI/provider support. See AUTH-ID-01 in the current handoff.

</details>

## ADR-013 — One canonical product frontend

**Status:** Accepted.

**Decision:** KRISTOU has one canonical React/TypeScript product frontend for normal Browser and Telegram WebView. In the current repository it is the application under `src/`; its route/shell may evolve without creating a second product. Telegram-specific code is limited to host/runtime adaptation such as validated `initData`, lifecycle, viewport/safe area, BackButton, haptics, and compatible deep links. No second router/shell, feature tree, product state, API client, asset authority, or business behavior is allowed.

**Reason:** Prevent Browser/Telegram drift and preserve one API/domain authority and canonical User.

## ADR-014 — Continue the existing Supabase backend with isolated environments

**Status:** Accepted; provider decision retained and clarified.

**Decision:** Continue Supabase-managed PostgreSQL as durable authority, reviewed source-controlled migrations/security, narrow Supabase Edge Functions for initial server transport and governed private Storage when required. Continue the existing project; no replacement database or additional runtime is implied. Local, staging and production configuration/data/secrets remain isolated.

Supabase backend selection does not select a frontend hosting provider. Vercel is the current observed frontend host; this reconciliation commissions no hosting switch or deployment. Do not import historical Railway/Cloudflare configuration from `funmarket/Kristou` as current infrastructure.

**Consequences:** Least-privilege grants/RLS and verified function/resource policy precede protected connections. Service-role credentials remain server-side; any bypass path requires independent authorization and deny cases. The dashboard is not a second schema authority. Reuse installed objects and inspect migration/source mappings before changes; no blind db push, history repair, reset or replay of installed SQL.

**Evidence boundary:** Existing project/schema presence does not prove source/runtime parity, private uploads, authorized realtime, RLS isolation or production readiness. Dated inventories and tests remain evidence records.

<details>
<summary>Historical ADR-014 wording — provider decision retained, dated state is not current proof</summary>

**Historical record only.** Earlier status/implementation statements below are reproduced for provenance, not current instructions or evidence. The current decision above supersedes conflicting wording.

**Status:** Accepted; a hosted KRISTOUSCHOOL project and source-controlled authentication foundation exist. Migration/runtime reconciliation remains pending.

**Context:** The product owner selected Supabase as the backend and database platform direction for `funmarket/KRISTOUSCHOOL`.

**Decision:** Use Supabase-managed PostgreSQL as durable business truth, source-controlled Supabase CLI migrations for schema/security changes, Supabase Edge Functions as the initial server-side HTTP/orchestration runtime, and private Supabase Storage for approved private media. Local development, staging, and production must be isolated. The frontend hosting provider is not decided by this ADR.

**Security consequences:** Exposed tables require least-privilege grants and tested RLS; Edge Functions verify identity and resource policy; any secret/service-role key remains server-side and every RLS-bypass path receives explicit authorization and deny-case tests. Do not use dashboard-only schema changes as the source of truth.

**Status consequence:** This decision does not prove that repository migrations or Edge Function source match the hosted project. Record current project state only in `progress.md` after read-only verification; do not reconcile or deploy without explicit authorization.

</details>

## ADR-015 — Explicit Telegram linking and one canonical account

**Status:** Accepted; protected runtime scope reaffirmed 2026-11-14.

**Decision:** Browser and Telegram WebView use the same signup/sign-in product and canonical account. An unlinked visitor may browse approved public content anonymously. A signed-in app account may explicitly link Telegram through a short-lived one-time challenge, signed fresh initData validation and atomic identity claim. Existing keys/cardinality and the authorized claim prevent duplicate ownership; optional Telegram profile metadata is never a merge key.

Established later Mini App re-entry resolves the already-linked canonical account without creating another account or issuing a Supabase Auth session. A restored app-context profile is not a Supabase bearer token/direct RLS authority. Each future protected operation must verify current server identity and the same account/capability/resource policy in its actual transport.

**Protected scope:** Preserve auth, linking, challenges, re-entry/cache/session behavior against `09ffacf80daa4f546140053db441abb96c68ef8b`. The withdrawn Telegram lifecycle rewrite is not revived. No alternate auth system or protected-handler redeployment is authorized during GOV-01/AUTH-LOGIN-02 or documentation reconciliation.

**Consequences:** Requested roles/contact verification do not approve private access. No Telegram-only provisioning, heuristic merge, browser bot token or feature-owned credential store. Current Web login policy is ADR-012; governance policy is ADR-016.

**Evidence boundary:** The Owner’s successful live login/workspace/oversight report is valid manual acceptance. Handler/source parity, ordinary RLS and actual two-session concurrency require their own exact-candidate evidence; old review reports below are not current status.

<details>
<summary>Historical ADR-015 and review-branch report — earlier status is not current acceptance</summary>

**Historical record only.** Earlier status/implementation statements below are reproduced for provenance, not current instructions or evidence. The current decision above supersedes conflicting wording.

**Status:** Accepted; source and deployed runtime status must be checked against `docs/CURRENT_STATE_AND_HANDOFF_2026-11-13.md`. Deployed `telegram-auth` v9 was observed, but browser end-to-end acceptance and source/deployment parity remain unverified.
**Context:** Visitors may browse school-approved public content without an account. App accounts are created through the shared app's normal signup form using Web credentials, whether opened in Browser or Telegram WebView; school admission remains separate. A signed-in account holder may explicitly link Telegram to that same canonical User.
**Decision:** Use Supabase Auth as the credential verifier for Web credentials and link every Auth user one-to-one to a KRISTOU profile. Store the custom username and requested role in the profile created by the `auth.users` trigger. Resolve username sign-in only in a server-side Edge Function, then establish the normal Supabase Auth session. To link Telegram, create a short-lived, one-time challenge bound to the verified Web user, pass it as the `startapp` parameter to the configured KRISTOU Mini App, validate fresh Telegram `initData` server-side, and atomically attach the Telegram identity to that same canonical User. On later normal Mini App launches, validate fresh `initData` and resolve that linked User to the Telegram app context without issuing a Supabase Auth session or creating an account. Requested signup categories, including School Staff and Administrative Personnel, never grant privileged access by themselves. No profile-field-based account merging is allowed.

The implementation must use strong provider password handling, confirmation settings, generic authentication errors, rate limits at the Edge Function/provider boundary, no browser-side contact lookup, explicit conflict failure, and no service-role credential in browser code. Any private operation initiated from Telegram must be authorized through a server-verified Telegram path; the Telegram app-context profile alone is not a Supabase Auth session and does not grant direct RLS access. Private school domains remain gated until their own access matrices and deny-case tests are implemented.

**Reference:** [Supabase password-based authentication](https://supabase.com/docs/guides/auth/passwords).

**ADR-015 dated Owner governance addendum (2026-11-13):** Public visitors are anonymous; seven registered roles only. Requested roles never grant permission. Only APP_ADMIN appoints/governs APP_ADMIN and MANAGER. Approved ADMINISTRATIVE_PERSONNEL have automatic ordinary school-office powers and may take lifecycle actions on *other* ordinary accounts, never on themselves or privileged roles. These decisions require authoritative server implementation and deny-case tests; no current approval RPC is assumed.

**Review-branch candidate (`feature/auth-id-01-review-20261113` — `AUTH-UX-01`, `AUTH-UX-01-FIX1`, `AUTH-ID-01`):**
- Implements localized (`ar`, `fr`, `en`) registration and pending-approval feedback (`account_not_approved`, `contact_not_confirmed`, `invalid_credentials`, `sign_in_failed`) while preserving fail-closed denial of private workspaces and signing out unapproved sessions.
- Repairs `signInAccount()` username transport by unwrapping `@supabase/supabase-js` `FunctionsHttpError` responses from `auth-username-signin`.
- Implements human-friendly Unicode username validation/normalization (`src/lib/username.ts`), Tunisian (`+216`) and explicit E.164 phone normalization, and optional-username registration combinations `B`–`G` while explicitly blocking combination `A` (username-only without email or phone) and keeping secondary phone in `F`/`G` marked as unverified (`pending_phone`) and disabled for login until provider verification is completed.
- Prepares `supabase/migrations/20261113120000_human_friendly_usernames.sql` (`PREPARED — NOT VERIFIED`) preserving the seven-role `app_role` enum, `handle_new_user()`, `username_normalized`, and `profiles_username_normalized_key` in place.

</details>

## Source decision history — Owner addendum of 2026-11-14

The exact original addendum is retained for provenance. Its current policy is consolidated in ADR-012/015; it does not create a second execution queue.

<details>
<summary>Original Owner addendum</summary>

**Accepted; supersedes older identifier-combination and public phone-login wording in ADR-012/015:** Public sign-in accepts username or email plus password. Registration requires email or phone; phone without email also requires a chosen username. Keep phone credentials enabled internally for the server-side username resolver. Username-only provisioning remains unsupported; no synthetic contact aliases or identity merging.

**Protected scope:** Preserve Telegram authentication, linking, challenges and cached/session behavior against `09ffacf80daa4f546140053db441abb96c68ef8b`. The Owner withdrew Telegram lifecycle changes from GOV-01/AUTH-LOGIN-02. Do not introduce another Telegram auth system or redeploy Telegram handlers during this closeout. Shared Web loader and governance changes must not alter those sections. This is a scope decision, not a new Telegram security certification.

</details>

## ADR-016 — Current account governance and scoped authority

**Status:** Accepted.

**Decision:** Anonymous public browsing has no account role. The seven registered roles are `APP_ADMIN, MANAGER, ADMINISTRATIVE_PERSONNEL, TEACHER, SCHOOL_STAFF, PARENT, STUDENT`; GENERAL_USER is never a persisted enum/fallback. Signup requests never grant authority.

Only APP_ADMIN governs APP_ADMIN/MANAGER appointments. Approved Administrative Personnel automatically receive the ordinary office bundle and may take lifecycle actions on other ordinary accounts, including peers, never themselves or privileged targets. Managers act through explicit delegated authority; job/Teacher/Parent/Student roles retain resource scope. Neither a Manager label nor role-workspace inspection creates Owner privilege or physical-release authority.

**Consequences:** Current status/roles/grants are server-derived; old sessions/open screens cannot restore revoked permission. Mutations require fresh caller/target checks, version/retry policy and audit. Preserve a recoverable last Owner and reauthorize callers after waiting. Reuse existing governance RPCs/records rather than invent another approval system. Manager grant storage alone is not completed delegation.

**Open gates:** DG-01/DG-04/DG-05/DG-06 govern remaining lifecycle UX, effective multi-role policy and real acceptance. GOV-C1 closes the existing corrective candidate; F1-G3 delegation is separately scoped. Do not reapply installed safeguards or bootstrap another Owner.

## ADR-017 — School-person identity is separate from credentials

**Status:** Accepted.

**Decision:** People owns stable student/staff/parent facts independently of whether the person has an app account. Identity owns account mapping/username/provider credentials; Access Control owns status/roles/grants. A student record/import never creates credentials, approves a role, merges identities or establishes guardian/collector authority.

One physical table may contain fields with different logical owners; each fact still has one writer. Existing account display fields are People presentation facts; verified Auth aliases are Identity authority; review/status fields are Access Control. School-official identity and approved public-directory presentation are distinct facts, not automatic copies.

**Consequences:** Individual forms and CSV/XLSX preview/confirmed imports use the same domain writers. Student Profile is an additive audience-filtered projection over source owners, not a denormalized editable ledger. Preserve existing information/layout; no copied Attendance/grade totals.

**Open gates:** DG-02/DG-03/DG-07 for identifiers, imports, admission and lifecycle. F2-A1…A10, PRO-01/02, ACC-01; exact physical relationships are frozen before their migrations, not by UI types.

## ADR-018 — Operational school calendar and class calendar have distinct owners

**Status:** Accepted.

**Decision:** Academics owns school dates/closures, subjects/teaching assignments and teaching-session lifecycle. Class Community owns class-only content calendar. Broadcasts owns global notice publication/audience referencing canonical events; no independently editable per-class copies.

The school calendar is inside **Global Announcements for all seven approved school roles**, including staff without a class. Private class views retain member/guardian/assigned-staff scope. Public projection requires deliberate approval.

**Consequences:** Shared calendar presentation adopts Hooma Athletes → Communities month arrows/Today/selected date/markers/agenda/authorized edit/cancellation interactions using KRISTOU styles and existing navigation. No import of Hooma sports permissions, Prisma/runtime topology, Photo Board or Whistle Board. Use Africa/Tunis, date-only all-day holidays and every affected date of multi-day spans; retain cancellation reason/original context/replacement references. RSVP/acknowledgement are not Attendance or physical release.

**Open gates:** DG-08/DG-14 before register/session granularity, editor/lifecycle/reminder/acknowledgement details. CAL-01/02/03 and COM-01/02/03. No complete timetable engine or new schema is implied.

## ADR-019 — Independent teacher Attendance and separate parent justification

**Status:** Accepted.

**Decision:** Attendance owns register entries/corrections and absence-justification decisions, referencing canonical pupil and academic teaching context. Different teachers have **independent registers** on the same class/date; Teacher A cannot overwrite Teacher B. Class/day alone is insufficient. One counted pupil entry per approved register identity; correction history does not create a second counted entry.

Present/Absent/Late/Excused are pupil states; untouched entries show Not recorded. Teaching-session lifecycle is separate. Parent explanation/attachment and authorized staff decision are distinct; submission does not set Excused. The actual recording/correcting actor remains separate from responsible Teacher.

**Consequences:** Profile/history/reports read the same entries. Cancelled sessions/unrecorded registers are not absences; one lesson absence is not automatically whole-school-day absence. Attendance cannot authorize collectors or release pupils.

**Open gates:** DG-08 for register unit, repeated lessons by the **same teacher on one day**, correction/finalization, Parent/Student visibility, Late/Excused treatment and denominator; DG-09 for cover/history edits. ATT-01…05 depend on People/Academics/Family and permitted Media. Do not silently choose a daily/per-period unique key or percentage.

## ADR-020 — Effective assignments and preserved academic-year history

**Status:** Accepted.

**Decision:** Academics owns effective teacher/substitute/student assignments. Temporary cover identifies real substitute, original responsible context, class/subject/session, start/end and permitted actions. No shared credentials, new role or unbounded historical access. Current server-time checks deny covered reads/writes before start, after expiry or revocation.

Rollover, promotion/retention/transfer/withdrawal and enrollment renewal use preview then explicit audited, retry-safe confirmation through owning academic/enrollment operations. End old current scope without overwriting prior memberships, Teachers, Attendance or report versions. Never copy old marks as new results or auto-approve accounts/guardian/collector links.

**Consequences:** Current access and historical attribution are separate. Ending access does not delete valid history; historical access has its own policy. Substitutes retain responsible Teacher separately from actual actor.

**Open gates:** DG-09/DG-15 for co-teaching, overlaps/replacement, corrections, transition rules and historical audiences. CAL-04, YEAR-01/02 and downstream ATT/GRD/Profile/report consumers.

## ADR-021 — Assessment owns grades, report publication and educational remarks

**Status:** Accepted.

**Decision:** Assessment owns assessment definitions/results, subject/report calculations, report-card review/publication and educational Teacher remarks. It references People and canonical academic assignment/year/class/subject; it does not own another roster, Parent Notes or editable Profile totals.

**Consequences:** Assigned teachers and authorized academic corrections have explicit scope. Parents/Students see only their permitted child’s/own published outputs. Drafts/restricted remarks are denied. Missing results are not implicitly zero; published results retain source/policy/version provenance and cannot silently change through draft edits. Remarks are distinct from Attendance notes and restricted safeguarding/clinical/disciplinary dossiers.

**Open gates:** DG-11/DG-12 for school terms/scales/weights/rounding/missing/exempt rules, review/publication/correction and remark fields/audiences/retention. GRD-01…04. No national/school formula or physical table is chosen by this ADR.

## ADR-022 — Recovery and contact verification preserve canonical identity

**Status:** Accepted.

**Decision:** Identity owns provider-backed recovery/contact change for username/email and phone-backed username users, including lost-contact cases. Contact display/edit, ownership proof and verified Auth alias activation are separate.

**Consequences:** Recovery retains canonical account/roles/links. No identity merge, private-contact handle lookup, password reading, fabricated alias or unrestricted admin reset bypass. School-assisted recovery requires its verified operator/proof/audit policy. Phone verification never introduces direct public phone login.

**Open gates:** DG-10 for supported channels/proofs, expiry/replay/rate limits, session handling and operator process. REC-01/02 and ACC-01; accepting recovery does not claim any unimplemented channel works.

## ADR-023 — Emergency contacts and safety facts remain narrowly scoped

**Status:** Accepted.

**Decision:** People owns school-verified emergency contacts/minimal safety facts. Family owns guardian authority; Pickup owns collector authority. A contact is not automatically a guardian, account or AuthorizedPickupPerson.

**Consequences:** Only permitted staff receive the narrow task-relevant projection. Office/Teacher/Manager/Pickup access never implies full medical/enrollment/family dossiers. Public/class feeds and ordinary notifications exclude restricted details; Directory publishes only explicitly approved public fields.

**Open gates:** DG-13/DG-07 for precise fields/verifiers/editors/readers, custody restrictions, review/expiry/escalation and lifecycle. PRO-01/02 and any permitted Pickup consumers. No invented legal/consent policy or broad medical module.

## ADR-024 — Schema, RPC, generated types and UI release form one contract

**Status:** Accepted.

**Decision:** Each authorized vertical slice synchronizes actual schema/grants/RLS/API/function contract with one generated Supabase TypeScript type owner, typed adapters/validators and every affected UI consumer. Generate from the **exact tested schema**, with reproducible command and fingerprint; freeze actual path/interfaces after current-source inspection.

**Consequences:** Replay reviewed migrations in clean isolated Supabase and exercise ordinary allowed/denied principals. Detect absent tables/columns, renamed parameters, stale types, missing grants/exposure and incompatible payloads. Handwritten or cast types are not database authority and cannot justify creating absent tables. Compilation/source guards cannot replace real API/DB/storage/realtime tests and readback.

Compatible backend dependencies precede dependent frontend release. Verify actual installed schema/handler and deployed frontend version with recovery/forward-fix. No blind migration replay/history repair/db push or protected Telegram redeployment.

**Dependencies:** Existing parity/governance closeout and each new feature apply this gate. F0-R1/R2, GOV-C1, OPS-01 and owning feature packets; backend implementation remains paused during DOC-D4.

## ADR-025 — Complete existing entry points through canonical owners and projections

**Status:** Accepted.

**Decision:** Existing Governance & Access, School Operations and every role-home/card/menu/form/bell/footer action must reach its actual owning operation and correct permitted destination. UI-01/UI-02 trace the master’s 80-card register **and nested controls** through contract, verified scope, persistence, truthful feedback/readback and acceptance.

Reports/exports and Control Center are authorized source projections, not another editable ledger or unrestricted query layer. School Settings orchestrates domain-owned policy/configuration, not a generic blob. Office/staff work queues reuse admission/inquiry/domain operations; DG-19 identifies owner/lifecycle/scope before any genuinely new request persistence.

**Consequences:** Open/Pending backend/Coming soon are presentation states, not completion. My Profile is not Home; Messages is not Parent Notes. No production mock fallback or false saved/sent/released result. Preserve current eight homes/design/logo, Owner Teachers → Classes → Registration, stable LTR shell and non-impersonating oversight. A Manager’s inspection permission never grants mutation authority.

**Dependencies:** ACC-01, CFG-01, CTR-01, STF-01, REP-01 and owning feature packets. DG-07/DG-16 for scoped/audited/formula-safe exports and DG-19 for staff placeholders. Labels create no bus/HR/medical/ERP expansion.

## ADR-026 — Production readiness is measured behavior and recoverability

**Status:** Accepted.

**Decision:** Scale through small typed boundaries, bounded/paginated queries/imports/exports, meaningful indexes, transactional invariants, safe retries and measured load/error behavior. No speculative cache/worker fleet/microservices or additional runtime solely because the goal says scalable.

**Consequences:** Isolated CI/staging proves the relevant migrations, grants/RLS, API/contracts, durable readback and mobile/trilingual/theme/accessibility Browser/Telegram workflows at the exact candidate. Database, objects, configuration and identity dependencies belong in the approved restore scope; database backup presence alone is not Storage-byte recovery. Rehearse restore/readback in isolation with rollback/forward-fix, monitoring/alerts, delivery retry and incident ownership.

Keep Pickup backend-blocked until its isolated/staging safety acceptance and explicit activation. A committed business transition with delayed notification remains committed; show truthful delivery uncertainty rather than fake rollback or duplicate release.

Document validation, Node mocks/source guards, table existence, a build or hosted status cannot certify production readiness. Preserve valid Owner manual acceptance while testing the remaining enforcement/concurrency/release gaps.

**Open gates:** DG-05/DG-07/DG-16 for isolation, lifecycle, measurable targets, recovery scope/objectives and operational ownership. OPS-01…03, REP-01, F4-P3 and F5-V1…V3. No invented SLA or paid service activation.

## ADR-027 — Optional queued Table Editor review for authorized manual row work

**Status:** Accepted as an optional operator tool; no setting or data action enabled by this ADR.

**Decision:** Use Supabase’s queued Table Editor operations as a review aid when an authorized packet actually calls for manual row corrections or synthetic test-data preparation: confirm target/environment, queue intended row changes, inspect the full diff, deliberately save and verify readback. Supabase documents batching inserts/edits/deletes with diff review and saving in a single transaction.

**Consequences:** This is a dashboard editing aid, **not** the business outbox, notification queue or an app feature. It does not replace versioned schema migrations, domain invariants, approval/Attendance/Pickup workflows, audit or real allow/deny/concurrency acceptance. Normal business operations continue through their authorized application/RPC boundary; exceptional data repair needs its own bounded packet. Do not bypass the current backend pause, edit real users as test fixtures, or infer migration history/rollback/validation from a pending diff.

**Source:** [Supabase — Queue table inserts, edits and deletes](https://supabase.com/changelog/42460-queue-table-inserts-edits-and-deletes-on-the-table-editor), published 2026-02-04, inspected 2026-11-14. The current UI controls enablement; this research did not enable or exercise the feature on KRISTOU.

## Decision-gate index and accepted additions

Feature inclusion is settled; unresolved school policies remain the same DG identifiers from the master. References are not additional tasks or execution permission.

| Gate | Remaining decision / acceptance |
| --- | --- |
| DG-01 | Remaining status/lifecycle UX acceptance; SUSPENDED already exists |
| DG-02 | Identifiers/import template, matching/conflicts/limits and atomic-versus-partial behavior |
| DG-03 | Admission documents/eligibility/age/year rules; verify legal claims |
| DG-04 | Effective multi-active-role precedence and privileged targets |
| DG-05 | Real isolated ordinary RLS/two-session concurrency environment |
| DG-06 | Pending/rejected/suspended/revoked experience and stale-session denial within protected Telegram scope |
| DG-07 | Minor/media/audit/backup retention/archive/export/deletion |
| DG-08 | Attendance register unit/same-Teacher repeats/correction/visibility/Late/Excused/denominator |
| DG-09 | Substitute/co-teacher/effective scope/reassignment/history edits |
| DG-10 | Recovery/contact proof/channels/operator/sessions |
| DG-11 | Terms/scales/weights/rounding/missing/exempt/report review/publication |
| DG-12 | Educational remarks versus restricted fields/audiences/correction/retention |
| DG-13 | Emergency/safety fields/verification/access/custody/review/escalation |
| DG-14 | Calendar editors/week start/types/cancellation/reschedule/reopen/reminders/acknowledgement |
| DG-15 | Promotion/retention/transfer/withdrawal/history |
| DG-16 | Measured performance/restore/recovery/export/monitoring/incidents |
| DG-17 | Operational-message participants and moderation/abuse policy |
| DG-18 | Optional AI provider/tools/data/cost/activation |
| DG-19 | Exact office/staff request/assignment/status/data scope and placeholder disposition |

| Accepted addition | Decision records |
| --- | --- |
| School calendar, holidays and cancelled sessions | ADR-018 |
| Temporary substitute assignments | ADR-020 |
| Parent absence justification/staff decision | ADR-019 |
| Academic-year rollover/history | ADR-020 |
| Recovery and verified contact changes | ADR-022 |
| Emergency contacts/minimal safety | ADR-023 |
| Grades/report cards/Teacher remarks | ADR-021 |
| Operational reports and recovery procedures | ADR-025/026 |

Still excluded: multi-school tenancy, student private DMs, tuition/payments, transport/bus operations, lunch ordering/payment, automatic QR/face/geofence pickup, broad medical cases and autonomous AI administration. Optional AI remains an authorized API client under approved later scope, with DG-18 before activation.

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


## Documentation boundary and continuation

DOC-D4 reconciles this decision record only. Its checks establish document consistency, supersession, references and protected scope; they do not test or implement the app. The master, requirements, structure, canonical model and all code/schema/config/accounts remain unchanged by this packet. Local documentation is not a merged/deployed release.

Next proposed document: **AGENTS.md (DOC-D5)**, only upon explicit instruction. Do not update another document/master/progress, change PR #15, enable Table Editor preferences or resume backend work automatically.

## ENROLL-D01 — explicit admission completion (2026-11-27)

ENROLL-D02 continuation: separate review/completion/history presentation; reuse People
directory readers, Academics memberships and Family links for explicit administration.
Admission authority does not imply roster/placement/guardian-management authority.
Verified Telegram routes these bounded operations through existing authenticated-role
gateway transactions. Backend migration and gateway release precede dependent UI.

The latest Owner-authorized PR 1 adds an Enrollment-owned completion receipt and audit
to bridge accepted applications to existing People identity and verified Family links.
It does not invent another student/guardian/class owner. An application can be ENROLLED
only with a canonical student and active admission-completion record; class placement
and annual enrollment/renewal remain separate. Explicit existing-student selection is
supported; no name/email/contact account matching. Legacy status-only ENROLLED rows may
be repaired through the same atomic RPC, never by a silent bulk backfill.

Completion/review permits approved APP_ADMIN, MANAGER, ADMINISTRATIVE_PERSONNEL and
SCHOOL_STAFF with an existing active ENROLLMENT_REVIEW delegation, as explicitly directed
for ENROLL-D01. This does not broaden class/roster, account governance or Pickup authority.
The attached Parent account uses existing submitted_by_user_id, while parent_child_links
retains Family write authority. Repeats return the same student/receipt without repeated
audit/notification; conflicting identity/verification intent fails closed. See the dossier
plan for exact scope and progress.md for actual CI/hosted evidence and remaining UI work.
