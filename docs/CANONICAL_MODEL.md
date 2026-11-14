# KRISTOU SCHOOL — CANONICAL MODEL

Status: **ACTIVE DATA + AUTHORITY CONTRACT**

Revision: **2026-11-14 — DOC-D3**. Repository: `funmarket/KRISTOUSCHOOL`. One school only.

This document defines canonical concepts, relationships, write owners and invariants. Accepted behavior is in [requirements.md](../requirements.md) (DOC-D1); architecture is in [structure.md](../structure.md) (DOC-D2). The Owner-approved **KRISTOU SCHOOL Master Execution Plan, revision 3**, saved as `KRISTOU_MASTER_EXECUTION_PLAN(1).txt`, SHA-256 `d0213cd47d3cbf94d749a7234a9ab29cc965448c0c39850f9d234978b053e3cd`, owns roadmap/dependencies. Dated implementation proof belongs in [progress.md](../progress.md); [docs/DECISIONS.md](DECISIONS.md) awaits its separate reconciliation.

Only this document changes in DOC-D3. Requirements, structure and the master remain unchanged. Backend implementation is paused; no code, migration, account, function, infrastructure, publication, merge or deployment is commissioned. A conceptual name below is **not an installed table, approved SQL filename, RPC signature or instruction to create schema**.

## Installed baseline versus target concepts

Read-only metadata on 2026-11-14 confirmed the following in existing Supabase project `KRISTOUSCHOOL / ofppapwofhovhroyjtkc`. Refresh exact schema/source/versions before an implementation packet. These are object/key observations, not behavioral acceptance.

| Existing public table | Observed identity/relationship | Contract interpretation |
| --- | --- | --- |
| `profiles` | `id` primary key and FK to `auth.users(id)`; username/normalized key, requested role, contact/display fields, account status/review metadata and `governance_version` | Canonical account mapping, not a generic Student/Family/academic record. A stored contact/request is not verified authority |
| `role_assignments` | Own row ID; FK `user_id → profiles.id`; unique `(user_id, role)`; active/assigner/timestamps | Several role rows may exist; effective multi-active-role policy is DG-04, not an assumed single role |
| `telegram_identities` | `user_id` primary key/FK to profile; unique `telegram_user_id` | At most one linked Telegram identity per account and one owner per Telegram ID in the current schema |
| `account_link_challenges` | Own ID; profile FK; unique `verifier_hash`; expiry/consumed/created timestamps | Explicit, expiring one-time link claim; no app credentials or arbitrary identity merge |
| `manager_capability_grants` | Own ID; Manager/grantor profile references; unique `(manager_user_id, capability)`; active/timestamps | Existing grant storage; not proof the complete grant/revoke workflow or every resource scope is implemented |
| `account_governance_audit_logs` | Own ID; actor/target profile references; previous/resulting status/roles/reason; unique `(actor_user_id, idempotency_key)` for a supplied non-null key | Existing governance evidence; not a general-purpose audit schema for every future domain |

Installed `app_role` contains exactly `APP_ADMIN, MANAGER, PARENT, STUDENT, TEACHER, SCHOOL_STAFF, ADMINISTRATIVE_PERSONNEL`, with **no GENERAL_USER**. Installed approval states are `PENDING, APPROVED, REJECTED, SUSPENDED, REVOKED`. Do not add these enums/tables again. Foreign-key delete actions are installed mechanics, not approval to delete school accounts/history; retention/recovery remains DG-07/DG-16.

The six public tables do not include school-domain People, Family, Academics, Attendance, Assessment, content or Pickup persistence. No Storage buckets and no public tables in `supabase_realtime` publication were observed; no conclusion about all Broadcast/Presence channels follows. Installed routines/migration mapping are documented in the master and dated [REMOTE_SCHEMA_INVENTORY.md](REMOTE_SCHEMA_INVENTORY.md); do not replay installed SQL or infer integration from existence.

Current `src/lib/supabase.ts` contains handwritten types for absent school tables, omits profile status in its Row type and declares no RPC functions; governance uses a separate interface/cast. Those types are not schema authority. The synchronization gate in section 24 must close the gap through an authorized vertical slice, not by creating tables to fit stale types.

For future concepts below, ownership and the stated invariant are accepted; exact physical normalization, keys, field sets, RPC shapes and access policy details are frozen under their decision gates before migration. Do not duplicate a durable concept to bypass an unsettled policy.

---

# 0. Global authority rules

1. Every durable product concept has exactly one authoritative owner.
2. PostgreSQL is durable business truth.
3. A cache is optional and transient only where explicitly designed; scalability does not require a second durable store.
4. Object storage holds binary media bytes.
5. Web and Telegram never own separate business copies.
6. Read models/projections may duplicate presentation data only when their non-authoritative status is explicit.
7. Cross-domain consumers use application ports/readers, not another domain's concrete repository/ORM model.
8. Notification/realtime failure never rewrites the canonical business event that triggered it.
9. Exposed Supabase tables/views/functions require deliberate grants and tested Row Level Security; service-role access is not a substitute for product authorization.
10. Private Supabase Storage access follows the same resource authorization as the owning product feature.
11. All durable records belong to KRISTOU SCHOOL; no other schools, school switching, inter-school memberships or registry.
12. Every mutable record has an authorized writer and correction/concurrency rule. Unique/FK/check constraints and transactions encode settled invariants; UI state is not enforcement.
13. Current permission and historical attribution are separate. Ending access does not delete valid history or make a former actor currently authorized.
14. Date-only holidays, timed events, teaching sessions and pupil marks are distinct. Use Africa/Tunis for school business time and timezone-aware instants where applicable.
15. A projection, imported spreadsheet, notification, acknowledgement or RSVP cannot become a parallel roster, mark, privilege or physical-release authority.

---

# 1. Identity & Authentication

**Write owner: Identity & Authentication**, using Supabase Auth for credential/session authority.

## User

One canonical account identity. Current physical mapping is `profiles.id → auth.users.id`; the primary/FK combination gives each profile one Auth user and at most one profile per Auth ID. Account creation must establish its required mapping through the accepted provider/trigger flow and tests. Do not add another User table, merge accounts or copy the identity model from another repository.

A school person/student may exist without credentials; People owns that identity separately (section 3). Creating/importing a student never creates an Auth account, role approval, guardian or collector.

## WebCredential

A conceptual provider-owned authority, **not a custom application password table**. Supabase Auth verifies password/contact credentials; Identity owns the chosen username and normalized lookup key in the account profile, never application-owned password hashes or a second verifier. Account display fields and school-person facts have the field owners in section 3. Public login is username or email plus password; direct phone input is rejected before provider/resolver calls. Phone-backed username resolution may use the linked phone credential internally.

Signup requires full name, password, requested role and email or phone. Phone without email requires a chosen valid username; with email it is optional. Username-only provisioning is unsupported. Full name is presentation, not identity proof. A secondary typed contact is not an Auth/recovery alias until verified and associated by the provider.

Preserve accepted Unicode/NFC normalization, uniqueness, 3–50 code-point handles, permitted Arabic/Latin/accented French names and numeric-underscore handles such as `123_456`; reject phone-like/invisible/bidi/ambiguous identifiers. Existing valid handles stay usable. No fabricated contacts, transliteration-based identity merge or browser-side private contact lookup.

## WebSession

Provider-managed session issuance, expiry, refresh and revocation; product features consume verified actor context, not a new application session table or custom cookie scheme. Keep secrets out of logs, audit, public tables and client error bodies. Preserve the accepted provider session handling; do not redesign token persistence as part of documentation work.

## TelegramIdentity

Existing link references the same canonical account. Current keys enforce one owner per Telegram ID and at most one linked Telegram identity per account. The authorized link operation must reject reassignment of an already-owned identity; uniqueness alone is not a permission check. Optional public Telegram metadata is neither role authority nor a matching key for People.

Linking uses a signed-in account, expiring challenge, server-validated fresh signed initData and atomic link claim. Later established re-entry resolves the already-linked account without creating an account or issuing a Supabase Auth session. A restored profile is not a Supabase bearer token/direct RLS authority. Future private operations must verify current actor and resource scope in the appropriate transport.

Preserve the protected `09ffacf80daa4f546140053db441abb96c68ef8b` auth/link/challenge/cache/session baseline; this contract does not authorize a rewrite, Telegram-only provisioning or handler redeployment.

## AccountLinkChallenge

Identity owns target account, hashed verifier, expiry and consumed state. Current link logic atomically verifies/consumes the challenge and binds the identity; expiry, replay, wrong target and owned-identity conflicts fail closed. Raw challenge secrets are not an audit or public read model. Do not confuse optional linking with contact verification/account approval.

## Recovery and verified contact change

Identity owns provider-backed recovery/contact verification. DG-10 freezes proof/channel, expiry/replay/rate limits, contact collision, school-assisted operator and session-revocation policy before implementation. Any local receipt/proof metadata is created only if needed for that approved operation; no speculative second recovery identity store.

Contact display/edit, ownership proof and verified Auth alias activation are distinct. Recovery preserves canonical account, roles and links; no heuristic merge, private-contact disclosure, password-reading or unrestricted administrative reset bypass. A successful phone verification does not enable public phone login.

---

# 2. Access Control

**Write owner: Access Control.** Identity supplies the verified actor; Access Control owns current account status, effective role and grants, while Family/Academics supply resource facts.

## RoleAssignment and account status

Reuse existing profile status/version/reviewer metadata and `role_assignments`. Requested role is a request, never an assignment; contact confirmation is not school approval. Seven registered roles only; GENERAL_USER means anonymous browsing and must never become a persisted role or auth fallback.

APP_ADMIN governs privileged APP_ADMIN/MANAGER appointments. Approved ADMINISTRATIVE_PERSONNEL have the ordinary school-office bundle and may review other ordinary accounts, including peers, never themselves or privileged targets. MANAGER acts only through explicit delegation. School Staff have job scope; Teacher has assigned class/subject/context; Parent has verified links; Student has own active membership. No role label grants unrestricted medical, historical correction or physical-release access.

DG-04 freezes effective multi-role precedence and handling of privileged targets before dependent changes. Do not derive policy from the ordering of role rows or a client selector.

## CapabilityGrant

Reuse `manager_capability_grants` for its installed purpose. Owner is grant/revoke authority; existing uniqueness/active state is not proof every operation/scope exists. Freeze exact action vocabulary, resource/effective scope and API contracts in the relevant governance packet; do not invent a feature-owned grant table or bypass policy with broad client capabilities.

Approved Office bundle is server policy, not a manually created grant for every office worker. Feature-specific sensitive actions still need explicit field/resource rules.

## Governance mutation and audit

Current governance RPCs and `governance_version` support the installed operation boundary. Preserve the reviewed shared-entry-lock, READ COMMITTED and fresh-caller design; source presence does not prove genuine concurrency. Do not change lock order or replace real DB acceptance with the in-memory harness.

Each accepted lifecycle/appointment/delegation change must authorize the current caller and target, enforce expected-version/idempotency policy, persist protected state and audit atomically. Caller authority revoked during a wait must be rechecked; concurrent removals cannot eliminate the last recoverable approved Owner. A null/absent idempotency key is not automatically a duplicate-request guarantee.

Pending/rejected/suspended/revoked status and revoked/expired scope deny subsequent private operations even with old sessions/open screens. Do not mutate protected Telegram lifecycle as a shortcut for a future feature’s current-authority checks.

---

# 3. People

**Write owner: People.** Owns stable school-person/student identity and permitted personal facts, not credentials, class placement, marks or guardian/collector authorization.

## ParentProfile / StudentProfile / TeacherProfile / ManagerProfile

These remain conceptual school-profile facets; SCHOOL_STAFF and ADMINISTRATIVE_PERSONNEL use the same non-duplicating person/profile discipline. A school person has one stable school identity/reference and may have no app account. If account-backed, its association to canonical User is explicit and verified; similar names/contact/photo are never identity keys. DG-02 freezes official codes, minimum fields and matching policy before imports.

An app `profiles` row is not a general student record. Do not force a child to have credentials merely to appear in a roster, or duplicate display/contact facts across separate domain-owned person tables. Exact physical split is frozen in the People slice.

## Field authority across account and school views

One existing table may contain fields with different logical owners; that does not create competing writers for the same fact. Preserve the current physical account table and restrict each field through its owning operation. Reads, copies and UI labels do not transfer authority.

| Fact | Authoritative owner | Boundary |
| --- | --- | --- |
| Account ID, username and normalized lookup key | Identity | Existing account mapping; no second person credential identifier |
| Verified Auth contact/credential association | Identity through Supabase Auth | Profile contact columns are not proof of ownership or independently editable login aliases |
| Account status, requested-role handling, review/version metadata and effective grants | Access Control | A display-profile edit never approves an account or changes privilege |
| Account display name/avatar, including existing `profiles.full_name` / `avatar_url` | People presentation policy | Permitted own-account edits do not silently change an official school-person identity or a public directory publication |
| Official student/staff identity and permitted operational contact/safety facts | People school records | School-verified record and editor policy; no automatic Auth alias activation from a contact edit |
| Guardian relation | Family | Explicit verified scope, not a name/contact match |
| Academic membership and teaching context | Academics | Profile and roster consume references; they do not write another assignment |
| Attendance, marks and educational remarks | Attendance / Assessment, respectively | Same records feed profile/history; no independently editable copied totals |
| Approved public name/photo/biography/contact presentation | School Directory | Deliberate public projection, never automatic publication of private profile fields |

## EmergencyContact and restricted safety facts

People owns school-verified contact identity/details and minimal safety facts; the relevant student relationship is explicit. A contact is not automatically guardian, app user or AuthorizedPickupPerson. Family owns guardian authority; Pickup owns collection authority.

DG-13 freezes fields, verifiers/editors/readers, relationship/custody restrictions, review/expiry and escalation. DG-07 freezes retention/export/deletion. A narrowly approved allergy/action indicator is not a clinical/disciplinary dossier. Restricted facts remain audience-filtered and excluded from public/class feeds, routine notifications and unrelated exports.

## Student Profile view

An additive projection over People, Enrollment, Academics, Family, Attendance, Assessment and permitted emergency/safety facts. Preserve existing information/layout where present; each field uses its own canonical owner. No mutable all-in-one Student Profile ledger, copied attendance totals or duplicate grade history.

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
  effective start/end and verification policy frozen in the Family slice
```

Used by:

- parent private-class access;
- Parent Notes;
- pickup authorization checks;
- child-switching UI projections.

Consumers use Family-owned readers/operations, not duplicate links in Parent Notes, Attendance, calendars or Pickup. School verifies guardian authority; signup/import/contact matching never creates it. Current reads use active verified scope; expiry/revocation removes current access without deleting historical attribution. Historical parent access is a separate approved policy (DG-07/DG-15).

Used also by absence justification, permitted child marks/report/history and the Student Profile projection. A permitted linked-child read does not grant parent mark-writing or physical release.

**Write owner:** Family.

---

# 5. Academics

**Write owner for all concepts in this section: Academics.** These are target logical records, not installed tables.

## AcademicYear

Stable year identity/configuration and lifecycle. Closing a year cannot rewrite prior memberships, assignments, Attendance or published reports. Promotion/retention/transfer/withdrawal and history access follow DG-15.

## Level

School-controlled CP through 6ème context; exact level/year configuration is approved by the school, not a hard-coded legal rule.

## Class

Stable class identity within its academic-year/level context. Class is the private community authority; no redundant one-to-one ClassCommunity entity/roster. Similar display names across years do not mean the same class membership or register.

## Subject and teaching assignment

Subject identifies the teaching subject, not a grade or menu label. A teaching assignment connects the responsible Teacher, class, subject where applicable and effective context. These references supply Attendance/Assessment and class-content scope. Exact optional/mandatory subject shapes and scheduling fields are frozen in CAL-01; no mandatory full timetable engine is implied.

## TeacherClassAssignment

Canonical effective teacher-to-class authority, refined by subject/teaching context where required. Consumers include announcements/homework, Parent Notes, Questions moderation, Attendance, Assessment and Pickup **only when its own action policy also permits**. Assignment alone never grants physical release.

Ending/replacing an assignment removes its current authority, not the attribution of prior records. Co-teaching and historical correction rights require DG-09.

## SubstituteAssignment

Identifies substitute Teacher, original responsible teaching context, covered class/subject/session, effective start/end and allowed actions. No new account role or shared credentials. Current server-time checks deny covered reads/writes before start, after expiry or revocation.

DG-09 defines overlap/replacement/co-teaching and past-record correction. The actual recording actor and original responsible Teacher remain separate. Cover cannot rewrite ownership or merge two independent teachers’ registers.

## StudentClassMembership

Canonical effective student-to-class relationship, consistent with Enrollment eligibility for the academic year. No separate roster authority in content, Profile, Attendance or Pickup. Ending membership removes current-class access; approved historical access remains separately scoped. Freeze overlapping/transfer/membership rules before dependent schema under DG-15 and the records slice.

## SchoolCalendarEvent / Closure

Canonical operational school dates, all-day holidays/closures and approved timed events. All-day dates use date-only semantics; multi-day spans cover every affected school date. Timed instants use timezone-aware storage and Africa/Tunis school-time display/rules.

School-global calendar is accessible inside Global Announcements to all seven approved roles, including people without a class. Broadcasts owns publication/audience; Class Community owns class-only content calendar; public views require explicit public approval. Shared calendar components/read models do not own new event copies.

Cancellation retains status/reason, original context and approved replacement reference; rescheduling is not destructive date overwrite. DG-14 freezes types/editors/week start, cancel/reschedule/reopen/reminder/acknowledgement effects. Physical status vocabulary and recurrence, if needed, wait for that contract. Notice acknowledgement/RSVP are not pupil Attendance.

## TeachingSession / approved register context

Canonical scheduled teaching context references class, responsible assignment/Teacher, subject where applicable and date/time/session identity. Scheduled/cancelled/completed lifecycle is separate from pupil marks; final vocabulary is frozen in CAL-01.

Two different Teachers must have independent register contexts on the same class/date. Whether the **same Teacher** has another register for repeated lessons on one day remains DG-08. Do not freeze a class/day or class/Teacher/day unique key before deciding the unit.

Cancellation or closure may affect sessions only through the reviewed academic policy; it never automatically marks pupils absent, changes a grade or sets Pickup RELEASED. Cross-domain dismissal effects require the Pickup policy. Existing event/session history survives cancellation, reassignment and rollover.

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

School operational dates/closures and teaching sessions are Academics-owned (section 5). A class feed references a school event rather than cloning dates/lifecycle. Class-only event editing remains Class Community authority. Private class content must not leak into school-global or public projections.

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

Quota enforcement and durable note creation must be concurrency-safe in the approved transactional operation. An optional transient counter cannot be the sole quota or note authority.

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

DG-17 freezes permitted participant/context combinations and abuse/moderation policy before writing threads; a private student DM is not an approved combination.

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

Audience policy:

- **All approved school accounts**: school-global member notices/calendar include all seven roles, even without class membership.
- `ALL_CLASSES`: class-targeted audience, not equivalent to all school members.
- `SELECTED_LEVELS / SELECTED_CLASSES`: only the chosen authorized academic audience.
- Explicitly public: deliberate school-approved projection; never automatic disclosure of an internal event or private class data.

These labels express policy, not new enum/RPC names. Freeze actual persistence/recipient contracts under COM-02 and DG-14.

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

A publication may reference canonical school/class events and governed attachments. Broadcasts does not own another teaching schedule or attendance count. Source publication, required audit/outbox and idempotent delivery remain distinct from recipient/read state. Preferences cannot hide a required in-app school notice; opening a notification rechecks access.

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

Bounded delivery processor (runtime choice remains separately reviewed):

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
- delivery-state projections;
- Student Profile attendance/history and published assessment summaries;
- school/global/class calendar view models referencing their owning events;
- scoped reports/exports and Control Center aggregates;
- School Settings panels orchestrating canonical domain configuration;
- office/staff work queues derived from owning operations.

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

Still excluded without new Owner scope: transport/bus operations, tuition/payments, lunch ordering/payment, QR/face/geofence automatic pickup, student private DMs, multi-school tenancy, broad medical/clinical case management and autonomous AI administrative decisions.

Attendance, absence justification, grades/report cards/educational remarks, school calendar, substitutes, rollover, recovery, narrow emergency/safety data and operational reporting are **accepted scope**, with their named design gates. Do not reinstate older exclusions or infer a bus/medical/HR subsystem from a staff-card label.

---

# 23. Cross-domain authority examples

| Workflow | Verified facts/owners consumed | Sole mutation/source authority |
| --- | --- | --- |
| Parent opens private class | Identity/Access → Family link → active Academics membership | Class Community content; no new roster |
| Parent announces pickup arrival | Actor, Family/collector relation, enrollment/membership, dismissal window | Pickup owns PARENT_ARRIVED; only authorized staff later confirms RELEASED |
| Teacher publishes homework | Current actor and effective academic assignment | Class Community owns content; Notifications derives delivery |
| App Admin publishes Food Menu | Current editor authority and Media attachment contract | Food Menu week/day publication |
| Teacher saves Attendance | Effective Teacher/subject/class/context and pupil membership | Attendance entry/correction; audit/outbox with required transaction |
| Parent explains absence | Current Family child scope and permitted absence reference | Attendance-owned justification; staff decision separate from parent submission |
| Teacher records/publishes results | Assignment, approved Assessment policy/review authority | Assessment marks and report publication; Profile is read-only projection |
| School publishes cancellation | Academic operational date/session plus editor authority | Academics lifecycle; Broadcasts links notice; no pupil mark or physical release |
| School rolls year/transfer | Approved enrollment, effective memberships/assignments and preview | Owning academic/enrollment operations; history retained and current scope refreshed |
| User recovers contact/account | Provider proof/operator authorization and existing account | Identity changes verified credential association/session per DG-10; roles/links not re-owned |

These are conceptual dependency contracts, not proof the future workflow is installed. Never claim a multi-owner operation is atomic merely because several browser calls succeeded.

---

# 24. Implementation and contract-refresh rule

Before any schema/API operation is implemented, the authorized packet must:

1. Inspect exact current schema/migration mapping, owning source and affected consumers. Identify the row/field writer and current allow/deny matrix; search before creating a model.
2. Close applicable decision gates for identifiers, register unit, grading, audiences, retention and effective-time policy. Names/fields here describe logical facts; freeze actual SQL names, keys, FK/delete actions, types and RPC/error shapes in that packet.
3. Encode settled uniqueness/referential/state/version invariants in reviewed migrations and transactional operations; preserve valid history and protected existing accounts/links.
4. Replay in clean isolated Supabase, including constraints/grants/RLS and ordinary-principal API/RPC/storage/realtime access, retry and genuine concurrency. A table, policy flag, service-role success or mocked lock schedule is insufficient.
5. Generate one authoritative Supabase TypeScript type owner from the **exact tested schema**, record fingerprint/generation command, and update every typed adapter/validator/UI consumer. Detect missing tables/columns, renamed parameters, stale types, missing grants/exposure and incompatible handlers.
6. Release compatible backend dependencies before dependent frontend, verify actual installed/deployed versions, and retain a tested recovery/forward-fix path. No blind reset/db push/history repair or redeployment of protected Telegram handlers.
7. Report scope-specific source, DB/API/UI, recovery/performance and runtime evidence honestly. Document checks prove prose consistency only; existing Owner manual login/oversight acceptance remains its own valid evidence class.

A roadmap/model entry is not mutation authorization. No migration, physical table/RPC, app code, grant or function is created by DOC-D3.

---

# 25. Attendance

**Write owner: Attendance.** Depends on People student identity, Academics membership/teaching context and Identity/Access; Family supplies parent scope, not mark authority.

## AttendanceRegister

Logical register references the approved teaching/register context and responsible Teacher. Different Teachers have independent registers on the same class/date. Its exact unit and repeated same-Teacher lessons require DG-08; never use class/day alone or silently choose per-day/per-period schema.

## AttendanceEntry and correction history

One counted entry per **student reference and approved register identity**. Allowed pupil statuses: **Present, Absent, Late, Excused**. Untouched entries display **Not recorded**; do not silently default a roster to present or absent. Whether unrecorded is represented by absence of a row or another physical shape is a packet design choice that must preserve this behavior.

Entries reference their pupil and context, recorded status and actual actor; preserve original responsible Teacher separately. Amendments include authorized correcting actor, reason, prior/resulting state and version/time lineage. Do not append a second counted mark to represent correction or overwrite another Teacher’s register. A substitute acts only on its approved covered context, under DG-09, without changing responsible ownership.

Version/concurrency and retry safeguards must prevent duplicate counted entries, lost accepted changes and unauthorized historical edits. DG-08 freezes finalization/correction windows and Parent/Student visibility. Historical attribution does not itself grant current edit rights.

## AbsenceJustification and decision

Parent-originated explanation references a verified linked child and relevant absence/context. Private attachments use Media authorization. Authorized staff acceptance/rejection/request for clarification is a separate actor/time/reason decision; parent submission cannot set Excused.

Any authorized mark correction references the decision and preserves entry history. An ABSENCE Parent Note may link this record, not become another justification owner or a mark-writing loophole. Do not assume the dedicated justification workflow inherits Parent Notes quota/time windows; freeze its actual policy before implementation.

## Attendance summaries

Profile/history/reports read the same entries and policy. DG-08 defines eligible sessions/registers, range, Late/Excused treatment and denominator before percentages. Cancelled sessions and unrecorded registers are not absences. One lesson absence never automatically means whole-school-day absence. Attendance, acknowledgement or RSVP never authorizes a collector or physical release.

**Acceptance:** two teachers’ different marks survive readback, cross-class/register access denied, safe duplicate/concurrent corrections, parent direct mark edits denied, private justifications, no misleading cancelled/unrecorded totals, and preserved context/actor history. Tasks ATT-01…05; CAL/Family/Media prerequisites apply.

# 26. Assessment

**Write owner: Assessment.** Uses People student identity and canonical academic year/class/subject/Teacher assignment. No duplicate academic roster, Parent Notes authority or independently editable Profile totals.

## AssessmentDefinition and result

Definition identifies the actual assessment/exam/assignment context and applicable school grading policy. Result references student and definition, permitted value or approved missing/exempt state, responsible teaching context, actual actor and version/history. Do not assume a scale, term, default zero or weight.

DG-11 freezes terms, scales, weights, rounding, missing/exempt rules, correction windows, approval/publication and calculation examples before schema/calculations. Assigned Teachers write only their permitted scope; academic correction/override is explicit and audited, not inferred from a role label.

## Subject summary and ReportCard

Derived results use canonical marks and the applicable versioned policy. Published reports retain the source/policy/version provenance needed to explain their outcome; draft edits cannot silently change a published result. Freeze snapshot-versus-reference storage and approved correction/republication behavior in GRD-01/03, preserving accurate history either way.

Parents/Students read only their permitted child’s/own **published** results/reports. Draft marks and other pupils’ records are denied. Approval, publication, revocation/correction and recipient delivery are distinct operations; a notification is not report publication authority.

## TeacherRemark

Educational remark references its actual child/academic context, author, intended audience and approved lifecycle. DG-12 freezes field types/audience/correction/retention and distinguishes educational remarks from restricted behavioral/safeguarding notes. No unrestricted medical/disciplinary dossier. Parent Notes, Attendance notes and Teacher remarks remain separate concepts.

**Acceptance:** policy-calculation examples, hidden drafts, cross-teacher/child denial, safe concurrent edits and publication/correction audit; Profile/report totals agree. GRD-01…04, DG-11/DG-12.

# 27. Academic-year continuity, entry and import operations

**Write owners:** People for identity, Academics for year/membership/assignment/session, Enrollment for admission/eligibility. These operations do not create another durable business owner.

## Rollover and transfer

DG-15 freezes promotion/retention/transfer/withdrawal, effective dates and historical access. Preview lists intended changes/conflicts without committing assignments; explicit confirmation executes the reviewed owning operations with safe retry, audit and defined partial/conflict behavior.

End old current scope and create/activate approved new scope without overwriting old class, assignment, pupil marks, published reports or attribution. Prior-year grades are not copied as new marks. Rollover cannot auto-approve accounts, guardian links or collectors. Ending current access does not delete history; historical reads have their separate permitted audience.

## Individual entry and CSV/XLSX import

Both use the same domain validation/writers. DG-02 freezes official IDs/templates/matching/conflicts/limits and atomic-versus-partial semantics. Names/contact similarities cannot merge people. Validate preview before confirmed commit; reject formulas/macros and unsupported credential/role/link effects. Retain exact committed/rejected outcomes, audit and retry semantics without turning the spreadsheet/receipt into a second roster.

Any staging/job/operation receipt is introduced only when required by the approved slice; it references source operations rather than owns new student identity. History preserves source IDs and actual actor while private data in receipts/exports follows DG-07.

**Acceptance:** preview causes no assignment changes, confirmed changes update current scope safely, retry does not duplicate people/memberships, partial results are explicit and previous-year history remains accurate. F2-A6/A7/A8, YEAR-01/02 and downstream Profile/history/report consumers.

# 28. Reports, settings and operational projections

Reports/exports and Control Center are authorized read projections of source domains, not editable totals or broad cross-domain SQL authority. Define range, denominator/policy and freshness so exported counts agree with Profile/source. DG-07/DG-16 freeze fields/retention/formats/download expiry, bounded jobs, audit and formula-injection protection; no cross-family, draft-grade or restricted-safety leak.

School Settings orchestrates configuration written by its owning domain: academic year/calendar, admission, dismissal, grading or delivery preference policy as approved. No catch-all mutable settings blob or retroactive rewrite of history.

Office/staff work queues consume existing admission/inquiry/domain operations. DG-19 fixes assignment/request types, statuses, assignees, data scope and the single owner of any genuinely new request lifecycle before persistence. Existing labels do not authorize HR, bus, broad medical or library ERP subsystems.

Recovery/restore reads canonical state and the required object/configuration/identity dependencies. Database backup presence alone cannot prove Storage-byte restoration. DG-16 defines recovery/performance objectives, operators, isolated rehearsal/readback and incidents. No production overwrite as a drill or implied cascade cleanup from FK delete mechanics.

**Acceptance:** scoped/field-safe outputs, matching totals, honest unavailable/partial/stale data, retry-safe operational jobs, isolated restoration and measured objectives. REP-01, CFG-01, CTR-01, STF-01, OPS-01…03 and F5 gates.

# 29. Decision gates and slice traceability

These references reuse the master’s single roadmap; they do not create another queue or authorize implementation.

| Concept / decision | Master gate and owning slice |
| --- | --- |
| Status/lifecycle and stale-session private access | DG-01/DG-06; F1 and each private slice |
| Multi-active roles / privileged targets | DG-04; GOV-C1/F1 |
| Genuine isolated RLS/concurrency evidence | DG-05; F0-R1/GOV-C1 |
| Identifiers/import policy | DG-02; F2-A1/A6/A7/A8 |
| Admission eligibility/documents | DG-03; F2-A4/F3-C1 |
| Data retention/export/deletion/audit/backups | DG-07; Media/REP/OPS consumers |
| Register unit/same-Teacher repeats/correction/visibility/statistics | DG-08; CAL-01, ATT-01…05 |
| Substitute/co-teacher/effective scope/history edits | DG-09; CAL-04, dependent ATT/GRD |
| Recovery/contact proof/operator/sessions | DG-10; REC-01/02, ACC-01 |
| Assessment policy/calculation/publication | DG-11; GRD-01/02/03 |
| Remarks/restricted-note audience | DG-12; GRD-04 |
| Emergency contacts/minimal safety facts | DG-13; PRO-01/02, permitted Pickup consumers |
| School/class dates, closures/cancellation/notice publication | DG-14; CAL-01/02/03, COM-02/03 |
| Rollover/transfer/history access | DG-15; YEAR-01/02 |
| Restore/export/performance/monitoring/incidents | DG-16; REP-01, OPS-01…03, F5 |
| Message participants/moderation | DG-17; COM-04 |
| Optional AI tools/data/provider/cost | DG-18; AI-01 |
| Office/staff request lifecycle | DG-19; STF-01 |

All eight accepted additions have owners and invariants here: calendar/cancellations, substitutes, absence justification, rollover, recovery/contacts, emergency/minimal safety, grades/reports/remarks and operational reports/recovery. Accepted inclusion does not decide unresolved school policy or imply deployed persistence.

Only DOC-D3 is completed by this edit. PR #15 remains a separate corrective candidate with overlapping documentation; future authorized publication/rebase/merge must preserve these newer contracts and the accepted local requirements/structure edits. Do not restore historical phone-login/Attendance exclusions or deploy protected Telegram handlers for parity.

Next proposed document: **docs/DECISIONS.md (DOC-D4)**, only upon explicit instruction. No automatic update to another document, master/progress, application, database, PR or deployment.
