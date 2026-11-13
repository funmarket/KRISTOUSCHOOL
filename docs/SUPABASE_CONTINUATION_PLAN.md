# KRISTOU SCHOOL — SUPABASE-FIRST CONTINUATION PLAN
> **SUPERSEDED LIVE SNAPSHOT (2026-11-13):** Section 1.2 below describes the 2026-11-11 historical state, NOT the present live backend. Fresh inspection found five live migration records (including atomic Telegram link and canonical account roles), revoked authenticated challenge SELECT, a present atomic link RPC and Edge Functions v6/v9/v6. Do not apply the old 'missing' atomic migration or downgrade deployed auth handlers. Newest proposed packet order is in the Owner handoff; current-state evidence lives in `docs/CURRENT_STATE_AND_HANDOFF_2026-11-13.md`. Existing phases below are historical proposals, not active commands.


**Status:** Proposed execution plan for review; no remote database mutation is authorized by this document.
**Backend direction:** Supabase PostgreSQL, Supabase Edge Functions, private Supabase Storage when needed.
**Frontend:** one canonical React/TypeScript product for Browser and Telegram WebView.
**Primary goal:** move from the current mock-driven UI to safe, tested vertical slices without duplicate ownership, accidental data deletion, or historical-provider drift.
**Deployment boundary:** this plan serves KRISTOU SCHOOL only. It does not design support for additional schools, a school signup registry, inter-school membership, or data shared between schools.

**Telegram account-flow clarification (2026-11-11):** the owner approved app-account signup/sign-in through the shared app (including its Telegram WebView) followed by explicit Web-account-to-Telegram linking. Telegram `initData` confirms that one-time link; it does not provision a new account or issue a Supabase session. The older Telegram-first provisioning/session alternatives in this historical plan are superseded for the current slice. Future protected Telegram domain operations still require their own reviewed authorization path.

---

## 1. Current-state diagnosis

### 1.1 What exists locally

The current app combines a mock-driven school-domain prototype with a partial Supabase authentication foundation:

- one Vite/React app and shared Browser/Telegram shell; school feature views and most data remain mock-driven;
- a browser Supabase client contract that fails closed when URL/key configuration is absent;
- source for Supabase Auth signup/sign-in, the Auth-backed profile/role foundation, username sign-in, and explicit one-time Telegram account linking;
- source migrations for `authentication_foundation` and atomic Telegram linking; this reconciliation branch additionally carries the two reviewed trigger-permission hardening migrations from PR #9;
- source Edge Functions for username sign-in, authenticated challenge creation, and Telegram link confirmation;
- focused Node verifier tests plus a new synthetic-fixture pgTAP test and pinned local database scripts;
- no implemented private school-domain backend slice; the local pgTAP suite cannot yet be run here because Docker is unavailable.

### 1.2 What exists remotely

The active project is `KRISTOUSCHOOL` (`ofppapwofhovhroyjtkc`, `eu-west-3`, `ACTIVE_HEALTHY`). Its public schema contains `profiles`, `role_assignments`, `telegram_identities`, and `account_link_challenges`; all were reported RLS-enabled and empty. Live migration IDs are `20261110212125 authentication_foundation`, `20261110212204 revoke_auth_trigger_execute`, and `20261110212239 revoke_auth_trigger_execute_public`. The repository filenames use different versions, and `20261111030000_atomic_telegram_account_link` is absent remotely.

The live `authenticated` role still has `SELECT` on `account_link_challenges`, despite source revoking it. The live security advisor returned no lints, but that does not resolve the grant/source mismatch. All three live Edge Functions are active at v5; deployed `telegram-auth` is the older request-body `linkCode`/incorrect-HMAC implementation and does not call the source-controlled atomic RPC. No production migration or function change was made during this reconciliation.

### 1.3 Immediate architectural mismatch

The hosted schema is now a small auth foundation, not the unrelated 49-table project described by an older supplied reference. The remaining risk is history/runtime drift, not a broad legacy-table family. Do not run `db push`, `migration repair`, or a production function deployment until a non-destructive version mapping is reviewed and the owner authorizes the exact action.

Separately, the published Vercel bundle was read-only inspected: it contains the Supabase configuration error path but neither the expected project URL nor an actual publishable/anon key token. The signup error is consistent with missing `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` during the Production build. Vercel's private settings were not inspected; the owner should set those public build values and redeploy.

---

## 2. Plan invariants

These are hard gates, not suggestions:

- no remote table/data deletion, rename, truncation, or cascade cleanup during the current build phase;
- no direct browser access to private public-schema tables until grants, RLS, identity mapping, and deny tests are complete;
- no real school data in local seed fixtures;
- Web email/phone/username credentials must use the source-controlled Supabase Auth/profile foundation; no browser-side username contact lookup;
- no separate Browser/Telegram app, store, router, or API authority;
- no frontend-only role authorization;
- no `service_role` or database secret in `src/` or Vite output;
- no feature migration without a domain owner, access matrix, test plan, and rollback/forward-fix plan;
- no “done” claim based only on a page, button, model, mock, or successful build; the authentication foundation is not evidence that private school domains are secure.

---

## 3. Target topology

Keep the current repository small and add only proven boundaries:

```text
KRISTOUSCHOOL/
  src/
    components/                         # presentation and feature UI
    context/                            # temporary presentation/session composition only
    i18n/                               # language dictionaries and locale helpers
    lib/                                # public client/composition helpers only
    features/<domain>/                  # add when a feature boundary is proven
  supabase/
    config.toml
    migrations/                         # ordered schema, constraints, grants, RLS, SQL functions
    seed.sql                            # synthetic-only local data
    functions/<capability>/             # narrow Edge Function transport/composition
    tests/                              # pgTAP/RLS and database integration tests
  tests/
    frontend/
    functions/
    contracts/
  docs/
```

Do not turn `src/context/AppContext.tsx` into the permanent global backend store. Replace it gradually with domain-specific data hooks/clients as each vertical slice becomes live.

A future server-side function should be shaped like:

```text
supabase/functions/<capability>/index.ts   # HTTP parsing, auth context, composition
application/domain operation                # explicit use case and cross-domain ports
policy/domain rules                          # no HTTP or Supabase client dependency
PostgreSQL/RLS/storage                       # durable authority and enforcement
```

---

## 4. Ordered execution phases

### Phase 0 — Repository, deployment boundary, and provider cleanup

**Purpose:** remove stale assumptions before any backend code is added.

Tasks:

1. Keep `funmarket/KRISTOUSCHOOL` as the only implementation authority for KRISTOU SCHOOL.
2. Do not add other schools, routing for additional schools, or identities shared between schools.
3. Keep `funmarket/Kristou` read-only and historical.
4. Ensure current repository docs contain no superseded provider names, service labels, deployment variables, endpoints, or historical live claims.
5. State clearly that Supabase is backend/database/function/storage direction, while frontend hosting remains a separate future decision.
5. Keep `requirements.md`, `structure.md`, `docs/DECISIONS.md`, `docs/CANONICAL_MODEL.md`, `docs/SUPABASE_BACKEND_IMPLEMENTATION_PLAN.md`, and `progress.md` consistent.

**Gate:** repository search shows no obsolete provider references in the current project; docs distinguish target direction from verified integration.

**Do not:** rewrite historical reference repository files or claim that the remote project is now migration-managed.

---

### Phase 1 — Local Supabase toolchain and evidence baseline

**Purpose:** make local database work reproducible before remote changes.

Tasks:

1. Pin the CLI invocation; this branch uses `npx --yes supabase@3.1.0` and verifies the CLI version.
2. Run `npm run db:start`, `npm run db:reset`, and `npm run db:test` with Docker available. In the current environment the CLI is present through `npx`, but Docker is absent, so database reset/tests remain unverified.
3. Keep the pinned package scripts and synthetic-only pgTAP fixtures; no real school data belongs in tests.
4. Keep `.env.example` limited to placeholders for public URL/publishable key and server-only secret names.
5. Keep `supabase/seed.sql` empty or synthetic-only; no actual children, families, staff, medical data, enrollment documents, or pickup records.
6. Maintain `docs/REMOTE_SCHEMA_INVENTORY.md` as a read-only inventory of the authorized project, exact migration IDs, grants, RLS state, and runtime drift.
7. Add a schema inventory test or script only if a subsequent feature requires it; do not create legacy-table cleanup behavior.

**Deliverables:**

- reproducible local config;
- pinned CLI and package commands; clean local reset/test is pending Docker;
- synthetic seed policy;
- read-only live schema/migration/function inventory;
- synthetic pgTAP allow/deny tests;
- documented mismatch between local migration filenames and live history.

**Gate:** clean local checkout resets deterministically, pgTAP allow/deny assertions pass, and the remote history can be read without mutation. This gate is not yet passed because Docker is unavailable here.

---

### Phase 2 — Remote schema reconciliation, non-destructive only

**Purpose:** establish what the remote tables mean before writing a migration baseline.

Tasks:

1. Preserve the exact read-only live table, RLS, grant, routine, advisor, and Edge Function evidence in `docs/REMOTE_SCHEMA_INVENTORY.md`.
2. Map each live migration name/version to its repository filename and compare the actual migration contents before selecting a baseline strategy.
3. Resolve the three version-ID mismatches without deleting objects or falsely marking a migration applied; the atomic-link migration is source-only and absent remotely.
4. Do not merge PR #9 as-is: port only its reviewed trigger-hardening migrations, `SERVICE_ROLE_KEY` compatibility, and current deployment guidance. Do not reintroduce its older Telegram handler/verifier or remote-state assumptions.
5. Keep existing live tables and data untouched. Do not create duplicate identity tables or add private school-domain tables during reconciliation.
6. Prepare a non-destructive migration-history mapping/baseline proposal for review. No remote migration/history repair is part of this branch unless separately authorized.

**Deliverables:**

- `docs/REMOTE_SCHEMA_INVENTORY.md` or equivalent authoritative inventory;
- exact live-to-local migration version map and source/function drift summary;
- non-destructive baseline proposal;
- list of unknowns requiring owner approval;
- no remote changes.

**Gate:** migration history is reconciled in a reviewed plan, local migrations and pgTAP tests pass, and every table used by the first vertical slice has a known owner, schema shape, grant state, and access policy plan. No remote mutation is implied.

---

### Phase 3 — Web identity/session and explicit Telegram-link validation

**Purpose:** validate the already-accepted and source-implemented Supabase Auth credential mapping and explicit Telegram identity linking; do not reopen the product policy or confuse source with deployment.

The product policy is not open for replacement:

- Web uses email, full international phone number, or normalized username + password;
- username resolution is server-side and contact identifiers are not exposed to the browser;
- a signed-in shared-app account may link Telegram through server-validated Mini App `initData`;
- Web and Telegram identity records attach to one canonical User;
- account linking is explicit, expiring, one-time, conflict-failing;
- no heuristic merge.

The local/source verification must answer:

1. How Supabase Auth handles the shared-app email/phone credentials, sessions, expiry, and logout.
2. How username normalization/uniqueness and the server-side username resolver avoid exposing contact identifiers.
3. How generic errors, rate limits, and account conflict behavior work.
4. How fresh Telegram Mini App `initData` is HMAC-validated for the explicit link confirmation and bot-token secrecy is preserved.
5. How the Web-created challenge is one-time, expiring, hashed at rest, atomically consumed, and bound to the authenticated Web user.
6. How Telegram identity conflicts fail closed without heuristic account merging.
7. Which future school-domain operations require additional server authorization beyond this link-confirmation slice.

**Current evidence:** product behavior is captured in ADR-012/ADR-015 and the source link flow is in PR #10/main. The deployed `telegram-auth` v5 is stale and does not implement that contract; see `docs/REMOTE_SCHEMA_INVENTORY.md`.

**Remaining deliverables:**

- local Edge Function request tests for authentication, replay/conflict, CORS, and malformed `initData`;
- successful clean database reset and pgTAP allow/deny test run;
- an explicit source-versus-live deployment comparison.

**Gate:** local function/database verification is clean. Any hosted function/migration deployment remains a separate, explicitly authorized task.

---

### Phase 4 — Foundation schema and security baseline

**Purpose:** make the minimum identity/access foundation reproducible without touching existing remote data destructively.

Foundation concepts:

- User;
- WebCredential;
- WebSession;
- TelegramIdentity;
- AccountLinkChallenge;
- RoleAssignment;
- CapabilityGrant;
- AuditLog;
- OutboxEvent;
- Preferences.

Tasks:

1. Reconcile these against existing remote tables instead of blindly creating duplicates.
2. Add only missing constraints/indexes/functions through reviewable migrations.
3. Ensure timestamps use timezone-aware types for instants; use `Africa/Tunis` only for business-time calculations.
4. Define safe ownership and write paths for credentials/sessions/challenges.
5. Lock browser access to private tables until verified identity/RLS design exists.
6. Add pgTAP or equivalent allow/deny tests for the foundation.
7. Add secret scanning and generated-type checks before frontend connection.

**Gate:** clean local reset passes; foundation constraints are tested; no browser path can read or mutate credential/session/access-control tables without verified design.

---

### Phase 5 — Public Directory vertical slice

**Purpose:** deliver a low-risk live slice without private child/family data.

Recommended first slice: public Teachers/Administration directory, if the owner confirms the current public content is approved.

Ownership:

- People owns internal teacher/manager profiles.
- School Directory owns public presentation cards, biographies, ordering, visibility, and approved public media references.
- Media owns bytes/descriptors only.

Dependencies:

```text
Public request
  -> narrow public read function or deliberately public RLS view
  -> School Directory projection
  -> approved public media references
```

Tasks:

- define read-only public contract;
- add localized fields/translation strategy where required;
- ensure internal phone/contact/identity fields are excluded;
- test anonymous allowed rows and private-field denial;
- add loading/empty/error states;
- replace mock directory reads only after the backend contract is proven.

**Gate:** no private People fields leak; one canonical directory owner; frontend has no mock fallback for the live slice.

---

### Phase 6 — Parent-scoped class read

**Purpose:** prove the first private authorization path without mutations.

Dependencies:

```text
verified actor
  -> Access Control
  -> Family parent-child link
  -> Academics active student membership/class
  -> Class Community read model/content
```

Tasks:

- define an access matrix for parent, student, teacher, manager, admin, unauthenticated, and cross-class actors;
- expose only linked children and active classes;
- test cross-parent, cross-child, inactive-membership, and unauthenticated denial;
- add server-side route/function authorization and RLS tests;
- connect one Class Community read surface through typed contracts.

**Gate:** private reads are server-scoped and deny tests pass. Do not add Parent Notes or pickup mutations yet.

---

### Phase 7 — Parent Notes

**Purpose:** implement a bounded parent-to-school communication slice with explicit policy.

Rules:

- 11 parent-originated notes per day;
- send window `08:00 <= time < 18:00` in `Africa/Tunis`;
- quota reset at 08:00 `Africa/Tunis`;
- parent may tag only linked children;
- teacher tag must belong to the class when required;
- replies do not consume parent quota;
- note privacy is limited to linked guardian(s), relevant teacher(s), and authorized staff.

Dependencies:

```text
Identity + Access
  -> Family child scope
  -> Academics class/teacher assignment
  -> Parent Notes command
  -> PostgreSQL durable note + quota transaction
  -> Outbox/Notifications projection
```

Use a transaction-safe database operation for quota and note creation. Redis may assist with transient counters/locks only after durable semantics are established; Redis must not be the only record.

Tests:

- 11th allowed, 12th denied;
- exact time boundaries;
- concurrent sends;
- cross-child/teacher denial;
- reply authorization;
- notification failure does not roll back the note;
- no private note body leaks in notification projections.

---

### Phase 8 — Class Community mutations and questions

**Purpose:** add teacher content and student class-wide questions without creating duplicate roster authority.

Scope:

- ClassAnnouncement;
- Homework/Classwork;
- ClassCalendarItem;
- ClassQuestion/ClassQuestionReply;
- moderation/reporting/audit where required.

Rules:

- canonical Class comes from Academics;
- active membership is required for student access;
- assigned teacher authority is class-scoped;
- questions/replies maximum 200 characters;
- no private student DMs initially;
- moderation and safeguarding access is explicit;
- content can be rendered through one shared frontend in Browser and Telegram.

Tests:

- correct class access;
- outsider/cross-class denial;
- teacher assignment denial;
- 200/201 boundary;
- moderation;
- membership removal immediately removes access;
- duplicate/concurrent writes where relevant.

---

### Phase 9 — Messaging and Notifications

**Purpose:** implement short operational communication without bypassing Parent Notes.

Messaging owns only approved short operational threads/messages. It must not become a private student DM system or a Parent Note loophole.

Notifications own recipient/read/delivery projections only. Source domains remain authoritative.

Tasks:

- define allowed participant/context combinations;
- 200-character validation;
- notification target route/resource reference;
- outbox event for durable side effects;
- idempotent delivery/retry;
- safe summaries that do not copy unauthorized private bodies;
- read/unread and expiry behavior;
- test delivery failure and retry without source mutation.

---

### Phase 10 — Food Menu, Public Content, Registration, and Media

Implement only after foundation/public/private access gates.

#### Food Menu

- weekly/daily structure;
- provider attribution `La Toque Gourmande`;
- DRAFT/PUBLISHED/ARCHIVED lifecycle;
- translated content fields;
- Admin or explicit Manager capability for writes;
- public/parent/student reads based on publication/access rules;
- optional menu image/meal photos through Media.

#### Public Content

- home/about/activities/clubs/pedagogy;
- approved public gallery/calendar;
- no private class/family records;
- localization strategy for school-managed content.

#### Registration

- public inquiry/application entry;
- DRAFT -> SUBMITTED -> UNDER_REVIEW -> NEED_DOCUMENTS -> UNDER_REVIEW -> ACCEPTED/WAITLIST/REJECTED -> ENROLLED;
- acceptance does not itself create class access;
- document requirements and age windows configurable;
- private documents use private Storage and strict policies;
- legal/Tunisian requirements must be verified before being presented as facts.

#### Media

- private buckets by default for child/family/class/enrollment assets;
- public assets require explicit public owner;
- signed access only after authorization;
- metadata stripping/type/size/retention rules;
- test cross-child download/upload/overwrite/delete denial.

---

### Phase 11 — Pickup, last among the sensitive first-wave slices

Pickup should not be implemented as a mock-to-live shortcut. It requires the strongest cross-domain and concurrency proof.

Dependencies:

```text
Identity
  -> Access Control
  -> Family parent/authorized-pickup scope
  -> Academics student/class/teacher assignment
  -> Pickup dismissal window + state transition
  -> PostgreSQL atomic event/state + Audit + Outbox
  -> Notifications/live board projections
```

Parent arrival command must verify:

- actor/session;
- parent-child or authorized pickup relation;
- active student enrollment;
- correct class;
- server-side dismissal window;
- valid approved pickup person;
- child not already released.

Staff release command must reverify:

- staff identity;
- staff capability/class authority;
- current state `PARENT_ARRIVED`;
- valid pickup authorization;
- not already released.

Tests must cover duplicate/simultaneous arrival, closed window, wrong child/class, unauthorized pickup person, unauthorized staff, double release, live-coordination outage, reconnect/current-state recovery, and audit creation.

Never use browser local state to decide release. Never let parent arrival directly set `RELEASED`.

---

### Phase 12 — Staging and operations

Only after local and vertical-slice gates:

- create isolated staging project/environment;
- configure protected secrets and origins;
- apply migrations in reviewed order;
- deploy Edge Functions after required schema compatibility;
- verify auth redirects, CORS, logs, storage, backups/PITR, rate limits, and audit;
- use synthetic data only;
- record exact source revision and migration version;
- require owner approval before any production data or protected migration.

Frontend hosting remains a separate decision. Do not infer it from the database platform.

---

## 5. Agent work packets / handoffs

### Agent A — Repository and documentation steward

**Mission:** keep source-of-truth docs consistent and eliminate stale provider assumptions.

**Reads:** all required documents plus this handoff.

**Owns:** `README.md`, `requirements.md`, `structure.md`, `docs/DECISIONS.md`, `docs/CANONICAL_MODEL.md`, `docs/LIVING_BUILD_PLAN.md`, `progress.md`.

**Must not:** change database schema, invent product policy, or rewrite historical reference repositories.

**Done when:** current docs contain no obsolete platform references; owner/LTR language/auth policy is consistent; progress records evidence only.

---

### Agent B — Local Supabase/toolchain steward

**Mission:** make local reset/migration/test workflow reproducible.

**Owns:** `supabase/config.toml`, local scripts, synthetic seed, local test harness, toolchain documentation.

**Depends on:** owner approval of the identity design only for auth-specific local configuration.

**Must not:** link or mutate the remote project; create real fixtures; apply the draft migration blindly.

**Done when:** clean local reset passes, seed is synthetic-only, commands are verified, and inventory output is reproducible.

---

### Agent C — Remote schema reconciliation steward

**Mission:** map the actual remote tables to canonical ownership without changing them.

**Owns:** schema inventory, table/owner matrix, mismatch report, baseline proposal.

**Depends on:** current read-only Supabase audit.

**Must not:** drop/rename/truncate tables, create duplicate canonical tables, or add allow policies.

**Done when:** every remote table is classified as canonical candidate, legacy, unknown, or infrastructure; unresolved ownership questions are explicit.

---

### Agent D — Identity/session design steward

**Mission:** produce the accepted Supabase-compatible shared-app username/password and explicit Telegram-link design.

**Owns:** ADR/threat model/sequence diagrams/auth contracts/test matrix.

**Depends on:** product requirements and current remote identity tables.

**Must not:** ship fallback login, synthetic email aliases, browser username lookup, heuristic merge, or protected allow policies before acceptance.

**Done when:** password/session/linking/conflict/claims/RLS identity representation are reviewed and approved.

---

### Agent E — Foundation security steward

**Mission:** reconcile foundation constraints, grants, RLS, audit, and outbox in migrations.

**Depends on:** Agents B, C, and D completed gates.

**Must not:** make dashboard-only changes, blanket-delete old tables, or expose private data.

**Done when:** clean local migration reset passes, grant/RLS allow-deny tests pass, and remote application is separately authorized.

---

### Agent F — First public vertical slice steward

**Mission:** connect public directory/content through a narrow, typed, server-safe boundary.

**Depends on:** foundation inventory and public access matrix.

**Must not:** read private People rows directly or create a global API/store.

**Done when:** anonymous/public allowed reads and private-field denial are tested; frontend no longer uses a mock fallback for that slice.

---

### Agent G — Private parent/class slice steward

**Mission:** prove linked-child and active-class scoping with a read-only class surface.

**Depends on:** accepted identity design, Access Control, Family, Academics, and RLS tests.

**Must not:** add Parent Notes/pickup shortcuts or trust client child/class IDs.

**Done when:** cross-child/cross-class/inactive/unauthenticated denies pass and the browser renders server-authorized data.

---

### Agent H — Parent Notes steward

**Mission:** implement the quota/time-window/private-note vertical slice.

**Depends on:** Agent G plus transaction/concurrency test support.

**Must not:** put quota only in the browser or cache, or make notifications authoritative.

**Done when:** boundary, concurrency, scope, replies, and notification failure behavior are proven.

---

### Agent I — Class Community/Messaging steward

**Mission:** implement class content, questions, moderation, short messages, and notification projections in ownership order.

**Depends on:** active class read path, teacher assignment, outbox foundation.

**Must not:** create a second roster, private student DMs, or cross-domain monolith.

**Done when:** access/moderation/length/notification tests pass.

---

### Agent J — Pickup safety steward

**Mission:** implement arrival/release state machine and live board only after all security gates.

**Depends on:** Identity, Access Control, Family, Academics, Audit, Outbox, and concurrency test infrastructure.

**Must not:** implement release in the frontend, trust device time, or use mock state as live authority.

**Done when:** all mandatory pickup acceptance tests pass and outage behavior fails closed.

---

## 6. Verification ladder

Use the strongest tier relevant to the claim:

### Tier A — Static

- source inspection;
- format/lint/typecheck;
- dependency/architecture checks;
- secret scan;
- obsolete-provider reference scan.

### Tier B — Focused behavior

- component tests;
- Edge Function unit tests;
- contract validation;
- deterministic policy tests.

### Tier C — Real integration

- clean local database reset;
- PostgreSQL constraints/transactions/concurrency;
- pgTAP RLS allow/deny;
- storage policy tests;
- function integration;
- disposable Redis only where transient behavior is truly used.

### Tier D — Runtime

- local frontend startup;
- Edge Function startup/health;
- Browser/Telegram shared frontend behavior;
- safe-area/mobile behavior;
- worker/outbox processing where implemented.

### Tier E — Hosted/staging

- exact source revision;
- migration state;
- function deployment;
- auth origins/CORS;
- synthetic smoke tests;
- logs/health/backups/PITR/rate limits.

A green build is only Tier A. It does not prove authorization, migrations, security, or deployment.

---

## 7. Recommended first three implementation tickets

### Ticket 1 — `schema-reconciliation-report`

Read-only only. Produce the table ownership/mismatch report and decide how to establish migration history without deleting the existing schema.

### Ticket 2 — `auth-identity-design`

Threat-model and document shared-app username/password plus explicit one-time Telegram identity linking. No production deployment or protected school-domain API authorization is implied.

### Ticket 3 — `local-supabase-reproducibility`

Pin CLI/tooling and prove clean local reset/test commands using synthetic data. Do not link or mutate the remote project.

Only after these three tickets pass their gates should the team select the first live public vertical slice.

---

## 8. Completion report template for every future agent

```markdown
## Task result
- Task ID:
- Branch / HEAD:
- Scope:
- Canonical owner:
- Dependencies verified:

## Files changed
- ...

## Database / Supabase
- Migrations:
- Grants/RLS:
- Functions/storage:
- Remote operations:
- Remote changes explicitly not performed:

## Verification
- Static:
- Focused tests:
- Local integration:
- Runtime:
- Hosted/staging:

## Evidence gaps
- ...

## Next decision/task
- ...
```

Do not report a feature as complete unless the applicable source, authorization, persistence, UI, integration, tests, documentation, and runtime layers are proven for that exact scope.
