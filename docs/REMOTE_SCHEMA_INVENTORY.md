# KRISTOU SCHOOL — REMOTE SUPABASE SCHEMA INVENTORY

**Status:** Read-only reconciliation evidence; not a migration baseline
**Updated:** 2026-11-10
**Repository:** `funmarket/KRISTOUSCHOOL`

## Scope and safety boundary

This document records inspection evidence only. No remote SQL, migration, table, policy, grant, storage, function, or data change was performed during this task. Existing remote objects must remain untouched until their provenance, ownership, backup state, and access design are reviewed.

## Supplied project reference

The task supplied this URL:

```text
https://bzerboixpbwfvmbnbzxd.supabase.co
```

The attached read-only audit for that reference reports project ref `bzerboixpbwfvmbnbzxd`, project name `Kistou`, region `eu-west-1`, PostgreSQL 17.11, 49 public tables, RLS enabled with no policies on the inspected tables, broad `anon`/`authenticated` table grants, no reported migration history, no public-schema routines, no deployed Edge Functions, and no Storage buckets. The reported tables include both a PascalCase canonical candidate family and an older snake_case family.

The exact table inventory in that audit is:

- PascalCase candidates: `AcademicYear`, `AccountLinkChallenge`, `AuditLog`, `AuthorizedPickupPerson`, `CapabilityGrant`, `Class`, `ClassAnnouncement`, `ClassQuestion`, `ClassQuestionReply`, `DismissalPolicy`, `Enrollment`, `EnrollmentApplication`, `FoodMenuDay`, `FoodMenuWeek`, `HomeworkItem`, `Level`, `ManagerProfile`, `Message`, `MessageThread`, `OutboxEvent`, `ParentChildLink`, `ParentNote`, `ParentNoteReply`, `ParentProfile`, `PickupEvent`, `RoleAssignment`, `SchoolBroadcast`, `StudentClassMembership`, `StudentProfile`, `TeacherClassAssignment`, `TeacherDirectoryEntry`, `TeacherProfile`, `TelegramIdentity`, `User`, `UserNotification`, `UserPreferences`, `WebCredential`, `WebSession`.
- Snake_case candidates: `announcements`, `calendar_events`, `children`, `class_question_replies`, `class_questions`, `classes`, `homework`, `parent_children`, `parent_notes`, `pickup_records`, `users`.

This evidence is from the supplied handoff and is not treated as a current live query in this session.

## Current authorized Supabase connector evidence

The authorized Supabase connector currently lists a different project:

```text
project ref: ofppapwofhovhroyjtkc
name: KRISTOUSCHOOL
region: eu-west-3
status: ACTIVE_HEALTHY
PostgreSQL: 17.11
```

A read-only public-table listing for that authorized project returned no tables. The connector rejected read-only inspection requests for the supplied `bzerboixpbwfvmbnbzxd` ref. This is a project/credential mismatch that must be resolved before any schema pull, migration baseline, generated type export, or remote deployment is attempted.

## Local repository comparison

The current branch has no `supabase/` directory or committed migration baseline. The application contains a placeholder browser client and mock-driven state. Its handwritten TypeScript database shape describes only the older snake_case `users`, `children`, `parent_notes`, and `pickup_records` tables, so it must not be used as proof of compatibility with the supplied project’s reported PascalCase schema.

The browser client now fails closed when runtime configuration is absent. It accepts only:

- `VITE_SUPABASE_URL` / `SUPABASE_URL`;
- `VITE_SUPABASE_PUBLISHABLE_KEY` or the compatibility anon-key names.

No project URL, mock key, service-role key, or database credential is embedded in source.

## Required next decision before database implementation

1. Confirm which Supabase project is the intended KRISTOU SCHOOL environment and grant read-only access for that exact ref.
2. Obtain a verified schema snapshot or controlled `db pull` for that project, including columns, constraints, foreign keys, indexes, routines, grants, RLS policies, storage, and migration history.
3. Reconcile overlapping table families against `docs/CANONICAL_MODEL.md` without dropping, renaming, truncating, or rewriting existing objects.
4. Choose and review a non-destructive migration-baseline strategy before adding feature migrations.
5. Do not connect private child, family, credential, health, enrollment, or pickup data from the browser until identity mapping, grants, RLS, and allow/deny tests are accepted.
