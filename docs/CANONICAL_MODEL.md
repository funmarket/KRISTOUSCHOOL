# KRISTOU SCHOOL — CANONICAL MODEL
> **2026-11-13 precedence note:** New Owner-authored AUTH-ID-01 requires optional username/email/phone combinations and Unicode/multiword usernames, subject to secure verified Auth identities and one canonical User. The existing SQL/username constraint is still ASCII-only; username-only provisioning and multiple Auth aliases are NOT demonstrated. Accepted ADMINISTRATIVE_PERSONNEL standard-bundle/self-denial rules supersede older per-capability language. See `requirements.md` and the dated live checkpoint; do not treat target entities below as migrated tables.


Status: **ACTIVE DATA + AUTHORITY CONTRACT**

This file defines canonical product data ownership and write authority for KRISTOU SCHOOL in `funmarket/KRISTOUSCHOOL`. The model is only for KRISTOU SCHOOL. This repository defines only the KRISTOU SCHOOL data model.

The authentication foundation is now implemented as a source-controlled Supabase migration and server-side function boundary. The remaining domain models below are contracts and must not be treated as implemented until their own migrations, RLS, and tests exist. Where the exact relational shape is not yet approved, the authority and invariants are locked while storage details remain **TBD**. Supabase Auth verifies the shared app's Web credentials; application identity and roles remain in KRISTOU-linked public tables. Telegram is explicitly linked to an existing authenticated canonical User through a short-lived one-time challenge and server-validated Mini App `initData`; later Mini App opens use fresh signed `initData` to restore that linked identity in the app without creating a Supabase Auth session.

During implementation, the following must agree with this document:

```text
Supabase SQL migrations
repository ports
infrastructure repositories
application services
authorization policies
contracts
integration tests
Web/Telegram projections
```

If implementation establishes a different owner for a concept, update this document and the related architectural decision before allowing duplicate authority.

---

# 0. Global authority rules

1. Every durable product concept has exactly one authoritative owner.
2. PostgreSQL is durable business truth.
3. Redis is transient only where explicitly designed.
4. Object storage holds binary media bytes.
5. Web and Telegram never own separate business copies.
6. Read models/projections may duplicate presentation data only when their non-authoritative status is explicit.
7. Cross-domain consumers use application ports/readers, not another domain's concrete repository/ORM model.
8. Notification/realtime failure never rewrites the canonical business event that triggered it.
9. Exposed Supabase tables/views/functions require deliberate grants and tested Row Level Security; service-role access is not a substitute for product authorization.
10. Private Supabase Storage access follows the same resource authorization as the owning product feature.
11. All durable records belong to KRISTOU SCHOOL; do not add other schools, inter-school membership, school switching, or a global school registry without an explicit product decision.

---

# 1. Identity & Authentication

## User

One canonical KRISTOU identity.

Conceptual minimum:

```text
User
  id
  createdAt
  updatedAt
```

Authentication identities attach to User; they do not replace User.

**Write owner:** Identity & Authentication.

## WebCredential

Represents Web login authority for one canonical User.

Conceptual fields include:

```text
userId
loginUsername
passwordHash
email?
failedLoginCount
lockedUntil?
lastLoginAt?
createdAt
updatedAt
```

Rules:

- `loginUsername` is the unique normalized custom Web identifier;
- Web sign-in accepts username, email, or full international phone number plus password;
- email and phone credentials are verified by Supabase Auth;
- username resolution is server-side and must not expose contact identifiers to the browser;
- app accounts are created through the shared app's credential signup in either Browser or Telegram WebView; the current flow does not provision Telegram-only users;
- **AUTH-ID-01 review-branch refinement (`feature/auth-id-01-review-20261113`):** `loginUsername` is optional when a verified email or phone credential is provided (with `handle_new_user()` assigning `user_<uuid_hex>` when omitted) and supports 3–50 Unicode characters (Arabic script, French accented Latin, ASCII letters/digits, single internal spaces, `.`, `_`, `-`) normalized via Unicode NFC + whitespace collapse (`normalizeUsernameDisplay` / `normalizeUsernameKey`). `full_name` is a non-unique personal display name and is never a login identifier. Combination `A` (username-only without email or phone) remains blocked (`username_only_requires_contact_or_backend_auth`) unless a server-backed non-contact credential store is approved; synthetic email/phone aliases are forbidden. When both email and phone are entered at signup (`F`, `G`), `email` is the primary Supabase Auth credential and the normalized phone (`+216XXXXXXXX` or explicit E.164) is recorded in `pending_phone` metadata as not enabled for login until verified (secondary alias verification is not proven end-to-end). Database constraint updates in `supabase/migrations/20261113120000_human_friendly_usernames.sql` are `PREPARED — NOT VERIFIED`.

**Write owner:** Identity & Authentication.

## WebSession

Represents server-authorized browser session state.

Rules:

- raw session secrets/tokens must not be stored in plaintext;
- session revocation/expiration is Identity-owned;
- product domains must not query WebSession persistence directly for product authorization.

**Write owner:** Identity & Authentication.

## TelegramIdentity

Represents validated Telegram identity attached to the same canonical User.

Conceptual fields may include:

```text
userId
telegramUserId
telegramUsername?
firstName?
lastName?
languageCode?
lastAuthenticatedAt
createdAt
updatedAt
```

Telegram profile metadata is not permission to merge with an existing User heuristically. In the currently approved flow, Telegram is linked only after the person creates/signs into the shared app account and confirms the one-time challenge in the Mini App. Later Telegram launches restore that already-linked canonical profile from fresh signed `initData`; they do not create a new account or a Supabase Auth session. Telegram-only account provisioning is not part of this implementation slice.

**Write owner:** Identity & Authentication.

## AccountLinkChallenge

Short-lived one-time authority for explicit shared-app-account -> Telegram linking.

Rules:

- target canonical User is fixed when the challenge is created;
- plaintext link secrets/codes must not be stored if a secure verifier/hash can be used;
- code is short-lived;
- code is single-use;
- conflicts fail closed;
- a Telegram identity already owned by another User cannot be silently moved.

**Write owner:** Identity & Authentication.

---

# 2. Access Control

Access Control owns server-side authorization policy and durable grants where persistence is required.

Conceptual entities:

```text
RoleAssignment
CapabilityGrant
```

The authentication foundation persists `RoleAssignment` in Supabase. Capability-grant details remain **TBD** and must not be duplicated in feature domains.

Locked authority rules:

- APP_ADMIN / School Owner is global authority;
- Approved Administrative Personnel automatically receive the ordinary school-administration bundle: academic coordination, student/class management, teacher support, parent relations, school guidance, admission and both manual + validated CSV/XLSX import. They may govern OTHER ordinary-role accounts only, never themselves or APP_ADMIN/MANAGER. Server enforcement remains a future Access Control task;
- School Staff authority is explicit, capability-specific, and scoped to assigned student, facility, health, meal, transport, or resource responsibilities;
- Manager/Associate authority is explicit and capability-specific;
- Teacher authority is class/resource-scoped;
- Parent authority depends on canonical guardian/child scope;
- Student authority depends on active class membership;
- UI visibility is never authorization.

**Write owner:** Access Control.

Product domains may define domain-specific actions, but they do not create independent role systems.

---

# 3. People

People owns user-facing school-person profile data, not authentication credentials.

Conceptual profiles:

```text
ParentProfile
StudentProfile
TeacherProfile
ManagerProfile
```

Exact split between one shared profile table and typed profile tables is **TBD** and must be decided during implementation without duplicating canonical presentation data.

Rules:

- every account-backed profile references canonical `User.id`;
- Student may have a school profile even if standalone account creation policy evolves;
- private contact information is not automatically public;
- public teacher/board presentation is owned separately by School Directory.

**Write owner:** People.

---

# 4. Family

## ParentChildLink

Canonical guardian relationship between a parent/guardian and a student.

Conceptual authority:

```text
ParentChildLink
  parentUserId
  studentId
  relationship
  active
  effective dates TBD
```

Used by:

- parent private-class access;
- Parent Notes;
- pickup authorization checks;
- child-switching UI projections.

Consumers must use Family-owned application readers/ports instead of duplicating relationship tables.

**Write owner:** Family.

---

# 5. Academics

## AcademicYear

Canonical school academic-year identity/configuration.

**Write owner:** Academics.

## Level

Canonical school level/grade grouping.

**Write owner:** Academics.

## Class

Canonical class identity and lifecycle.

A Class is the authority context for private class community access.

Do not create a redundant 1:1 ClassCommunity entity unless it later owns independent lifecycle/state.

**Write owner:** Academics.

## TeacherClassAssignment

Canonical teacher-to-class assignment.

Used by authorization for:

- class announcements;
- homework/classwork;
- Parent Notes;
- Class Questions moderation;
- pickup operations.

**Write owner:** Academics.

## StudentClassMembership

Canonical active student-to-class assignment.

Rules:

- membership must be consistent with valid Enrollment authority;
- there is no separate roster authority in Class Community/Pickup/frontend;
- ending membership ends student private class access.

Exact relation to Enrollment row and academic-year transition shape is **TBD**.

**Write owner:** Academics.

---

# 6. Enrollment

## EnrollmentApplication

Canonical application/review workflow.

Locked lifecycle:

```text
DRAFT
-> SUBMITTED
-> UNDER_REVIEW
-> NEED_DOCUMENTS
-> UNDER_REVIEW
-> ACCEPTED | WAITLIST | REJECTED
-> ENROLLED
```

Acceptance alone does not create class authority.

## Enrollment

Canonical durable enrolled-student status for an academic year.

Class membership/assignment remains Academics-owned.

Enrollment may provide the eligibility/reference needed for Academics to establish StudentClassMembership.

## Enrollment Documents

Enrollment owns semantic document requirement/application attachment relationships.

Generic media descriptors/bytes remain Media-owned infrastructure.

**Write owner:** Enrollment.

---

# 7. Class Community

Class Community owns private content whose authority context is a canonical Class.

It does **not** own Class identity or class membership.

## ClassAnnouncement

Teacher/school-authored announcement scoped to a Class.

## HomeworkItem / ClassworkItem

Teacher-controlled learning item scoped to a Class.

Exact naming/model split is **TBD**.

## ClassCalendarItem

Class-scoped calendar/event reminder.

School-wide calendar ownership is **TBD** if/when a distinct school calendar is needed.

## ClassDocument

Class-private document attachment/metadata.

Binary asset lifecycle remains Media-owned.

## ClassGalleryItem

Class-private gallery attachment/context.

## ClassQuestion

Student class-wide question.

Locked rules:

- active class members only;
- maximum 200 characters;
- no private student direct-message semantics;
- teacher moderation;
- safeguarding access for authorized staff;
- auditable/moderatable.

## ClassQuestionReply

Reply within the same class-wide ClassQuestion thread.

Maximum 200 characters.

**Write owner for all above:** Class Community.

---

# 8. Parent Notes

Parent Notes is a dedicated domain because its timing, quota, tagging, privacy, and audience rules differ from general Messages.

## ParentNote

Canonical parent-originated structured note.

Locked policy inputs include:

- actor parent;
- child tag;
- optional/required teacher tag according to subject;
- topic;
- body/content;
- class context where applicable;
- created time.

Locked limits:

```text
11 parent-originated notes per day
send window 08:00 inclusive -> 18:00 exclusive
quota reset 08:00 Africa/Tunis
```

Quota counters may use Redis, but PostgreSQL remains durable note truth.

## ParentNoteReply

Teacher/authorized staff reply linked to ParentNote.

Replies do not consume parent-originated quota.

**Write owner:** Parent Notes.

Notification records must not become a second ParentNote authority.

---

# 9. Messaging

Messaging owns short operational conversation threads that are not Parent Notes or Student Class Questions.

## MessageThread

Canonical participant/context grouping for allowed operational messaging.

Exact supported participant combinations are **TBD** and must be approved before implementation.

## Message

Locked rule:

```text
maximum 200 characters
```

Rules:

- server-authorized participants/context;
- read/reply semantics;
- student private DMs are not enabled in initial scope;
- Messages must not bypass Parent Note policy.

**Write owner:** Messaging.

---

# 10. Pickup

Pickup is safety-critical and owns dismissal policy, pickup authorization, state transitions, and release records.

## DismissalPolicy

Canonical school/class pickup window configuration.

Time authority:

```text
Africa/Tunis
server clock
```

## AuthorizedPickupPerson

Separate concept from Parent role.

Conceptual fields:

```text
studentId
person identity/details appropriate to school policy
relationship
active
validFrom?
validUntil?
schoolApproved
notes?  // restricted operational notes only
```

A non-parent AuthorizedPickupPerson does not require a KRISTOU account in initial scope.

## Pickup state / record

Locked logical states:

```text
WAITING
PARENT_ARRIVED
RELEASED
```

Optional future states/flags such as ABSENT, EARLY_RELEASE, LATE_PICKUP require their own approved rules.

Exact relational storage shape — current-state row, daily cycle row, append-only events, or combination — is **TBD**.

The following invariant is not TBD:

> A parent/authorized arrival actor may announce arrival. Only authorized school staff may release the child.

## Pickup transition/audit event

Durable history must be able to prove:

- child;
- class;
- actor;
- authorized pickup person where relevant;
- transition/action;
- timestamp;
- releasing staff;
- released-to identity.

Redis locks/live state are never the durable pickup authority.

**Write owner:** Pickup.

---

# 11. Broadcasts

## SchoolBroadcast

One canonical school broadcast.

Audience:

```text
ALL_CLASSES
SELECTED_LEVELS
SELECTED_CLASSES
```

Lifecycle:

```text
DRAFT
SCHEDULED
PUBLISHED
REVOKED
```

Class/feed appearances are projections linked to the same canonical broadcast identity.

Do not clone a broadcast into independent per-class business truth.

**Write owner:** Broadcasts.

---

# 12. Notifications

Notifications owns inbox/delivery projections.

Conceptual entities:

```text
UserNotification
NotificationDelivery?   // exact split TBD
```

A notification may contain:

- recipient User;
- kind/category;
- safe display title/summary;
- target route/resource reference;
- read/unread state;
- created time;
- delivery status where applicable.

Rules:

- notification is not the source business record;
- notification body must not become an unauthorized copy of private source data;
- delivery failure does not roll back the originating event;
- pickup/Parent Note/Message state remains owned by those domains.

**Write owner:** Notifications.

---

# 13. Preferences

Preferences owns user-selectable presentation/delivery preferences.

Conceptual settings:

- language: Arabic | French | English;
- appearance: Light | Pitch Black;
- notification sound selection;
- optional per-category sound/mute preferences;
- vibration preference where platform support exists.

These preferences do not alter business truth or authorization.

**Write owner:** Preferences.

---

# 14. Food Menu

## FoodMenuWeek

Canonical weekly school menu publication.

Conceptual authority:

```text
weekStart
weekEnd
title
provider attribution: La Toque Gourmande
status: DRAFT | PUBLISHED | ARCHIVED
translated content as configured
```

## FoodMenuDay

Structured daily meal content, potentially:

```text
starter?
main?
side?
dessert?
notes?
```

## FoodMenu media attachments

Original weekly menu image and meal photos attach through Media descriptors.

App Admin or Manager with explicit Food Menu capability may write.

Public/parent/student visibility derives from publication state/access configuration.

**Write owner:** Food Menu.

---

# 15. School Directory

School Directory owns school-approved public presentation cards, not internal People records.

## TeacherDirectoryEntry

May reference a TeacherProfile/User and own public-only fields such as:

- public display name/title;
- approved biography;
- approved public subjects/responsibilities;
- approved languages;
- approved public contact;
- display order;
- visibility;
- public photo reference.

Internal TeacherProfile remains People-owned.

## BoardDirectoryEntry

Public Administration / School Board presentation:

- member reference where account-backed;
- public title/role;
- biography;
- responsibilities;
- languages;
- approved public contact;
- display order;
- visibility;
- photo reference.

**Write owner:** School Directory.

---

# 16. Public Content

Public Content owns CMS-style school public information that is not another domain's canonical record.

Examples when implemented:

- homepage sections;
- About content;
- activities;
- clubs;
- pedagogy/service copy;
- public gallery;
- general public announcements where not modeled as SchoolBroadcast.

Exact public content taxonomy is **TBD** and should follow real school needs rather than speculative tables.

**Write owner:** Public Content.

---

# 17. Media

## MediaAsset

Canonical generic media descriptor/lifecycle.

Exact schema is **TBD**, but must be capable of representing:

- owning namespace/domain reference;
- canonical object key;
- media type/format;
- size/dimensions where relevant;
- visibility/access classification;
- variant descriptors where applicable;
- lifecycle/status;
- timestamps.

Rules:

- product domain decides whether upload/attachment is authorized;
- Media owns generic descriptor/bytes lifecycle;
- object storage owns bytes;
- private media requires authorization-controlled delivery;
- no arbitrary external URL field becomes a substitute for governed upload where managed media is required.

**Write owner:** Media.

---

# 18. Audit

## AuditLog

Durable sensitive-operation history.

Conceptual minimum:

```text
id
actorUserId?
action
entityType
entityId?
requestId?
safe metadata?
createdAt
```

Never store:

- passwords;
- raw session tokens;
- Telegram bot token;
- link-code plaintext;
- unnecessary child/private message content;
- secrets.

**Write owner:** Audit.

Product domains trigger audit writes through explicit interfaces where required.

---

# 19. Async Foundation

## OutboxEvent

Durable async handoff record.

Where an asynchronous side effect matters, the business mutation and OutboxEvent should commit atomically.

Worker:

- claims safely;
- retries;
- is idempotent;
- does not re-own business authorization;
- records safe operational failure state.

Outbox is infrastructure authority for pending async work, not a copy of the originating business entity.

**Write owner:** Async Foundation / transactional infrastructure boundary.

---

# 20. Projections and read models

The following are explicitly non-authoritative projections/read models:

- notification inbox entries derived from source events;
- live pickup board projections;
- manager pickup aggregate counts;
- child/class selector UI state;
- public/home discovery aggregations;
- Telegram/Web UI caches;
- search indexes;
- delivery-state projections.

A projection may be rebuilt from canonical sources where architecture supports it.

A projection must never become the only record of a safety-critical or durable business action.

---

# 21. AI

AI Assistant authority remains **planned / later phase**.

Locked rule:

- AI calls authorized KRISTOU APIs;
- AI never owns a second database;
- AI cannot exceed actor authorization;
- AI cannot autonomously release children, authorize pickup, accept/reject enrollment, grant staff authority, or perform destructive administration.

Do not add durable AI models until the approved AI slice requires them.

---

# 22. Out-of-scope canonical models

Do not add durable models yet for:

- grades/report cards;
- general attendance;
- school transport/bus;
- payments;
- lunch ordering/payment;
- QR/face/geofence pickup;
- student private direct messaging.

A future owner decision and domain design are required first.

---

# 23. Cross-domain authority examples

## Parent opens private class

```text
Identity -> authenticated User
Access Control -> protected action capability
Family -> ParentChildLink
Academics -> active StudentClassMembership
Class Community -> class-private content
```

No one of those domains duplicates the others' source data.

## Parent announces pickup arrival

```text
Identity -> actor
Family -> parent-child relation
Academics -> active student/class assignment
Pickup -> AuthorizedPickupPerson + dismissal window + state transition
Async Foundation -> OutboxEvent
Notifications -> recipient projection/delivery
```

Pickup alone owns `PARENT_ARRIVED` / `RELEASED`.

## Teacher publishes homework

```text
Identity -> actor
Access Control + Academics -> teacher/class authority
Class Community -> Homework/Classwork durable write
Notifications -> optional recipient projection
```

## App Admin publishes Food Menu

```text
Identity/Access Control -> actor authority
Food Menu -> canonical weekly menu
Media -> attached menu/meal assets
Notifications -> publication notification
```

---

# 24. Implementation rule

Before introducing any schema model:

1. identify the concept's row in `structure.md`;
2. confirm this file's write owner;
3. confirm no equivalent model already exists;
4. define the smallest vertical slice that requires persistence;
5. add migration/schema only with that slice;
6. prove authorization and repository boundaries;
7. update this document if the canonical authority changes.

Do not turn this file into an implementation status ledger. Current proof belongs in `progress.md`.
