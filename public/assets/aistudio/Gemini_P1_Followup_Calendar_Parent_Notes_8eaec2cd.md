# Gemini follow-up — P1 corrections, calendar mechanics and parent communication

You are continuing KRISTOU SCHOOL in the existing AI Studio workspace. This is an implementation correction packet, not a request for another audit-only reply.

The Owner requires you to finish the missing application work, correct the defects below, and adapt the calendar mechanics from HoomaUltimate’s Athletes community calendar. Immediately below the authenticated calendar, use the established KRISTOU Parent Notes communication rules. Preserve completed work and the existing design.

## 1. Non-negotiable truth and ownership rules

Your previous “P1 complete” claim is not accepted as full acceptance. Codex inspected the uploaded files and reproduced two failures in your notification rollback callback. Browser, hosted database and genuine concurrency acceptance remain unverified.

Do not claim implemented, saved, sent, private, tested, deployed or complete without evidence for that exact claim. A visible button, source regex, mocked RPC response or successful build does not prove a durable backend operation. Never replace a missing backend with localStorage, an in-memory store, demo records or unconditional success.

Your application scope remains src/** EXCEPT src/lib/database.types.ts and src/lib/supabase.ts, tests/**, .evidence/** and export artifacts. Do not modify:
- supabase/migrations/**, supabase/tests/** or supabase/functions/**;
- the generated database type owner or Supabase client composition owner;
- docs/SUPABASE_DEPLOYMENT_2026-11-15.json;
- AGENTS.md, README.md, requirements.md, structure.md, docs/** or progress.md;
- credential rules, approval authority, Telegram auth/link/re-entry/session behavior, or Pickup safety locks.

Codex owns database contracts, migrations, grants/RLS and generated types. HoomaUltimate is READ-ONLY reference material. Do not edit it, import its runtime/backend architecture, or copy its founder/member permissions into the school.

Do not push, create a PR, merge or deploy. The Owner publishes your workspace changes. If .git is absent, report Git identity as UNAVAILABLE; never initialize Git or invent a commit.

Read the current workspace instructions and owning source first. Preserve a baseline inventory and protected-file SHA-256 checksums. Do not rewind the workspace to an older GitHub snapshot.

## 2. Correct these demonstrated application defects first

### A. Notification rollback and account isolation

In the reviewed AppContext.tsx, markNotificationRead and markAllNotificationsRead capture the whole notifications array and restore it on failure.

Two deterministic unit reproductions using the uploaded callback failed:
1. Mark notification A and B concurrently; B succeeds, then A fails. Restoring the old array incorrectly makes B unread again.
2. Start a mark-read request, log out and clear private state, then resolve the old request as a failure. Restoring the snapshot brings the previous account’s notifications back.

Fix the actual provider behavior:
- Bind asynchronous results to the originating account and session/request generation.
- Invalidate pending work on logout, account replacement, approval loss and unmount.
- Never restore an entire stale array.
- Make concurrent single-read and mark-all operations deterministic; an earlier failure must not undo a later success.
- Preserve notifications added by a refresh while an operation is pending.
- Display truthful operation-specific pending/error feedback and recover through authorized server readback where needed.
- Handle rejected promises as well as returned error results.

Audit school-data hydration, class switches, recipient loading and preference saves for the same stale-result problem. Prevent old-user, old-class and old-request responses from replacing current state. Limit edits to these affected flows.

### B. Visible error states with cached records

The reviewed ParentNotesView and RegistrationView show ERROR/UNAUTHORIZED banners only when their lists are empty. A failed refresh with existing records therefore conceals the failure. DirectoryView and FoodMenuView handle ERROR but lack the claimed UNAUTHORIZED banner.

Correct this consistently:
- Show refresh failures even when cached records exist.
- Distinguish loading, confirmed empty, stale-but-readable, unauthorized, unavailable contract and ordinary error.
- On access denial, clear affected private data and disable commands; do not continue displaying it as current authorized data.
- Retry must perform a real refresh and reflect its result.
- Do not show an empty-state message while loading or on an unresolved failure.
- Do not substitute preview data for ordinary network/permission failures.
- Preserve drafts on recoverable command failure.

src/lib/supabase.ts remains protected. If its error classifier prevents correct distinctions, document the exact required correction for Codex. Do not work around it with a second global classifier or report that dependency fixed.

### C. Preferences and recipients

Preference failures must not silently look persisted. Keep local display choices distinct from confirmed account persistence. An unavailable backend must not clear a genuine save error as though the save succeeded. Guard out-of-order responses and account changes.

Recipient loading must depend on the actual account identity, not only a boolean isAuthorized value. Clear obsolete recipients/selections on identity or authority changes, reject stale responses, and reconcile selected IDs against fresh eligible results.

## 3. Calendar reference — inspect these exact sources

The repository URL’s default main branch currently contains documentation only. The working reference inspected by Codex is:

Repository: funmarket/HoomaUltimate
Branch: phase-0-foundation
Inspected commit: 1edc332eee47bca567c7e107977c69daeecc673e

Inspect the pinned source, not a guessed main-branch path:

- https://github.com/funmarket/HoomaUltimate/blob/1edc332eee47bca567c7e107977c69daeecc673e/packages/frontend/src/athletes/AthletesPages.tsx
- https://github.com/funmarket/HoomaUltimate/blob/1edc332eee47bca567c7e107977c69daeecc673e/packages/frontend/src/athletes/AthletesCalendar.tsx
- https://github.com/funmarket/HoomaUltimate/blob/1edc332eee47bca567c7e107977c69daeecc673e/packages/frontend/src/athletes/useAthletesCalendar.ts
- https://github.com/funmarket/HoomaUltimate/blob/1edc332eee47bca567c7e107977c69daeecc673e/packages/frontend/src/athletes/athletes-calendar-time.ts
- https://github.com/funmarket/HoomaUltimate/blob/1edc332eee47bca567c7e107977c69daeecc673e/apps/api/src/modules/athletes/application/athletes-calendar.service.ts
- https://github.com/funmarket/HoomaUltimate/blob/1edc332eee47bca567c7e107977c69daeecc673e/packages/contracts/src/athletes.ts

Relevant reference tests include athletes-calendar.component.test.ts, athletes-calendar-time.test.ts, athletes-calendar.integration.test.ts and athletes-calendar-rsvp-concurrency.integration.test.ts under tests/. Test-file existence is not a passing test result.

Verified reference mechanics:
- Month navigation, Today, selected-date highlighting and event counts.
- Selected-date agenda; adding starts from the selected date.
- Create/edit forms, start/end times, location, description and optional event photo.
- Server-backed create, update and cancellation followed by readback.
- Explicit cancellation confirmation; cancelled entries remain represented, with edit/RSVP changes rejected by the reference server.
- One persisted RSVP per event/member; changing it replaces the previous response.
- Going / Maybe / Not going choices, personal selection and server-derived aggregate counts.
- Bounded month/range requests, pagination and loading/error/retry states.
- Request-generation checks against obsolete responses.
- Uploaded media uses authorized server handling and private signed delivery; it is not a browser-only URL fiction.

These are source findings, not a claim that Codex ran Hooma’s live UI or test suite.

Create .evidence/CALENDAR_REFERENCE_MATRIX.md mapping each mechanic to the existing Kristou owner, current support, required application adjustment, database dependency and verification. Do not replace the calendar wholesale.

## 4. Adapt the calendar correctly to KRISTOU

Continue using the canonical SchoolCalendarPanel and existing adapters. Preserve the school categories, AR/FR/EN, mobile layout, stable LTR shell, existing all-day/multi-day behavior and school permissions.

Complete supported mechanics now:
- Month/Today/date selection must control the actual agenda and selected-date creation draft.
- Category filters, markers and agenda must agree.
- Date changes must not leave edit/cancel state attached to the wrong event.
- Show actual loading/error states; preserve appropriate drafts.
- Guard duplicate submissions and stale responses.
- Read back committed changes. Distinguish “command committed, refresh failed” from “command failed” so retries do not create duplicates.
- Expose RSVP commands only to eligible approved actors, never public visitors.
- Keep cancelled entries clearly distinguished for audiences authorized to read them; do not hard-delete them to imitate cancellation.
- Do not imply that an event cancellation records a pupil absence, closes school automatically, or releases a child.

Respect these important contract differences:
1. Kristou’s current create RPC is named upsert_school_calendar_event but only inserts. It has no event-ID update operation. Do not implement Edit by calling it and creating a duplicate.
2. start_time/end_time/timezone columns exist, but the current create RPC does not accept times. Do not show a functional timed-event save that discards those fields.
3. Location and event-photo persistence are not established Kristou calendar contracts.
4. The current adapter fetches calendar rows without a month range or pagination. Scope/bound the reads through supported contracts, with stable ordering and tests.
5. Existing school responses are ATTENDING / ACKNOWLEDGED / DECLINED. Hooma uses GOING / MAYBE / NOT_GOING. ACKNOWLEDGED means “seen,” not “maybe.” Never relabel it as Maybe. Document the additive response-contract change required for reference parity while preserving existing acknowledgement data.
6. Aggregate counts require an authorized server projection. Never fetch private response rows broadly, count only the caller’s RLS-visible rows and call that a total, or invent zero totals.
7. Preserve recorded school/event timezone semantics and the existing Africa/Tunis default. Hooma uses device timezone; do not silently replace school scheduling semantics with device-local dates. Keep all-day dates stable across devices and label timezone behavior.
8. Codex inspected the installed respond_to_calendar_event function: it currently has no cancelled-status rejection or event-state locking. Hiding buttons is not a fix. Request the database guard and cancellation/RSVP race tests from Codex.

Add exact contract requests for timed creation, safe event editing/conflict handling, range pagination, RSVP semantics/totals, cancelled-event denial and optional location/media. Specify parameters, return/error shapes, access scope and required tests as proposals, not installed facts. Do not create fake adapters for absent RPCs or call them at runtime before their contracts land.

## 5. REQUIRED: parent communication immediately below the calendar

This Owner clarification is mandatory.

On the AUTHENTICATED school/class calendar surface, place the parent-school communication area directly below the calendar/selected-day agenda. Reuse the existing Parent Notes domain, persistence and actions. Extract a small shared panel if necessary so the existing dedicated Parent Notes destination and the calendar panel use the same owner. Do not duplicate state, quota accounting or send/reply implementations.

This is not a public class chat or a copy of Hooma’s Whistle/chat board.

Apply the established rules:
- Approved PARENT identity and a verified active parent-child relationship.
- Parent may tag only their linked child; the child must belong to the relevant class.
- Teacher tag is required for teacher-related matters, and the teacher must be assigned to that class.
- Maximum 11 parent-originated notes per parent per school day, shared across children, devices, calendar entry points and the dedicated Notes page.
- Sending is allowed from 08:00 inclusive to 18:00 exclusive in Africa/Tunis.
- Quota resets at 08:00 Africa/Tunis. Do not substitute device midnight or a new panel-local counter.
- Existing server content validation currently permits 1–1000 trimmed characters; preserve the installed limit and report any product-contract discrepancy rather than inventing a new one.
- Staff/teacher replies do not consume parent quota.
- Keep approved topics such as ABSENCE, HOMEWORK, BEHAVIOR, HEALTH, PICKUP and OTHER.
- Child-specific notes remain private to the authorized family, relevant teachers and authorized staff. Other class parents, public visitors and unrelated users cannot read them.
- UI guards explain limits; server authorization, durable quota enforcement and concurrency safety remain authoritative.
- Show send state, remaining quota and server errors truthfully; retain the draft on failure.
- Reading existing authorized correspondence must not be disabled merely because the parent send window is closed.
- Do not add the parent send quota/window to staff replies without an approved rule.
- Parent Notes mentioning an event do not automatically become public calendar comments.
- Ordinary 200-character Messages remain a separate feature and must not provide a route around Parent Notes rules. Student private DMs remain disabled.

Important existing gaps to investigate and report to Codex:
- addParentNote currently accepts an optional teacher argument but ignores it; send_parent_note accepts only student/topic/content and automatically selects a teacher. Do not offer a teacher picker whose selection is discarded.
- Existing school_day accounting uses a Tunis calendar date. Verify 08:00 reset semantics, including the displayed remaining count before 08:00, rather than declaring the contractual reset proven.
- The private panel must not mount or fetch child/notes data on the anonymous public calendar. Compose it in the authorized host when the calendar itself is shared.
- Switching child/class/account must clear obsolete drafts or keep them explicitly bound to their original context. A stale send must never go to the newly selected child by accident.

Test 07:59 denial, 08:00 allowance, 17:59 allowance, 18:00 denial; the 11th/12th boundary; the 08:00 reset; multiple children sharing one quota; correct teacher/class tags; staff replies; cross-family denial and late responses after account/class change. Mocked unit tests do not prove hosted quota or genuine concurrency.

## 6. Finish the remaining P1 wiring within real contracts

Recheck Owner governance readiness, Manager/Office counters, Classes linking and teacher unassignment, Messages, public CMS reads, public live-versus-preview rendering, preferences, notification failures, and all affected retry paths.

Keep existing supported operations working. Reuse the existing application boundaries. Do not restore manual UUID inputs as the only completed picker experience when an eligible-account contract is missing; report that dependency truthfully.

Previously requested database contracts remain proposals:
- upsert_school_public_content;
- create/delete_class_document;
- create/delete_class_gallery_item;
- mark_operational_thread_read;
- list_assignable_school_accounts;
- calendar update and the additional calendar contracts above.

Codex verified these eight named RPCs were absent at review time. Recheck the supplied generated contract before wiring anything new. Private documents/photos need a real authorized Storage contract; arbitrary public URLs do not establish privacy. Pickup stays safety-locked.

Do not stop all application corrections because one database contract is missing. Complete independent work and list the dependent controls precisely as blocked. Never call the entire packet complete while required operations remain blocked.

## 7. Verification must exercise the behavior

Add regression coverage that fails on the current defect, then passes on the corrected behavior. Do not weaken existing tests.

Required meaningful coverage:
- Provider/component notification overlap, mark-all overlap, logout/account switch and refresh races.
- Error and unauthorized banners with both empty and populated data.
- Recipient identity changes and failed/out-of-order preference persistence.
- Calendar date selection → draft → actual adapter call → confirmed readback.
- Pending/duplicate prevention, failed saves retaining drafts, safe cancellation and RSVP behavior.
- The private Parent Notes panel below the calendar with the rules in section 5.
- Existing public preview/private broadcast isolation and protected auth behavior.

Source regex checks may supplement tests but cannot replace interaction/state tests. Mock RPC tests prove adapter behavior only. Browser tests prove rendered interaction only in their named environment. Hosted RLS/SQL/concurrency require Codex-side evidence.

After the FINAL edit, run the available full Node suite, TypeScript check and production build. Capture exact commands, timestamps, revision or workspace fingerprint, exit codes and actual counts. Check protected files against the pre-edit baseline. Inspect the final complete diff.

If browser tooling or another required facility is absent, report the actual probe and NOT RUN. Do not fabricate browser acceptance or install unapproved tools.

## 8. Deliver the complete, reviewable workspace packet

Your previous attachment set omitted these eight claimed changed files:
- src/App.tsx
- src/components/Navbar.tsx
- src/components/homepages/PublicHomePage.tsx
- src/components/homepages/OwnerHomePage.tsx
- src/components/homepages/ManagerHomePage.tsx
- src/components/homepages/AdministrativePersonnelHomePage.tsx
- src/components/views/ClassesManagementView.tsx
- src/components/views/GlobalAnnouncementsCalendarView.tsx

Export ALL changed files, not just those eight, plus:
1. A complete unified diff against the real pre-correction baseline; also retain the full cumulative P1 diff against its recorded original baseline.
2. Changed-file inventory and SHA-256 manifest identifying each baseline.
3. Updated tests and unedited final test/lint/build logs.
4. Protected-file baseline and postcheck output.
5. Updated DATABASE_CONTRACT_REQUESTS.md, including the new calendar and Parent Notes gaps.
6. CALENDAR_REFERENCE_MATRIX.md and an explicit under-calendar Parent Notes acceptance map.
7. Browser evidence or the exact NOT RUN reason.
8. Remaining blocked behaviors and the exact Codex-owned dependencies.

Start your final report with:
GEMINI WORKSPACE EVIDENCE — NOT GITHUB VERIFICATION

Report separately: corrections implemented and tested locally; source-inspected behavior; database dependencies; browser checks; hosted checks; publication/deployment.

Do not claim “everything works,” “production ready,” “65/65” or any other result unless the final artifacts support that exact statement. Your old test count is not a target. Add necessary tests and report the actual final count. Finish with the real status: COMPLETE WITHIN AUTHORIZED SCOPE only if every scoped gate passed, otherwise PARTIALLY IMPLEMENTED with a precise remaining list.

Begin the corrections now. Do not substitute another optimistic summary for the missing implementation and evidence.

