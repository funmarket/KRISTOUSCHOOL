# KRISTOU SCHOOL — COMPLETE FULL-PROJECT CONTINUATION HANDOFF

**Prepared:** 2026-11-10 23:18 +01:00  
**Repository:** `https://github.com/funmarket/KRISTOUSCHOOL`  
**Reference repository:** `https://github.com/funmarket/Kristou`  
**Active Supabase project:** `KRISTOUSCHOOL` / ref `ofppapwofhovhroyjtkc`  
**Current branch:** `feature/supabase-telegram-deployment`  
**Current HEAD:** `10fe112 fix: use configured service role secret name`  
**Open PR:** [PR #9 — Deploy Telegram backend separately](https://github.com/funmarket/KRISTOUSCHOOL/pull/9)  
**Previous PR:** PR #8 was merged by the user and is not the place for new database/deployment work.

> This document covers the **entire KRISTOU SCHOOL project**, not only PR #9. PR #9 is only the current backend/deployment delta inside the wider product history. Read this document before changing the repository, Supabase project, PRs, UI, authentication flow, translations, or product plans.

The next agent should treat this as a project memory document: it explains what the product is, what has already been built, why the architecture is shaped this way, what was learned from mistakes, which documents are authoritative, how GitHub and Supabase must be handled, and what remains unfinished. Do not reduce the project context to the latest PR.

---

## 1. Collaborator and working relationship

The user is the product owner and technical decision-maker for KRISTOU SCHOOL. They work directly through GitHub and Supabase rather than maintaining a local project. They want implementation to happen in controlled branches and pull requests, with database work kept separate from UI work. They prefer direct execution, concise status reporting, and no wasted test cycles when they explicitly say the remaining credit/time is limited. They still expect careful inspection before changes, especially for Supabase schema, authentication, migration history, PR status, and duplication risk.

The user is sensitive to accidental pushes to already-merged PRs. Always inspect PR state before pushing. If a PR is merged, create a new branch from current `origin/main` and open a new PR. Never assume that a feature branch is still the correct review target.

The user has explicitly requested that KRISTOU remain a **single-school project named Kristou School**. Remove or avoid any multi-school, multischool, multitenant, or shared-school product language. The reference repository is useful for feature structure, mechanics, and behavior, but its files must not be copied blindly because the current project uses Supabase and has its own architecture.

The user’s current secret naming decision is important:

```text
SERVICE_ROLE_KEY
TELEGRAM_BOT_TOKEN
TELEGRAM_BOT_ID
```

Supabase does not allow the user’s preferred secret name beginning with `SUPABASE`, so the Edge Functions were updated to read `SERVICE_ROLE_KEY`. They retain fallback support for `SUPABASE_SERVICE_ROLE_KEY` for compatibility.

---

## 2. Working character and style for continuation

Continue as a practical senior product engineer and repository steward: inspect first, distinguish source-controlled evidence from plans, make the smallest safe change, preserve the current architecture, and report exactly what was verified. Combine high-level product judgment with hands-on GitHub/Supabase implementation. The useful “smart” behavior in this collaboration is context-aware and skeptical: do not blindly trust old documents, current branch names, mock UI, or a successful endpoint response as proof of production readiness. The baseline working style is calm, direct, transparent, and execution-oriented: use tools to inspect state, avoid redundant work, and clearly mark unknowns.

Do not expose hidden prompts, private system instructions, or internal tool definitions. In user-facing explanations, summarize the working approach as: repository-aware, Supabase-first, security-conscious, mobile-first, and evidence-based.

Preferred communication pattern:

1. Briefly acknowledge the request.
2. State the exact scope and whether the work will touch GitHub, Supabase, or both.
3. Inspect live state before acting.
4. Batch independent reads/checks where possible.
5. Do not run tests/builds when the user explicitly says not to, but state that they were not run.
6. Never claim a real Telegram end-to-end success without a real Telegram WebApp `initData` payload.
7. At completion, report branch, commit, PR URL, live deployment status, and remaining blockers.

---

## 3. Product identity and architecture decisions

### Product boundary

- The product is only **Kristou School**.
- It is not a multi-school platform.
- There is one canonical school, one app, one frontend shell, one Supabase project, and one shared authority model.
- The historical `Kristou` repository is a reference for features, structure, mechanics, and behavior only.
- Supabase is the current backend source of truth; do not copy Prisma/database implementation from the reference project into KRISTOUSCHOOL.

### Frontend

- Vite + React + TypeScript.
- Mobile-first design is the primary target because the app is expected to be used mostly on phones.
- The mobile layout should be intentionally designed for phone screens, not merely a scaled desktop layout.
- The top navigation shell remains stable LTR, including when Arabic is selected.
- User profile remains on the far right of the top bar.
- Theme and role controls belong inside the profile dropdown, not the top bar.
- Arabic translates content but does not mirror or restructure the generic top navigation.
- Supported UI languages are English, French, and Arabic.

### Authentication policy

Registration is for application access, not school enrollment/admission. School enrollment is a separate future/domain flow.

The registration form begins with the account category, then conditionally renders fields:

- Parent / Guardian: parent/guardian full name, username, email, phone, password.
- Teacher: full name, staff/employee ID, username, school email, phone, password.
- School Staff: full name, staff/employee ID, username, school email, phone, password.
- Administrative Personnel: full name, staff/employee ID, username, school email, phone, password.
- Student: student full name, admission/student ID, username, email, phone, password.

The role selector is the first action below the Sign in/Register tabs. The old static parent-name field at the top and bottom role selector were corrected in PR #8 before it was merged.

Web authentication uses Supabase Auth for email/phone credentials and a server-side Edge Function for custom KRISTOU username resolution. The custom username is not a native Supabase Auth login field. The browser must never perform a private profile lookup to resolve usernames.

Telegram is a direct Telegram WebApp authentication/linking path. It is not a third independent identity authority. Telegram identities link to the canonical Supabase profile through a short-lived one-time challenge.

Requested signup roles are declarations only. They do not grant authority. Server-side role assignments and RLS remain authoritative.

---

## 4. Role taxonomy

The database enum currently includes:

```text
GENERAL_USER
PARENT
STUDENT
TEACHER
SCHOOL_STAFF
ADMINISTRATIVE_PERSONNEL
MANAGER
PRINCIPAL
EMPLOYEE
APP_ADMIN
```

The user specifically corrected the omission of School Staff and Administrative Personnel. The School Staff category covers personnel supporting wellbeing, health, learning resources, office operations, facilities, safety, meals, transportation, and special needs. Administrative Personnel includes Principals and Vice Principals and other operational/educational leadership. These requested categories do not automatically grant Manager or Admin permissions.

The frontend `UserRole` type and signup role type include `SCHOOL_STAFF` and `ADMINISTRATIVE_PERSONNEL`.

---

## 5. Repository and PR history

### PR #7

PR #7 merged the mobile-first homepage, stable LTR shell, full translation work, updated assets, and profile-dropdown behavior into `main`.

### PR #8

PR #8 was the Supabase authentication foundation and role-based registration work. The user explicitly merged it. It is closed/merged and must not receive new commits.

PR #8 included:

- Supabase Auth/profile foundation.
- Username resolver Edge Function.
- Telegram auth/link-challenge source functions.
- Conditional role-based registration UI.
- Role categories including School Staff and Administrative Personnel.
- `staff_id` and `admission_id` registration metadata.
- Authentication authority-document updates.

### PR #9 — current review target

URL: [https://github.com/funmarket/KRISTOUSCHOOL/pull/9](https://github.com/funmarket/KRISTOUSCHOOL/pull/9)

State: **OPEN**  
Base: `main`  
Head: `feature/supabase-telegram-deployment`  
Mergeability: `MERGEABLE`  
Merge state: `CLEAN`  
Do not merge unless the user explicitly asks.

PR #9 is database/deployment follow-up work only. It contains:

- `.env.example`
- `docs/SUPABASE_CONTINUATION_PLAN.md`
- `progress.md`
- `supabase/functions/auth-username-signin/index.ts`
- `supabase/functions/telegram-auth/index.ts`
- `supabase/functions/telegram-link-challenge/index.ts`
- `supabase/migrations/20261110222200_revoke_auth_trigger_execute.sql`
- `supabase/migrations/20261110222300_revoke_auth_trigger_execute_public.sql`

PR #9 commits:

```text
c5d031d chore: document Telegram deployment and harden auth trigger
10fe112 fix: use configured service role secret name
```

The branch is clean and tracks its remote branch.

---

## 6. Live Supabase state

Project:

```text
Name: KRISTOUSCHOOL
Ref:  ofppapwofhovhroyjtkc
URL:  https://ofppapwofhovhroyjtkc.supabase.co
```

Live migration history:

```text
20261110212125 authentication_foundation
20261110212204 revoke_auth_trigger_execute
20261110212239 revoke_auth_trigger_execute_public
```

The deployment created these RLS-enabled tables:

- `public.profiles`
- `public.role_assignments`
- `public.telegram_identities`
- `public.account_link_challenges`

`profiles` includes:

- `username`
- generated `username_normalized`
- `full_name`
- `email`
- `phone`
- `requested_role`
- `staff_id`
- `admission_id`
- `avatar_url`

The migration also creates the Auth user trigger `public.handle_new_user()`, profile/role/Telegram update triggers, RLS policies, and the `current_profile_id()` helper.

The Auth trigger’s execute permissions were hardened in two migrations. PostgreSQL’s default `PUBLIC` execute grant was revoked in addition to `anon` and `authenticated`. The final Supabase security advisor check returned an empty lint list.

No school domain tables such as enrollment, classes, attendance, food menus, pickup records, announcements, or messaging were added by this work. Do not create duplicates without first inspecting the plan, current schema, migration history, and domain ownership.

---

## 7. Live Edge Function deployment status

All three functions are active at **version 5**:

```text
auth-username-signin
  status: ACTIVE
  verify_jwt: false

telegram-auth
  status: ACTIVE
  verify_jwt: false

telegram-link-challenge
  status: ACTIVE
  verify_jwt: true
```

All version-5 functions read:

```ts
Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
```

The bot token is read only by `telegram-auth`:

```text
TELEGRAM_BOT_TOKEN
```

The allowed frontend origin is read as:

```text
ALLOWED_ORIGIN
```

The current implementation does not read `TELEGRAM_BOT_ID`; it is retained for bot/deep-link configuration and future use.

Important distinction: GitHub repository secrets do not automatically become Supabase Edge Function Secrets. The user added GitHub secrets, but Supabase Edge Functions need their own secret configuration in Supabase Dashboard.

Required Supabase Function Secrets:

```text
SERVICE_ROLE_KEY=<Supabase service-role key>
TELEGRAM_BOT_TOKEN=<Telegram bot token>
ALLOWED_ORIGIN=<deployed frontend origin>
```

Never put `SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, or any service credential in `VITE_*` variables, frontend source, or generated browser bundles.

---

## 8. Telegram test results and current blocker

Safe live HTTP checks were performed against version-5 functions:

```text
auth-username-signin OPTIONS: 200
telegram-auth OPTIONS: 200
telegram-link-challenge OPTIONS: 200
```

Unauthenticated/empty POST behavior:

```text
auth-username-signin: 400 {"error":"invalid_credentials"}
telegram-auth: 503 {"error":"telegram_unavailable"}
telegram-link-challenge: 401 missing authorization header
```

Interpretation:

- CORS and routing work.
- Username auth rejects invalid input safely.
- Link challenge is correctly protected by JWT.
- `telegram-auth` still cannot see one of its required protected secrets. Since the user reported saving `SERVICE_ROLE_KEY`, the most likely missing secret is `TELEGRAM_BOT_TOKEN`; it is also possible that `SERVICE_ROLE_KEY` was saved in a different Supabase project/environment.
- A real Telegram end-to-end test has **not** been completed because no valid Telegram WebApp `initData` payload was supplied and the backend currently reports `telegram_unavailable` before validation.
- Do not fabricate `initData`, bot signatures, or Telegram user identities.

The next safe action is for the user to verify in the **same** Supabase project (`ofppapwofhovhroyjtkc`) under Edge Function Secrets that both `SERVICE_ROLE_KEY` and `TELEGRAM_BOT_TOKEN` exist. After that, invoke `telegram-auth` from a real Telegram WebApp. A malformed payload should then return `401 invalid_telegram_auth`; a real fresh Telegram WebApp payload is required for successful linking.

A full successful flow should be:

1. Authenticated web user calls `telegram-link-challenge`.
2. Backend returns a one-time `linkCode` valid for 10 minutes.
3. Telegram WebApp supplies fresh `initData` and the link code to `telegram-auth`.
4. Backend validates Telegram HMAC using `TELEGRAM_BOT_TOKEN`.
5. Backend consumes the challenge and writes `telegram_identities` for the canonical profile.
6. A second Telegram login for the same Telegram identity resolves to the same canonical profile.
7. Reusing the challenge fails with `invalid_or_expired_link`.
8. Linking the same Telegram identity to another profile fails with `identity_conflict`.

---

## 9. Last completed task

The last completed task was the correction and separation of the Telegram/Supabase backend follow-up after the user merged PR #8.

Actions completed:

- Confirmed PR #8 was already merged before continuing.
- Created `feature/supabase-telegram-deployment` from current `origin/main`.
- Carried the database-only deployment/hardening records into the new branch.
- Updated all three Edge Functions to support `SERVICE_ROLE_KEY` while retaining compatibility with `SUPABASE_SERVICE_ROLE_KEY`.
- Updated `.env.example`, `progress.md`, and the Supabase continuation plan to use the real secret name.
- Deployed all three corrected functions to Supabase version 5.
- Created PR #9 and left it open/unmerged.
- Did not run tests/builds, as explicitly requested.

---

## 10. Current task handoff

The user is closing this chat and wants the next chat to resume with zero context loss. The immediate status is:

1. Handoff document: being written at this path.
2. PR #9: open, clean, mergeable, and unmerged.
3. Supabase functions: active version 5.
4. Supabase migrations: applied.
5. Security advisor: clear.
6. `SERVICE_ROLE_KEY` compatibility: deployed.
7. Telegram real end-to-end: blocked until Supabase sees `TELEGRAM_BOT_TOKEN` and a real Telegram WebApp supplies `initData`.
8. Do not merge PR #9 unless the user requests it.
9. Do not run broad tests/builds if the user again says to conserve credits; the user has explicitly prioritized creating the correct PR and avoiding wasted testing in this phase.

---

## 11. Required references to read before further work

Read these files before modifying architecture, auth, roles, or Supabase:

```text
AGENTS.md
requirements.md
structure.md
progress.md
.env.example
docs/CANONICAL_MODEL.md
docs/DECISIONS.md
docs/LIVING_BUILD_PLAN.md
docs/SUPABASE_BACKEND_IMPLEMENTATION_PLAN.md
docs/SUPABASE_CONTINUATION_PLAN.md
docs/REMOTE_SCHEMA_INVENTORY.md
supabase/migrations/20261110210000_authentication_foundation.sql
supabase/migrations/20261110222200_revoke_auth_trigger_execute.sql
supabase/migrations/20261110222200_revoke_auth_trigger_execute_public.sql
src/lib/supabase.ts
src/lib/auth.ts
src/context/AppContext.tsx
src/components/AuthModal.tsx
```

Read the reference repository only for comparison, especially its role and feature mechanics. Do not use it as authority for the current Supabase schema.

Relevant URLs:

- Current repository: `https://github.com/funmarket/KRISTOUSCHOOL`
- Reference: `https://github.com/funmarket/Kristou`
- PR #9: `https://github.com/funmarket/KRISTOUSCHOOL/pull/9`
- Supabase project URL: `https://ofppapwofhovhroyjtkc.supabase.co`
- Supabase advisor remediation for security-definer execute warnings: `https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable`

---

## 12. Explicit operating rules and lessons learned

- Always check PR state immediately before pushing.
- Never push new work to a merged PR branch.
- Start follow-up branches from current `origin/main`.
- Keep UI changes and database/deployment changes in separate PRs when the user asks for separation.
- Inspect live Supabase project/ref before applying migrations.
- Check migration history and tables before creating schema; do not assume emptiness.
- Use idempotent additive migrations where possible.
- Do not delete, truncate, rename, or cascade-clean school data during the build phase.
- Treat Supabase RLS and grants as security authority; frontend visibility is not authorization.
- Requested roles never equal granted roles.
- Never expose service-role or Telegram bot secrets to the browser.
- GitHub secrets and Supabase Function Secrets are separate stores.
- Do not claim a Telegram E2E pass without a real signed `initData` payload.
- Empty POSTs and CORS checks are route smoke tests, not real authentication tests.
- Record exact commit, branch, migration version, function version, and observed response status.
- Use the user’s primary language; this collaboration has been conducted in English.
- Keep responses concise but complete, with links to PRs and generated documents.
- Do not merge unless explicitly requested.

---

## 13. Next recommended sequence

1. User verifies/adds `TELEGRAM_BOT_TOKEN` and confirms `SERVICE_ROLE_KEY` in Supabase project `ofppapwofhovhroyjtkc` Edge Function Secrets.
2. Confirm the frontend deployment origin and set `ALLOWED_ORIGIN` exactly, without a trailing mismatch.
3. Use a real Telegram WebApp to generate fresh `initData` and exercise `telegram-auth`.
4. Test web-authenticated challenge creation, Telegram linking, replay rejection, and identity conflict behavior.
5. Only after the backend flow is proven should PR #9 be reviewed/merged.
6. Then proceed to the next domain vertical slice, beginning with a schema audit and access matrix rather than copying reference files.
7. Keep the current single-school boundary and Supabase-first architecture intact.

---

## 14. Final state summary

The project has moved from a mock UI/auth prototype to a source-controlled Supabase authentication foundation with role-based registration, Telegram linking boundaries, RLS-enabled identity tables, active Edge Functions, and security-advisor-cleared trigger permissions. The remaining issue is operational configuration and real Telegram verification, not missing function deployment. PR #9 is the correct review vehicle for this backend-only follow-up and must remain separate from merged PR #8.


---

## 15. Full-project map for the next agent

### What the project looked like at the beginning

The repository began as a Vite/React school application prototype with mock data, in-memory state, a basic application shell, placeholder Supabase configuration, and incomplete translation coverage. The user supplied a continuation archive, live Supabase audit material, product requirements, architecture documents, and design packages. The first responsibility was to recover the project’s intended architecture instead of treating the prototype as production-ready.

The initial inspection established that the project needed a single-school boundary, a Supabase-first backend, real authentication, role-aware access, Telegram linking, complete trilingual content, and mobile-first UI. The old reference repository `funmarket/Kristou` was retained as a feature/behavior reference but not as a database or implementation source of truth.

### Documentation and architecture work already completed

The product and architecture authorities were reconciled across:

- `requirements.md`
- `structure.md`
- `docs/CANONICAL_MODEL.md`
- `docs/DECISIONS.md`
- `docs/LIVING_BUILD_PLAN.md`
- `docs/SUPABASE_BACKEND_IMPLEMENTATION_PLAN.md`
- `docs/SUPABASE_CONTINUATION_PLAN.md`
- `AGENTS.md`
- `progress.md`

The accepted contract is now: one canonical KRISTOU user profile, Supabase Auth for credentials, a custom server-side username resolver, optional Telegram identity linking, server-authoritative role assignments, and a separate school enrollment/admission flow. Do not reintroduce the earlier ambiguity that treated registration as only parent registration or treated enrollment as app signup.

### UI and design work already completed

The homepage was redesigned from the original plain/blurry concept into a supplied-reference-faithful, colorful, mobile-first Kristou School composition. Supplied image assets were copied into the project and superseded blurry assets were removed from active use. The homepage preserves application routes and feature navigation rather than becoming a disconnected marketing page.

The app shell was adjusted so mobile phone presentation is the primary design target. The user specifically rejected a desktop page merely shrinking onto a phone. Future UI work must start at phone width and then expand gracefully for larger screens.

The top navigation is deliberately stable LTR. Arabic changes content direction for page content where appropriate, but the generic top menu does not mirror or rearrange. The profile icon remains on the far right. Dark/light mode and role status were moved into the profile dropdown and removed from the top bar. Do not undo these constraints when changing translations or RTL behavior.

### Translation work already completed

The translation system was expanded beyond titles and navigation labels. Homepage copy, feature UI labels, announcements, coursework, menu content, directory content, notes, notifications, authentication labels, role labels, and new registration fields participate in the English/French/Arabic dictionary. Dynamic mock content is localized through content mappings rather than leaving language-dependent literals in views.

When adding future user-facing text:

- Add English, French, and Arabic dictionary entries.
- Use the shared translation helper in components.
- Do not introduce hardcoded visible labels, placeholders, titles, aria labels, or error messages unless they are genuinely technical and intentionally untranslated.
- Preserve the stable LTR top navigation even when Arabic is selected.

### Authentication and role work already completed

The old mock/fallback login path was replaced with Supabase Auth/session restoration and canonical profile loading. Username login is resolved server-side by `auth-username-signin`; the browser does not query private profiles to resolve usernames.

The registration modal was corrected after the user identified a structural UX error. Role selection is now the first registration decision below the Sign in/Register tabs. Conditional state determines which fields appear. Parents, teachers, school employees, administrative personnel, and students each have separate registration paths and metadata. Registration requests do not grant permissions; the server must assign active roles.

The current account model must continue to recognize these broad user types:

- Parents/guardians.
- Teachers.
- School employees/staff.
- Administrative personnel.
- Students.
- General users.
- Managers/associates with explicit capabilities.
- App administrators/school owner.

### Telegram architecture learned during this work

Telegram is not a separate application or a second canonical user database. It is a WebApp login/linking channel connected to the same Supabase profile. The expected sequence is: authenticated web user requests a short-lived link challenge; Telegram WebApp sends signed `initData` and the challenge code; the Edge Function validates the HMAC with the bot token; the backend consumes the challenge and stores one Telegram identity for the canonical profile.

The bot token must remain a Supabase Edge Function Secret. GitHub Actions/repository secrets and Supabase Edge Function Secrets are separate stores. The current code accepts `SERVICE_ROLE_KEY` because that is the user’s actual Supabase secret name and also accepts the old `SUPABASE_SERVICE_ROLE_KEY` spelling for compatibility.

### What remains unfinished across the full project

- Complete a real Telegram WebApp authentication/linking test with a fresh signed `initData` payload after `TELEGRAM_BOT_TOKEN` is visible in the correct Supabase project.
- Confirm `SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, and `ALLOWED_ORIGIN` in Supabase Edge Function Secrets.
- Review and merge PR #9 only when the user explicitly requests it.
- Replace remaining mock feature data with domain-specific Supabase vertical slices one at a time.
- Before every domain migration, audit the actual live schema, migration history, grants, policies, and existing ownership documents.
- Add database/RLS tests and integration tests when the user authorizes test work and budget permits.
- Continue from the current mobile-first UI without reintroducing blurry assets, desktop-first layout, generic top navigation, incomplete translations, or manual frontend role authorization.

---

## 16. How the next agent must work

Start every new task by reading this handoff and the relevant authority documents. Then inspect the current GitHub branch/PR state and the live Supabase project state. The current repository is not a local-only coding exercise: GitHub and Supabase are the real project surfaces.

For GitHub:

1. Fetch current `main` and relevant branches.
2. Check whether the named PR is open, merged, closed, or already superseded.
3. Never push to a merged PR.
4. Create a new branch from current `origin/main` for follow-up work.
5. Keep UI PRs and database/deployment PRs separate when requested.
6. Do not merge unless the user explicitly asks.

For Supabase:

1. Identify the project by URL/ref before any mutation.
2. List migrations and tables before adding schema.
3. Inspect advisors after security-sensitive changes.
4. Prefer source-controlled migrations for DDL.
5. Do not create duplicates or blindly replay reference-project schema.
6. Do not delete or reset existing school data during the build phase.
7. Keep service-role credentials out of browser code.
8. Treat RLS, grants, and server functions as the authorization boundary.

For Telegram:

1. Confirm required secrets in Supabase, not only GitHub.
2. Use real fresh Telegram `initData` for success testing.
3. Treat empty requests, malformed payloads, CORS responses, and unauthorized responses as smoke tests only.
4. Never fabricate a valid HMAC or report a successful login without real Telegram evidence.
5. Verify challenge expiry, replay rejection, identity conflict rejection, and canonical profile reuse.

For UI:

1. Design phone-first, not desktop-down.
2. Preserve the real Kristou logo and sharp assets.
3. Preserve stable LTR top navigation and right-side profile placement.
4. Keep theme and role status inside the profile menu.
5. Translate all visible content in English, French, and Arabic.
6. Keep school enrollment separate from application account registration.

For reporting:

- State what was inspected.
- State what was changed.
- State what was deployed.
- State exact branch/commit/PR and live migration/function versions.
- Separate verified facts from assumptions and remaining blockers.
- If tests were skipped, say so plainly.
- If an external action was not possible, provide the exact manual next step.

The goal is not merely to make the next screen or endpoint appear to work. The goal is to continue building one coherent, secure, mobile-first Kristou School product without losing the architectural decisions, evidence discipline, or user-approved boundaries established in this collaboration.
