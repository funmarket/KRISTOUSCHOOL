# KRISTOU SCHOOL — CLEAN STRUCTURE AND DOMAIN ARCHITECTURE

Status: **PRIMARY ARCHITECTURE CONTRACT — CLEAN TARGET + VERIFIED CURRENT BOUNDARIES**

Revision: **2026-11-20**

Repository: **funmarket/KRISTOUSCHOOL**

Current recovery branch checkpoint used for this revision: **3117fbd6438b43a1b939decc5d42639d49c323ee**

Supabase project inspected read-only for this revision: **KRISTOUSCHOOL / ofppapwofhovhroyjtkc**

Product boundary: **one school, one React product, one Supabase backend/data authority, one canonical identity model, Browser and Telegram as two runtime contexts of the same application.**

---

## 0. Purpose and authority of this document

This document defines how the KRISTOU SCHOOL application must be structured so that future implementation stays maintainable, testable, secure, and free of duplicate ownership.

It is intentionally not a feature wishlist and not a claim that every target folder below already exists.

There are three kinds of statements in this document:

- **VERIFIED CURRENT** — observed in the current repository or installed Supabase project at the revision above.
- **CLEAN TARGET** — the required architectural direction for future work.
- **PLANNED / NOT INSTALLED** — accepted conceptual domain ownership whose physical persistence has not yet been established in the installed database.

When a CLEAN TARGET section proposes a future split, it is an architectural boundary, not automatic authorization to refactor the repository.

Accepted product behavior remains governed by requirements.md. Canonical data relationships and invariants remain governed by docs/CANONICAL_MODEL.md. Durable architecture decisions remain governed by docs/DECISIONS.md. Execution authorization and current task sequencing remain governed by the latest Product Owner instruction and docs/LIVING_BUILD_PLAN.md.

The purpose of structure.md is narrower:

1. define source boundaries;
2. define canonical domain ownership;
3. define dependency direction;
4. define where database authority lives;
5. prevent monolithic modules and duplicate business owners;
6. define how the current code should evolve without a rewrite.

---

# 1. Non-negotiable architecture principles

## 1.1 One product, not parallel applications

KRISTOU SCHOOL has one product implementation.

Browser and Telegram WebView use the same React application, the same domain contracts, the same canonical account model, and the same Supabase authority.

Telegram code may adapt:

- Telegram initData verification;
- launch/re-entry mechanics;
- explicit account-link transport;
- Telegram-specific host behavior.

Telegram must not own:

- a second role system;
- a second student model;
- a second router;
- a second backend;
- duplicate school feature logic;
- duplicate durable application state.

~~~mermaid
flowchart LR
  WEB["Browser"] --> APP["Canonical React Application"]
  TG["Telegram WebView"] --> APP
  APP --> AUTH["Supabase Auth / verified identity"]
  APP --> CONTRACTS["Typed domain contracts"]
  CONTRACTS --> SUPA["Supabase RPC / RLS / approved reads"]
  SUPA --> DB["PostgreSQL durable authority"]
~~~

---

## 1.2 One canonical owner per durable concept

Every durable concept has exactly one owner.

A UI screen may display fields owned by several domains, but the screen does not become the owner of those fields.

A context provider may compose state from several domains, but it does not become the database owner.

A compatibility barrel may export functions from several domains, but it does not become a business service.

No feature is allowed to create a second table, second type hierarchy, second state store, or second API merely because importing the canonical owner is inconvenient.

---

## 1.3 Dependency direction is inward toward domain contracts

The required direction is:

**UI → feature composition → domain adapter → server/database contract → durable owner**

Never:

**UI → arbitrary table queries → cross-domain mutation → local state pretending to be authority**

~~~mermaid
flowchart LR
  UI["Components / Views"] --> COMPOSE["Thin feature composition"]
  COMPOSE --> DOMAIN["Owning domain adapter"]
  DOMAIN --> API["RPC / RLS-scoped query"]
  API --> DATA["Canonical tables"]
  DATA --> API
  API --> DOMAIN
  DOMAIN --> MAP["Validated view-model mapping"]
  MAP --> COMPOSE
  COMPOSE --> UI
~~~

---

## 1.4 PostgreSQL is durable business truth

Supabase PostgreSQL owns durable school state.

React state owns only:

- current presentation state;
- selected tabs/filters;
- optimistic UI state with safe rollback/readback;
- local display caches;
- temporary form state.

React state must never silently become the only owner of:

- account approval;
- roles/capabilities;
- students;
- guardian links;
- class membership;
- attendance;
- grades;
- Parent Notes;
- messages;
- publication state;
- pickup/release state;
- notification read state.

---

## 1.5 Authorization is server-owned

Navigation visibility is presentation.

Real authorization belongs to server contracts:

- RLS;
- RPC authorization;
- verified server identity;
- capability checks;
- resource relationship checks.

Client role strings are never sufficient authorization for a protected mutation.

GENERAL_USER is not a database account role. Public visitors are anonymous readers of explicitly public content.

---

# 2. Verified current topology — 2026-11-20

The current branch is a Vite + React + TypeScript application backed by the existing Supabase project.

Verified current source characteristics:

- src/context/AppContext.tsx is approximately **1,814 lines** and currently carries broad composition responsibility.
- src/types.ts is approximately **590 lines** and mixes many application view types.
- src/lib/domains already contains focused domain adapters and is the correct direction for business ownership.
- src/lib/schoolContent.ts is primarily a compatibility re-export barrel.
- src/lib/schoolOperations.ts is a compatibility re-export barrel.
- the installed public Supabase schema currently contains **48 public tables**, all observed with RLS enabled.
- current installed data includes identity/governance, preferences/notifications, people/academics, enrollment, broadcasts/calendar, class community, Parent Notes, messaging, directory, food menu, public content, academic subjects/allocations, attendance, and class-creation permissions.

This means the clean-up goal is **not** to rebuild the application from scratch.

The goal is to finish separating ownership that is already emerging.

---

# 3. Clean target source structure

The following is the target organization.

It preserves current repository conventions and avoids a disruptive framework rewrite.

Files should move toward this shape only in explicitly authorized domain packets.

~~~text
src/
├── main.tsx
├── App.tsx
│
├── app/
│   ├── AppShell.tsx                  # target: top-level composition only
│   ├── routeModel.ts                 # target: typed tab/view route model
│   └── featureRegistry.ts            # target only if needed; no business logic
│
├── context/
│   ├── AppContext.tsx                # transition owner; composition only
│   ├── IdentityContext.tsx           # target split when authorized
│   ├── PreferencesContext.tsx        # target split when authorized
│   └── NotificationContext.tsx       # target split when authorized
│
├── components/
│   ├── AuthModal.tsx
│   ├── Navbar.tsx
│   ├── Footer.tsx
│   │
│   ├── homepages/
│   │   ├── HomePageResolver.tsx
│   │   ├── homepageAccess.ts
│   │   ├── OwnerHomePage.tsx
│   │   ├── ManagerHomePage.tsx
│   │   ├── AdministrativePersonnelHomePage.tsx
│   │   ├── TeacherHomePage.tsx
│   │   ├── ParentHomePage.tsx
│   │   ├── StudentHomePage.tsx
│   │   ├── SchoolStaffHomePage.tsx
│   │   ├── PublicHomePage.tsx
│   │   └── shared/
│   │
│   └── views/
│       ├── StudentsManagementView.tsx
│       ├── ClassesManagementView.tsx
│       ├── AttendanceView.tsx
│       ├── MessagesView.tsx
│       ├── ParentNotesView.tsx
│       ├── DirectoryView.tsx
│       ├── FoodMenuView.tsx
│       ├── GlobalAnnouncementsCalendarView.tsx
│       ├── ClassCommunityView.tsx
│       ├── RegistrationView.tsx
│       ├── PickupBoardView.tsx
│       └── Shared/
│
├── lib/
│   ├── supabase.ts                   # one browser Supabase client owner
│   ├── database.types.ts             # generated/verified DB contract owner
│   ├── auth.ts                       # identity transport adapter
│   ├── telegram.ts                   # Telegram host adapter only
│   ├── username.ts                   # identifier rules
│   │
│   ├── domains/
│   │   ├── academics.ts
│   │   ├── people.ts
│   │   ├── enrollment.ts
│   │   ├── broadcasts.ts
│   │   ├── calendarMutations.ts
│   │   ├── classCommunity.ts
│   │   ├── parentNotes.ts
│   │   ├── messaging.ts
│   │   ├── preferences.ts
│   │   ├── notifications.ts
│   │   ├── directory.ts
│   │   ├── foodMenu.ts
│   │   ├── publicContent.ts
│   │   └── publicInquiry.ts
│   │
│   ├── attendance/
│   │   ├── api.ts
│   │   ├── logic.ts
│   │   └── dateUtils.ts
│   │
│   ├── calendar/
│   │   ├── calendarModel.ts
│   │   ├── calendarQueries.ts
│   │   ├── calendarAudience.ts
│   │   ├── calendarReadOwner.ts
│   │   └── useCalendarMonth.ts
│   │
│   ├── classes/
│   │   ├── classCreation.ts
│   │   ├── classFilters.ts
│   │   └── studentOverview.ts
│   │
│   ├── schoolContent.ts              # compatibility barrel ONLY
│   ├── schoolOperations.ts           # compatibility barrel ONLY
│   └── focused cross-cutting guards
│
├── i18n/
│   ├── translations.ts
│   ├── authMessages.ts
│   ├── homepages.ts
│   ├── content.ts
│   └── telegram-link.ts
│
├── data/
│   └── mockData.ts                   # development/test preview only; never durable authority
│
└── types.ts                          # transition compatibility types; shrink over time

supabase/
├── config.toml
├── migrations/
├── functions/
│   ├── _shared/
│   ├── auth-username-signin/
│   ├── telegram-auth/
│   └── telegram-link-challenge/
├── tests/
└── seed.sql

tests/
├── browser/
├── db/
├── functions/
├── helpers/
└── focused Node regression suites
~~~

## 3.1 Important rule about the target tree

The target tree does **not** require creating every proposed target file immediately.

A file should be split only when a real responsibility boundary exists.

The correct migration rule is:

**move → prove → remove**

Never:

**copy → leave old owner active → create two sources of truth**

---

# 4. Domain module shape

A domain may stay as one file while it remains focused.

When a domain file becomes too large or begins to mix responsibilities, split **inside that domain**, not into generic shared files.

Example clean growth pattern:

~~~text
src/lib/domains/messaging/
├── index.ts             # public exports only
├── api.ts               # Supabase/RPC calls
├── contracts.ts         # domain request/result types
├── mappers.ts           # server-row → application mapping
├── validation.ts        # pure validation
└── selectors.ts         # pure derived reads if needed
~~~

Not allowed:

~~~text
src/lib/
├── management.ts
├── helpers.ts
├── common.ts
├── everything.ts
└── schoolService.ts
~~~

unless a file has one genuinely cross-domain technical responsibility.

A name such as helpers, common, management, or service is not an ownership model.

---

# 5. No-monolith rules

## 5.1 A module must have one reason to change

A single module must not simultaneously own:

- React rendering;
- role authorization;
- Supabase queries;
- database row mapping;
- form validation;
- notifications;
- routing;
- Telegram behavior;
- unrelated school domains.

If a change to Parent Notes and a change to Food Menu both regularly modify the same implementation file, ownership is wrong.

---

## 5.2 AppContext is composition, not a school database

The current AppContext is a transition point and is too broad to remain the permanent owner of feature behavior.

Clean target responsibility for AppContext:

- expose current signed-in identity/session context;
- coordinate top-level application composition;
- expose small stable context interfaces;
- compose domain-specific providers/hooks where justified;
- clear private presentation state on identity change.

AppContext must gradually stop owning:

- raw Parent Notes mapping;
- raw Messaging mapping;
- Notification persistence logic;
- preference persistence rules;
- directory CRUD;
- food-menu CRUD;
- calendar business rules;
- student/class business rules.

Domain behavior belongs to the owning adapter or domain-specific composition hook.

---

## 5.3 Components render; domains decide data contracts

A component may:

- collect input;
- display loading/error/empty/denied states;
- invoke an approved domain operation;
- render returned application models.

A component must not:

- invent Supabase table names;
- build privileged RPC parameter contracts ad hoc;
- guess role authorization;
- join unrelated tables in the browser;
- convert malformed backend data into success;
- silently swallow nested query errors.

---

## 5.4 Compatibility barrels are not service owners

schoolContent.ts and schoolOperations.ts may remain while existing consumers depend on them.

Their rule is strict:

**re-export only, except explicitly approved tiny technical helpers during transition.**

They must not accumulate:

- business validation;
- database queries;
- cross-domain orchestration;
- authorization;
- server row mapping.

The existing inline URL helper in schoolContent.ts is a known low-priority cleanup candidate, not permission to expand the barrel.

---

## 5.5 Size is a warning, responsibility is the real gate

No hard line-count rule can replace design judgment, but the following review thresholds apply:

- **0–250 lines:** normally healthy for a focused module.
- **250–400 lines:** inspect responsibility density.
- **400–700 lines:** split is normally expected unless the file is a cohesive declarative model.
- **700+ lines:** requires explicit justification and a decomposition plan.
- **1000+ lines:** presumed monolithic unless proven otherwise.

The current 1,814-line AppContext is therefore a transition owner, not the desired end state.

The purpose of splitting is not smaller files for their own sake. The purpose is one clear owner per behavior.

---

# 6. Clean application-layer architecture

~~~mermaid
flowchart TB
  subgraph Runtime["Runtime contexts"]
    Browser["Browser"]
    Telegram["Telegram WebView"]
  end

  subgraph Presentation["Presentation"]
    App["App / App Shell"]
    Nav["Navbar + role home resolver"]
    Views["Feature Views"]
    SharedUI["Shared presentational components"]
  end

  subgraph Composition["Thin composition"]
    IdentityCtx["Identity/session composition"]
    FeatureCtx["Feature-specific hooks/providers"]
  end

  subgraph Domains["Canonical client domain adapters"]
    Identity["Identity/Auth"]
    Governance["Access/Governance"]
    People["People"]
    Academics["Academics"]
    Enrollment["Enrollment"]
    Attendance["Attendance"]
    Calendar["Calendar"]
    Broadcasts["Broadcasts"]
    Community["Class Community"]
    ParentNotes["Parent Notes"]
    Messaging["Messaging"]
    Notifications["Notifications"]
    Preferences["Preferences"]
    Directory["Directory"]
    Food["Food Menu"]
    Public["Public Content / Inquiry"]
  end

  subgraph Backend["Supabase backend authority"]
    Auth["Supabase Auth"]
    RPC["RPC / Edge Functions"]
    RLS["RLS / grants / constraints"]
    PG["PostgreSQL"]
    Outbox["Notification outbox"]
  end

  Browser --> App
  Telegram --> App
  App --> Nav
  App --> Views
  Views --> SharedUI
  App --> IdentityCtx
  Views --> FeatureCtx

  IdentityCtx --> Identity
  FeatureCtx --> Domains

  Identity --> Auth
  Governance --> RPC
  Domains --> RPC
  Domains --> RLS
  RPC --> PG
  RLS --> PG
  PG --> Outbox
  Outbox --> Notifications
~~~

---

# 7. Canonical domain ownership matrix

| Domain | Owns | Does not own | Current primary source owner | Main installed database authority |
| --- | --- | --- | --- | --- |
| Identity & Authentication | canonical account identity, credentials transport, Telegram identity/link challenge | school roles, students, classes | auth.ts, telegram.ts, Edge Functions | auth.users, profiles, telegram_identities, account_link_challenges |
| Access / Governance | approval state, effective roles, Manager capabilities, governance audit | login credentials, class membership | accountGovernance.ts + governance RPCs | role_assignments, manager_capability_grants, account_governance_audit_logs |
| Preferences | language, theme, sound, vibration | permissions or access decisions | domains/preferences.ts | user_preferences |
| Notifications | notification inbox/read state and delivery projection | source domain truth | domains/notifications.ts | notification_outbox, user_notifications |
| People | student/person identity and school-member information projections | class membership, guardian relationship | domains/people.ts | students plus profile relationships |
| Family | verified parent-child relationship | account identity, emergency-contact equivalence | server contract / narrow readers | parent_child_links |
| Academics | years, levels, classes, class membership, teacher assignment, subject offerings | parent scope, attendance mark authority | domains/academics.ts plus classes modules | academic_years, school_levels, school_classes, student_class_memberships, teacher_class_assignments, curriculum/subject tables |
| Enrollment | application intake/review and enrollment workflow | account approval, class membership mutation unless explicitly transactional | domains/enrollment.ts | enrollment_applications |
| Calendar | canonical school event record, audiences, responses, cancellation lifecycle | announcements, attendance, pickup | calendar modules + domains/calendarMutations.ts | school_calendar_events, school_calendar_event_targets, school_calendar_responses |
| Broadcasts | school announcements and publication targeting | canonical calendar state | domains/broadcasts.ts | school_broadcasts |
| Class Community | class announcements, homework, class documents/gallery/questions/replies | class roster authority | domains/classCommunity.ts | class_announcements, class_homework_items, class_documents, class_gallery_items, class_questions, class_question_replies |
| Parent Notes | structured parent-to-school notes, reply state, quota/window contract | generic DM system | domains/parentNotes.ts | parent_notes |
| Messaging | short operational threads/messages and participant rules | Parent Notes, public announcements | domains/messaging.ts | message_threads, thread_participants, thread_messages |
| Directory | approved public/internal directory presentation | private People records | domains/directory.ts | directory_entries |
| Food Menu | weekly menu/day items and publication | general public content | domains/foodMenu.ts | food_menu_weeks, food_menu_days |
| Public Content | published Home/About/Contact/activity content | private school records | domains/publicContent.ts | school_public_content |
| Public Inquiry | public inquiry intake and staff response workflow | enrollment | domains/publicInquiry.ts | public_school_inquiries |
| Attendance | registers, marks, attendance events/requests, authorized correction flow | class membership owner, assessment | lib/attendance | attendance_registers, attendance_entries, attendance_events, attendance_requests |
| Class Creation Permission | explicit class-creation authorization | general governance or role assignment | classes/classCreation.ts + backend | class_creation_permissions |
| Assessment / Performance | **PLANNED ownership** for marks/report calculations/publication | attendance, student identity | performance.ts is presentation logic today; backend owner not yet established | **not established in installed schema** |
| Pickup / Release | **PLANNED safety domain** for authorized collector and release state | attendance or parent-arrival shortcut | PickupBoardView currently safety-blocked | **not established in installed schema** |
| Media | **PLANNED generic byte lifecycle** | audience/meaning of attachments | no canonical installed owner yet | **not established** |

---

# 8. Domain dependency rules

Domain ownership does not mean isolation from all other domains.

It means dependencies are explicit and directional.

~~~mermaid
flowchart LR
  Identity["Identity"] --> Access["Access / Governance"]
  People["People"] --> Family["Family"]
  People --> Academics["Academics"]
  Academics --> Attendance["Attendance"]
  Academics --> Calendar["Calendar"]
  Academics --> Community["Class Community"]
  Family --> ParentNotes["Parent Notes"]
  Academics --> ParentNotes
  Identity --> Messaging["Messaging"]
  Access --> Messaging
  Calendar --> Broadcasts["Broadcasts"]
  Access --> Directory["Directory"]
  People --> Directory
  Identity --> Preferences["Preferences"]
  Identity --> Notifications["Notifications"]
  Enrollment["Enrollment"] --> People
  Public["Public Content"] --> PublicUI["Anonymous public UI"]
~~~

Rules:

1. **Attendance consumes Academics membership/teaching context.** Attendance does not maintain a competing roster.
2. **Parent Notes consumes Family + Academics facts.** Parent Notes does not infer a child from a surname or message recipient.
3. **Messaging consumes approved participant identity.** Messaging does not use Parent Notes as a loophole and Parent Notes does not become generic chat.
4. **Directory consumes safe presentation fields.** It does not expose the private People table directly.
5. **Notifications project domain events.** A notification is never the authoritative state of the underlying domain.
6. **Preferences are user-scoped.** Preferences never decide authorization.
7. **Calendar owns calendar events.** Broadcasts and class features may reference or create calendar events only through the Calendar contract.
8. **Enrollment acceptance is not account approval.** Identity/governance remains separate.
9. **People identity is not class membership.** Academics owns membership.
10. **Family link is not emergency contact text.** Family owns verified parent-child linkage.

---

# 9. Installed database structure — clean ownership view

The installed database is larger than the old structure document described.

The following diagram groups currently installed tables by canonical owner.

~~~mermaid
flowchart TB
  subgraph IdentityDB["Identity / Governance"]
    profiles["profiles"]
    roles["role_assignments"]
    tgids["telegram_identities"]
    challenges["account_link_challenges"]
    grants["manager_capability_grants"]
    audit["account_governance_audit_logs"]
  end

  subgraph UserDB["User-scoped state"]
    prefs["user_preferences"]
    notif["user_notifications"]
    outbox["notification_outbox"]
  end

  subgraph AcademicDB["People / Family / Academics"]
    years["academic_years"]
    levels["school_levels"]
    classes["school_classes"]
    students["students"]
    scm["student_class_memberships"]
    tca["teacher_class_assignments"]
    pcl["parent_child_links"]
    curr["curriculum_domains"]
    subjects["academic_subjects"]
    components["academic_subject_components"]
    applicability["subject_level_applicability"]
    offerings["school_subject_offerings"]
    allocations["teacher_subject_allocations"]
    allocationEvents["teacher_subject_allocation_events"]
    createPerm["class_creation_permissions"]
  end

  subgraph EnrollmentDB["Enrollment / Public inquiry"]
    enroll["enrollment_applications"]
    inquiry["public_school_inquiries"]
  end

  subgraph CalendarDB["Calendar / Broadcasts"]
    broadcasts["school_broadcasts"]
    events["school_calendar_events"]
    targets["school_calendar_event_targets"]
    responses["school_calendar_responses"]
  end

  subgraph CommunityDB["Class Community"]
    ann["class_announcements"]
    hw["class_homework_items"]
    docs["class_documents"]
    gallery["class_gallery_items"]
    qs["class_questions"]
    qrs["class_question_replies"]
  end

  subgraph CommunicationDB["Parent Notes / Messaging"]
    notes["parent_notes"]
    threads["message_threads"]
    participants["thread_participants"]
    messages["thread_messages"]
  end

  subgraph PublicDB["Directory / Food / Public content"]
    directory["directory_entries"]
    menuWeeks["food_menu_weeks"]
    menuDays["food_menu_days"]
    content["school_public_content"]
  end

  subgraph AttendanceDB["Attendance"]
    registers["attendance_registers"]
    entries["attendance_entries"]
    attEvents["attendance_events"]
    requests["attendance_requests"]
  end

  profiles --> roles
  profiles --> tgids
  profiles --> prefs
  profiles --> notif
  students --> scm
  classes --> scm
  classes --> tca
  profiles --> tca
  profiles --> pcl
  students --> pcl
  classes --> registers
  registers --> entries
  students --> entries
  events --> targets
  events --> responses
  threads --> participants
  threads --> messages
  menuWeeks --> menuDays
~~~

---

# 10. Core relational schema

The following ER diagram shows the principal identity, family, academics, communication, and attendance relationships.

It is intentionally not every column.

~~~mermaid
erDiagram
  PROFILES ||--o{ ROLE_ASSIGNMENTS : has
  PROFILES ||--o| TELEGRAM_IDENTITIES : links
  PROFILES ||--o{ USER_PREFERENCES : owns
  PROFILES ||--o{ USER_NOTIFICATIONS : receives

  ACADEMIC_YEARS ||--o{ SCHOOL_CLASSES : contains
  SCHOOL_LEVELS ||--o{ SCHOOL_CLASSES : classifies

  STUDENTS ||--o{ STUDENT_CLASS_MEMBERSHIPS : joins
  SCHOOL_CLASSES ||--o{ STUDENT_CLASS_MEMBERSHIPS : contains

  PROFILES ||--o{ TEACHER_CLASS_ASSIGNMENTS : teacher
  SCHOOL_CLASSES ||--o{ TEACHER_CLASS_ASSIGNMENTS : staffed_by

  PROFILES ||--o{ PARENT_CHILD_LINKS : parent
  STUDENTS ||--o{ PARENT_CHILD_LINKS : child

  PROFILES ||--o{ PARENT_NOTES : submits
  STUDENTS ||--o{ PARENT_NOTES : concerns
  SCHOOL_CLASSES ||--o{ PARENT_NOTES : scopes

  MESSAGE_THREADS ||--o{ THREAD_PARTICIPANTS : contains
  MESSAGE_THREADS ||--o{ THREAD_MESSAGES : contains
  PROFILES ||--o{ THREAD_PARTICIPANTS : participates
  PROFILES ||--o{ THREAD_MESSAGES : sends

  SCHOOL_CALENDAR_EVENTS ||--o{ SCHOOL_CALENDAR_EVENT_TARGETS : targets
  SCHOOL_CALENDAR_EVENTS ||--o{ SCHOOL_CALENDAR_RESPONSES : receives

  SCHOOL_CLASSES ||--o{ ATTENDANCE_REGISTERS : owns
  ATTENDANCE_REGISTERS ||--o{ ATTENDANCE_ENTRIES : contains
  STUDENTS ||--o{ ATTENDANCE_ENTRIES : marked_for
~~~

---

# 11. Identity and role model

## 11.1 Canonical account roles

Registered-account roles are:

1. APP_ADMIN — School Owner / Principal
2. MANAGER — Manager / Associate Principal / Director
3. PARENT
4. STUDENT
5. TEACHER
6. SCHOOL_STAFF
7. ADMINISTRATIVE_PERSONNEL

GENERAL_USER is anonymous/public and is not an account role.

## 11.2 Role ownership

Supabase Auth establishes authenticated identity.

profiles stores canonical application profile/account state.

role_assignments stores durable role assignments.

manager_capability_grants stores delegated Manager capabilities.

No UI component may infer an effective role by choosing whichever home page is visible.

No domain may create its own role enum.

---

# 12. Clean request flow

Example: Parent sends a Parent Note.

~~~mermaid
sequenceDiagram
  participant P as Parent UI
  participant C as App composition
  participant D as Parent Notes domain
  participant RPC as send_parent_note RPC
  participant DB as PostgreSQL
  participant N as Notification outbox

  P->>C: submit student/topic/content
  C->>D: sendParentNote(...)
  D->>D: local presentation validation
  D->>RPC: p_student_id, p_topic, p_content
  RPC->>RPC: verify auth + approved PARENT
  RPC->>DB: verify parent-child link
  RPC->>DB: verify quota/window/class
  RPC->>DB: insert parent_notes
  RPC->>N: enqueue teacher notification
  RPC-->>D: {note, remainingToday}
  D->>D: validate server response shape
  D-->>C: typed BackendOpResult
  C-->>P: update presentation state
~~~

This pattern applies across domains:

- server owns privileged invariants;
- client validates returned contract shape;
- malformed success payloads fail closed;
- UI never manufactures missing server fields.

---

# 13. State ownership

## 13.1 Server-authoritative state

Always server-authoritative:

- account approval/status;
- roles/capabilities;
- parent-child links;
- student identity;
- class membership;
- teacher assignments;
- attendance;
- Parent Notes quota/use;
- message participants;
- publication state;
- notification read state;
- calendar lifecycle;
- enrollment state.

## 13.2 Client presentation state

Safe client-owned examples:

- active tab;
- open modal;
- selected class;
- search input;
- expanded card;
- unsaved form draft;
- temporary loading/error state;
- optimistic state that can be reconciled.

## 13.3 Never mix the two

A React state variable must not become authoritative merely because the UI needs immediate feedback.

If the server rejects a mutation, the UI must show failure or reconcile from server truth.

---

# 14. Type ownership

The application currently has a large src/types.ts compatibility surface.

Clean target:

1. database.types.ts owns generated or verified database-row contracts;
2. each domain owns its request/result/application model types when the type is domain-specific;
3. components consume domain/application view models;
4. src/types.ts shrinks into genuinely shared presentation types only.

Forbidden:

- copying a database table interface into several feature files;
- treating TypeScript casts as proof that a database column exists;
- adding a field to a UI type and assuming persistence now supports it;
- handwritten Supabase types that disagree with the installed schema.

---

# 15. Data-access rules

## 15.1 Direct table reads

Direct client reads are permitted only when:

- RLS is the intended authorization boundary;
- the table/view is intentionally exposed;
- the adapter owns the query;
- the selected columns are explicit;
- malformed data/errors fail closed.

## 15.2 RPCs

Use RPCs for:

- multi-row transactional invariants;
- privileged state transitions;
- atomic counters/quotas;
- governance;
- operations requiring server-derived identity;
- operations whose correctness depends on locking or concurrency.

## 15.3 Edge Functions

Use Edge Functions for transport/integration boundaries that cannot be correctly expressed as an ordinary database contract, such as verified Telegram initData and username authentication transport.

Do not create an Edge Function merely to move arbitrary JavaScript to another file.

---

# 16. Error semantics

Every domain operation returns a typed result with an explicit status.

No domain may:

- convert null/malformed payloads into fake successful objects;
- swallow a nested query error;
- return READY after an essential child query failed;
- replace missing IDs with empty strings;
- convert undefined to the literal string "undefined";
- treat authorization failure as an empty dataset.

Recommended meanings:

- READY — valid successful contract
- ERROR — operation failed or backend response invalid
- UNAUTHORIZED — actor not permitted
- BLOCKED_BACKEND — required verified backend contract unavailable

---

# 17. Presentation architecture

## 17.1 Home pages

HomePageResolver decides presentation based on verified effective account context.

Each home page owns layout and shortcuts for that role.

It must not own protected business mutations.

APP_ADMIN and MANAGER may see broad navigation, but server authorization still decides each protected operation.

## 17.2 Views

Views are feature surfaces.

A view should normally depend on:

- one primary domain;
- small approved readers from related domains;
- shared presentation components.

A view should not become an orchestration script for five unrelated database domains.

## 17.3 Shared components

Shared components may own:

- layout;
- reusable display states;
- generic form controls;
- accessibility behavior.

Shared components must not own school-specific business decisions merely to reduce duplication.

---

# 18. AppContext decomposition plan

This section defines the desired end state without authorizing a large refactor.

## Phase A — stop adding new business logic

No new domain persistence logic should be added directly to AppContext.

New functionality enters through an owning domain adapter first.

## Phase B — extract domain composition

As each domain is verified, AppContext may expose a thin wrapper or delegate to a focused hook/provider.

Candidate examples:

~~~text
useIdentitySession()
usePreferences()
useNotifications()
useMessaging()
useParentNotes()
useCalendar()
~~~

These names are target examples, not mandatory files until an authorized packet proves they improve ownership.

## Phase C — reduce AppContext to shell composition

Long-term AppContext should contain only cross-feature application composition that truly belongs at application scope.

---

# 19. Testing architecture

Each domain must have evidence at the level appropriate to its risk.

~~~text
tests/
├── focused domain unit/contract tests
├── browser component/interaction tests
├── db/
│   └── database contract/concurrency tests
├── functions/
│   └── Edge Function tests
└── helpers/
    └── test-only infrastructure
~~~

## 19.1 Required test layers

**Pure validation tests**

For deterministic local rules.

**Adapter contract tests**

For RPC/table parameter names, mapping, malformed responses, and error propagation.

**Database integration/RLS tests**

For allowed/denied principals and real installed/isolated database behavior.

**Concurrency tests**

For last-owner protection, attendance/calendar serialization, quotas, and any operation where two valid callers can race.

**Browser tests**

For user-visible loading, error, unauthorized, empty, retry, keyboard/touch, responsive behavior.

**Deployment proof**

For exact commit deployment status.

No layer substitutes for another.

---

# 20. Domain-by-domain physical database ownership

## Identity / Governance

Owns:

- profiles
- role_assignments
- telegram_identities
- account_link_challenges
- manager_capability_grants
- account_governance_audit_logs

## Preferences / Notifications

Owns:

- user_preferences
- notification_outbox
- user_notifications

Notification outbox is infrastructure for delivery, not the owner of the originating business event.

## People / Family / Academics

Owns:

- students
- parent_child_links
- academic_years
- school_levels
- school_classes
- student_class_memberships
- teacher_class_assignments
- curriculum_domains
- academic_subjects
- academic_subject_components
- subject_level_applicability
- school_subject_offerings
- teacher_subject_allocations
- teacher_subject_allocation_events
- class_creation_permissions

## Enrollment / Inquiry

Owns:

- enrollment_applications
- enrollment_admission_completions (admission receipt; no class-membership ownership)
- enrollment_admission_audit_logs (immutable completion evidence)
- public_school_inquiries

## Broadcasts / Calendar

Owns:

- school_broadcasts
- school_calendar_events
- school_calendar_event_targets
- school_calendar_responses

## Class Community

Owns:

- class_announcements
- class_homework_items
- class_documents
- class_gallery_items
- class_questions
- class_question_replies

## Parent Notes

Owns:

- parent_notes

## Messaging

Owns:

- message_threads
- thread_participants
- thread_messages

## Directory / Food / Public Content

Owns:

- directory_entries
- food_menu_weeks
- food_menu_days
- school_public_content

## Attendance

Owns:

- attendance_registers
- attendance_entries
- attendance_events
- attendance_requests

---

# 21. Cross-domain transaction rule

A domain is allowed to reference another domain's canonical identifier.

It is not allowed to silently duplicate that domain's state.

Examples:

- parent_notes.student_id references Students; Parent Notes does not own student identity.
- attendance_entries reference Students; Attendance does not own the roster.
- directory_entries may reference/profile approved people presentation; Directory does not own private People fields.
- notifications reference a source target; Notifications do not own the source object's status.

For an operation that must atomically modify more than one owner, define one explicit application operation with transactional server implementation and document which domain owns the command.

Do not coordinate critical multi-domain transactions by firing several browser requests and calling the sequence "atomic."

---

# 22. Public versus private boundaries

Public/anonymous surfaces may read only deliberately public contracts.

Examples:

- published school_public_content;
- published directory entries;
- deliberately public menu/public information;
- public inquiry submission.

An authenticated administrator having broad RLS visibility does not mean a function named "public reader" may return unpublished records.

Public readers must encode their own published-only contract when required.

---

# 23. Security and RLS structure

Every protected table needs a documented access model.

For each domain, the implementation packet must identify:

1. who can SELECT;
2. who can INSERT;
3. who can UPDATE;
4. who can DELETE;
5. whether writes are direct or RPC-only;
6. whether the operation is security-definer;
7. which grants expose the object;
8. which allow and deny cases prove the policy.

RLS enabled is not proof that RLS is correct.

A service-role test cannot prove ordinary caller isolation.

---

# 24. Schema-change protocol

No feature may modify the schema casually.

Required sequence:

1. inspect current installed schema;
2. inspect repository migration history;
3. define the owning domain;
4. write the smallest forward migration;
5. replay in isolated database;
6. test constraints;
7. test grants/RLS allow + deny;
8. regenerate/verify database types;
9. update the owning adapter;
10. update every affected consumer;
11. only then request hosted migration authorization.

Never:

- create a replacement Supabase project;
- broad db push without inspection;
- rewrite migration history to make it look tidy;
- delete installed objects because source documentation looks different;
- infer production schema from TypeScript alone.

---

# 25. Naming and ownership rules

Preferred names identify a real bounded context:

- messaging
- parentNotes
- academics
- attendance
- directory
- enrollment

Avoid catch-all names:

- manager
- misc
- commonBusiness
- schoolService
- backendHelpers
- operations2
- newApi
- utils2

If a module cannot be named after the responsibility it owns, the boundary is probably unclear.

---

# 26. Import rules

Allowed:

~~~text
component
  -> feature/domain public API
  -> shared technical adapter
~~~

Avoid:

~~~text
component A
  -> internal implementation of domain B
  -> internal implementation of domain C
  -> raw Supabase tables
~~~

A domain may import:

- genuinely shared technical primitives;
- types/interfaces from an explicitly approved upstream owner;
- narrow readers/contracts.

A domain must not import another domain's concrete persistence implementation merely to bypass its public contract.

---

# 27. Clean feature example

A clean Directory feature looks like:

~~~text
DirectoryView.tsx
    |
    v
domains/directory.ts
    |
    +-- listPublicDirectory()
    +-- listSchoolDirectory()
    +-- upsertDirectoryEntry()
    |
    v
Supabase table/RPC contract
    |
    v
directory_entries + RLS
~~~

The UI does not query directory_entries itself.

The domain adapter does not own private People records.

The public reader explicitly enforces the public publication contract.

The internal reader follows its own authorized contract.

---

# 28. Clean Messaging example

~~~text
MessagesView.tsx
    |
    v
domains/messaging.ts
    |
    +-- listApprovedMessageRecipients()
    +-- listMessageThreads()
    +-- sendOperationalMessage()
    +-- replyOperationalThread()
    |
    v
message RPCs + participant RLS
    |
    v
message_threads
thread_participants
thread_messages
~~~

Recipient names/roles come from canonical recipient identity contracts.

The adapter never fabricates a role such as "SCHOOL" merely to satisfy a UI type.

---

# 29. Clean Parent Notes example

~~~text
ParentNotesPanel / ParentNotesView
    |
    v
domains/parentNotes.ts
    |
    +-- listParentNotes()
    +-- sendParentNote()
    +-- replyParentNote()
    |
    v
send_parent_note / reply_parent_note + RLS
    |
    v
parent_notes
~~~

The server owns:

- approved-parent authority;
- parent-child link;
- Tunis window;
- quota;
- class/teacher resolution.

The client owns:

- input presentation validation;
- strict response-shape validation;
- display state.

---

# 30. Clean recovery / implementation rule

Every future domain recovery follows:

**SOURCE → INSTALLED BACKEND → RED TEST → MINIMAL FIX → READBACK → FOCUSED TEST → SURROUNDING REGRESSION → BUILD → EXACT PREVIEW → STOP**

Do not combine unrelated domains into one repair because they happen to share a branch.

Do not merge merely because the branch builds.

---

# 31. Current clean-up priorities

At this revision, the architecture direction is:

1. preserve the verified domain adapter recovery already completed;
2. continue domain-by-domain reconciliation;
3. reduce AppContext only through later explicit decomposition packets;
4. keep compatibility barrels thin;
5. keep existing Supabase project and installed data;
6. reconcile source migrations and installed backend without destructive history repair;
7. keep Calendar, Attendance, Teacher T1/T2, Students/PR #33, auth, Telegram and other protected workstreams isolated from unrelated domain cleanup;
8. create no second service layer merely for aesthetics.

---

# 32. Architecture acceptance checklist

A new feature or repair is architecturally acceptable only if all applicable answers are YES.

### Ownership

- Is there one canonical domain owner?
- Is every durable concept stored by one database owner?
- Is a compatibility barrel re-export-only?
- Is the UI free of business-data ownership?

### Dependencies

- Does dependency direction point toward domain contracts?
- Is cross-domain access narrow and explicit?
- Is there no circular business dependency?

### Security

- Is actor identity server-derived?
- Are grants/RLS/RPC authority verified?
- Are deny cases tested?
- Is service-role usage isolated from browser code?

### Data integrity

- Are malformed backend responses rejected?
- Are required fields validated?
- Are concurrency/transaction requirements implemented server-side?
- Is durable state not duplicated into a second table family?

### Source structure

- Does every file have one primary reason to change?
- Is the change free from catch-all management/common/utils growth?
- Did an existing monolith get smaller or at least not grow?
- Is any new split inside the owning domain rather than horizontal technical dumping?

### Evidence

- Was exact HEAD verified?
- Was the exact source read back?
- Were focused and surrounding tests executed?
- Was build evidence tied to the exact revision?
- Was deployment/runtime evidence classified separately from source evidence?

---

# 33. Final architecture rule

The clean KRISTOU SCHOOL application is not defined by having many small files.

It is defined by **clear ownership**.

The desired architecture is:

**one product → thin presentation → thin composition → focused domain contracts → verified server authorization → one durable PostgreSQL owner per concept.**

No monolithic school service.

No monolithic AppContext business database.

No duplicate domain models.

No second backend.

No UI-created authorization.

No silent malformed-success states.

No fake cleanup that moves the same coupled logic into a different large file.

Every future structural change must make ownership clearer than it was before.
