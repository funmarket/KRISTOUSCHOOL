# KRISTOU SCHOOL — Eight-role signup, approval, and access checklist

> Implementation planning only. No code, database, or existing authentication is changed by this PR.

**Status:** DRAFT, Product Owner decision gates pending
**Date:** 12 November 2026
**Repo:** funmarket/KRISTOUSCHOOL
**Inspected base:** main@4554ed68c9cd11768e890c368fd36252a38af51f
**Authority:** Latest explicit Product Owner decisions take precedence over older requirements and current source. AGENTS.md and existing domain ownership remain binding.

## Goal and hard boundaries

Fix the eight canonical product role definitions and reconcile the existing registration role selector with approval-before-sign-in. Preserve the existing React global UI, form order and appearance, working username/email/phone/password credentials, Web/Telegram shared account identity, Telegram linking, public homepage, and school business domains.

**Exactly eight product role codes:**

| # | Code | Owner-approved meaning | Current signup form |
|---|---|---|---|
| 1 | APP_ADMIN | School Owner = Principal; highest authority | Not offered; privileged assignment |
| 2 | MANAGER | Manager / Associate / Director, appointed by Owner | Not offered; Owner appointment |
| 3 | GENERAL_USER | Anonymous/public visitor; no account needed | Not offered; no signup required |
| 4 | PARENT | Parent / guardian | Offered |
| 5 | STUDENT | Student | Offered |
| 6 | TEACHER | Teacher | Offered |
| 7 | SCHOOL_STAFF | Cooks, cleaners and other regular staff | Offered |
| 8 | ADMINISTRATIVE_PERSONNEL | Office/administrative employees; their own login and paperwork responsibilities | Offered |

The absence of the three privileged/public categories from a signup dropdown must not automatically be treated as a bug. **Decision DG-01:** Owner must resolve whether MANAGER and APP_ADMIN should appear as *request-only* signup choices, or be assigned/provisioned only after an approved school account exists. Even a visible option must NEVER grant its own authority. GENERAL_USER remains public and account-free. Showing all eight selectable choices would conflict with the no-account GENERAL_USER rule. This is a **planning gate**, not permission to guess.

## Verified current source — evidence

Inspected main SHA above, GitHub open PR count zero, rejected PR #13 excluded.

| Source | Verified live implementation / discrepancy |
|---|---|
| src/components/AuthModal.tsx | Role is first signup field. Five offered: PARENT, TEACHER, SCHOOL_STAFF, ADMINISTRATIVE_PERSONNEL, STUDENT. Student requires Admission ID; teacher/staff/admin-employee require Staff ID. Full name, username, password, email or phone. Post-signup copy currently says account can sign in. |
| src/lib/auth.ts | SignupRole contains GENERAL_USER + those five; signUpAccount sends requested_role in metadata; email/phone use Supabase signInWithPassword, username uses auth-username-signin Edge Function. loadCanonicalUser reads active role_assignments. Legacy mappings PRINCIPAL→MANAGER, EMPLOYEE→MANAGER, APP_ADMIN→ADMIN. |
| src/types.ts | Frontend union currently includes both PUBLIC and GENERAL_USER, and ADMIN instead of APP_ADMIN — nine codes. |
| src/context/AppContext.tsx | Session restore, login/signup/logout and development setCurrentRole helper. Login does not enforce Owner/Manager approval before reporting success. |
| supabase/migrations/20261110210000_authentication_foundation.sql | PostgreSQL role enum has historical PRINCIPAL and EMPLOYEE. profiles.requested_role persists selected request; role_assignments has active and assigned_by; new-user trigger initially assigns GENERAL_USER and may bootstrap APP_ADMIN. No account approval lifecycle established by this migration. |
| supabase/functions/auth-username-signin/index.ts | Username lookup followed by normal provider password sign-in, without inspected school approval gate. |
| supabase/functions/telegram-auth/index.ts | Validates Telegram initData and looks up linked user and active roles, but no inspected account-approval status gate. |
| src/App.tsx, src/components/Navbar.tsx | Existing public/home and seven destinations, account menu. Visibility is not backend permission. Do not build new dashboards as part of this correction. |
| Existing tests | tests/auth-username.test.mjs, tests/functions/telegram-init-data.test.mjs, supabase/tests/auth_foundation_security.test.sql. They do not establish the required approval-before-login end-to-end guarantee. |

AGENTS.md, requirements.md §§3–4, structure.md, docs/DECISIONS.md ADR-012/015, docs/CANONICAL_MODEL.md, docs/LIVING_BUILD_PLAN.md, docs/SUPABASE_BACKEND_IMPLEMENTATION_PLAN.md, progress.md, docs/CONTINUATION_HANDOFF_2026-11-10.md, and docs/SUPABASE_CONTINUATION_PLAN.md were inspected. **Contradiction:** older requirements describe an authenticated GENERAL_USER account immediately after signup; the latest Owner instruction instead requires pending school applicants to remain without approved school sign-in credentials/access. Reconcile the governing wording in a separately approved implementation PR.

**Live Supabase database not independently verified by this plan.** Current SQL files are not proof of deployed migrations, provider settings or actual legacy role records. No SQL change authorized.

## Intended applicant lifecycle — not currently implemented

1. Anonymous visitor browses as GENERAL_USER without an account.
2. Applicant opens existing Signup tab and chooses the school role sought **as the first field**; existing conditional fields remain.
3. Applicant submits contact identifier, unique username, password, role and required IDs.
4. Submission creates a **pending application**, not an approved school identity. Requested role is **not** a grant.
5. APP_ADMIN or authorized MANAGER reviews the application and decides approve/reject.
6. On approval, activate sign-in credentials and assign the approved school role to the same canonical identity. The approved role must follow the requested role unless the Owner explicitly authorizes a different decision policy.
7. Only then permit school sign-in via username/email/phone and authorized Telegram app context. Pending/rejected/revoked users cannot bypass via a different route or restored session.
8. A signed-in approved user sees their assigned role's approved school pages. Login is separate from school admission/enrollment.

Owner grants access to roles/pages. Manager may approve applicants only through an Owner-authorized capability. Manager does not thereby acquire Owner-only assignment authority.

## Decision gates — mandatory before any implementation

- [ ] **DG-01 — Selectable role policy:** approve exactly which school roles appear in public Signup. Five already work. Decide MANAGER and APP_ADMIN request/provision behavior; GENERAL_USER stays account-free.
- [ ] **DG-02 — Approval authority:** APP_ADMIN and authorized MANAGER; determine precise Manager grant and who appoints/revokes Managers.
- [ ] **DG-03 — Application states:** pending, approved, rejected, revoked; resubmission, account identity continuity, contact confirmation and stale-session treatment.
- [ ] **DG-04 — Provider credential activation:** choose and verify the precise Supabase Auth solution enforcing approval across all three password login methods and Telegram; do not invent frontend-only session gates.
- [ ] **DG-05 — Legacy role migration:** inventory existing PRINCIPAL/EMPLOYEE assignments and resolve case-by-case mappings. Never silently map all EMPLOYEE to MANAGER, delete enum values or mutate live records.

## Implementation checklist (execution separately authorized, per packet)

### P0 — Inspect and baseline

- [ ] Fresh GitHub main HEAD, open PRs, rejected PR #13 exclusion, exact files/tests, applicable governance.
- [ ] Read-only inventory of target Supabase project, migrations, role enum, current role assignments and Auth settings without exposing private account details.
- [ ] Establish failing focused checks and an exact target file allowlist; do not change other school domains.

### P1 — Canonical role representation

- [ ] Change src/types.ts UserRole to **exactly eight** codes listed above, with no PUBLIC or ADMIN alias.
- [ ] Reconcile src/lib/auth.ts mappings; APP_ADMIN must remain APP_ADMIN; MANAGER remains distinct; PRINCIPAL and EMPLOYEE follow DG-05 (no assumptions).
- [ ] Update proven consumers: src/context/AppContext.tsx, src/components/Navbar.tsx, src/components/views/PickupBoardView.tsx and dev fixture data, without replacing their UI or allowing mock roles as authority.
- [ ] RED/GREEN tests for exactly eight roles, public anonymous visitor, Owner, Manager, Staff and Administrative Personnel; run npm run lint, npm run test:auth and npm run build on exact candidate.

### P2 — Signup form and request persistence

- [ ] Preserve src/components/AuthModal.tsx first-field role selector, existing five choices and Staff ID/Admission ID requirements until DG-01 is settled.
- [ ] Add **only** Owner-approved requestable categories/translated AR-FR-EN labels to SignupRole and dropdown. Any choice remains a request.
- [ ] Preserve username, password, email or phone, full name and current styling.
- [ ] Persist requested_role server-side; do not create active school authority from form input.
- [ ] Replace current “Account created. You can now sign in” message with accurate pending-review copy in all supported languages.
- [ ] Tests: every permitted role choice, conditional fields, invalid role injection, and absence of self-approved Manager/Owner grants.

### P3 — Server-owned pending → approval → credentials

- [ ] Define exact Access Control-owned durable approval contract; confirm live schema and approval authority first.
- [ ] Write a reversible reviewed Supabase migration only after separate Owner approval, local reset and SQL policy tests; no dashboard-only production writes.
- [ ] Add a bounded backend review operation for APP_ADMIN and authorized MANAGER; log approver, applicant, role, time and decision.
- [ ] Activate requested approved role and credential eligibility consistently; handle duplicate decisions, rejection, revocation and existing accounts.
- [ ] Add allow/deny tests: authorized/unauthorized Manager, Owner, Parent, Teacher, Student, Staff, self-approval, replay, direct database/API attempts.

### P4 — Protect every login entry

- [ ] Keep current frontend sign-in interfaces. Enforce approval in the authoritative backend/provider path, not just via disabled form or menu.
- [ ] Cover src/lib/auth.ts email/phone signInWithPassword; supabase/functions/auth-username-signin/index.ts; src/context/AppContext.tsx session restoration; supabase/functions/telegram-auth/index.ts.
- [ ] Verify pending/rejected/revoked cannot authenticate to school access via username/email/phone, session restore or Telegram; approved same-role user can.
- [ ] Preserve existing one-user Browser/Telegram link challenge and identity policy.

### P5 — Role pages and Owner grants (separate future feature, NOT part of signup fix)

- [ ] Only after approved role/session access works, plan role-specific page destinations using existing app design and exact previous sketches.
- [ ] Separately approve Access Control page/action/resource-scope grants, with Owner management; never rely on navigation-only guards.
- [ ] No PR #13 generic role cards, no fabricated working pages.

### P6 — Evidence/PR gates

- [ ] Independent RED/GREEN for each packet; actual npm run lint, npm run test:auth, npm run build, pgTAP/RLS deny tests, Web/Telegram integration and real browser AR/FR/EN mobile acceptance.
- [ ] Inspect exact SHA GitHub diff, keep implementation on a dedicated branch, draft PR only, no direct main write, no merge without owner approval.
- [ ] Report unknown/unrun checks honestly. Green Vercel deployment alone is not approval evidence.

## STOP / no-drift rules

Stop if DG-01..DG-05 unresolved for a behavior-changing task; if current source/DB differs from inspected evidence; if a role is inferred rather than actually approved; if username/email/phone/Telegram can bypass the gate; if an implementation changes the existing UI, school enrollment, or unrelated domain; if SQL lacks its separately approved migration or relevant deny tests.

## Per-task evidence template

- CURRENT_COMMAND / authorized files / forbidden files
- Integration HEAD / work branch HEAD / concurrent changes
- Product decision gate(s) resolved
- Exact tests: RED evidence; GREEN evidence; lint/build/CI SHA
- Supabase target/migration state and allowed/denied integration results
- Web and Telegram account tests; mobile AR/FR/EN regression
- Exact changed files / final PR link / merge status

**Plan PR acceptance means approval of a checklist for later focused execution. It does not authorize changes to auth credentials, Supabase, role grants or deployment.**
