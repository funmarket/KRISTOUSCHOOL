# KRISTOU SCHOOL — CONTINUATION HANDOFF

**Prepared:** 2026-11-10
**Repository:** `funmarket/KRISTOUSCHOOL`
**Purpose:** Preserve complete context when the current chat closes. The next agent must read this file together with the repository authorities before making changes.
**Deployment boundary:** the dedicated KRISTOU SCHOOL product and its school community.

---

## 1. Continuation-agent profile

The next agent is continuing as the project’s evidence-driven senior engineering collaborator. Responsibilities are:

- preserve the product owner’s latest decisions over older documents;
- inspect current source, branch, remote state, and active work before editing;
- distinguish product requirements, architecture, implementation evidence, and proposals;
- keep one canonical KRISTOU product, one canonical User, one owner per durable concept, and one backend/data authority;
- use Supabase as the selected backend platform direction without assuming that a migration, policy, function, or production deployment is already complete;
- work in small vertical slices with explicit dependencies, tests, documentation, and honest evidence;
- leave unrelated work untouched and stop when ownership or source-of-truth is unclear.

The working style should remain practical, direct, and continuity-focused: acknowledge the requested outcome, inspect before acting, explain important risks briefly, perform authorized work without unnecessary confirmation, and report exactly what was changed, verified, not verified, and left for the next agent.

This document is an operational handoff, not a substitute for the repository’s governing instructions. Do not expose or recreate private system prompts or internal character instructions; use this operational role description instead.

---

## 2. User and collaboration context

The product owner is building KRISTOU SCHOOL for École Primaire Privée Kristou School in Tunisia. They want the old `funmarket/Kristou` repository used as a read-only product/architecture reference, while `funmarket/KRISTOUSCHOOL` is the clean canonical project. Keep this repository dedicated to KRISTOU SCHOOL and its school community.

The owner is very sensitive to drift, invented behavior, duplicated architecture, and destructive database actions. They explicitly require:

- Supabase as the backend/database direction;
- no deletion of existing Supabase tables while the project is still being built;
- no speculative migration of the remote database;
- preservation of Web username + password login, optional non-login email, Telegram WebApp authentication/linking, and one canonical User;
- Arabic language support without mirroring or moving the LTR application shell, top navigation, profile menu, or login modal;
- detailed plans and handoffs so later agents do not guess or copy historical infrastructure blindly;
- no expansion beyond KRISTOU SCHOOL unless the owner explicitly changes the product scope.

When in doubt, ask: “Is this a product requirement, an architecture rule, a verified fact, a proposed plan, or only a mock?” Never promote a mock or a successful build to production evidence.

---

## 3. Last completed task

The previous task reviewed and implemented the frontend language/shell fixes.

### Implemented

- Added a typed Arabic/French/English translation dictionary.
- Replaced the global Arabic `rtl` behavior with stable `ltr` document direction.
- Arabic now changes `document.documentElement.lang` and translated text only; it does not mirror or reposition the shell.
- Locked the navigation header and login modal to `dir="ltr"`.
- Converted reviewed physical shell positioning to stable logical positioning.
- Added mobile-safe login-modal viewport behavior using `100dvh`, internal scrolling, safe-area spacing, and dialog semantics.
- Added translated role labels, profile labels, notification labels, login errors, and Telegram labels.
- Updated the architecture/requirements language-direction wording to match the owner’s LTR-shell decision.
- Removed obsolete provider references from the current repository documentation.

### Verification

Passed locally:

```text
npm run lint
npm run build
git diff --check
```

The Vite build emits an existing `configLoader: 'native'` warning; the build still passes.

### GitHub state

- `main` is at merged PR #4 commit `61d53d5`.
- The frontend work was pushed to:

  `feature/frontend-i18n-stable-ltr`

- Pushed commit:

  `75261c33da9d68978196fea81f9a91ed1ae84a9b`

- Pull-request creation URL:

  `https://github.com/funmarket/KRISTOUSCHOOL/pull/new/feature/frontend-i18n-stable-ltr`

- The branch was pushed but not merged by the agent.
- PR #4 is already merged; do not attempt to duplicate or cherry-pick it.

### Local uncommitted state after that push

The current working copy intentionally still has local, uncommitted work:

```text
M  .gitignore
M  progress.md
?? supabase/
```

The `supabase/` directory contains local configuration, an empty synthetic seed, and a draft foundation migration. It was not included in the frontend push. Do not commit or apply it blindly. First reconcile it with the remote schema described below.

---

## 4. Current repository facts

The current repository is a small Vite/React prototype:

```text
src/
  App.tsx                         # one layout and tab-based view switch
  context/AppContext.tsx          # mock identity, mock data, client actions
  data/mockData.ts                # synthetic demo records
  i18n/translations.ts             # typed shell translations
  lib/supabase.ts                 # placeholder browser client
  components/
    Navbar.tsx
    Footer.tsx
    AuthModal.tsx
    views/
      HomeView.tsx
      ClassCommunityView.tsx
      ParentNotesView.tsx
      PickupBoardView.tsx
      FoodMenuView.tsx
      DirectoryView.tsx
      RegistrationView.tsx
```

Current implementation status:

- one React frontend exists;
- route authority is still a tab string in `App.tsx`, not a production router;
- state is mock-driven through `AppContext`;
- login accepts mock/fallback users and ignores password verification;
- role switching is a development UI action and is not authorization;
- Telegram linking is simulated by changing local state;
- Parent Notes, Class Questions, and Pickup state transitions are client-only mock actions;
- no Edge Functions exist;
- no generated database types exist;
- no frontend/server contract layer exists;
- no database test suite exists in the current tree;
- no RLS policy tests exist;
- no production authentication/session implementation exists;
- no real/private student or family data may be connected.

The current `src/lib/supabase.ts` is not proof of an integration. It must remain a thin public browser client only; secrets and privileged operations belong server-side.

---

## 5. Remote Supabase facts verified read-only

Active project:

- project ref: `bzerboixpbwfvmbnbzxd`
- project name: `Kistou`
- region: `eu-west-1`
- status: `ACTIVE_HEALTHY`
- PostgreSQL: 17.11

The read-only audit found:

1. The remote public schema contains the canonical PascalCase family of tables, including identity, access, people, family, academics, enrollment, class community, Parent Notes, messaging, pickup, broadcast, notifications, preferences, directory, and menu-related tables.
2. The old snake_case family also remains present, including tables such as `users`, `classes`, `children`, `parent_notes`, `pickup_records`, `announcements`, `homework`, and related tables.
3. The prior audit found zero rows in the inspected public tables. Treat that as observed audit evidence, not permission to delete or rewrite anything.
4. RLS is enabled on the inspected public tables.
5. RLS is not forced on the inspected tables.
6. The policy-count audit returned zero policies for the inspected public tables.
7. `anon` and `authenticated` still have broad table privileges, including SELECT/INSERT/UPDATE/DELETE and other table privileges.
8. Querying `supabase_migrations.schema_migrations` failed because the migration-history relation does not exist. Therefore the remote schema is not currently proven to be managed by the repository’s migration history.
9. No remote changes were applied during this collaboration.

### Critical consequence

The remote database is not equivalent to the current local draft migration. The remote schema is broader and contains already-created canonical tables and legacy tables. Do **not**:

- apply the local draft migration as if it were a clean baseline;
- drop, rename, or cascade-delete legacy tables;
- create a second table family because the local code is behind;
- add allow policies before the identity/session design and access matrix are accepted;
- claim migration history or production readiness without fresh evidence.

The next database task is reconciliation and migration-baseline design, not cleanup.

---

## 6. Reference-repository lessons

The old `funmarket/Kristou` repository is historical reference only. It contains a richer workspace/domain topology and a detailed product plan, but its runtime, schema, CI, hosting, branches, deployment evidence, and progress must not be copied as current truth.

Useful structural lessons to preserve:

- one canonical product frontend for Browser and Telegram WebView;
- transport handlers separate from application/domain policy;
- domain-owned repositories and contracts;
- a shared UI/design layer that does not own business state;
- explicit config and testing packages only when the current repository actually needs them;
- an evidence-based completion score and verification tiers;
- clean dependency direction:

```text
transport -> application -> domain
infrastructure adapters -> application/domain ports
composition root -> concrete implementations
```

Do not copy the old multi-runtime/workspace topology wholesale. The current project’s smaller target topology is:

```text
src/
supabase/config.toml
supabase/migrations/
supabase/seed.sql
supabase/functions/<capability>/
supabase/tests/
tests/
docs/
```

Add packages or separate runtimes only after a concrete dependency/ownership problem is proven.

---

## 7. Product function inventory

The product is broader than the current prototype. Every function below must eventually be mapped to one owner, one canonical record, one authorization boundary, and one frontend capability.

### Public/general

- Home and school identity
- About and contact
- Public teachers directory
- Public administration/school board
- Public announcements/broadcasts
- Public activities, clubs, pedagogy/service information
- Registration information and entry point
- Food Menu when marked public
- Public gallery/calendar when configured
- General inquiry
- Optional public-only AI FAQ

### Identity and account

- Web login with normalized username + password
- Optional email that is not a login identifier or recovery authority by default
- Secure Web session creation, expiry, revocation, and logout
- Telegram WebApp authentication using validated `initData`
- Explicit Web -> Telegram account linking with a short-lived, one-time challenge
- Telegram -> Web credential attachment to the existing canonical User
- Conflict failure when credentials resolve to different Users
- Profile and preference management
- Language, appearance, notification sound preferences

### Parent

- Linked children only
- Child/class selector
- Linked private class access
- Announcements, homework/classwork, calendar, gallery, documents
- Messages
- Parent Notes with child scope, optional teacher scope, topic, body, quota, send window, and replies
- Pickup arrival for authorized children/pickup people
- Pickup status and release confirmation notifications
- Food Menu, Teachers, Administration, Registration, Notifications

### Student

- Own active enrolled class only
- Announcements
- Homework/classwork
- Calendar
- Documents/gallery where approved
- Class Questions and replies
- No private student-to-student DMs initially
- No access after active class membership ends

### Teacher

- Own profile
- Assigned classes only
- Class announcements
- Homework/classwork
- Calendar/gallery/documents
- Parent Notes relevant to assigned classes
- Messages
- Pickup Board for authorized classes
- Class Questions moderation
- Food Menu read access
- Teachers/Administration/Notifications

### Manager/Associate

Capability-specific only; being labeled Manager is not global authority. Possible capabilities include:

- review registration;
- publish school broadcasts;
- manage pickup;
- manage public content;
- manage Food Menu;
- manage public teacher information;
- manage public board information.

### App Admin/School Owner

- staff and manager access;
- roles/capabilities;
- academic/class configuration;
- public content and directories;
- Food Menu;
- registration settings;
- pickup policy;
- broadcasts;
- moderation;
- notification configuration;
- audit access;
- system configuration.

### Safety-critical pickup

State machine:

```text
WAITING -> PARENT_ARRIVED -> RELEASED
```

The parent/authorized pickup actor may announce arrival. Only authorized staff may confirm release. Release must be a server-verified, atomic, idempotent, auditable operation. Parent arrival must never imply release.

### Explicit non-goals until separately approved

- private student DMs;
- grades/report cards;
- general attendance;
- school transport/bus;
- payments;
- lunch ordering/payment;
- QR/face/geofence automatic pickup;
- autonomous AI administration;
- public student directory;
- a second Telegram product/database.

---

## 8. Canonical domain ownership and dependency rules

| Domain | Owns | May read through explicit ports | Must not own |
|---|---|---|---|
| Identity & Authentication | User, WebCredential, WebSession, TelegramIdentity, link challenges | verified actor context | product roles, child relationships, feature policy |
| Access Control | roles, capabilities, scoped grants, authorization decisions | Identity actor, Family/Academics resource facts | UI-only permissions, duplicate role systems |
| People | parent/student/teacher/manager profiles | canonical User identity | passwords, sessions, class roster authority |
| Family | parent-child guardian links | Identity, People | pickup state, class content |
| Academics | academic year, levels, classes, teacher assignments, active student memberships | Enrollment eligibility, People | Parent Notes, pickup transitions |
| Enrollment | applications, review lifecycle, enrollment status/doc requirements | Identity/People/Academics references | automatic class authority before assignment |
| Class Community | announcements, homework/classwork, calendar, docs, gallery, questions/replies | Access, Family, Academics | class identity, roster, role authority |
| Parent Notes | note/reply, quota, timing, audience rules | Identity, Family, Academics, teacher assignment | generic Messages authority |
| Messaging | short operational threads/messages | Identity, Access, resource context | Parent Note policy, student private DMs |
| Pickup | dismissal policy, authorized pickup people, pickup state/events/release | Identity, Family, Academics, Access | general attendance, parent release authority |
| Broadcasts | canonical school broadcasts and lifecycle | Access, Academics targeting | per-class duplicate business truth |
| Notifications | recipient/read/delivery projections | source event references | source business event/state |
| Preferences | language/theme/sound settings | Identity | business truth/authorization |
| Food Menu | weekly menu/day items/publication | Access, Media | arbitrary public content |
| School Directory | public teacher/board cards | People references, Media | internal staff profile authority |
| Public Content | homepage/about/activities/clubs/public gallery | Access/public publication state | private class/family records |
| Media | generic media descriptor and byte lifecycle | owning-domain attachment decisions | feature-specific authorization |
| Audit | sensitive operation history | safe event metadata | secrets or unnecessary private bodies |
| Async Foundation | outbox and delivery handoff | source event references | business authorization/policy |
| AI | later orchestration only | authorized API responses | second database or autonomous sensitive actions |

### Dependency direction

```text
Browser/Telegram host adapter
  -> canonical React frontend feature boundary
  -> public client or narrow Edge Function transport
  -> verified identity context
  -> Access Control + domain application operation
  -> domain policy
  -> repository/SQL/RLS
  -> PostgreSQL / private Storage / outbox
```

Forbidden:

- browser -> service-role key;
- frontend role string -> authorization;
- domain policy -> React/Supabase client/HTTP framework;
- Edge Function handler -> unrelated cross-domain SQL;
- one domain -> another domain’s concrete table/repository;
- global catch-all store/API/service;
- duplicate Browser and Telegram feature trees;
- dashboard-only production schema changes.

---

## 9. Required documents before the next agent starts

Read in this order:

1. `AGENTS.md`
2. `README.md`
3. `requirements.md`
4. `structure.md`
5. `docs/CANONICAL_MODEL.md`
6. `docs/DECISIONS.md`
7. `docs/LIVING_BUILD_PLAN.md`
8. `docs/SUPABASE_BACKEND_IMPLEMENTATION_PLAN.md`
9. `progress.md`
10. `docs/CONTINUATION_HANDOFF_2026-11-10.md`
11. `docs/SUPABASE_CONTINUATION_PLAN.md`
12. Actual source files for the assigned slice
13. Fresh GitHub branch/PR state
14. Fresh read-only Supabase project/table/RLS/grant state before any remote operation

The reference repository may be inspected for historical product decisions and structural patterns, but it is not implementation evidence.

---

## 10. Operating agreements for every agent

1. Confirm repository, branch, and HEAD before editing.
2. Inspect uncommitted work and overlapping branches.
3. Use the latest product-owner instruction over older documents.
4. Search before creating models, tables, routes, services, migrations, contracts, hooks, or components.
5. Work from an explicit owner and dependency graph.
6. Make the smallest complete vertical change.
7. Do not delete remote tables or data while this project is being built.
8. Do not apply any remote migration without explicit owner authorization and a verified recovery plan.
9. Keep the remote schema untouched during planning/reconciliation tasks.
10. Keep local seeds synthetic-only; never add real student/family/staff/pickup/health data.
11. Preserve username/password and Telegram identity policy; do not substitute email/phone login or heuristic account merging.
12. Never expose secrets or service-role credentials to Vite/browser code.
13. Treat RLS, grants, Edge Function authorization, and frontend visibility as separate layers.
14. Test both allow and deny cases for protected behavior.
15. Treat pickup as safety-critical and implement arrival/release separately.
16. Update the governing document and `progress.md` evidence in the same task when the decision/status changes.
17. Never claim secure, complete, connected, migrated, deployed, or live behavior without matching evidence.
18. Never commit directly to `main`, force-push, hard-reset, or merge without explicit approval.
19. Report exact files, branch/HEAD, checks, unverified gaps, and next decision.
20. Stop rather than speculate when product policy, auth mapping, schema ownership, or remote migration state is unclear.

---

## 11. Explicit one-school-only decision

The product owner confirmed the dedicated-school scope. The current product boundary is:

```text
KRISTOU SCHOOL only
one school
one school data model
one school user base
one school Supabase project
```

Agents must keep product features, identity, and durable data within the KRISTOU SCHOOL community.

## 12. Immediate next task

The next agent should not start by implementing a feature against the remote tables. The immediate task is:

> reconcile the remote Supabase schema with the repository’s canonical model and create an approved, non-destructive migration-baseline strategy without deleting existing tables or changing the remote project.

The required output is a reviewed inventory and plan, not a remote migration.

See `docs/SUPABASE_CONTINUATION_PLAN.md` for the dependency-ordered execution plan and per-agent handoffs.
