# Class Management backend contract — 18 November 2026

Status: **INSTALLED — CONTRACT READBACK VERIFIED**. Owner approved the exact SQL on 18 November 2026; hosted migration `20261118213709` was installed and verified. Application wiring and authenticated browser acceptance of the new controls remain separate.
Source baseline: `005d51d4cc26f61c6bedbe8178f60f8ef29cc26b` (PR #29 merged).
Target: existing KRISTOUSCHOOL / `ofppapwofhovhroyjtkc` only.
Source migration: `20261118210357_class_management_creation_permissions_and_years.sql`. Hosted migration: `20261118213709` / `class_management_creation_permissions_and_years`. Exact SQL SHA-256: `e6513b778e9464cb56b7ecae88d3af5d42680582da4e9f692ca9b89c2075bdce`.

## Scope and authority

This packet supplies configured academic-year reads, stored class capacity, and independent Owner-controlled class creation. It does not implement transfers, requests, imports, new role management, or application controls. Gemini remains the application implementer after the installed contract is confirmed.

Approved active APP_ADMIN, MANAGER, ADMINISTRATIVE_PERSONNEL and TEACHER accounts default to class creation. Explicit Owner denial overrides that default for the latter three, including a Manager with FULL_ACCESS. Owner authority cannot be denied. Other roles cannot be granted creation by this operation. The server checks actual current profiles/active roles, not frontend or JWT metadata claims.

Creation does not assign Teachers, enroll pupils, expose school-wide rosters or grant Attendance authority. In particular, a Teacher-created class does not become an assigned class automatically. A Teacher may receive a successful creation receipt while remaining unauthorized to read that class's roster. The application must preserve the receipt and report unverified list readback honestly.

`class_creation_permissions` is a narrow per-user governance override. It does not duplicate the role or Manager capability stores. Direct client table privileges are revoked and RLS is enabled. One internal permission projection is shared by the self reader, Owner reader and writer. Its private schema is not client-accessible. Audit events reuse `account_governance_audit_logs`; unrelated Manager capability definitions and audit rules remain intact. The existing Office audit-read policy is preserved.

## Exact public contracts

### `list_academic_years()` → JSON array

Approved Owner/Manager/Office/Teacher only, including creation-denied staff. Independent of classes or students. Rows: `{id,code,label,startsOn,endsOn,isActive}`. Active first, then newest start date and stable ID. Returns existing configured future/inactive years; does not create a year or infer one from classes. Families, School Staff, unapproved and identityless callers are denied.

### `get_my_class_creation_permission()` → JSON object

Authenticated caller's identity only; no target argument:

`{userId,canCreate,reasonCode,version}`

`reasonCode`: `owner_authority`, `role_default`, `owner_denied`, `role_not_eligible`, `account_not_approved`, or `actor_not_found`. Unapproved/ineligible accounts receive `canCreate:false`. Missing authenticated identity raises `actor_unauthenticated`. No private Owner reason is exposed. `version:0` means no override row.

### `governance_list_class_creation_permissions(p_limit integer default 100, p_offset integer default 0)` → JSON array

Approved current Owner only. Limit 1–200; nonnegative offset. Eligible active-role accounts, ordered by user ID. Fields:

`{userId,fullName,username,accountStatus,roles,overrideDenied,changeReason,changedAt,canCreate,reasonCode,version}`

Owner rows are visible but immutable through the permission writer. Page until fewer than the requested limit are returned. Do not interpret an error as an empty list.

### `governance_set_class_creation_permission(p_target_user_id uuid,p_allowed boolean,p_reason text,p_expected_version integer)` → JSON object

Approved current Owner only. Target must have an active MANAGER, ADMINISTRATIVE_PERSONNEL or TEACHER role and no active APP_ADMIN role. Reason is mandatory, trimmed length 3–500. Expected version is mandatory, initially 0. `p_allowed:false` denies; `true` restores the role default. No operation can make Parent/Student/School Staff eligible.

Returns `{userId,changed,canCreate,reasonCode,version,auditLogId?}`. Matching-state no-op returns `changed:false` without an audit or version increment. Stale versions raise `version_conflict`; reload current settings before a new decision. A lost response is not permission to blindly replay a new decision with an invented version.

Actual transitions increment the permission version and existing profile governance version, and insert one `DENY_CLASS_CREATION` or `RESTORE_CLASS_CREATION` audit record atomically. Actor, target, reason and unchanged role/status snapshots are recorded. Audit failure rolls back the override and profile update.

### Existing `create_school_class(text,text,text,integer,text)`

Signature and receipt remain `{id,name,levelCode}`. Existing year, name, level, uniqueness and capacity constraints remain authoritative. Caller profile/roles are locked, then effective creation permission is checked. Denials preserve the existing primary `insufficient_authority` error, with detail `class_creation_denied`, so current error classification remains compatible. Approval loss raises `actor_not_approved`.

No new class state, auto-placement or Teacher assignment. Existing default capacity remains 28 for omitted input; persisted capacity remains constrained to 1–60.

### Existing `list_school_classes_with_rosters()`

Adds only `capacity` from `school_classes.capacity`. All existing fields and roster authorization are preserved. Class creation permission is not consulted for roster access. Parent/Student/anonymous access is not broadened.

## Locking and errors

Mutation isolation must be READ COMMITTED; other levels raise `class_creation_requires_read_committed`. Permission mutation locks sorted actor/target profiles, sorted role rows, then the override, and writes the audit. Creation holds the caller profile and role SHARE locks, then the academic-year SHARE lock. The target-profile UPDATE lock serializes even the first denial where no override row exists. Authority is revalidated after waits. A creation that commits before denial remains a valid existing class; denial prevents later creation and never deletes it.

Other errors: `owner_only_operation`, `reason_required`, `invalid_permission_input`, `target_not_found`, `invalid_target_role`, `owner_authority_retained`, `version_conflict`, `invalid_pagination`, `invalid_academic_year`; existing SQL uniqueness/check/FK errors remain unchanged.

## Application wiring after installation confirmation

1. Use the actual school operations adapter and Supabase singleton; add strict result parsing.
2. Load configured years from the year reader. Remove hardcoded create-year options. Preserve the separately scoped list filter's meaning; handle confirmed empty/error/denied distinctly.
3. Consume `capacity` as returned data, including existing records; do not synthesize persisted values.
4. Introduce a separate server-backed creation-permission state. Do not broaden `canManageClassesUi`, roster access, assignment rights, enrollment actions or Attendance.
5. Allow approved Managers without roster delegation to reach a creation-only surface without loading unauthorized rosters. Teacher creation remains independent of current assignments. This requires explicit separation of creation entry and roster entry in the existing access owner; it is not blanket Manager/Teacher class-management permission.
6. Add Owner deny/restore controls through the existing governance owner, with reason and expected version. Refresh after writes; handle conflicts explicitly.
7. Scope permission/year results and mutation completions to current actor/approval/role/capabilities. Revalidate on entry/resume and after permission changes. Server enforcement is immediate even if a stale control is visible.
8. Preserve PR #29 creation receipt, uncertain-outcome and refresh-only retry behavior. A successful create does not guarantee permission to list its roster.
9. AR/FR/EN, keyboard/mobile behavior and canonical navigation remain required. No placeholder backend, fabricated successful requests or duplicated services.

## Verification and reproduction

Candidate executed against a real disposable PostgreSQL 16.2 database using replayed source migrations plus the exact already-installed Calendar audience and Attendance SQL snapshots. Hosted PostgreSQL is a separate environment; no new hosted migration is claimed.

- 20 real database scenarios, including five two-session lock-contention cases.
- Seven pgTAP suites: 261 assertions (237 existing, 24 new).
- Eight real PostgREST 13 HTTP cases with ordinary authenticated/anonymous JWTs.
- Types were first generated from the isolated tested schema with postgres-meta 0.100.0. After installation, the canonical type file was replaced by fresh Supabase-hosted generated output from this exact project; no handwritten type patches.
- Frozen Bun 1.4.4 install, 166 Node tests, TypeScript and production build passed.

One former regression asserted that a roster-only Manager could never create. The approved new default supersedes that premise. The test now explicitly denies that Manager through the Owner writer, then still asserts denied creation and permitted roster reads. No denial assertion was removed.

`tests/db/class_management_contract.py` requires psycopg 3 and a local, fresh disposable database containing the full installed baseline (including the existing Attendance prerequisite), but not this new migration. It creates/removes synthetic principals, applies this candidate, runs ordinary-role SQL tests, pgTAP and PostgREST HTTP tests, and proves lock waits with `pg_blocking_pids`. It refuses non-loopback or non-test database names and existing account/class data.

```sh
KRISTOU_CM_CONFIRM_ISOLATED=YES_DISPOSABLE_SYNTHETIC_ONLY \
KRISTOU_CM_TEST_DSN='postgresql://postgres@127.0.0.1:54322/kristou_cm_review' \
KRISTOU_POSTGREST_BIN='/absolute/path/to/postgrest' \
KRISTOU_CM_EVIDENCE_DIR='/absolute/path/outside/repository' \
python tests/db/class_management_contract.py
```

The source migration inventory still predates the separately installed Calendar audience and Attendance snapshots. Do not replay their hosted installations or silently replace source migration history. The reviewed evidence packet retains the exact prerequisite snapshots for local reproduction. This older source-recording debt is distinct from installing this candidate.

## Installation gate and recovery

Installation completed after Owner approval. The stored SQL matches the approved SHA-256 exactly; all seven function bodies match the candidate. Hosted rollback-only role reads verified Owner creation authority, one configured year, one existing class with valid saved capacity, and denied direct override-table/internal-helper privileges. The existing class, profiles and role fingerprints are unchanged; protected Calendar, Attendance and capability-function hashes are unchanged. No permission overrides or production fixtures were created. Do not replay this installed migration. These role reads do not establish hosted sign-in or browser acceptance.

The SQL is additive except compatible replacements of the existing create/list functions and extension of the audit action constraint. Any installation error rolls back the transaction. After activation, preserve permission/audit history and use a reviewed forward repair; do not restore legacy creation code in a way that bypasses recorded Owner denials. Emergency disabling of the create RPC requires a separate explicit instruction.
