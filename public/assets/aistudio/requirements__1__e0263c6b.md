# KRISTOU SCHOOL — REQUIREMENTS

Status: **PRIMARY PRODUCT ACCEPTANCE CONTRACT**

This file defines what KRISTOU SCHOOL must do. It is a behavior/acceptance contract, not a progress ledger, implementation queue, migration plan, or architecture document.

Implementation status belongs in `progress.md`.  
Architecture belongs in `structure.md`.  
Canonical data/authority belongs in `docs/CANONICAL_MODEL.md`.  
Architectural decisions belong in `docs/DECISIONS.md`.

When the product owner gives a newer explicit instruction that conflicts with this file, the newer instruction wins and this file must be updated promptly.

---

# 1. Product definition

KRISTOU SCHOOL is the mobile-first digital platform for École Primaire Privée Kristou School in Tunisia.

It serves:

- anonymous/public visitors;
- registered general users;
- parents/guardians;
- students;
- teachers;
- delegated managers/associates;
- the School Owner / App Admin.

It combines public school information, enrollment, class communities, parent-school communication, student class questions, safety-critical pickup, school food menus, teachers/administration presentation, notifications, Web + Telegram access, and optional AI assistance.

The product is not a generic social network and must not become a catch-all school ERP by default.

---

# 2. Global acceptance principles

The following are locked:

1. **Mobile first.** Phone usability is the primary interaction baseline.
2. **One KRISTOU product.** Normal Browser and Telegram WebView are delivery/authentication contexts of the same KRISTOU product. They must use one canonical React/TypeScript product frontend, one route authority, one feature implementation per capability, one shared frontend state/API integration path, one canonical backend API/application/domain behavior, and one canonical durable state. Telegram-specific code may adapt host/runtime mechanics only; it must not create a second product frontend, router, shell, feature tree, API client/state model, asset authority, or business behavior.
3. **One canonical User.** Web and Telegram identities attach to the same canonical user; there are no separate Web/Telegram product accounts.
4. **Server-side authorization.** UI visibility never grants authority.
5. **RBAC + resource scope.** Protected actions require role/capability plus the correct child/class/resource scope.
6. **Fail closed.** Identity, authorization, child/class membership, pickup authority, and security-sensitive state must be verified before action.
7. **Children’s privacy first.** Private student/family/class information is never public by default.
8. **One authoritative owner per concept.** Product behavior must not be duplicated across domains.
9. **PostgreSQL is durable truth.** Redis is transient only where explicitly designed.
10. **Arabic, French, English from foundation.** Arabic uses full RTL.
11. **Light is default.** Optional dark mode is pitch black with light/white text.
12. **Official KRISTOU brand identity.** Use the owner-approved enhanced KRISTOU SCHOOL logo without substituting a fake mascot/mark.

---

# 3. User roles

## 3.1 Anonymous / Public

Unauthenticated visitor.

May access school-approved public information only.

## 3.2 GENERAL_USER

Authenticated user with no enrolled-child or staff/class authority.

May access public/general school services and their own allowed account/inquiry surfaces.

## 3.3 PARENT

Guardian linked to one or more children.

Parent authority is limited to linked children and the resources/classes that those child links permit.

## 3.4 STUDENT

Student account associated with an active enrollment/class assignment.

Student access is limited to the student’s own enrolled class and student-safe school surfaces.

## 3.5 TEACHER

Teacher assigned to one or more classes.

Teacher class authority is scoped to assigned classes unless separately granted broader capability.

## 3.6 MANAGER / ASSOCIATE

Delegated school staff with explicit capabilities.

A manager label does not imply full App Admin authority.

Initial owner preference: no more than approximately three managers/associates, subject to later owner change.

## 3.7 APP_ADMIN / SCHOOL_OWNER

Global school application authority.

---

# 4. Authentication and identity

## 4.1 Canonical identity

The canonical model is:

```text
User
├── WebCredential / WebSession
└── TelegramIdentity
```

Not:

```text
web_users
telegram_users
```

## 4.2 No heuristic merging

Never merge identities because of matching:

- name;
- display name;
- Telegram username;
- phone;
- email;
- profile photo.

Account linking must be explicit and verified.

## 4.2.1 Web login policy

KRISTOU Web authentication uses:

- a unique normalized **login username**;
- a password stored only as a strong one-way password hash;
- an optional email address.

The optional email is not a Web login identifier. Web sign-in is **login username + password**.

An email value does not become password-recovery authority merely because it is present. Email-based recovery requires a separately designed verified-email flow.

A Telegram-originated canonical User may add a WebCredential later by choosing a unique login username and password, with email remaining optional. That WebCredential must attach to the existing canonical User rather than creating a second User.

## 4.3 Web -> Telegram linking

A signed-in Web user may choose **Connect Telegram**.

Expected behavior:

1. Web session is authenticated.
2. Backend verifies no conflicting Telegram link.
3. Backend creates a short-lived, one-time account-link code/challenge.
4. User opens/authenticates in the KRISTOU Telegram Mini App.
5. Telegram `initData` is validated server-side.
6. The code is claimed.
7. Backend attaches TelegramIdentity to the same canonical `User.id`.
8. Conflicts fail closed.

## 4.4 Telegram -> Web

A Telegram-originated canonical user may later attach Web credentials to the same `User.id`; a second User must not be created.

## 4.5 Credential conflict

If independently valid Web and Telegram credentials resolve to different canonical Users, the request must fail with a stable auth-conflict error rather than choosing one principal.

---

# 5. Languages and direction

KRISTOU supports from foundation:

- العربية;
- Français;
- English.

Requirements:

- Arabic uses `dir="rtl"`;
- French/English use LTR;
- one shared component tree, not one duplicated app per language;
- UI strings use translation keys;
- school-managed content should support translated fields where appropriate;
- layouts, menus, bottom sheets, cards, forms, and navigation must work in RTL.

---

# 6. Appearance

## 6.1 Default

Light mode is always the initial/default presentation.

Do not automatically force dark mode from OS preference.

## 6.2 Dark mode

Dark mode must be genuinely pitch black:

```text
background       #000000
surface          approximately #090909
raised surface   approximately #111111
primary text     #FFFFFF
secondary text   light neutral gray
```

Do not use a dark-blue application background.

Do not place dark text on dark surfaces.

## 6.3 Brand

The latest owner-supplied KRISTOU SCHOOL logo asset is the official app logo source.

Use that supplied artwork as-is. Do not regenerate, redraw, replace, recolor, or stylistically reinterpret it unless the product owner explicitly requests a new logo asset.

## 6.4 Phone-first scrolling

KRISTOU is a phone-device-first application.

- Touch scrolling must remain native, smooth, and unobstructed.
- Scrollable cards, sheets, menus, carousels, and panels must not show thick browser-default scrollbars.
- On touch/mobile surfaces, scrollbar chrome should be effectively transparent/hidden while preserving scrollability.
- On pointer/desktop surfaces, any visible scrollbar should be thin, transparent/low-contrast, and unobtrusive.
- Horizontal card strips must not expose an old-style horizontal scrollbar.

---

# 7. Authenticated application shell

The authenticated top bar contains:

```text
[ KRISTOU logo + KRISTOU SCHOOL ]      [ bell ] [ avatar/profile ▼ ]
```

The bell and profile menu are separate controls.

On phones, account/profile menus may use a bottom sheet or full-height panel rather than a tiny desktop dropdown.

---

# 8. Profile/account menu

The menu reflects server-issued access/capabilities; it never creates them.

Typical parent menu may include:

- My Profile
- My Children
- My Classes
- Teachers
- Administration
- Messages
- Parent Notes
- Pickup
- Food Menu
- Registration
- Appearance
- Language
- Notification Sound
- Settings
- Log out

Student, Teacher, Manager, and App Admin menus vary by role/capability.

Manager/App Admin controls appear only where the actor has the required capability.

---

# 9. Public/general surfaces

Public/general users may access school-approved public content such as:

- Home
- About / school identity
- Contact
- Teachers
- Administration / School Board
- Public announcements
- Public events/activities
- Clubs / pedagogy
- Registration information and entry points
- Food Menu when marked public
- Public gallery/calendar where configured
- General inquiry
- Public-only AI FAQ when AI is enabled

They must not access:

- private class communities;
- student lists;
- child profiles;
- private class galleries/documents;
- Parent Notes;
- private Messages;
- pickup boards/state;
- private class calendars;
- enrollment documents;
- School Control Center.

---

# 10. Parent experience

A Parent may access all allowed public/general content plus resources for linked children only.

Expected parent surfaces include:

- My Children
- My Classes
- Class Community
- Announcements
- Homework & Classwork
- Calendar
- Gallery
- Documents
- Messages
- Parent Notes
- Pickup
- Food Menu
- Registration
- Teachers
- Administration
- Notifications

Cross-child or cross-class private access is forbidden.

---

# 11. Student experience

Students access only their active enrolled class.

The Student Class Community contains:

```text
Announcements
Homework & Classwork
Calendar
Documents
Class Questions
```

## 11.1 Student Class Questions

Students may ask classmates about school/class matters such as:

- homework;
- exercises;
- lessons;
- notebooks/materials;
- reminders;
- classwork.

Locked rules:

- class-wide only;
- no private student-to-student DMs in initial scope;
- maximum 200 characters per post/reply;
- only active members of that class may read/post;
- teachers may moderate their assigned class;
- authorized managers/admins may review for safeguarding;
- reporting/moderation is supported;
- posting is rate-limited;
- posts/replies are auditable;
- class access ends immediately when active membership ends;
- no phone/email/address exposure.

Teacher Announcements, Homework/Classwork, and Student Class Questions must remain visually and semantically distinct.

---

# 12. Teacher experience

Teacher access is scoped to assigned classes unless separate capability grants broader authority.

Expected teacher functions include:

- My Profile
- My Classes
- Class Community
- official class Announcements
- Homework & Classwork
- Calendar
- Gallery
- Documents
- Parent Notes
- Messages
- Pickup Board
- Student Class Questions moderation
- Food Menu read access
- Teachers
- Administration
- Notifications

School-wide broadcast/control functions require explicit extra capability.

---

# 13. Manager / Associate capabilities

Manager access is capability-specific.

Potential accepted capabilities include:

```text
CAN_REVIEW_REGISTRATION
CAN_BROADCAST
CAN_MANAGE_PICKUP
CAN_MANAGE_PUBLIC_CONTENT
CAN_MANAGE_FOOD_MENU
CAN_MANAGE_TEACHERS_PUBLIC_INFO
CAN_MANAGE_BOARD_PUBLIC_INFO
```

The exact capability vocabulary may be refined during implementation, but broad implicit manager authority is forbidden.

---

# 14. App Admin / School Owner

The App Admin may control, subject to final implemented capabilities:

- staff/manager access;
- role/capability assignments;
- academic/class configuration;
- public content;
- Teachers directory presentation;
- Administration/School Board presentation;
- Food Menu;
- registration settings;
- pickup policy;
- broadcasts;
- moderation;
- notification configuration;
- audit access;
- system configuration.

---

# 15. Class Community

The canonical Class is the private-community authority context.

Do not create a redundant 1:1 `ClassCommunity` durable entity unless it later owns independent lifecycle/state.

A private class community may contain:

- Announcements;
- Homework & Classwork;
- Calendar;
- Gallery;
- Documents;
- Parent Notes;
- Pickup Board;
- Student Class Questions.

Visibility always derives from server-verified class/child/staff scope.

---

# 16. Homework & Classwork

Teacher-controlled class content.

Students and linked parents may read according to class membership.

A homework/classwork item may include:

- title;
- description;
- class;
- owning teacher;
- due date where applicable;
- approved attachments;
- status/timestamps.

Grades/report cards are not implied by this feature.

---

# 17. Class Calendar

May include:

- tests;
- activities;
- meetings;
- trips;
- reminders;
- school/class deadlines.

Class-specific calendar items are visible only to authorized class members/staff.

---

# 18. Gallery and Documents

## Class Gallery

Private by default and visible only to authorized class members/staff.

## Public Gallery

Separate school-approved public content.

## Class Documents

May include worksheets, notices, schedules, school forms, homework attachments, and other approved files.

Enrollment/legal/identity documents use stricter private access and must not leak into class/public document surfaces.

---

# 19. Messages

KRISTOU has a dedicated short operational messaging feature.

Locked rule:

```text
maximum 200 characters per short message
```

Messages may support:

- thread;
- read/unread;
- reply;
- actor/context;
- notification;
- moderation/audit where appropriate.

Messages must not become a loophole that bypasses Parent Note rules.

Student private direct messaging is disabled in initial scope.

---

# 20. Parent Notes

Parent Notes are a structured parent-school communication system separate from Messages.

Locked rules:

- maximum 11 parent-originated notes per day;
- parent send window: 08:00 inclusive to 18:00 exclusive, `Africa/Tunis`;
- quota resets at 08:00 `Africa/Tunis`;
- quota enforcement is concurrency-safe;
- child tag is required for child-related/class Parent Notes;
- parent may tag only their linked child;
- child must belong to the relevant class;
- teacher tag is required when the matter involves a teacher;
- tagged teacher must be assigned to the class;
- teacher/admin replies do not consume parent quota.

Suggested topics:

```text
ABSENCE
HOMEWORK
BEHAVIOR
HEALTH
PICKUP
OTHER
```

Child-specific Parent Notes are private to linked guardian(s), relevant teacher(s), and authorized staff; they are not visible to all class parents by default.

---

# 21. Notifications

KRISTOU has one unified notification inbox/bell.

Notification categories may include:

- School
- Teachers/Class
- Messages
- Parent Notes
- Pickup
- Calendar
- Food Menu
- Registration
- System

A notification is a delivery/read projection, not the canonical business event itself.

A delivery failure must not roll back the underlying business mutation.

A notification requiring response should open the correct message/note/thread rather than duplicating its body as a separate authority.

---

# 22. Notification sounds

Initial user-selectable sounds:

- Kristou Bell
- Soft Chime
- Classroom Bell
- Gentle Pop
- Silent

Preferences may be separated by category, including:

- general;
- messages;
- pickup;
- urgent school notices.

Pickup may use a distinct alert sound.

Actual background playback must respect browser/Telegram/device restrictions; the product must not promise sound where the platform forbids it.

---

# 23. Teachers directory

The public Teachers section uses school-approved cards.

Card summary:

- photo;
- name;
- role/title.

Expanded teacher information may include only school-approved public fields such as:

- biography;
- assigned public classes;
- subjects/responsibilities;
- languages;
- public contact method if explicitly approved.

App Admin or explicitly authorized Manager controls the public presentation.

Private personal contact/home information must not be exposed automatically.

---

# 24. Administration / School Board

Administration/School Board cards use the same public-directory design family as Teachers.

Possible public entries:

- School Director
- Academic Coordinator
- Parent Relations
- Administration roles approved by the school

App Admin may control:

- member;
- photo;
- title;
- public biography;
- responsibilities;
- languages;
- public contact;
- order;
- visible/hidden state.

---

# 25. La Toque Gourmande Food Menu

The school Food Menu is a first-class KRISTOU feature.

It may appear:

- on Home;
- in the account menu;
- on parent/student home;
- publicly if the school marks it public.

Content may be managed by:

- App Admin;
- Manager with explicit Food Menu capability.

A weekly menu supports:

- week start/end;
- title;
- provider attribution: **La Toque Gourmande**;
- draft/published/archived lifecycle;
- structured day entries;
- original menu image;
- meal photos;
- translated text where appropriate.

A day may contain:

- starter;
- main;
- side;
- dessert;
- notes;
- photos.

Publishing a weekly menu may generate a normal notification.

---

# 26. School Broadcasts

There is one canonical SchoolBroadcast per publication.

Audience choices:

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

Supported fields may include:

- title;
- body;
- priority (`NORMAL | URGENT`);
- attachments;
- publishAt;
- requiresAck.

Class feeds may project the broadcast using the same canonical broadcast ID; do not create independent duplicate truth per class.

Teachers do not receive school-wide broadcast authority merely by being Teachers.

---

# 27. Registration and enrollment

Account creation, guardian/student profile, staff onboarding, and enrollment application are separate concepts.

Enrollment application lifecycle:

```text
DRAFT
-> SUBMITTED
-> UNDER_REVIEW
-> NEED_DOCUMENTS
-> UNDER_REVIEW
-> ACCEPTED | WAITLIST | REJECTED
-> ENROLLED
```

Acceptance does not itself grant class/private access. Active enrollment/class assignment is required.

Academic-year age windows and document requirements must be configurable rather than permanently hard-coded.

Exact Tunisian legal/document requirements must be verified at implementation time; do not present assumptions as law.

---

# 28. Pickup — safety-critical invariant

The primary invariant is:

> **A parent may announce arrival. Only authorized school staff may release a child.**

The application must never blur `PARENT_ARRIVED` with `RELEASED`.

---

# 29. Pickup configuration

Pickup/dismissal windows are school-controlled per class/schedule.

Time authority:

```text
Africa/Tunis
server clock
```

Client device time must not decide whether pickup is open.

---

# 30. Pickup state machine

Initial production states:

```text
WAITING
  -> PARENT_ARRIVED
  -> RELEASED
```

Optional separately designed states/flags may include:

- ABSENT;
- EARLY_RELEASE;
- LATE_PICKUP.

Do not overload normal pickup with early-leave behavior.

---

# 31. Parent pickup flow

Parent sees only linked children.

Before the pickup window:

- show the next opening time;
- do not allow arrival announcement.

During the active window:

- parent may press **I HAVE ARRIVED**.

Before accepting the action, server verifies:

1. authenticated actor;
2. guardian/authorized pickup relation;
3. ParentChildLink where relevant;
4. active student enrollment;
5. correct class;
6. active server-side dismissal window;
7. valid AuthorizedPickupPerson;
8. child is not already released.

On success:

```text
WAITING -> PARENT_ARRIVED
```

The parent does not gain release authority.

---

# 32. Pickup arrival persistence and concurrency

A successful arrival records at least the canonical child/class/actor/pickup-person/time/source information needed for audit.

Web and Telegram arrival attempts resolve through the same backend command.

Duplicate/concurrent arrival must be idempotent/concurrency-safe. A short transient lock may be used, but durable history remains PostgreSQL-backed.

---

# 33. Teacher Pickup Board

The corresponding class Teacher Pickup Board updates immediately after a valid arrival.

A pickup card should show only operationally required information, for example:

- student photo;
- student name;
- class;
- `PARENT ARRIVED`;
- arrival timestamp;
- authorized pickup person and relationship;
- narrowly approved safety flag(s) only if later explicitly authorized;
- **CONFIRM RELEASE** action.

Teachers must not see unrelated enrollment/family documents merely because they can operate pickup.

---

# 34. Manager Pickup Control Center

Authorized manager/admin may see an aggregate live view by class:

- waiting count;
- parent-arrived count;
- released count;
- unresolved/late items when implemented.

Managers may inspect only pickup information their capability permits.

---

# 35. Release confirmation

Authorized staff physically verifies the handoff and deliberately selects **CONFIRM RELEASE**.

The server re-verifies:

- staff identity;
- release capability;
- class assignment or pickup-control authority;
- current pickup state;
- valid pickup authorization;
- not already released.

On success:

```text
PARENT_ARRIVED -> RELEASED
```

Persist who released the child, to whom, and when.

Parent receives release confirmation.

No automatic geolocation, AI action, timeout, or parent action may set `RELEASED`.

---

# 36. AuthorizedPickupPerson

AuthorizedPickupPerson is a separate concept from the Parent role.

A child may have school-approved pickup people such as:

- mother;
- father;
- grandparent;
- uncle/aunt;
- another explicitly approved person.

Initial scope allows a non-parent pickup person to exist as a school-managed authorization record without requiring a full KRISTOU account.

---

# 37. Early leave

Early leave is separate from normal dismissal.

Expected policy:

```text
parent/school contact or request
-> staff authorization
-> early-release record
-> adult arrives
-> staff verifies
-> staff releases
```

The normal parent-arrival button must not silently perform early release.

---

# 38. Pickup realtime and outage behavior

Authoritative flow:

```text
Parent action
-> API validation/authorization
-> durable PostgreSQL mutation
-> durable outbox/event
-> worker/realtime fanout
-> class teacher board
-> manager control board
-> notification/sound
-> Web/Telegram projections
```

The browser must not become the source of teacher/manager state.

If required live coordination is unavailable, do not display false arrival success. Fail closed and direct the parent to contact school staff.

---

# 39. Pickup audit

Sensitive pickup actions are auditable, including:

- arrival announcement;
- duplicate/denied attempt where appropriate;
- release;
- early release;
- late pickup handling where implemented;
- pickup-person authorization changes.

Audit must support answering who acted, on which child/class, when, and what state changed.

---

# 40. Media

KRISTOU uses one governed media architecture.

A canonical MediaAsset/descriptor model may support:

- teacher photos;
- administration photos;
- Food Menu images/photos;
- public/class galleries;
- announcements;
- documents;
- student photos;
- registration documents.

The owning product domain controls semantic attachment and visibility; shared media/storage infrastructure controls generic descriptor/byte lifecycle.

Private child/enrollment/class media must use authorization-controlled access.

Do not scatter unmanaged arbitrary URL fields across domains as a substitute for a media design.

---

# 41. Privacy and sensitive data

Apply least privilege to minors and family data.

Do not expose publicly:

- student lists;
- pickup state;
- addresses;
- identity documents;
- Parent Notes;
- private class media/documents;
- health/medical records;
- family relationships.

Any teacher-visible health/allergy/safety indicator requires a later explicit field/access decision and must be narrower than a general medical record.

---

# 42. AI Assistant

Possible product names include:

- Kristou Assistant
- Assistant Kristou
- مساعد كريستو

AI is optional and later-phase.

It must operate as an authorized client of the KRISTOU API, never as a second database authority.

AI access must not exceed the actor’s server-authorized access.

Allowed examples:

- public FAQ;
- registration guidance;
- navigation help;
- summarize information the actor may access;
- draft Parent Notes/messages/communications.

Human confirmation is required before sending/publishing.

AI must never autonomously:

- release a child;
- authorize pickup;
- accept/reject enrollment;
- grant staff capability;
- perform destructive record actions.

The app must remain functional without AI.

---

# 43. Infrastructure direction

Current verified candidate deployment:

## Railway

Railway is the current hosting/runtime authority for the KRISTOU candidate:

- Web frontend (`web-candidate`);
- API (`api-candidate`);
- PostgreSQL;
- Redis/Valkey.

The verified Web deployment is sourced from the repository's `deploy-candidate` lineage and builds with `npm run build:web`.

## Cloudflare

Cloudflare is not the current frontend hosting authority.

It is reserved for later AI/edge capabilities when that phase is explicitly implemented, including where approved:

- Workers / Workers AI;
- AI Gateway;
- optional R2/object storage if separately selected.

Introducing Cloudflare must not fork the KRISTOU product frontend or create a second application/runtime authority.

Local, staging, and production must use isolated configuration/secrets/data.

Provider/runtime state is mutable; fresh deployment evidence overrides stale documentation about what is currently live.

---

# 44. Security requirements

At minimum:

- strong password hashing;
- opaque/secure Web sessions;
- secure production cookies;
- CSRF/origin protection for cookie-authenticated writes;
- strict CORS/origin allowlists;
- Telegram `initData` validation;
- one-time expiring account-link codes;
- fail-closed auth conflict;
- server-side authorization;
- authentication/linking rate limits;
- schema/input validation;
- parameterized ORM/database access;
- environment-only secrets;
- no client-side bot token;
- private storage authorization/signed access;
- PII-minimized logs;
- sensitive-operation audit;
- dependency/secret/security scanning in CI once tooling exists.

---

# 45. Navigation / information architecture

Exact URL paths are **TBD until the routing foundation is designed**.

Known product surfaces are the authority; do not invent permanent routes merely to satisfy this document.

Primary authenticated navigation must surface role-relevant access to:

- Profile
- Children / My Class / My Classes
- Teachers
- Administration
- Messages
- Parent Notes where applicable
- Pickup where applicable
- Food Menu
- Registration where applicable
- Notifications
- Settings
- Language
- Appearance
- Notification Sound
- Control Center for authorized staff

---

# 46. Testing acceptance principles

Testing proves behavior, not file count.

Critical areas require focused tests appropriate to implementation.

## Identity/linking

Test:

- Web registration/login;
- Telegram validation;
- Web -> Telegram linking;
- Telegram -> Web credential attach;
- link-code expiry/reuse denial;
- auth conflict.

## Authorization

Test role/capability/resource matrices, including cross-child/cross-class denial.

## Student Class Questions

Test:

- correct class access;
- outsider/cross-class denial;
- 200-character boundary;
- 201-character denial;
- moderation;
- access removal after class membership ends.

## Parent Notes

Test:

- 11th send allowed / 12th denied;
- concurrency safety;
- 08:00 inclusive;
- 18:00 exclusive;
- `Africa/Tunis` reset;
- child/teacher scope.

## Pickup

Mandatory coverage includes:

- duplicate arrival;
- simultaneous Web/Telegram arrival;
- closed-window denial;
- wrong child/class denial;
- unauthorized pickup-person denial;
- unauthorized staff release;
- double release;
- Redis/live-coordination outage behavior;
- reconnect/current-state recovery;
- audit creation.

---

# 47. UI acceptance

Critical screens must be verified in:

- mobile Light;
- mobile Pitch Black;
- desktop Light;
- desktop Pitch Black;
- Arabic RTL;
- French LTR;
- English LTR;
- Web;
- Telegram where the runtime differs.

Touch targets, focus, contrast, sheet/dialog behavior, and safe-area handling must be accessible.

---

# 48. Non-goals / out of initial scope

Do not infer or build these without a new approved design:

- student private DMs;
- grades/report cards;
- general attendance system;
- school transport/bus;
- payments;
- lunch ordering/payment;
- QR/face/geofence automatic pickup;
- autonomous AI administrative decisions;
- separate Telegram database/product records;
- public student directory.

---

# 49. Acceptance/source-truth rule

This file states accepted product behavior, not whether that behavior is already implemented.

A feature is not complete merely because:

- a page exists;
- a button exists;
- a model exists;
- an endpoint exists;
- a mock succeeds;
- documentation says it is planned.

Completion requires the applicable source, authorization, persistence, UI, integration, tests, and runtime evidence for the exact assigned scope.

Current implementation evidence belongs only in `progress.md`.
