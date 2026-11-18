# KRISTOU SCHOOL — Student, Teacher, Family and Dossier Continuation

Date: 2026-11-18. This is the living source-to-requirement reconciliation of the
approved master, not a replacement master or a declaration that its features are complete.

## Authority and inspected baseline

- Latest Owner decisions in this conversation take precedence.
- Approved master revision 3: `KRISTOU_MASTER_EXECUTION_PLAN_REV3.txt`, SHA-256
  `d0213cd47d3cbf94d749a7234a9ab29cc965448c0c39850f9d234978b053e3cd`.
  Original roadmap IDs below are retained.
- Source baseline: `funmarket/KRISTOUSCHOOL main@2b943580e0a98ed5223b90c613d36f661928f42a`;
  tree `08906a0ffb48652c39188906b3722ef3742853b7`. No open PRs at inspection.
- Governing product/ownership sources: `requirements.md` sections 4.2.2, 10–12,
  18, 20, 25, 50–60; `structure.md` sections 4, 7–9;
  `docs/CANONICAL_MODEL.md` sections 3–6, 8, 17, 25–28.
- HTML inspected: `KRISTOU-SCHOOL-FINAL-TEMPLATE(4).html`. It explicitly calls
  itself preview/demo data with no backend authorization. Its public Profile modal
  is a public Teacher/Administration directory modal, NOT an implemented pupil dossier.
- `National_Student_Lifecycle_System_Tunisia_Plan_v3_Full.md` is a national-system
  proposal/reference, NOT a verified Ministry API specification, agreement or permission
  to add another school, Prisma service, offline data authority or national registry.

The historical master/header statuses predate substantial implementation. Its old
NOT STARTED entries do not undo current source. Conversely, a card, table, test or
deployment does not prove the whole original packet accepted.

## New Owner decisions to retain

1. Support the complete agreed registration/dossier field set and pupil photographs/files.
   The school configures which fields/documents are mandatory and at which stage.
   Configuration cannot disable identity integrity, authorization, file validation or privacy.
2. Add **Students** alongside **Classes**. Keep class management intact. Students supplies
   authorized school-wide name/code search, class/year grouping and filters, pagination,
   and a reachable dossier through a clickable name or explicit View action.
3. Owner and approved Office have the ordinary school-record audience. Managers need
   the existing delegated roster authority. A Manager label or class-creation permission
   is not school-wide pupil access. Sensitive fields still have separate audiences.
4. Teachers retain assigned-class/student scope. Parents see authorized linked children;
   Students see their explicitly linked pupil record. A login account is not a pupil record.
5. Full student dossier and grades remain accepted work; an index or unavailable-state
   dashboard is not completion of the whole dossier.
6. Attendance uses year + responsible Teacher + ONE class + Africa/Tunis school date.
   No teaching blocks, subject-based register splitting or multi-class registers. Preserve
   incomplete drafts, explicit marks, complete-roster submission, reasoned corrections,
   end-of-school-date Teacher cutoff, later Owner/Office corrections, audit and revocation.
7. Calendar audience membership is a snapshot at event creation. Do not reopen that decision.

## Source findings — not runtime acceptance

| Area | Existing owner/evidence | Missing or not yet established |
| --- | --- | --- |
| Pupil identity | `students`: stable UUID/code, full name, birth date, optional explicit account link, active/archive status | Rich identity/address/photo fields and bounded update workflow |
| Classes and enrollment | `academic_years`, `school_classes`, `student_class_memberships`; `schoolOperations.ts` | Full lifecycle/transfer/rollover and dossier history UX |
| Teacher class/subject relations | `teacher_class_assignments`; T4A catalogue/offering/allocation owners | Complete profile/assignment administration and real acceptance of every relationship change |
| Family | `parent_child_links`; `get_my_school_context` | Dedicated verified link/revoke/account-association workflow beyond optional create-and-enroll inputs |
| Teacher T1/T2 | `ClassesManagementView.tsx`, `studentOverview.ts`, `StudentOverviewPanel.tsx` | Administrative dossier entry; full private pupil profile. Existing View is Teacher-only |
| Attendance | `src/lib/attendance/*`, `AttendanceView.tsx`, staff and family/history panels | Full dossier navigation/acceptance and the separately planned justification workflow |
| Registration | `RegistrationView.tsx`, `submit_enrollment_application` and review statuses | Complete field persistence, configurable requirements, private uploads and document-review lifecycle |
| Public Teacher profiles | `DirectoryView.tsx`, Directory readers/publish operations | Not a private Teacher school-record editor or proof of one |
| Performance | `PerformanceView.tsx`, Teacher-only `list_my_teacher_subject_allocations` | Assessment records, grades/charts/report cards/educational remarks and Parent subject projection |
| Parent Notes | Existing Notes UI, database routines, boundary controller | Fresh hosted source confirms midnight `school_day` and no Teacher selector parameter; it automatically picks one assigned Teacher. Audit/correct the 08:00 cycle, explicit tagging and allowance projection; preserve existing window/quota protection |
| School-wide Students | No Students route/view at the inspected baseline; class search is selected-roster only | Dedicated paginated search/detail API and application list/detail flow |
| PR #30 contract | `docs/CLASS_MANAGEMENT_BACKEND_CONTRACT.md`; installed years/creation-permission/capacity backend | Frontend still derives year options with historical hardcoded entries and does not call the new creation-permission/year readers |

Read-only hosted aggregate inspection on 2026-11-18 found one pupil, one active Teacher
assignment, one active guardian link and **zero linked Student accounts**. This does not
prove that the assignment and guardian refer to the intended test people. Inspect exact
relationships privately before any authorized linking; never join by name/email/contact.
No account/pupil/relationship was changed during this reconciliation.

## One canonical record, several authorized projections

| Fact or operation | Write owner | Dossier consumer rule |
| --- | --- | --- |
| Credentials, username, provider session | Identity | Account association is explicit; never manufacture credentials or modify signup here |
| Account approval/role/grants | Access Control | Display/profile edits cannot approve, grant or impersonate |
| Pupil/staff official identity and permitted contact facts | People | Reuse canonical identity; public directory remains an explicit separate publication |
| Parent/guardian authority | Family | Contact, emergency person and collector are not interchangeable |
| Year/class/Teacher/subject/membership | Academics | One assignment owner; effective scope determines current access |
| Admission and required documents | Enrollment | Acceptance does not automatically enroll, approve an account or authorize guardians |
| File bytes/descriptors | Media | Private resource-bound access; Enrollment/People owns attachment meaning |
| Pupil attendance/history | Attendance | Reuse actual registers/entries; no copied editable totals or inferred percentages |
| Marks/report cards/educational remarks | Assessment | Draft/review/published audiences; no grades derived from subject allocations |
| Parent-originated Notes/replies | Parent Notes | Existing quota/time/child/Teacher policy; not academic remarks |
| Short operational messages | Messaging | Existing participant/length policy; cannot bypass Parent Notes limits |

Teacher profile must distinguish (a) own account presentation, (b) school-verified staff
facts and academic assignments, and (c) explicitly published Directory fields. Reuse their
owners. Do not invent a Teacher HR/medical dossier from the public card or grant self-assignment.

## Dossier and registration field inventory

This is the approved feature inventory, not a certification that every field is legally
required by Tunisia. Labels, purpose, reader/writer, verification and requirement stage
must be mapped in the implementation contract. Never invent missing values to satisfy a
NOT NULL column; changes to current required fields need compatible schema/adapter review.

| Group | Supported information | Rule |
| --- | --- | --- |
| Admission | Configured academic year; new/renewal/transfer; requested level | Public entry consumes only a deliberately public open-admissions projection, not PR #30's staff-only year reader |
| Official identity | Given/surname, Arabic spelling and Latin spelling where available; birth date/place; sex/nationality | School-verified facts, separate from account display name; no forced transliteration |
| Identifiers | Existing school code; Ministry identifier when assigned; appropriate civil-document references | Separate namespaced identifiers/provenance, no fabricated Ministry format/code or automatic matching |
| Residence | Address, locality/delegation, governorate, postal code | Private scoped fields, not class/public directory data |
| Guardians | Responsible and additional authorized guardians; relationship, contact channels, address where different, relevant identification | Verify authority; allow a contact without forcing an app account; no implicit pickup authorization |
| Previous schooling | Establishment, preceding year/level, repeating/transfer information and supporting school record where applicable | Preserve history and original identity across movements |
| Photograph | Pupil photo, replacement/review status and controlled delivery | Private pupil media; do not reuse the public Directory bucket/projection |
| Documents | Birth certificate, residence/guardian evidence, vaccination/medical-examination evidence, prior reports/transfer documents when applicable | School-controlled checklist, private bytes, reviewer decisions and replacement history; not universally mandatory by assumption |
| Emergency/minimal safety | Approved contacts and essential action information | Separate verified, restricted projection; no broad medical/custody/disciplinary dossier by default |
| Enrollment | Application status, confirmed enrollment, academic year, class, dates and history | Separate from account approval and application acceptance |
| Academic record | Authorized subject allocations, assessment marks, published feedback/reports and progress | Assessment-owned, policy-versioned; missing is not zero |

Requirement configuration must distinguish hidden/optional/required and required-at-
application versus required-before-enrollment, with applicability by year/level/application
type. Save a policy version on submission/review so a later school change does not silently
reinterpret an existing dossier. File operations need server MIME/size/type validation,
resource ownership, private download authorization, replacement/orphan cleanup and audit.
An unrestricted generic settings blob, arbitrary SQL fields or catch-all notes JSON is not the design.

## Notes and academic policy boundaries

- Parent Notes: 11 parent-originated notes across children/entry points per school quota
  cycle, 08:00 inclusive to 18:00 exclusive Africa/Tunis, reset 08:00; child and relevant
  assigned Teacher; replies do not consume parent allowance.
- Attendance comments belong to the Attendance owner. Families see submitted permitted
  records, not internal comments or staff audit details.
- Educational Teacher remarks belong to Assessment, linked to pupil/academic context,
  author and explicit audience/publication state. They do not consume Parent Notes quota.
- Restricted staff notes must not leak through remarks, notifications, documents, exports
  or the dossier's general Notes tab. Exact fields/audience/retention remain DG-12/DG-13.
- Keep grades in scope. Before numeric implementation settle actual school terms/scales,
  coefficients/weights, rounding, missing/exempt rules, correction and publication policy
  (DG-11). Do not select these from a prototype or assume all subjects share one model.
- Behavior points, risk/SEN badges, tasks and automatic patterns from earlier suggestions
  are not evidence of approved implemented features. Preserve proposals separately rather
  than fabricate them in Overview or calculate unsupported scores.

## Living implementation checklist — original master IDs retained

Each row is a deliverable with its own review; do not reopen completed Calendar/T1/T2
work to make unrelated enhancements. A database contract is not the application flow.

| Order / packet | Master mapping | Current evidence and remaining deliverable | Owner |
| --- | --- | --- | --- |
| S0 source reconciliation | PRO-01; master §2.4, §2.8; UI-01/02 | This document records source/HTML/Owner decisions and missing work | Codex |
| S1 Students read contract | F2-A9, PRO-01/02 | Implement bounded name/code search and identity/enrollment detail using existing roster authority; local security/API tests; exact SQL review before installation | Codex |
| S2 Students application | F2-A9, PRO-02, UI-02 | Add Students route/menu/home entry, server paging, class/year filters/grouping, administrative clickable dossier and back/search preservation; preserve Classes and T1/T2 | Gemini after reviewed contract/types |
| S3 complete identity and relationship management | F2-A1/A3/A5/A6/A10, PRO-02 | Explicit Student-account association, verified guardian link/revoke, Teacher assignment administration, school identity edits and stale-version/audit handling | Codex contract; Gemini mechanics |
| S4 school-configurable admission dossier | F2-A4/A6, F3-C1, DG-03 | Real school requirement settings, typed fields, public-safe open year options, save/resume/review, no silent refresh/save confusion | Codex contract; Gemini mechanics |
| S5 private photos/documents | MED-01, PRO-02, F3-C1 | Real private upload/read/replace/delete/review, row/Storage authorization and document-request workflow | Codex contract/Storage; Gemini mechanics |
| S6 Teacher profile | People; F2-A3/A6/A10, PUB-01 | Own profile + school-verified staff/contact/assignment view; authorized editor; explicit Directory publication separation | Codex field contract; Gemini mechanics |
| S7 academic policy and persistence | GRD-01/02, DG-11/12 | Approve exact school grading/remarks policy; assessed results and audited corrections; assignments gate Teacher writes | Codex/Owner policy; real DB tests |
| S8 complete academic dossier | GRD-03/04, PRO-02 | Real grade entry, report review/publication, authorized Parent/Student results, charts from actual series and educational feedback | Gemini against S7 contracts |
| S9 shared attendance/history | ATT-05, PRO-02 | Consume existing Attendance history in permitted dossier sections; explicit bounds/statuses; preserve approved daily register | Gemini + Codex acceptance |
| S10 Parent Notes reconciliation | F3-C2 | Fresh installed-contract audit of 08:00 quota, Teacher tagging and real concurrency; narrow correction if needed | Codex; Gemini only affected UI |
| S11 absence justification | ATT-04, MED-01 | Private explanation/document, authorized review, no automatic mark mutation | Codex contract; Gemini mechanics |
| S12 imports and continuity | F2-A7/A8, YEAR-01/02, DG-02/15 | School-approved CSV/XLSX template, preview/conflicts/confirmed commit, transfer/renewal/rollover preserving history | Separate bounded packets |
| S13 Class Management frontend closeout | F2-A2/A6; PR #30 | Consume real years/capacity/creation permission; Owner reason/version controls without roster escalation; preserve PR #29 mutation/readback state machine | Gemini |
| S14 real relationship acceptance | F2-A10, F5-V1 | Owner's real test accounts + expressly authorized removable school fixtures; role/privacy/revocation/browser/API flow, then scoped cleanup | Codex + Owner |
| M1 Ministry preparation | DG-02; external reference only | Obtain actual convention/exchange specification/identifiers/credentials/sandbox; no invented endpoints or credential scraping | Separate track |

S2/S4/S5/S6/S8 are application assignments, not permission for overlapping Codex frontend
rewrites. Gemini edits actual AI Studio source; Owner handles external publication. Its
workspace is not compared to main as though its pending changes were already there.
Every Gemini implementation packet includes the Owner's absolute no-drift/no-fakes/no-
mocks/domain-ownership warning and exact contracts, protected paths and acceptance cases.
Do not put publication/sync instructions in Gemini prompts.

## First implementation — S1 interface and boundary

Candidate source: `supabase/migrations/20261118222622_students_search_and_identity_detail.sql`.
Not installed merely because this document or file exists.

- `list_school_students(p_search text default null, p_academic_year_id uuid default null,
  p_class_id uuid default null, p_status text default 'ACTIVE', p_limit integer default 25,
  p_offset integer default 0) -> jsonb {items,total,limit,offset}`.
  One pupil per item, literal case-insensitive name/code substring or exact pupil UUID;
  no wildcard interpretation. Year/class filters match ACTIVE memberships. No filter
  includes unassigned pupils. Status ACTIVE/ARCHIVED/ALL; limit 1–100, offset 0–100000,
  search up to 100 characters. Stable sort by lowercase name, code, UUID. Classes array
  is context, not another membership owner; grouping is within the returned page and
  must not imply a complete class roster. `total` counts pupils, not memberships.
- `get_school_student_identity(p_student_id uuid) -> jsonb` returns identity, birth date,
  active/archive state, a boolean account-link presence and canonical membership history.
  This intentionally narrow administrative projection is NOT called a complete dossier.
- Both reuse current approved Owner/Office or existing CLASSES_ROSTER_VIEW/CLASSES_MANAGE
  delegation (including existing FULL_ACCESS semantics). Teacher-only, Parent, Student,
  ordinary Staff, bare Manager, anonymous and unapproved callers are denied.
- Existing Teacher/family readers and field scopes remain untouched. No safety_note,
  private contacts, guardian documents, credentials, grades, notes or arbitrary `select *`.
- New SQL is read-only, authorizes before looking up resources and preserves all existing
  functions/RLS/tables/data. Revocation is checked against current DB state on subsequent
  requests, not cached JWT roles. An already-running SQL snapshot is not retroactively revoked.
- Generate candidate types from the tested schema; keep installed application types until
  the corresponding backend release is approved. Backend/API review precedes Gemini wiring.
- Required evidence: real PostgreSQL allow/deny, Unicode/literal search, paging/counts,
  deduplication, year/class context, unassigned/archived records, privacy, existing scopes,
  revocation on an open connection and actual PostgREST transport. No mocked backend/DOM
  counts as this acceptance. No performance/production claim from tiny fixtures.

## Remaining acceptance gates and maintenance

- [ ] Review/test S1 exact SQL and generated candidate types; record actual checks below.
- [ ] Obtain manual approval for the exact new SQL before hosted installation.
- [ ] Deliver S2 via Gemini against the installed reviewed contract; inspect real source.
- [ ] Preserve and execute S3–S14/M1; an unavailable card does not close a row.
- [ ] Record exact candidate/installed/deployed revisions and evidence per row, including
  failures and tests not run. Update this checklist after each accepted packet.

Do not mark grades/remarks/documents complete because navigation exists. Do not postpone
database contracts indefinitely, or make a UI promise to absent storage/RPCs. Continue the
dependency chain through real persistence, application wiring, readback and authorization.

### Existing private-field grant finding — must not be lost

Read-only hosted privilege inspection confirmed `authenticated` has whole-table SELECT
on `students`, including `safety_note`. Existing row scope does not provide a separate
column audience for that field. Do not populate sensitive clinical/custody information
there or claim that the present legacy grants enforce staff-only safety-field privacy.
S3 must audit direct table/reader consumers and replace that broad column exposure with
reviewed least-privilege fields before implementing restricted safety information.
The two new S1 projections explicitly exclude this field and do not widen the old grants.

### S1 execution checkpoint — 2026-11-18

The first isolated run passed its ten behavior tests but failed fixture cleanup on the
existing `manager_capability_grants.granted_by` foreign key. Cleanup was corrected to
delete this run's owned grants before deleting its synthetic accounts; the failed log is
retained. The subsequent complete run executed twelve real PostgreSQL test methods,
eight pgTAP suites / 277 assertions, and eight actual PostgREST HTTP cases successfully.
The final revision must be rerun after any later test/code edit; exact revision and final
results belong in the PR/evidence checkpoint. No hosted writes or browser acceptance
were performed. Candidate types are generated externally from the tested isolated schema;
installed application types remain unchanged until the corresponding release gate.
