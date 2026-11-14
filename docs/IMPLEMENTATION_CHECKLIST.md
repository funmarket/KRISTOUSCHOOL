# KRISTOU SCHOOL — Role Home Feature-to-Backend Implementation Checklist

Status: **REFERENCE ARCHITECTURE & IMPLEMENTATION MAPPING**  
Repository: `funmarket/KRISTOUSCHOOL`  
Scope: Maps every role-based Home card and shortcut defined under `src/components/homepages/` to its target feature view, TypeScript adapter, Supabase RPC / Edge Function, authoritative PostgreSQL table(s), migration owner, and architectural/security status (`READY_IN_SOURCE_UNDEPLOYED` vs `BLOCKED_BACKEND` vs `COMING_SOON`).

> **Deployment & Evidence Note:** Migrations `20261114100000` through `20261114140000` and pgTAP suite `supabase/tests/school_workflows_security.test.sql` are authored on disk. Until executed against Postgres (`npm run db:reset && npm run db:test`) and pushed to Supabase project `KRISTOUSCHOOL / ofppapwofhovhroyjtkc`, all runtime operations fail closed with `BLOCKED_BACKEND` / `backend_unavailable`.

---

## 1. Architectural Guardrails & Shared Cross-Home Contracts

| Cross-Cutting Domain | Presentation / Context Owner | TypeScript Adapter (`src/lib/`) | Edge Function / RPC | Authoritative DB Table(s) | Migration Owner | Architectural Boundary |
| --- | --- | --- | --- | --- | --- | --- |
| Web Auth & Canonical Profile | `AuthModal.tsx`, `AppContext.tsx` | `auth.ts` (`signInAccount`, `loadCanonicalUser`) | Edge Function `auth-username-signin`; Supabase Auth `signInWithPassword` / `signUp` | `auth.users`, `public.profiles`, `public.role_assignments`, `public.manager_capability_grants` | `20261110210000`, `20261112190435`, `20261113120000`, `20261113150000` | AUTH-LOGIN-02; fails closed on unapproved `account_status` (`PENDING`/`REJECTED`/`SUSPENDED`/`REVOKED`) |
| Telegram Link & Re-Entry *(Protected `09ffacf`)* | `AuthModal.tsx`, `AppContext.tsx` | `auth.ts`, `telegram.ts` | Edge Functions `telegram-link-challenge`, `telegram-auth`; RPC `claim_telegram_account_link` | `public.telegram_identities`, `public.account_link_challenges`, `public.profiles` | `20261110210000`, `20261111030000` | Protected byte-for-byte baseline; established re-entry restores profile without minting a Supabase Auth session |
| Home Routing & Non-Impersonating Oversight | `HomePageResolver.tsx`, `App.tsx` | `homepageAccess.ts` (`resolveHomePage`, `canAccessAppTab`, `getDelegatedOversightTargets`) | Server-side re-verification inside every RPC (`current_profile_id()`, `is_approved_school_member()`, `current_user_has_role()`, `current_user_has_capability()`) | `public.profiles`, `public.role_assignments`, `public.manager_capability_grants` | `20261113150000`, `20261114100000` | UI guards are presentation only; Owner/Manager workspace oversight never mutates `actor` identity |
| School Context & Role Scoping | `AppContext.tsx`, `ParentHomePage.tsx`, `TeacherHomePage.tsx`, `StudentHomePage.tsx` | `schoolOperations.ts` (`fetchMySchoolContext`) | RPC `get_my_school_context()` | `public.parent_child_links`, `public.students`, `public.student_class_memberships`, `public.teacher_class_assignments`, `public.school_classes`, `public.enrollment_applications`, `public.public_school_inquiries` | `20261114110000` | Strict server-scoped `linkedChildrenIds`, `assignedClassIds`, and `operationalCounts`; zero mock fallback for authenticated accounts |
| User Preferences & Notifications | `Navbar.tsx`, `AppContext.tsx` | `schoolContent.ts` (`loadMyPreferences`, `saveMyPreferences`, `listMyNotifications`, `markNotificationReadOnServer`, `markAllNotificationsReadOnServer`) | RPCs `upsert_my_preferences`, `mark_user_notification_read`, `mark_all_user_notifications_read`, `enqueue_school_notification` | `public.user_preferences`, `public.user_notifications`, `public.notification_outbox` | `20261114100000` | User-scoped presentation/notification state; notification failure never rolls back business writes |
| Application Status Gate (`APPLICATION_STATUS`) | `ApplicationStatusScreen.tsx` | `auth.ts`, `homepageAccess.ts` | Read via `loadCanonicalUser` + `signOutAccount` | `public.profiles`, `public.role_assignments` | `20261110210000`, `20261112190435` | Shown for `PENDING`, `REJECTED`, `SUSPENDED`, `REVOKED`; allows only `publicSite` and `Sign Out` |

---

## 2. School Owner Home (`OWNER_HOME` — `APP_ADMIN`)

Source: `src/components/homepages/OwnerHomePage.tsx` & `src/components/homepages/OwnerGovernanceWorkspace.tsx`  
Oversight selector: Non-impersonating preview of `PUBLIC_HOME`, `PARENT_HOME`, `STUDENT_HOME`, `TEACHER_HOME`, `SCHOOL_STAFF_HOME`, `ADMINISTRATIVE_PERSONNEL_HOME`, `MANAGER_HOME` (`onInspectRoleHome`).

### Group 1 — School Operations

| Card ID | Card Label (EN) | Target Feature / Tab | TypeScript Adapter (`src/lib/`) | Required Backend RPC / Query | Authoritative DB Table(s) | Migration Owner | Status & Constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `owner-control-center` | Control Center | `OwnerGovernanceWorkspace` (`activeSection: 'control-center'`) | `accountGovernance.ts` (`fetchGovernanceActorScope`), `schoolOperations.ts` (`fetchMySchoolContext`) | RPCs `governance_get_actor_scope()`, `get_my_school_context()` | `profiles`, `role_assignments`, `school_classes`, `students`, `enrollment_applications`, `public_school_inquiries` | `20261113150000`, `20261114110000` | Authored in migration; fails closed to `BLOCKED_BACKEND` if undeployed |
| `owner-pickup` | Pickup | Tab `pickup` → `PickupBoardView.tsx` | `homepageAccess.ts` (`attemptPickupOperation`) | **None yet** *(intentionally unimplemented)* | *(Future Pickup domain tables; not yet created)* | `—` | **Safety-locked (`BLOCKED_BACKEND`)**; arrival & physical release remain disabled until Pickup backend slice |
| `owner-classes` | Classes & Students | Tab `classes` → `ClassesManagementView.tsx` | `schoolOperations.ts` (`fetchSchoolClassesWithRosters`, `createSchoolClass`, `createAndEnrollStudent`, `assignTeacherToClass`) | RPCs `list_school_classes_with_rosters()`, `create_school_class(...)`, `create_and_enroll_student(...)`, `assign_teacher_to_class(...)` | `academic_years`, `school_levels`, `school_classes`, `students`, `student_class_memberships`, `teacher_class_assignments`, `parent_child_links` | `20261114110000` | Authored in migration; Owner Teachers → Classes → Registration menu order preserved |
| `owner-registration` | Registration | Tab `registration` → `RegistrationView.tsx` | `schoolOperations.ts` (`submitEnrollmentApplication`, `listEnrollmentApplications`, `reviewEnrollmentApplication`) | RPCs `submit_enrollment_application(...)`, `review_enrollment_application(...)`; SELECT `enrollment_applications` | `enrollment_applications` | `20261114110000` | Authored in migration; optimistic `version` check on review |
| `owner-broadcasts` | Broadcasts | Tab `announcements` → `GlobalAnnouncementsCalendarView.tsx` + `SchoolCalendarPanel.tsx` | `schoolContent.ts` (`listSchoolBroadcasts`, `publishSchoolBroadcast`, `listSchoolCalendarEvents`, `upsertSchoolCalendarEvent`, `cancelSchoolCalendarEvent`, `respondToCalendarEvent`) | RPCs `publish_school_broadcast(...)`, `upsert_school_calendar_event(...)`, `cancel_school_calendar_event(...)`, `respond_to_calendar_event(...)`; SELECTs | `school_broadcasts`, `school_calendar_events`, `school_calendar_responses` | `20261114120000` | Authored in migration; separates `PUBLIC_SITE`, `ALL_SCHOOL`, `CLASSES` audiences |
| `owner-food-menu` | Food Menu | Tab `foodMenu` → `FoodMenuView.tsx` | `schoolContent.ts` (`fetchActiveFoodMenu`, `saveFoodMenuWeek`) | RPC `save_food_menu_week(...)`; SELECT `food_menu_weeks`, `food_menu_days` | `food_menu_weeks`, `food_menu_days` | `20261114140000` | Authored in migration; honest `demoPreview` badge when DB rows are absent |
| `owner-public-content` | Public content | Tab `publicSite` → `PublicHomePage.tsx` | `schoolContent.ts` (`listSchoolBroadcasts`, `fetchActiveFoodMenu`), `schoolOperations.ts` (`submitPublicInquiry`) | RPC `submit_public_inquiry(...)`; public SELECTs | `school_broadcasts`, `food_menu_weeks`, `food_menu_days`, `school_public_content`, `public_school_inquiries` | `20261114110000`, `20261114120000`, `20261114140000` | Authored in migration; public projections strictly exclude private student/family records |

### Group 2 — Governance & Access

| Card ID | Card Label (EN) | Target Feature / Tab | TypeScript Adapter (`src/lib/`) | Required Backend RPC / Query | Authoritative DB Table(s) | Migration Owner | Status & Constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `owner-pending-approvals` | Pending Account Approvals | `OwnerGovernanceWorkspace` (`activeSection: 'pending-approvals'`) | `accountGovernance.ts` (`fetchGovernanceActorScope`, `listPendingAccounts`, `getAccountGovernanceDetail`, `reviewAccountLifecycle`) | RPCs `governance_get_actor_scope()`, `governance_list_pending_accounts(...)`, `governance_get_account_detail(...)`, `governance_review_account(...)` | `profiles`, `role_assignments`, `account_governance_audit_logs` | `20261113150000` | Requires confirmed contact (`email_confirmed`/`phone_confirmed`) and `governance_version` match |
| `owner-user-directory` | User Directory & Account Status | `OwnerGovernanceWorkspace` (`activeSection: 'user-directory'`) | `accountGovernance.ts` (`listAccountDirectory`, `getAccountGovernanceDetail`, `reviewAccountLifecycle`) | RPCs `governance_list_account_directory(...)`, `governance_get_account_detail(...)`, `governance_review_account(...)` | `profiles`, `role_assignments`, `manager_capability_grants`, `account_governance_audit_logs` | `20261113150000` | Enforces last-Owner (`APP_ADMIN`) protection inside transaction lock |
| `owner-manager-delegation` | Manager Delegation | `OwnerGovernanceWorkspace` (`activeSection: 'manager-delegation'`) | `accountGovernance.ts` (`listManagerGrants`, `setManagerCapability`) | RPCs `governance_list_manager_grants()`, `governance_set_manager_capability(...)` | `manager_capability_grants`, `role_assignments`, `profiles`, `account_governance_audit_logs` | `20261113150000`, `20261114100000` | GOV-02: Owner-only (`APP_ADMIN`); strictly allowlisted capability strings |
| `owner-role-governance` | Role & Permission Governance | `OwnerGovernanceWorkspace` (`activeSection: 'role-governance'`) | `accountGovernance.ts` (`listAccountDirectory`, `appointPrivilegedRole`) | RPCs `governance_list_account_directory(...)`, `governance_appoint_privileged_role(...)` | `profiles`, `role_assignments`, `account_governance_audit_logs` | `20261113150000` | Owner-only for `APP_ADMIN` / `MANAGER` grant or revoke with explicit confirmation |
| `owner-directory-oversight` | Directory & Public Site Oversight | Tab `directory` (`subTab: 'teachers'`) → `DirectoryView.tsx` | `schoolContent.ts` (`listPublicDirectory`, `upsertDirectoryEntry`) | RPC `upsert_directory_entry(...)`; SELECT `directory_entries` | `directory_entries` | `20261114140000` | Authored in migration; separate from private `profiles` records |
| `owner-school-settings` | School Settings | `EmptyFeatureState` (`state="COMING_SOON"`) | **None yet** | **None yet** *(future `CFG-01`)* | *(Future domain-owned policy settings; no catch-all blob)* | `—` | **COMING_SOON (`CFG-01`)**; displays settled defaults (`2026–2027`, `08:00–18:00 Africa/Tunis`, `11/day`) |

---

## 3. Manager Home (`MANAGER_HOME` — `MANAGER`)

Source: `src/components/homepages/ManagerHomePage.tsx`  
Delegated oversight selector: Renders only `OVERSIGHT:<HOME_KEY>` targets granted in `manager_capability_grants` (never `OWNER_HOME`).

| Card ID | Card Label (EN) | Visibility / Capability Gate | Target Feature / Tab | TypeScript Adapter (`src/lib/`) | Required Backend RPC / Query | Authoritative DB Table(s) | Migration Owner | Status & Constraints |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `manager-control-center` | Control Center | Always shown to approved `MANAGER` | Inline Control Center summary panel | `schoolOperations.ts` (`fetchMySchoolContext`), `auth.ts` (`loadCanonicalUser`) | RPC `get_my_school_context()`; SELECT `manager_capability_grants` | `manager_capability_grants`, `school_classes`, `students`, `enrollment_applications`, `public_school_inquiries` | `20261113150000`, `20261114110000` | Displays live operational counts & active delegated capabilities |
| `manager-pickup` | Pickup | Approved `MANAGER` (`PICKUP_RELEASE` / `PICKUP_VIEW` / `FULL_ACCESS` / default empty caps) | Tab `pickup` → `PickupBoardView.tsx` | `homepageAccess.ts` (`attemptPickupOperation`) | **None yet** | *(Future Pickup tables)* | `—` | **Safety-locked (`BLOCKED_BACKEND`)** |
| `manager-registration` | Registration | Always shown; review actions require `ENROLLMENT_REVIEW` or `FULL_ACCESS` | Tab `registration` → `RegistrationView.tsx` | `schoolOperations.ts` (`submitEnrollmentApplication`, `listEnrollmentApplications`, `reviewEnrollmentApplication`) | RPCs `submit_enrollment_application(...)`, `review_enrollment_application(...)`; SELECT `enrollment_applications` | `enrollment_applications`, `manager_capability_grants` | `20261114110000`, `20261114100000` | Server RPC verifies `ENROLLMENT_REVIEW` capability for `MANAGER` |
| `manager-broadcasts` | Broadcasts | Always shown; publish requires `BROADCAST_MANAGE` or `FULL_ACCESS` | Tab `announcements` → `GlobalAnnouncementsCalendarView.tsx` | `schoolContent.ts` (`listSchoolBroadcasts`, `publishSchoolBroadcast`) | RPC `publish_school_broadcast(...)`; SELECT `school_broadcasts` | `school_broadcasts`, `manager_capability_grants` | `20261114120000` | Server RPC enforces `BROADCAST_MANAGE` for `MANAGER` |
| `manager-food-menu` | Food Menu | Always shown; edit requires `CAN_MANAGE_FOOD_MENU` / `PUBLIC_CONTENT_MANAGE` / `FULL_ACCESS` | Tab `foodMenu` → `FoodMenuView.tsx` | `schoolContent.ts` (`fetchActiveFoodMenu`, `saveFoodMenuWeek`) | RPC `save_food_menu_week(...)`; SELECT `food_menu_weeks`, `food_menu_days` | `food_menu_weeks`, `food_menu_days`, `manager_capability_grants` | `20261114140000` | Server RPC enforces menu capability for `MANAGER` |
| `manager-public-content` | Public content | Always shown | Tab `publicSite` → `PublicHomePage.tsx` | `schoolContent.ts`, `schoolOperations.ts` | Public SELECTs; RPC `submit_public_inquiry(...)` | `school_broadcasts`, `food_menu_weeks`, `food_menu_days`, `school_public_content`, `public_school_inquiries` | `20261114110000`, `20261114120000`, `20261114140000` | Read-only public site view; editing requires `PUBLIC_CONTENT_MANAGE` |
| `manager-teacher-directory` | Teacher Directory | Always shown; write requires `PUBLIC_CONTENT_MANAGE` / `FULL_ACCESS` | Tab `directory` (`subTab: 'teachers'`) → `DirectoryView.tsx` | `schoolContent.ts` (`listPublicDirectory`, `upsertDirectoryEntry`) | RPC `upsert_directory_entry(...)`; SELECT `directory_entries` | `directory_entries`, `manager_capability_grants` | `20261114140000` | Server RPC enforces `PUBLIC_CONTENT_MANAGE` for `MANAGER` |
| `manager-admin-directory` | Admin Directory | Always shown; write requires `PUBLIC_CONTENT_MANAGE` / `FULL_ACCESS` | Tab `directory` (`subTab: 'admin'`) → `DirectoryView.tsx` | `schoolContent.ts` (`listPublicDirectory`, `upsertDirectoryEntry`) | RPC `upsert_directory_entry(...)`; SELECT `directory_entries` | `directory_entries`, `manager_capability_grants` | `20261114140000` | Server RPC enforces `PUBLIC_CONTENT_MANAGE` for `MANAGER` |
| `manager-calendar` | Calendar | Always shown; write requires `CALENDAR_MANAGE` / `FULL_ACCESS` | Tab `announcements` → `GlobalAnnouncementsCalendarView.tsx` + `SchoolCalendarPanel.tsx` | `schoolContent.ts` (`listSchoolCalendarEvents`, `upsertSchoolCalendarEvent`, `cancelSchoolCalendarEvent`, `respondToCalendarEvent`) | RPCs `upsert_school_calendar_event(...)`, `cancel_school_calendar_event(...)`, `respond_to_calendar_event(...)`; SELECTs | `school_calendar_events`, `school_calendar_responses`, `manager_capability_grants` | `20261114120000` | Server RPC enforces `CALENDAR_MANAGE` for `MANAGER` |
| `manager-moderation` | Moderation | Always shown; hide/unhide requires `COMMUNITY_MODERATE` / `FULL_ACCESS` | Tab `community` (`subTab: 'questions'`) → `ClassCommunityView.tsx` | `schoolContent.ts` (`listClassCommunityContent`, `moderateClassQuestion`, `replyClassQuestion`) | RPCs `moderate_class_question(...)`, `reply_class_question(...)`; SELECT `class_questions`, `class_question_replies` | `class_questions`, `class_question_replies`, `manager_capability_grants` | `20261114120000` | Server RPC enforces `COMMUNITY_MODERATE` for `MANAGER` |
| `manager-messages` | Messages | Always shown | Tab `messages` → `MessagesView.tsx` | `schoolContent.ts` (`listMessageThreads`, `listApprovedMessageRecipients`, `sendOperationalMessage`, `replyOperationalThread`) | RPCs `list_approved_message_recipients()`, `send_operational_message(...)`, `reply_operational_thread(...)`; SELECTs | `message_threads`, `thread_participants`, `thread_messages` | `20261114130000` | 1–200 char limit; excludes `STUDENT` participants |
| `manager-classes` | Classes & Rosters | Conditional: `CLASSES_ROSTER_VIEW`, `CLASSES_MANAGE`, or `FULL_ACCESS` | Tab `classes` → `ClassesManagementView.tsx` | `schoolOperations.ts` (`fetchSchoolClassesWithRosters`, `createSchoolClass`, `createAndEnrollStudent`, `assignTeacherToClass`) | RPCs `list_school_classes_with_rosters()`, `create_school_class(...)`, `create_and_enroll_student(...)`, `assign_teacher_to_class(...)` | `school_classes`, `students`, `student_class_memberships`, `teacher_class_assignments`, `manager_capability_grants` | `20261114110000` | Roster read requires `CLASSES_ROSTER_VIEW`/`CLASSES_MANAGE`; write requires `CLASSES_MANAGE` |
| `manager-pending-approvals` | Delegated Account Review | Conditional: `ACCOUNT_APPROVAL_REVIEW` or `FULL_ACCESS` | `OwnerGovernanceWorkspace` (`ordinaryReviewOnly`, `pending-approvals` & `user-directory`) | `accountGovernance.ts` (`fetchGovernanceActorScope`, `listPendingAccounts`, `listAccountDirectory`, `getAccountGovernanceDetail`, `reviewAccountLifecycle`) | RPCs `governance_get_actor_scope()`, `governance_list_pending_accounts(...)`, `governance_list_account_directory(...)`, `governance_get_account_detail(...)`, `governance_review_account(...)` | `profiles`, `role_assignments`, `manager_capability_grants`, `account_governance_audit_logs` | `20261113150000`, `20261114100000` | Ordinary accounts only (`ADMINISTRATIVE_PERSONNEL`, `TEACHER`, `SCHOOL_STAFF`, `PARENT`, `STUDENT`); self & privileged targets denied |

---

## 4. Administrative Personnel Home (`ADMINISTRATIVE_PERSONNEL_HOME` — `ADMINISTRATIVE_PERSONNEL`)

Source: `src/components/homepages/AdministrativePersonnelHomePage.tsx`  
Boundary: Ordinary school-office operational bundle; strictly excluded from `APP_ADMIN`/`MANAGER` privileged role governance (`OwnerGovernanceWorkspace` privileged tabs absent and rejected server-side).

| Card ID | Card Label (EN) | Target Feature / Tab | TypeScript Adapter (`src/lib/`) | Required Backend RPC / Query | Authoritative DB Table(s) | Migration Owner | Status & Constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `admin-personnel-office-desk` | Office Desk | Inline `admin-personnel-office-desk-panel` | `schoolOperations.ts` (`fetchMySchoolContext`, `listPublicInquiries`, `respondPublicInquiry`) | RPCs `get_my_school_context()`, `respond_public_inquiry(...)`; SELECT `public_school_inquiries` | `public_school_inquiries`, `school_classes`, `students`, `enrollment_applications` | `20261114110000` | Displays operational counts and responds (`NEW`/`IN_PROGRESS`/`RESOLVED`) to public inquiries |
| `admin-personnel-admission-files` | Admission Files | Tab `registration` → `RegistrationView.tsx` | `schoolOperations.ts` (`listEnrollmentApplications`, `reviewEnrollmentApplication`, `submitEnrollmentApplication`) | RPCs `review_enrollment_application(...)`, `submit_enrollment_application(...)`; SELECT `enrollment_applications` | `enrollment_applications` | `20261114110000` | Full office intake & review queue with optimistic `version` check |
| `admin-personnel-family-inquiries` | Family Inquiries | Tab `messages` → `MessagesView.tsx` | `schoolContent.ts` (`listMessageThreads`, `listApprovedMessageRecipients`, `sendOperationalMessage`, `replyOperationalThread`) | RPCs `list_approved_message_recipients()`, `send_operational_message(...)`, `reply_operational_thread(...)`; SELECTs | `message_threads`, `thread_participants`, `thread_messages` | `20261114130000` | Operational messaging (1–200 chars, approved non-`STUDENT` participants) |
| `admin-personnel-attendance` | Attendance | `EmptyFeatureState` (`state="COMING_SOON"`) | **None yet** | **None yet** *(future `DG-08`)* | *(Future Attendance domain tables)* | `—` | **COMING_SOON (`DG-08`)**; no fake local attendance logs |
| `admin-personnel-forms-documents` | Forms & Documents | Tab `community` (`subTab: 'documents'`) → `ClassCommunityView.tsx` | `schoolContent.ts` (`listClassCommunityContent`) | SELECT `class_documents` | `class_documents`, `school_classes` | `20261114120000` | Office access to class documents |
| `admin-personnel-school-calendar` | School Calendar | Tab `announcements` → `GlobalAnnouncementsCalendarView.tsx` + `SchoolCalendarPanel.tsx` | `schoolContent.ts` (`listSchoolCalendarEvents`, `upsertSchoolCalendarEvent`, `cancelSchoolCalendarEvent`, `respondToCalendarEvent`) | RPCs `upsert_school_calendar_event(...)`, `cancel_school_calendar_event(...)`, `respond_to_calendar_event(...)`; SELECTs | `school_calendar_events`, `school_calendar_responses` | `20261114120000` | Approved office bundle permitted to manage school calendar events |
| `admin-personnel-notices` | Notices | Tab `announcements` → `GlobalAnnouncementsCalendarView.tsx` | `schoolContent.ts` (`listSchoolBroadcasts`, `publishSchoolBroadcast`) | RPC `publish_school_broadcast(...)`; SELECT `school_broadcasts` | `school_broadcasts` | `20261114120000` | Approved office bundle permitted to publish school broadcasts |
| `admin-personnel-work-queue` | My Work Queue | `EmptyFeatureState` (`state="COMING_SOON"`) | **None yet** | **None yet** *(future `DG-19`)* | *(Future `DG-19` work queue lifecycle)* | `—` | **COMING_SOON (`DG-19`)**; no speculative task queue table |
| `admin-personnel-pickup-assist` | Pickup Assistance *(conditional: `PICKUP_RELEASE` \| `PICKUP_DESK`)* | Tab `pickup` → `PickupBoardView.tsx` | `homepageAccess.ts` (`attemptPickupOperation`) | **None yet** | *(Future Pickup tables)* | `—` | **Safety-locked (`BLOCKED_BACKEND`)**; only visible with server capability |

---

## 5. School Staff Home (`SCHOOL_STAFF_HOME` — `SCHOOL_STAFF`)

Source: `src/components/homepages/SchoolStaffHomePage.tsx`  
Boundary: Daily operational modules only; zero access to private student rosters (`classes` denied unless explicit `CLASSES_ROSTER_VIEW` capability), grades, or Parent Notes (`notes` denied).

### Core Staff Cards

| Card ID | Card Label (EN) | Target Feature / Tab | TypeScript Adapter (`src/lib/`) | Required Backend RPC / Query | Authoritative DB Table(s) | Migration Owner | Status & Constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `staff-internal-announcements` | Internal Announcements | Tab `announcements` → `GlobalAnnouncementsCalendarView.tsx` | `schoolContent.ts` (`listSchoolBroadcasts`) | SELECT `school_broadcasts` | `school_broadcasts` | `20261114120000` | Read-only school/staff-scoped broadcasts (`PUBLISHED`) |
| `staff-school-calendar` | School Calendar | Tab `announcements` → `GlobalAnnouncementsCalendarView.tsx` + `SchoolCalendarPanel.tsx` | `schoolContent.ts` (`listSchoolCalendarEvents`, `respondToCalendarEvent`) | SELECT `school_calendar_events`, `school_calendar_responses`; RPC `respond_to_calendar_event(...)` | `school_calendar_events`, `school_calendar_responses` | `20261114120000` | School-wide events & RSVP/acknowledgement; no `classId` private rosters required |
| `staff-food-menu` | Food Menu | Tab `foodMenu` → `FoodMenuView.tsx` | `schoolContent.ts` (`fetchActiveFoodMenu`) | SELECT `food_menu_weeks`, `food_menu_days` | `food_menu_weeks`, `food_menu_days` | `20261114140000` | Read-only weekly menu view |
| `staff-teachers-directory` | Teachers | Tab `directory` (`subTab: 'teachers'`) → `DirectoryView.tsx` | `schoolContent.ts` (`listPublicDirectory`) | SELECT `directory_entries` | `directory_entries` | `20261114140000` | Approved teacher directory presentation cards |
| `staff-administration-directory` | Administration | Tab `directory` (`subTab: 'admin'`) → `DirectoryView.tsx` | `schoolContent.ts` (`listPublicDirectory`) | SELECT `directory_entries` | `directory_entries` | `20261114140000` | Approved admin directory presentation cards |
| `staff-messages` | Messages | Tab `messages` → `MessagesView.tsx` | `schoolContent.ts` (`listMessageThreads`, `listApprovedMessageRecipients`, `sendOperationalMessage`, `replyOperationalThread`) | RPCs `list_approved_message_recipients()`, `send_operational_message(...)`, `reply_operational_thread(...)`; SELECTs | `message_threads`, `thread_participants`, `thread_messages` | `20261114130000` | 1–200 char short operational threads; `STUDENT` excluded |
| `staff-my-tasks` | My Tasks / Requests | `EmptyFeatureState` (`state="COMING_SOON"`) | **None yet** | **None yet** *(future `DG-19`)* | *(Future `DG-19` staff task table)* | `—` | **COMING_SOON (`DG-19`)** |

### Assigned Operational Modules

| Card ID | Card Label (EN) | Visibility / Capability Gate | Target Feature / Tab | TypeScript Adapter (`src/lib/`) | Required Backend RPC / Query | Authoritative DB Table(s) | Migration Owner | Status & Constraints |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `staff-pickup-desk` | Pickup Desk | Conditional: `PICKUP_RELEASE` \| `PICKUP_DESK` | Tab `pickup` → `PickupBoardView.tsx` | `homepageAccess.ts` (`attemptPickupOperation`) | **None yet** | *(Future Pickup tables)* | `—` | **Safety-locked (`BLOCKED_BACKEND`)** |
| `staff-cafeteria` | Cafeteria | Always shown | Tab `foodMenu` → `FoodMenuView.tsx` | `schoolContent.ts` (`fetchActiveFoodMenu`) | SELECT `food_menu_weeks`, `food_menu_days` | `food_menu_weeks`, `food_menu_days` | `20261114140000` | Cafeteria menu view (no lunch ordering/payment per scope) |
| `staff-facilities` | Facilities | Always shown | `EmptyFeatureState` (`state="COMING_SOON"`) | **None yet** | **None yet** *(future `DG-19`)* | *(Future `DG-19`)* | `—` | **COMING_SOON (`DG-19`)** |
| `staff-library-transport` | Library / Transport / Security | Always shown | `EmptyFeatureState` (`state="COMING_SOON"`) | **None yet** | **None yet** *(excluded transport domain / `DG-19`)* | *(None — bus/transport operations remain excluded)* | `—` | **COMING_SOON**; zero fake local mutations |

---

## 6. Teacher Home (`TEACHER_HOME` — `TEACHER`)

Source: `src/components/homepages/TeacherHomePage.tsx`  
Header class switcher: Strictly filtered via `resolveTeacherAssignedClasses(currentUser, classesList)` using server-verified `assignedClassIds` (`teacher_class_assignments`); never falls back to `MOCK_CLASSES`.

### Group 1 — My Teaching

| Card ID | Card Label (EN) | Target Feature / Tab | TypeScript Adapter (`src/lib/`) | Required Backend RPC / Query | Authoritative DB Table(s) | Migration Owner | Status & Constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `teacher-my-classes` | My Classes | Tab `community` (`subTab: 'announcements'`) → `ClassCommunityView.tsx` | `schoolContent.ts` (`listClassCommunityContent`, `createClassAnnouncement`), `schoolOperations.ts` (`fetchMySchoolContext`) | RPCs `create_class_announcement(...)`, `get_my_school_context()`; SELECT `class_announcements` | `teacher_class_assignments`, `school_classes`, `class_announcements` | `20261114110000`, `20261114120000` | RLS/RPC `can_access_class(class_id)` restricts writes to assigned teacher |
| `teacher-pickup` | Pickup | Tab `pickup` → `PickupBoardView.tsx` | `homepageAccess.ts` (`attemptPickupOperation`) | **None yet** | *(Future Pickup tables)* | `—` | **Safety-locked (`BLOCKED_BACKEND`)** |
| `teacher-homework` | Homework & Classwork | Tab `community` (`subTab: 'homework'`) → `ClassCommunityView.tsx` | `schoolContent.ts` (`listClassCommunityContent`, `createClassHomework`) | RPC `create_class_homework(...)`; SELECT `class_homework_items` | `class_homework_items`, `teacher_class_assignments` | `20261114120000` | Assigned class only (`can_access_class`) |
| `teacher-messages` | Messages | Tab `messages` → `MessagesView.tsx` | `schoolContent.ts` (`listMessageThreads`, `listApprovedMessageRecipients`, `sendOperationalMessage`, `replyOperationalThread`) | RPCs `list_approved_message_recipients()`, `send_operational_message(...)`, `reply_operational_thread(...)`; SELECTs | `message_threads`, `thread_participants`, `thread_messages` | `20261114130000` | Approved non-`STUDENT` participants; 1–200 chars |
| `teacher-parent-notes` | Parent Notes | Tab `notes` → `ParentNotesView.tsx` | `schoolContent.ts` (`listParentNotes`, `replyParentNote`) | RPC `reply_parent_note(...)`; SELECT `parent_notes` | `parent_notes`, `teacher_class_assignments` | `20261114130000` | Teacher sees/replies to notes for their assigned classes or directed recipient |
| `teacher-food-menu` | Food Menu | Tab `foodMenu` → `FoodMenuView.tsx` | `schoolContent.ts` (`fetchActiveFoodMenu`) | SELECT `food_menu_weeks`, `food_menu_days` | `food_menu_weeks`, `food_menu_days` | `20261114140000` | Read-only weekly menu view |

### Group 2 — Communication & School Services

| Card ID | Card Label (EN) | Target Feature / Tab | TypeScript Adapter (`src/lib/`) | Required Backend RPC / Query | Authoritative DB Table(s) | Migration Owner | Status & Constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `teacher-class-announcements` | Class Announcements | Tab `community` (`subTab: 'announcements'`) → `ClassCommunityView.tsx` | `schoolContent.ts` (`listClassCommunityContent`, `createClassAnnouncement`) | RPC `create_class_announcement(...)`; SELECT `class_announcements` | `class_announcements`, `teacher_class_assignments` | `20261114120000` | Assigned class only |
| `teacher-class-calendar` | Class Calendar | Tab `community` (`subTab: 'calendar'`) → `ClassCommunityView.tsx` + `SchoolCalendarPanel.tsx` | `schoolContent.ts` (`listSchoolCalendarEvents`, `respondToCalendarEvent`) | SELECT `school_calendar_events`, `school_calendar_responses`; RPC `respond_to_calendar_event(...)` | `school_calendar_events`, `school_calendar_responses` | `20261114120000` | Scoped to selected `class_id` or school-wide events |
| `teacher-class-documents` | Class Documents | Tab `community` (`subTab: 'documents'`) → `ClassCommunityView.tsx` | `schoolContent.ts` (`listClassCommunityContent`) | SELECT `class_documents` | `class_documents`, `teacher_class_assignments` | `20261114120000` | Assigned class only (file upload bytes await `MED-01` private Storage bucket) |
| `teacher-attendance` | Attendance / Absence | `EmptyFeatureState` (`state="COMING_SOON"`) | **None yet** | **None yet** *(future `DG-08`)* | *(Future Attendance registers/entries tables)* | `—` | **COMING_SOON (`DG-08`)** |

---

## 7. Parent Home (`PARENT_HOME` — `PARENT`)

Source: `src/components/homepages/ParentHomePage.tsx`  
Child switcher: Strictly filtered via `resolveParentLinkedChildren(currentUser, childrenList)` using server-verified `linkedChildrenIds` (`parent_child_links`); shows honest empty state with CTA to `registration` when unlinked; zero `MOCK_CHILDREN` fallback.

| Card ID | Card Label (EN) | Target Feature / Tab | TypeScript Adapter (`src/lib/`) | Required Backend RPC / Query | Authoritative DB Table(s) | Migration Owner | Status & Constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `parent-my-children` | My Children | Inline `showChildrenSummary` drawer | `schoolOperations.ts` (`fetchMySchoolContext`) | RPC `get_my_school_context()` | `parent_child_links`, `students`, `student_class_memberships`, `school_classes` | `20261114110000` | Displays verified linked children & class placement only |
| `parent-my-classes` | My Classes | Tab `community` (`subTab: 'announcements'`) → `ClassCommunityView.tsx` | `schoolContent.ts` (`listClassCommunityContent`, `postClassQuestion`, `replyClassQuestion`) | SELECT `class_announcements`, `class_questions`, `class_question_replies`; RPCs `post_class_question(...)`, `reply_class_question(...)` | `class_announcements`, `class_questions`, `class_question_replies`, `parent_child_links`, `student_class_memberships` | `20261114120000` | Scoped via linked child's active `student_class_memberships` (`can_access_class`) |
| `parent-homework` | Homework & Classwork | Tab `community` (`subTab: 'homework'`) → `ClassCommunityView.tsx` | `schoolContent.ts` (`listClassCommunityContent`) | SELECT `class_homework_items` | `class_homework_items`, `parent_child_links`, `student_class_memberships` | `20261114120000` | Read-only for parent's linked child class |
| `parent-calendar` | Calendar | Tab `community` (`subTab: 'calendar'`) → `ClassCommunityView.tsx` + `SchoolCalendarPanel.tsx` | `schoolContent.ts` (`listSchoolCalendarEvents`, `respondToCalendarEvent`) | SELECT `school_calendar_events`, `school_calendar_responses`; RPC `respond_to_calendar_event(...)` | `school_calendar_events`, `school_calendar_responses` | `20261114120000` | Multi-day date-only & Africa/Tunis event view + RSVP |
| `parent-messages` | Messages | Tab `messages` → `MessagesView.tsx` | `schoolContent.ts` (`listMessageThreads`, `listApprovedMessageRecipients`, `sendOperationalMessage`, `replyOperationalThread`) | RPCs `list_approved_message_recipients()`, `send_operational_message(...)`, `reply_operational_thread(...)`; SELECTs | `message_threads`, `thread_participants`, `thread_messages` | `20261114130000` | 1–200 char threads; excludes `STUDENT` |
| `parent-notes` | Parent Notes | Tab `notes` → `ParentNotesView.tsx` | `schoolContent.ts` (`listParentNotes`, `sendParentNote`) | RPC `send_parent_note(...)`; SELECT `parent_notes` | `parent_notes`, `parent_child_links` | `20261114130000` | Server-enforced `08:00–18:00 Africa/Tunis` window + `11/day` parent quota |
| `parent-pickup` | Pickup | Tab `pickup` → `PickupBoardView.tsx` | `homepageAccess.ts` (`attemptPickupOperation`) | **None yet** | *(Future Pickup tables)* | `—` | **Safety-locked (`BLOCKED_BACKEND`)**; arrival does not release child |
| `parent-food-menu` | Food Menu | Tab `foodMenu` → `FoodMenuView.tsx` | `schoolContent.ts` (`fetchActiveFoodMenu`) | SELECT `food_menu_weeks`, `food_menu_days` | `food_menu_weeks`, `food_menu_days` | `20261114140000` | Read-only weekly menu |
| `parent-teachers` | Teachers | Tab `directory` (`subTab: 'teachers'`) → `DirectoryView.tsx` | `schoolContent.ts` (`listPublicDirectory`) | SELECT `directory_entries` | `directory_entries` | `20261114140000` | Approved teacher profiles |
| `parent-administration` | Administration | Tab `directory` (`subTab: 'admin'`) → `DirectoryView.tsx` | `schoolContent.ts` (`listPublicDirectory`) | SELECT `directory_entries` | `directory_entries` | `20261114140000` | Approved administration profiles |
| `parent-registration` | Registration | Tab `registration` → `RegistrationView.tsx` | `schoolOperations.ts` (`submitEnrollmentApplication`, `listEnrollmentApplications`) | RPC `submit_enrollment_application(...)`; SELECT `enrollment_applications` | `enrollment_applications` | `20261114110000` | Parent sees own submitted applications |
| `parent-gallery` | Gallery | Tab `community` (`subTab: 'gallery'`) → `ClassCommunityView.tsx` | `schoolContent.ts` (`listClassCommunityContent`) | SELECT `class_gallery_items` | `class_gallery_items`, `parent_child_links`, `student_class_memberships` | `20261114120000` | Class-scoped or public approved gallery items |

---

## 8. Student Home (`STUDENT_HOME` — `STUDENT`)

Source: `src/components/homepages/StudentHomePage.tsx`  
Class banner: Strictly filtered via `resolveStudentAssignedClass(currentUser, classesList)` using server-verified `assignedClassIds`; zero fallback to `classesList[0]` or `MOCK_CLASSES`.  
Strict exclusion: `canAccessAppTab(student, 'messages') === false` (`students_cannot_direct_message` enforced both in UI and in `20261114130000_parent_notes_and_messaging.sql`).

| Card ID | Card Label (EN) | Target Feature / Tab | TypeScript Adapter (`src/lib/`) | Required Backend RPC / Query | Authoritative DB Table(s) | Migration Owner | Status & Constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `student-announcements` | Announcements | Tab `community` (`subTab: 'announcements'`) → `ClassCommunityView.tsx` | `schoolContent.ts` (`listClassCommunityContent`) | SELECT `class_announcements` | `class_announcements`, `students`, `student_class_memberships` | `20261114120000` | Read-only for student's active class membership (`can_access_class`) |
| `student-homework` | Homework & Classwork | Tab `community` (`subTab: 'homework'`) → `ClassCommunityView.tsx` | `schoolContent.ts` (`listClassCommunityContent`) | SELECT `class_homework_items` | `class_homework_items`, `students`, `student_class_memberships` | `20261114120000` | Read-only for student's active class |
| `student-questions` | Class Questions | Tab `community` (`subTab: 'questions'`) → `ClassCommunityView.tsx` | `schoolContent.ts` (`listClassCommunityContent`, `postClassQuestion`, `replyClassQuestion`) | SELECT `class_questions`, `class_question_replies`; RPCs `post_class_question(...)`, `reply_class_question(...)` | `class_questions`, `class_question_replies`, `student_class_memberships` | `20261114120000` | Moderated 1–200 char class Q&A (not private DMs) |
| `student-food-menu` | Food Menu | Tab `foodMenu` → `FoodMenuView.tsx` | `schoolContent.ts` (`fetchActiveFoodMenu`) | SELECT `food_menu_weeks`, `food_menu_days` | `food_menu_weeks`, `food_menu_days` | `20261114140000` | Read-only weekly menu |
| `student-calendar` | Calendar | Tab `community` (`subTab: 'calendar'`) → `ClassCommunityView.tsx` + `SchoolCalendarPanel.tsx` | `schoolContent.ts` (`listSchoolCalendarEvents`, `respondToCalendarEvent`) | SELECT `school_calendar_events`, `school_calendar_responses`; RPC `respond_to_calendar_event(...)` | `school_calendar_events`, `school_calendar_responses` | `20261114120000` | Assigned class & school-wide events |
| `student-documents` | Documents | Tab `community` (`subTab: 'documents'`) → `ClassCommunityView.tsx` | `schoolContent.ts` (`listClassCommunityContent`) | SELECT `class_documents` | `class_documents`, `student_class_memberships` | `20261114120000` | Assigned class documents only |

---

## 9. Public Home (`PUBLIC_HOME` — Anonymous & Signed-In Public Site)

Source: `src/components/homepages/PublicHomePage.tsx`  
Privacy rule: Never renders private class announcements (`announcements.filter((a) => !a.classId)`), student lists, pickup data, or unapproved PII. Displays honest `demoPreview` labels whenever DB public projections are unavailable.

| Card / Control ID | Label (EN) | Target Feature / Section | TypeScript Adapter (`src/lib/`) | Required Backend RPC / Query | Authoritative DB Table(s) | Migration Owner | Status & Constraints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Hero CTAs / Family Space / `kr-enroll` | Enroll / Discover Team | Tabs `registration`, `directory` | `schoolOperations.ts`, `schoolContent.ts` | RPC `submit_enrollment_application(...)`; public SELECT `directory_entries` | `enrollment_applications`, `directory_entries` | `20261114110000`, `20261114140000` | Anonymous intake permitted for `submit_enrollment_application` |
| Hero Shortcut: `Schedule` | Schedule *(Emploi du temps)* | Disabled button (`COMING_SOON`) | **None yet** | **None yet** *(future `CAL-01`)* | *(None)* | `—` | **COMING_SOON (`CAL-01`)**; button explicitly disabled |
| Hero Shortcuts: `Homework`, `Class Community` | Homework / Class Community | Auth-gated (`community` if approved, else `AuthModal`) | `homepageAccess.ts` (`canAccessAppTab`) | Redirects anonymous/unapproved to `AuthModal` | `class_homework_items`, `class_announcements` *(only post-auth)* | `20261114120000` | Anonymous access blocked |
| `public-teachers` | Teachers | Tab `directory` (`subTab: 'teachers'`) → `DirectoryView.tsx` | `schoolContent.ts` (`listPublicDirectory`) | SELECT `directory_entries` (`is_published = true`) | `directory_entries` | `20261114140000` | School-approved public profiles only |
| `public-food-menu` *(+ shortcut & panel)* | Food Menu | Tab `foodMenu` → `FoodMenuView.tsx` | `schoolContent.ts` (`fetchActiveFoodMenu`) | SELECT `food_menu_weeks` (`PUBLISHED`), `food_menu_days` | `food_menu_weeks`, `food_menu_days` | `20261114140000` | Shows `demoPreview` badge if DB not yet deployed |
| `public-administration` | Administration | Tab `directory` (`subTab: 'admin'`) → `DirectoryView.tsx` | `schoolContent.ts` (`listPublicDirectory`) | SELECT `directory_entries` (`is_published = true`) | `directory_entries` | `20261114140000` | School-approved admin profiles only |
| `public-admissions` | Admissions | Tab `registration` → `RegistrationView.tsx` | `schoolOperations.ts` (`submitEnrollmentApplication`) | RPC `submit_enrollment_application(...)` | `enrollment_applications` | `20261114110000` | Returns persisted `referenceCode` only on verified DB insert |
| `public-levels-classes` | Levels & Classes | Scroll to `#levelsSectionRef` | Static canonical levels (`CP`–`6EME`) | *(Public projection of `school_levels`)* | `school_levels` | `20261114110000` | No private student rosters exposed |
| `public-activities-clubs` | Activities & Clubs | Scroll to `#activitiesSectionRef` | Public `translations.ts` pillars | *(Target projection: `school_public_content`)* | `school_public_content` | `20261114140000` | Schema table authored; public-only approved editorial copy |
| `public-gallery` *(+ shortcut)* | Public Gallery | Scroll to `#gallerySectionRef` | Static verified `/assets/kristou-home/*` photos | *(Target projection: `class_gallery_items` where `is_public = true`)* | `class_gallery_items` | `20261114120000` | Approved campus media only |
| `public-apply-register` | Apply / Register | Tab `registration` → `RegistrationView.tsx` | `schoolOperations.ts` (`submitEnrollmentApplication`) | RPC `submit_enrollment_application(...)` | `enrollment_applications` | `20261114110000` | Same fail-closed enrollment workflow |
| `public-announcements` *(+ shortcut & panel)* | Announcements | Scroll to `#announcementsSectionRef` | `schoolContent.ts` (`listSchoolBroadcasts`) | SELECT `school_broadcasts` (`is_public = true`, `status = 'PUBLISHED'`) | `school_broadcasts` | `20261114120000` | Excludes all `classId` / internal broadcasts |
| `public-contact` (+ Inquiry Form) | Contact | Scroll to `#contactSectionRef` + inline form | `schoolOperations.ts` (`submitPublicInquiry`) | RPC `submit_public_inquiry(...)` | `public_school_inquiries` | `20261114110000` | Persists inquiry for `ADMINISTRATIVE_PERSONNEL` / `MANAGER` / `APP_ADMIN`; fails closed if undeployed |

---

## 10. Explicitly Deferred / Locked Workflows Across All Homes

| Feature Area | Affected Home Card IDs | Current State | Blocking Gate / Decision Required Before Implementation |
| --- | --- | --- | --- |
| Pickup Arrival & Physical Release | `owner-pickup`, `manager-pickup`, `admin-personnel-pickup-assist`, `staff-pickup-desk`, `teacher-pickup`, `parent-pickup` | `BLOCKED_BACKEND` (`pickup_backend_unavailable`) | Dedicated Pickup slice & atomic release transaction; parent arrival never releases a pupil |
| Teacher & Office Attendance | `teacher-attendance`, `admin-personnel-attendance` | `COMING_SOON` | `DG-08` (teaching session / register unit & correction policy) |
| Persistent School Settings Editor | `owner-school-settings` | `COMING_SOON` | `CFG-01` (domain-owned school policy settings without catch-all JSON blob) |
| Public Schedule / Timetable | `PublicHomePage` `Schedule` shortcut | `COMING_SOON` (disabled) | `CAL-01` (subject/session schedule shape) |
| Staff Tasks, Office Work Queue & Facilities | `admin-personnel-work-queue`, `staff-my-tasks`, `staff-facilities`, `staff-library-transport` | `COMING_SOON` | `DG-19` (authoritative work-queue/ticket ownership; transport/bus operations remain excluded) |
| Grades, Report Cards & Private Media Uploads | Student/Parent/Teacher Assessment & `class_documents` uploads | Deferred / Read-only URLs | `DG-11`, `DG-12`, `MED-01` (assessment formulas & private Supabase Storage buckets) |
