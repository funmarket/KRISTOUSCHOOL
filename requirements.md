# KRISTOU SCHOOL — REQUIREMENTS

Status: **PRIMARY PRODUCT ACCEPTANCE CONTRACT**
Revision: **2026-11-14 — DOC-D1**, reconciled with the Owner-approved **KRISTOU SCHOOL Master Execution Plan, revision 3**, saved as `KRISTOU_MASTER_EXECUTION_PLAN(1).txt`, SHA-256 `d0213cd47d3cbf94d749a7234a9ab29cc965448c0c39850f9d234978b053e3cd`.

This is a documentation deliverable, not implementation, activation, certification or a claim of GitHub publication. Backend work remains paused. Other authorities are reconciled **one at a time**; older exclusions/auth proposals do not override these newer Owner decisions. The master owns order/dependencies; this file owns behavior. Neither authorizes implementation. Sections 1–49 retain their subject identities; sections 50–61 add accepted scope and traceability. Historical reports remain dated evidence, not active policy.

This file defines what KRISTOU SCHOOL must do. It is a behavior/acceptance contract, not a progress ledger, implementation queue, migration plan, or architecture document.

Implementation status belongs in `progress.md`.  
Architecture belongs in `structure.md`.  
Canonical data/authority belongs in `docs/CANONICAL_MODEL.md`.  
Architectural decisions belong in `docs/DECISIONS.md`.

When the product owner gives a newer explicit instruction that conflicts with this file, the newer instruction wins and this file must be updated promptly.

---

# 1. Product definition

KRISTOU SCHOOL is the mobile-first digital application for École Primaire Privée Kristou School in Tunisia.

This repository defines only KRISTOU SCHOOL, one school. Do not add other schools, school signup, accounts shared between schools, school switching, routing for additional schools, or a global school registry unless the product owner explicitly changes this decision.

It serves:

- anonymous/public visitors;
- approved school-member accounts (seven registered role categories);
- parents/guardians;
- students;
- teachers;
- delegated managers/associates;
- the School Owner / App Admin.

It combines public school information, enrollment, records/imports, class communities, school/class calendars, independent teacher Attendance, absence justification, grades/report cards/teacher remarks, academic-year continuity, communication, Class Questions, safety-critical pickup, menus/directories, recovery, emergency contacts/minimal safety information, reports, notifications, Web + Telegram and optional AI. School context is CP through 6ème; exact year/level configuration is school-controlled.

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
9. **PostgreSQL is durable truth.** Optional caches are transient where explicitly designed; scalability does not mandate Redis, microservices or a second API.
10. **Arabic, French, English from foundation.** Arabic text is supported from the foundation, while the application shell and top navigation remain stable LTR when the language changes.
11. **Light is default.** Optional dark mode is pitch black with light/white text.
12. **Official KRISTOU brand identity.** Use the owner-approved enhanced KRISTOU SCHOOL logo without substituting a fake mascot/mark.

---

# 3. User roles

## 3.1 Anonymous / Public

Unauthenticated visitor.

May access school-approved public information only, in both a normal Browser and the Telegram WebView. Opening the app from Telegram does not itself create an account or grant authenticated access.

## 3.2 GENERAL_USER — anonymous public visitor only

`GENERAL_USER` is the conceptual unauthenticated/public browsing experience, **not** a registered role, Auth account, Supabase enum value, or fallback. Visitors can browse school-approved public pages without signup. Private school services always require a verified, approved account and resource-scoped server authorization.

## 3.3 PARENT

Guardian linked to one or more children.

Parent authority is limited to linked children and the resources/classes that those child links permit.

## 3.4 STUDENT

Student account associated with an active enrollment/class assignment.

Student access is limited to the student’s own enrolled class and student-safe school surfaces.

## 3.5 TEACHER

Teacher assigned to one or more classes.

Teacher authority is scoped to assigned classes/subjects/teaching contexts unless explicitly extended. Different teachers have independent Attendance registers; one cannot overwrite another. Cover follows section 53.

## 3.6 SCHOOL_STAFF

School staff are school personnel who support student wellbeing, learning resources, health, operations, facilities, safety, meals, transportation, or additional needs. The role is a requested account category; it does not grant access until the school assigns explicit capabilities and resource scope.

The School Staff category includes:

- Guidance Counselors and School Psychologists: mental health support, emotional guidance, and academic counseling;
- School Nurses and Health Technicians: student medical needs, first aid, and prescriptions;
- Librarians and Curriculum Developers: media resources and instructional materials;
- Secretaries and Attendance Clerks: office management, attendance, and family communication;
- Caretakers and Cleaners: facility maintenance, repairs, and classroom sanitation;
- Security Guards: campus entry monitoring and physical safety;
- Cafeteria Staff: daily meals for students and faculty;
- Transportation Workers and Special Needs Assistants: bus transit, student arrival logistics, and additional-needs support.

## 3.7 ADMINISTRATIVE_PERSONNEL

Approved `ADMINISTRATIVE_PERSONNEL` receive the standard ordinary school-administration bundle automatically: academic/curriculum coordination, class and student records, teacher support, school guidance, registration/admission, parent relations, individual data entry and validated CSV/XLSX import. They may approve, reject, suspend, revoke or reactivate **other** ordinary-role accounts, including other Administrative Personnel, but may never govern their own account or any `APP_ADMIN`/`MANAGER` target. Signup requesting this role grants nothing until separately approved. This is accepted authority; implementation evidence is recorded separately.

## 3.8 MANAGER / ASSOCIATE

Delegated school staff with explicit capabilities.

A manager label does not imply full App Admin authority.

Initial owner preference: no more than approximately three managers/associates, subject to later owner change.

## 3.9 APP_ADMIN / SCHOOL_OWNER

Global school application authority. Only an existing authorized `APP_ADMIN` may appoint or govern `APP_ADMIN` and `MANAGER` privileges. A public signup selection of either role is not authorization.

## 3.10 Governance and lifecycle acceptance

| Actor | Accepted authority | Boundaries |
| --- | --- | --- |
| APP_ADMIN | School-wide application governance; ordinary account review; Owner/Manager appointments; school operations | Preserve at least one recoverable approved Owner; audited explicit actions |
| MANAGER | Operational and ordinary-review actions explicitly delegated by Owner | No implicit full access, Owner/Manager governance or physical release authority |
| ADMINISTRATIVE_PERSONNEL | Automatic standard school-office bundle after approval: classes/students, teacher coordination, admissions, family relations, manual entry/import and other ordinary-account lifecycle | No self-account lifecycle, no APP_ADMIN/MANAGER governance, no automatic full medical access or Pickup release |
| TEACHER | Assigned class/subject/session work; attendance, grades and remarks within policy | No other teacher's register overwrite; no school-wide private roster by role label |
| PARENT | Verified linked children, permitted class resources, explanations/communications and eligible pickup arrival | No attendance/grade authority, other-family records, private staff notes or physical release |
| STUDENT | Own approved student-safe resources and active class scope | No classmate dossiers, private student DMs, or attendance/grade writes |
| SCHOOL_STAFF | Explicit job/resource capability; reads school-wide notices/calendar as an approved school user | No implicit school-wide roster, health dossier, governance or release |
| Anonymous | Approved public school information | No private school/global member calendar, rosters, family, class or release data |

Administrative Personnel may approve/reject/suspend/revoke/reactivate other ordinary accounts, including peers. Deny actions against any target holding/requesting privileged authority beyond their scope. A Manager requires explicit grants. New academic/medical/assessment functions must refine field/action rules rather than treating the office bundle as unrestricted access to everything.

Private actions require current approved status, effective role/capability and resource scope. Pending/rejected/suspended/revoked accounts cannot regain private access through old sessions, cached roles or open screens. Requested role/contact confirmation is not approval.

Lifecycle/role/delegation actions require deliberate server authorization, safe audit and stale/concurrent-update handling. Grants/revocations affect subsequent protected requests. Caller authority revoked while waiting cannot be reused. Preserve at least one recoverable approved Owner; no public-signup privileged bootstrap. Multi-active-role precedence remains DG-04, not array-order policy.

Acceptance: allowed ordinary peer review; denied Office self/privileged review; Manager grant/revoke; unauthorized appointment denial; genuine two-session last-Owner and post-wait caller-revocation checks. In-memory schedules are not database concurrency proof.

---

# 4. Authentication and identity

## 4.1 Canonical identity

The conceptual relationship is (not a request for custom credential/session tables alongside Supabase Auth):

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

## 4.2.1 Web account and login policy — AUTH-LOGIN-02

This is the single current identifier policy; older all-seven-combinations proposals and direct public phone-login wording are superseded.

- Public sign-in: chosen username/handle OR email, plus password. Direct phone-number input is rejected before provider/resolver calls with localized guidance.
- Signup: full name, password, requested role, and email or phone (or both). Phone without email requires a chosen valid username. With email, username is optional. Full name is display information, not a login identifier. Username-only credential provisioning remains unsupported.
- Preserve Unicode username normalization/uniqueness, supported Arabic/Latin names and valid numeric-underscore handles such as `123_456`. Reject phone-like usernames. Keep phone entry separate and retain existing Tunisian/international normalization.
- Phone-backed accounts authenticate through the username resolver's internal phone credential path. Do not disable Supabase phone credentials. A secondary contact is not automatically a verified login/recovery alias. Prefill login with email or username, never phone.
- Keep existing password policy and confirmation handling; re-inspect source before freezing exact policy changes. No custom public password table, synthetic contact alias, browser-side contact lookup or heuristic identity merge.
- Seven account roles only: APP_ADMIN, MANAGER, ADMINISTRATIVE_PERSONNEL, TEACHER, SCHOOL_STAFF, PARENT, STUDENT. GENERAL_USER denotes anonymous public browsing only, never an account/enum/fallback role. Requested signup role never grants permission.
- Approval is required before private access. Contact verification, app-account approval, student admission, enrollment, guardian linking and class placement are distinct transitions.
- Preserve optional explicit Telegram linking, challenge/HMAC validation, established re-entry/cache/session behavior against the agreed `09ffacf80daa4f546140053db441abb96c68ef8b` reference. Telegram lifecycle modifications and handler redeployment remain outside GOV-01/AUTH-LOGIN-02. This contract does not revive the withdrawn Telegram rewrite.
- Future private operations in Telegram require server-verified identity and the same resource policy. A restored profile is not by itself a Supabase Auth session. Define/verify each feature's transport without silently redesigning established authentication.

| Signup contacts | Username | Required behavior |
| --- | --- | --- |
| Email, with or without phone | Optional | Supported credentials; public sign-in by email or chosen username after applicable verification/approval |
| Phone without email | Required | Phone-backed credentials; public login by chosen username |
| Phone without email or username | Missing | Reject with localized guidance; do not leave an unusable account |
| No email or phone | Any | Reject unsupported credential provisioning |

Preserve accepted 3–50 Unicode code-point username validation, NFC normalization, permitted Arabic/Latin letters/marks, accented French, internal spaces/separators and consistent normalized uniqueness across client/server/database. Reject control/invisible/bidi characters/invalid boundaries. Existing valid ASCII handles remain usable. No separate transliteration/French identity model. Keep validated Tunisian `+216` and explicit international phone normalization; never guess ambiguous foreign numbers.

---

## 4.2.2 App signup is separate from school admission

App signup creates an authenticated application account. It does not enroll a child, submit an admission request, or replace the school registration/admission flow. The existing Registration surface remains the separate school-owned enrollment process for student admission.

## 4.2.3 Registration and pending-approval feedback (`AUTH-UX-01` & `AUTH-UX-01-FIX1` — 2026-11-13)

Creating application credentials does not immediately authorize access to private school workspaces. The authentication modal provides localized feedback in Arabic (`ar`), French (`fr`), and English (`en`) that distinguishes between:

1. **Registration received without outstanding contact confirmation:** Explains that the registration request was received, access to private school spaces requires approval from KRISTOU SCHOOL administration, and the applicant will be able to access their school workspace after approval.
2. **Registration received with contact verification required:** Explains both that the applicant must verify their email address or phone number through the authentication provider and that private school access still requires approval by authorized KRISTOU SCHOOL personnel (confirming contact alone does not activate a school role). When a secondary phone is supplied alongside email, also explains that phone verification is separate and public sign-in uses username or email.
3. **Valid credentials without an active approved school role (`account_not_approved`):** Explains with neutral, accurate wording that credentials were accepted, the account does not currently have access to private school workspaces and may still be awaiting administrative approval, and the user should contact school administration if assistance is needed—while keeping private school workspaces inaccessible and signing out the unapproved session.
4. **Contact confirmation required on sign-in (`contact_not_confirmed`):** When the authentication provider returns an explicit `email_not_confirmed` or `phone_not_confirmed` error code, explains in the active language that the user must verify their email or phone number with the provider and that private school access also requires administrative approval.
5. **Invalid credentials (`invalid_credentials`):** Preserves generic invalid-credentials feedback exclusively for genuine authentication rejections (`invalid_credentials` / `invalid_grant` provider codes or explicit `Invalid credentials` / `Invalid login credentials` sentinels), never presenting wrong credentials as pending approval.
6. **Unexpected sign-in failure (`sign_in_failed`):** Network errors, provider unavailability, profile lookup failures, missing configuration, or unknown exceptions display a safe localized sign-in failure message (`signInFailedMessage`) without falsely claiming the password is wrong and without leaking raw provider/database internals.
7. **Approved account sign-in:** Routes the user to the canonical homepage for their approved role (`APP_ADMIN`, `MANAGER`, `ADMINISTRATIVE_PERSONNEL`, `TEACHER`, `SCHOOL_STAFF`, `PARENT`, `STUDENT`).

## 4.3 Web -> Telegram linking

A signed-in Web user may choose **Connect Telegram**.

Expected behavior:

1. Web session is authenticated.
2. Backend verifies no conflicting Telegram link.
3. Backend creates a short-lived, one-time account-link code/challenge.
4. User opens the KRISTOU Telegram Mini App through its configured direct link carrying the challenge as `startapp`.
5. The server validates fresh Telegram `initData` and reads the challenge from its signed `start_param`.
6. One database operation claims the challenge and attaches TelegramIdentity to the same canonical `User.id` atomically.
7. Conflicts, invalid/expired challenges, and replays fail closed.

## 4.4 Telegram Mini App account use

The shared app signup form is available in Telegram WebView and uses the same app credentials as Browser. Telegram `initData` validates explicit linking and established later re-entry to the already-linked account; it does not create an account or issue a Supabase Auth session. An unlinked visitor remains public until explicit shared-app signup/sign-in. Preserve the baseline specified in section 4.2.1; no withdrawn Telegram rewrite or handler redeployment is commissioned.

Do not treat a Telegram username, name, phone, or email claim as app credentials or as authority to merge accounts.

## 4.5 Credential conflict

If independently valid Web and Telegram credentials resolve to different canonical Users, the request must fail with a stable auth-conflict error rather than choosing one principal.

---

# 5. Languages and direction

KRISTOU supports from foundation:

- العربية;
- Français;
- English.

Requirements:

- Arabic, French, and English use one shared component tree;
- changing language must not mirror or reposition the application shell, top navigation, profile menu, or modal controls;
- Arabic text must render correctly inside the stable LTR shell;
- UI strings use translation keys;
- school-managed content should support translated fields where appropriate;
- layouts, menus, bottom sheets, cards, forms, and navigation must remain stable across languages.

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

All seven account-role menus vary by capability. Every approved role reaches Global Announcements/school calendar even without a class. Own Profile, histories, published reports, recovery and settings reach actual permitted features when delivered, not generic Home or unrelated pages.

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

Cross-child/class access is forbidden. Parents also receive school-global notices/calendar, permitted child Attendance/history, absence justification and published reports/remarks; DG-08 freezes Attendance visibility. No draft grades/restricted staff notes.

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

Teacher Announcements, Homework/Classwork and Questions remain distinct. Students also read school-global notices/calendar and own permitted Attendance/history/published results, never classmate dossiers/draft marks/restricted remarks. Historical access follows approved year policy.

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

School-wide broadcast/control **mutations** require explicit capability; every approved role may read global notices/calendar. Teachers also record own assigned Attendance/permitted grades/remarks; substitutes are time/resource bounded with responsible teacher and actual actor distinct.

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

Owner oversight retains `APP_ADMIN` as actor, shows viewed-workspace/actor banner and **Return to My Home** without impersonation/role mutation. Manager oversight requires explicit delegation, never Owner authority. School Settings/Control Center consume domain-owned configuration/authorized aggregates rather than duplicate truth.

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

Grades/report cards are separately accepted in section 54; homework completion is not an automatic grade or Attendance mark.

---

# 17. School and Class Calendars

Accepted: School calendar, holidays and cancelled sessions are accessible to all APPROVED registered school users across all seven roles **inside Global Announcements**. Class calendar remains inside Class Community for authorized members/linked guardians/staff. Pending/suspended/revoked accounts do not gain private access merely by being registered.

Adopt Hooma Athletes → Communities calendar interactions: month arrows, Today, selected date, date markers/counts, agenda below, inline authorized creation/editing and visible cancellation. Use KRISTOU's existing styles and localized copy. The accepted reference is source + Owner screenshots, not a requirement to import Hooma's sports permissions, neon colors, Prisma/API/worker topology, Photo Board or Whistle Board.

Required adaptation: Africa/Tunis school-time authority; date-only all-day holidays; multi-day spans shown on every affected date; school/global and class scope; loading/empty/error/denied states; upcoming agenda; cancellation reason and replacement date; audience-safe notifications. A school-wide event is referenced into relevant class views, not separately cloned and edited per class/homepage.

Proposed architecture to ratify in DOC-D2/D3: Academics owns school operational calendar/closures and teaching-session changes; Class Community retains class-content calendar items; Broadcasts owns global notice publication linking to canonical event references. One shared calendar component consumes authorized view models from those owners. School-wide operational notice audience must include approved staff even without class membership; do not equate it with only ALL_CLASSES recipients.

Optional event response follows type: RSVP may suit optional meetings/events; acknowledgement may suit important notices. RSVP, notice acknowledgement and teacher-recorded attendance are distinct. No automatic RSVP attendance. Notification preference must not become permission to hide a required in-app school notice.

Class events include tests/activities/meetings/trips/reminders/deadlines. DG-14 freezes editor authority, week start, types and cancellation/reopen/reminder/acknowledgement policy before publishing.

Acceptance: all approved roles without class membership reach the school calendar; anonymous/unapproved and cross-class access fail; all-day/multi-day dates survive device timezone changes; concurrent edits/cancellations/replacements and notifications retain one source. Calendar effects never automatically mark absence/change grades/release a child.

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

# 26. Global Announcements and School Broadcasts

One canonical publication projects into authorized feeds using the same source identity.

| Audience | Required behavior |
| --- | --- |
| All approved school accounts | Global notices/calendar reach all seven roles, including staff without a class |
| ALL_CLASSES | Class-targeted; not a substitute for all-school recipients |
| SELECTED_LEVELS / SELECTED_CLASSES | Selected authorized level/class recipients |
| Explicitly public | Approved public projection without private student/class data |

Audience labels describe policy, not permission to invent enums/RPCs. Owner/explicitly delegated editors draft/schedule/publish/revoke; Teacher status grants no school-wide publishing. Retain `DRAFT | SCHEDULED | PUBLISHED | REVOKED`, title/body, governed attachments, `NORMAL | URGENT`, publication time and configured acknowledgement. Calendar notices link to canonical events, not duplicate schedules.

Acceptance: all-role access, wrong-audience denial, private/public isolation, server-time/idempotent publication, revoked-content behavior and safe notification retry/access recheck.

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

ENROLL-D01: authorized staff explicitly complete an accepted admission into a new or
explicitly selected canonical student, with optional verified linkage to the attached
Parent account. Completion is atomic and retry-safe, requires a durable admission
receipt before ENROLLED, and may leave the student unassigned for later class placement.
No account/contact heuristic, automatic class authority, or duplicate student is allowed.
Legacy status-only ENROLLED applications require the same explicit completion operation.

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
-> authorized delivery/realtime fanout
-> class teacher board
-> manager control board
-> notification/sound
-> Web/Telegram projections
```

The browser must not become the source of teacher/manager state.

Keep the backend-unavailable lock until isolated/staging acceptance and explicit activation. Reject unsafe actions when required coordination prerequisites fail, with school-contact guidance. If a durable transition already committed but delivery is delayed, show confirmed state and delivery uncertainty; never claim rollback or invite duplicate release. Retry/readback uses operation identity/current authoritative state; reconnect refreshes boards/counts, never release authority from stale cache.

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

Emergency contacts/minimal safety information are accepted in section 57. Every teacher-visible field still requires DG-13 field/action/audience policy; no blanket medical access.

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

# 43. Platform and integration requirements

Continue the existing Vite/React/TypeScript product in `funmarket/KRISTOUSCHOOL` and existing Supabase backend. Auth verifies Web credentials; PostgreSQL is durable truth; narrow RPCs/Edge Functions enforce operations; governed Storage supplies private bytes when implemented. Vercel is the current frontend host, not deployment authorization. Old `funmarket/Kristou` infrastructure is historical.

Isolate local/staging/production configuration/data/secrets. Source-controlled schema/grants/RLS/views/RPCs/functions/storage/realtime must match feature contracts. Installed objects/RLS flags are not integration proof. Mutable inventories belong in dated evidence/master state, not permanent product claims.

Each schema/RPC change requires clean isolated replay and ordinary allowed/denied callers, one authoritative generated TypeScript database-type owner from the **exact tested schema**, fingerprint/reproducible generation command, and all adapters/validators/UI consumers updated. Detect missing columns, renamed parameters, stale types and missing grants/exposure; compilation cannot replace actual API success/error/denial and durable readback.

Compatible backend dependencies precede frontend release; verify installed contracts/deployed version/recovery path. No blind replay of installed SQL/history repair, replacement database, second Owner bootstrap or protected Telegram redeployment. This is acceptance policy, not mutation authorization.

---

# 44. Security requirements

At minimum:

- strong password hashing;
- provider-managed secure sessions/expiry/refresh/revocation without parallel password/session stores;
- secure cookies/CSRF **where cookie-authenticated writes are used**, without imposing new architecture over accepted provider sessions;
- origin protection appropriate to actual Browser/Telegram transport;
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

Preserve existing canonical tab/subtab and role-home navigation; inspect destinations before changing them. No new router/invented permanent paths are required by this document.

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
- Telegram link-proof validation;
- Web -> Telegram linking;
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
- actual configured coordination outage/delayed-delivery behavior;
- reconnect/current-state recovery;
- audit creation.

---

# 47. UI acceptance

Critical screens must be verified in:

- mobile Light;
- mobile Pitch Black;
- desktop Light;
- desktop Pitch Black;
- Arabic text direction within stable LTR shell/navigation (no global mirroring);
- French LTR;
- English LTR;
- Web;
- Telegram where the runtime differs.

Touch targets, focus, contrast, sheet/dialog behavior, and safe-area handling must be accessible.

---

# 48. Non-goals / out of initial scope

Do not infer or build these without a new approved design:

- student private DMs;
- broad medical/clinical case management;
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

Evidence belongs in dated records such as `progress.md`; the master links inventory/manual acceptance/gates. Preserve the Owner-reported successful live login/non-impersonating walkthrough as manual evidence; neither erase it because an agent did not repeat it nor promote it to RLS/concurrency/all-feature proof.

Document checks prove text/coverage only; unit/source checks prove exercised behavior. Actual database/API/private-object/UI/recovery/performance evidence is required at the exact revision. Maturity: planned → UI/contract → backend installed → real integration → staging → explicitly approved live acceptance. No checkbox skips a stage.


---

# 50. School records, import and Student Profile

People owns student identity, independent of login credentials. Enrollment owns eligibility/application decisions; Academics owns year/level/class/subject/teaching assignment/membership. Family owns verified guardian links. A student record/import does not create credentials, approve roles, merge people or establish pickup authority.

Support individual forms AND CSV/XLSX preview/confirmed import using the same domain writers. Review templates, identifiers, duplicate/conflict policy, size/row limits and atomic-vs-partial behavior before commit implementation. Never infer identity from matching names/contacts, execute spreadsheet formulas/macros, or report partial success ambiguously.

Student Profile additions preserve existing information and layout where present. Inspect the existing roster, child summaries and profile consumers before adding missing sections: identity/enrollment, permitted guardians/emergency contacts, attendance history, assessments/report cards, teacher remarks and minimal permitted safety information. A roster summary alone does not satisfy the full persistent profile contract. Do not put these domains into one denormalized `students` record. Scope every field and audience; history must survive transfer and year rollover.

Approved Office personnel have the ordinary records bundle; Owner/authorized Manager act within policy. Parent reads linked child, Student self, Teacher assigned context, Staff permitted job fields. Classes & Students supports search/filter/pagination, roster, Add/Edit/Assign/Import and actual Profile/history links. Individual forms/imports use the same writers.

Acceptance: row/field errors and exact committed/rejected counts under DG-02; retain inputs on recoverable failure; audited retry-safe commit; durable reload/readback; cross-family/class DB/API/storage denial; profile/roster/history agreement after corrections/transfers. Dependencies: Identity/Access, People, Academics, Enrollment, Family, Media as needed; F2-A1…A10, PRO-01/02.

# 51. Teacher-specific Attendance

Accepted: Different teachers record their own independent attendance in their assigned teaching context. Teacher A's entry must not overwrite Teacher B's. Include class, subject, teacher and date/session identity; class/day alone is insufficient. Preserve the Owner's clarification that teachers' registers are separate. Whether the SAME teacher takes a second register for repeated lessons on one day remains DG-08; do not silently decide it from a proposed schema.

Statuses: Present, Absent, Late, Excused; untouched roster entries display Not recorded. No silent present/absent default. Teaching-session states (scheduled/cancelled/completed, with final vocabulary frozen in CAL-01) are separate from pupil attendance states.

One authoritative attendance entry per pupil and approved register/session identity. Attendance history and totals read these same records. Updates amend an entry with actor/reason/version history; they do not append duplicate attendance counted twice. Preserve responsible teacher and actual recording/correcting actor separately, particularly for substitutes.

Parent justification is a separate submitted explanation/document for a linked child's absence. Authorized staff accepts/rejects/requests clarification under an approved policy; a parent's submission does not change attendance to Excused by itself. Attachments remain private; reasons must not leak to class/public feeds.

Statistics require defined eligibility, register unit, date range, Late/Excused treatment and denominator. Show honest counts before a percentage if policy is unresolved. Cancelled sessions and unrecorded registers are not pupil absences. Never derive a school-day absence simply from one teacher's lesson absence. Attendance does not change Pickup RELEASED or collector authority.

Assigned Teachers write own context; substitutes follow section 53; academic corrections need explicit policy; Parents/Students cannot write marks. DG-08 freezes same-teacher repeated lessons, visibility/corrections/statistics.

Acceptance: two Teachers save different marks for the same pupil/date and both survive readback; cross-teacher/unrelated-class writes denied; retry/concurrent corrections safe without duplicate totals/lost changes; actual actor/responsible teacher/history retained; cancelled/unrecorded sessions and undecided denominators cannot create false absence rates. Save/edit exposes pending/confirmed/validation/error/version conflict. ATT-01…05 depend on records/assignments and CAL session policy.

# 52. Absence justification

Parent submits a private explanation/allowed attachment for a verified linked child. Authorized staff accepts/rejects/requests clarification under policy. Explanation/decision is distinct from the mark; no automatic Excused on submission. Authorized correction references decision/prior history.

An ABSENCE Parent Note may link this workflow, not create duplicate justification or bypass note rules. Do not assume dedicated justification inherits Notes quota/window. DG-08/DG-07 freeze correction/visibility/retention.

Acceptance: guessed-child/file/direct mark edits denied; permitted staff decisions/corrections traceable; retry safe; notifications/exports private. ATT-04 depends on Attendance, Family and private Media.

# 53. Substitute-teacher assignments

Real substitute, covered class/subject/session, original responsible Teacher, start/end and permitted actions are explicit. No shared passwords/new role/unbounded access. DG-09 freezes co-teaching/reassignment/history corrections.

Before the assignment starts, after expiry or after revocation, covered reads and writes are denied server-side, including from an already-open screen. While effective, only the approved covered actions and resources are allowed. Attendance and grades retain the responsible teaching context and actual recording actor; replacement cannot move or erase history. Historical access requires its separately approved policy.

Acceptance: time-boundaries, early/expired/revoked/cross-class denial, permitted cover/actor attribution under concurrent reassignment. CAL-04 supplies downstream ATT/GRD prerequisites.

# 54. Grades, report cards and Teacher remarks

Accepted feature scope: teacher assignment/exam assessment entries, grades/subject summaries, term/semester/report-card publication and teacher remarks. Exact scale, weights, rounding, missing/exempt treatment, terms and publication/edit windows require school policy DG-11. Never invent a national or school grading scheme.

Assigned teachers enter permitted assessments/remarks for their teaching scope. Authorized academic administration reviews/corrects with reason/audit under approved rules. Parents/students see only their permitted child's/own published results; draft marks and restricted behavioral/safeguarding notes require separate audiences. Cross-teacher editing, administrative override and historical access must be defined. Teacher remarks are distinct from parent-originated Parent Notes, attendance notes and confidential staff case notes. Do not create unrestricted clinical or disciplinary dossiers.

Missing is not implicitly zero. Published/finalized results cannot change silently through drafts; preserve versions/approved correction/republication. Totals derive from canonical marks/policy, not editable Profile totals.

Acceptance: cross-teacher/child denial, hidden drafts, approved missing/exempt/rounding examples, conflict-safe edits, review/publication/correction audit and identical Profile/report output. GRD-01…04 depend on canonical assignments/records and DG-11/DG-12. This scope is accepted, no longer excluded.

# 55. Academic-year rollover and history

Rollover supports academic years, enrollment renewal, promotion/retention/transfer/withdrawal and new class/teacher memberships. Preview and confirm changes with audit/idempotency. Never overwrite previous-year records, copy grades into a new year as new marks, or auto-approve accounts/guardians/collectors. Decide access to historical records explicitly; immediate current-class access removal does not justify deleting history.

DG-15 freezes eligibility/effective dates/history policy. Preview errors/changes before explicit confirmation and audited commit.

Acceptance: preview changes no memberships; permitted promotion/retention/transfer changes scope; duplicate confirmation safe; partial/conflicting outcomes follow policy; prior Attendance/reports stay accurate. YEAR-01/02 depend on academic/enrollment and history/Profile/report consumers.

# 56. Account recovery and verified contact changes

Forgotten handle/password and lost contact access are supported for username/email and phone-backed username users via actual credential paths. DG-10 freezes proof/channels/expiry/replay/rate limits, sessions/operator procedure/re-verification.

Contact edit is not ownership verification. No new Auth/recovery alias without verified ownership/provider association/safe collision handling. No merging/private-contact handle lookup/password reading/unrestricted admin reset bypass. School-assisted recovery retains canonical identity/roles/links with operator authorization/audit.

Acceptance: wrong/expired/replayed proof/collision/unauthorized operator/enumeration denied; lost-contact process followed; successful recovery preserves identity/relationships and approved session policy. REC-01/02, ACC-01. No public phone login.

# 57. Emergency contacts and minimal safety information

School-verified contacts/minimal operational fields are accepted, not a medical/family dossier. DG-13 freezes fields/verifiers/editors/readers/review/expiry/escalation/custody restrictions; DG-07 retention/export/deletion. No invented legal/consent policy.

Contact is not automatically guardian/account/AuthorizedPickupPerson. Specifically permitted staff see only necessary safety/action indicators. Office/Teacher/Manager/Pickup access grants no full medical/enrollment documents. No restricted details in public/class feeds/routine notifications.

Acceptance: field-level audiences, guessed-child/file denial, correction/review audit and expired/revoked contacts. PRO-01/02 depend on People/Family/private Media; Pickup consumes only approved fields.

# 58. Reports, exports, recovery and production readiness

Scoped Attendance/academic/enrollment/roster/communication-delivery reports follow verified role/resource needs; Parent/Student get only permitted child/self outputs. Reports are canonical read projections, not duplicate editable ledgers.

DG-07/DG-16 freeze audience/fields/formats/retention/bounded jobs/download expiry/audit. Prevent spreadsheet formula injection; UI/Profile/export totals agree for the same definition/range; no cross-family/draft/safety leaks.

DG-16 sets measured service/load/recovery/backup objectives, owners/alerts/incidents. Verify database **and required object/configuration/identity dependencies**; a database backup alone does not prove Storage-byte recovery. Rehearse isolated restore/application readback, never production overwrite as drill. Record rollback/forward-fix/deployed revisions/delivery retries/escalation.

Scalability requires pagination/bounded imports/exports/indexes and measured policy/query/load behavior, not invented SLA/speculative fleet. CI/staging verifies security/contracts/migrations and accessible mobile/trilingual/theme Browser/Telegram flows at exact candidate. Explicit approval follows scope-specific evidence before protected activation.

Acceptance: scoped export denial/formula-safe outputs/authoritative totals/failed-job retry/isolated restore/performance/alerts meet approved examples/targets. REP-01, OPS-01…03, F5-V1…V3. A build/table count/hosted status/document check alone is not production readiness.

# 59. Complete wiring of every existing page and action

Preserve eight homes (public plus seven roles), existing style, Owner Teachers → Classes → Registration, profile-menu pattern and non-impersonating oversight. Inspect current controls/destinations; reuse views.

| Surface | Required end behavior |
| --- | --- |
| Pending Account Approvals; User Directory & Account Status | Authorized list/detail/review/status/conflict/error and durable readback |
| Manager Delegation; Role & Permission Governance | Owner privilege/bounded grants; no Office self/privileged changes/last-Owner lockout |
| Directory & Public Site Oversight | Approved Teachers/Administration/public edits/publication; exclude private People |
| School Settings | Domain-owned school/year/calendar/admission/dismissal/preferences config |
| Control Center | Authorized current aggregates/source links/stale/loading/error |
| Classes & Students | Add/Edit/Assign/Import/search/filter/pagination/roster → permitted Profile/history |
| Registration | Durable intake/review/private documents; no local-only submitted flag |
| Global Announcements / Broadcasts | All-school/targeted scope/scheduling/publication/revocation/calendar |
| Pickup / Pickup Desk / Teacher board / Manager summary | Safety lock until accepted; distinct arrival/release/collectors/live/reconnect/audit |
| Food Menu / Cafeteria | Canonical week/day/images/draft/publish/archive; no ordering/payments |
| Public content / Home / Footer | Approved news/about/contact/activities/clubs/levels/gallery/calendar and actual inquiry/admission |
| My Children / My Classes / My Class | Verified relationships/selection, global notices without a class |
| Class Announcements / Homework & Classwork / Calendar / Documents / Gallery | Durable scoped content/Media/canonical Class |
| Messages / Parent Notes / Questions | Distinct correct destination/policy; Messages routing to Notes is incomplete |
| Attendance / Absence; Grades / Reports / Remarks | Real workflows/history, not placeholder panels |
| My Profile / account / school-person details | Actual own-profile/permitted edits/recovery; Home redirect is not profile |
| Bell / notices / sound / language / theme | User-scoped read/delivery/preferences/authorized deep links/truthful platform support |
| Office Desk / My Work Queue / My Tasks / Requests / facilities/service desks | DG-19 approves workflow or explicit placeholder deferral; labels do not authorize ERP/transport/medical expansion |
| Logout / Telegram connect / role inspection | Preserve identity/link/actor; no simulated login/impersonation |
| New Reports / Recovery / Settings entry points | Real permitted destinations/results, not generic Home |

Each operation traces destination → typed contract → server identity/access → canonical DB/API/storage/realtime effect → honest feedback → durable readback → deny/error/retry/concurrency → staging/live evidence. Include loading/empty/denied/validation/conflict/offline-timeout/recovery states. No production mock substitution or false saved/sent/released states.

Master 80-card register is entry coverage, not proof of every nested control; UI-01/UI-02 trace all menus/forms/links/consumers. Open/Pending backend/Coming soon are presentation, not integration evidence; no bulk relabel to hide gaps. ACC-01/CFG-01/CTR-01/STF-01 keep bounded owners.

# 60. Decision gates and cross-feature acceptance

Accepted feature inclusion does not freeze unknown school policies. Each gate identifies the blocked behavior and owner decision needed; unrelated work continues when authorized.

| Gate | Current state and decision needed | Blocks |
| --- | --- | --- |
| DG-01 | SUSPENDED already exists in source/live enum. Confirm remaining suspension/revocation/reactivation messages and lifecycle acceptance against implemented policy; do not add it again | Remaining status UX/behavior changes |
| DG-02 | Import templates/official IDs, matching/conflict rules, maximum sizes, atomic/partial behavior | Import commit design and real uploads |
| DG-03 | School admission documents, eligibility/age/year windows | Admission validation/public claims |
| DG-04 | Multi-active-role policy, precedence/promotion and privileged-target handling | Changes depending on exactly one effective role |
| DG-05 | Isolated integration environment with ordinary RLS sessions and genuine concurrency; costs/config if hosted | Real DB acceptance and new security-sensitive migrations |
| DG-06 | Pending/rejected/revoked/suspended experience and stale-session resource denial, within protected Telegram scope | Dependent status changes/private feature activation |
| DG-07 | Retention/archive/export/deletion policy for minors, attachments, audit and backups | Broad export/delete and retention automation |
| DG-08 | Attendance register unit, repeated SAME-teacher lessons/day, correction/finalization window, Late/Excused denominator and parent/student visibility | ATT-02 onward and percentages |
| DG-09 | Substitute/co-teacher delegation, effective times, reassignment and historical edit access | Substitute activation and dependent attendance/grade writes |
| DG-10 | Recovery proof/channels, lost phone/email, contact re-verification, session handling and school-assisted operator process | Recovery/contact-change implementation |
| DG-11 | Terms/assessment scales/weights/rounding/missing/exempt rules/report approval and publication | Grades/calculations/report cards |
| DG-12 | Teacher remarks vs restricted behavioral notes, allowed field types/audiences/correction/retention | Remarks/sensitive note exposure |
| DG-13 | Emergency contacts/safety field schema, school verification, audiences and escalation | Safety projections/uploads |
| DG-14 | School calendar editors, week start, event types, cancellation/reschedule/reopen and acknowledgement/reminder policy | Calendar publishing and automated effects |
| DG-15 | Promotion/retention/transfer/withdrawal rules and historical access | Rollover execution |
| DG-16 | Backup/restore objectives, scope, export controls, monitoring owners and incident response | Operations acceptance/production launch |
| DG-17 | Allowed operational-message participants and abuse/moderation rules | Messaging writes |
| DG-18 | Optional AI provider, allowed tools/data, costs/quotas and activation | AI implementation |
| DG-19 | Existing Office Desk/staff service-card task/request types, assignment, status and data scopes; decide bounded workflow vs explicit deferral for each placeholder | STF-01 service writes |

Close each gate by recording the actual decision in the relevant authority and task, with date/evidence. Never label a decision unresolved after it has been explicitly settled; never treat a code default as approval.

Acceptance includes old-session denial, Office self/privileged denial, expired substitutes, independent registers, cross-family file/grade/justification denial, hidden drafts, cancellation without pupil absence/release, delayed notification after commit, import without credential/role/link effects, recovery replay/collision and scoped exports/isolated restore. Exercise ordinary DB/API/storage principals, not only service-role/RLS-bypassing runners. Freeze assertions/commands after owning policy decisions.

# 61. Requirements-to-master traceability

References are not another queue or execution permission. Proposed Attendance, Assessment and school-calendar ownership must be ratified during the scheduled architecture and canonical-model reconciliation before schema design. This product update does not approve physical tables or RPC signatures.

| Requirements / area | Master tasks |
| --- | --- |
| 1–8, 43–47: one school/product/identity/languages/shell | DOC-D1…D6; all slices; F5-V1 |
| 3–4: governance/approval/delegation/Telegram | GOV-C1; F0-R1/R2/R3; F1-G1…G6 |
| 9, 23–26: public/directories/menu/global notices | PUB-01/02/03; COM-02; MED-01 |
| 10–18, 50: records/import/profile/relationships | F2-A1…A10; PRO-01/02; COM-03 |
| 17, 26: school calendar/holidays/cancellations/class | CAL-01/02/03; COM-02/03 |
| 51: independent Teacher Attendance/history | ATT-01/02/03/05; CAL-01/02 |
| 52: absence justification/staff decision | ATT-04; Family/Media |
| 53: temporary substitutes | CAL-04; dependent ATT/GRD |
| 54: grades/report cards/remarks | GRD-01/02/03/04 |
| 55: rollover/history | YEAR-01/02; history consumers |
| 56: recovery/verified contacts | REC-01/02; ACC-01 |
| 57: emergency contacts/minimal safety | PRO-01/02; DG-13 |
| 58: reports/exports/restore/performance | REP-01; OPS-01/02/03; F5-V1/V2/V3 |
| 19–22: Messages/Notes/notices/preferences | COM-01/04; F3-C2; PUB-04 |
| 11, 15–18: Questions/class content/Media | F3-C3; COM-03; MED-01 |
| 27: admission/enrollment | F3-C1; F2-A4 |
| 28–39: Pickup | F4-P0/P1/P2/P3; CTR-01 |
| 40–41, 43–44: media/access/contracts/audit/outbox | MED-01; COM-01; each slice |
| 42: optional AI | AI-01; DG-18 |
| 45, 59: actions/profile/settings/Control Center/staff queues | UI-01/02; ACC-01; CFG-01; CTR-01; STF-01 |
| 46–49, 60: evidence/decisions/acceptance | Each slice; OPS-01…03; F5-V1…V3 |

All eight additions are covered. Student private DMs/multi-school tenancy/tuition-payments/transport-bus operations/lunch ordering-payment/automatic QR-face-geofence pickup/broad medical cases/autonomous AI remain excluded.

Next proposed document: `structure.md` (DOC-D2), **only upon explicit instruction**. No automatic other-document update, PR #15 merge or backend resumption.
