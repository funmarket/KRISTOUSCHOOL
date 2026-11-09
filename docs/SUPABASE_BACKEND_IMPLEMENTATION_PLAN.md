# Supabase Backend and Database Integration Plan

Status: **ORDERED IMPLEMENTATION PLAN — NOT IMPLEMENTATION EVIDENCE**

This plan establishes a safe route from the current Vite/React prototype to a Supabase-backed product. It does not provision or change any Supabase project. Progress belongs in `progress.md`; accepted product behavior belongs in `requirements.md`; architecture belongs in `structure.md`; canonical data ownership belongs in `docs/CANONICAL_MODEL.md`; decisions belong in `docs/DECISIONS.md`.

## Goal and scope

Use Supabase as the planned platform for managed PostgreSQL, source-controlled database migrations, server-side Edge Functions, and private object storage. Keep the browser as a presentation client. Deliver one complete, tested vertical slice at a time. Do not migrate all demo features or seed fake school records into a hosted environment.

Supabase is selected instead of Railway for the backend/database direction. This does not mean a Supabase project has been provisioned, connected, or deployed. Hosting for the static frontend is not selected by this plan; do not infer that Supabase backend selection answers frontend hosting.

## Blocking decision: login identity

The existing accepted product contract and ADR-012 specify a unique username plus password, with optional email that is not a login or password-recovery authority. Supabase's documented password sign-in identifiers are email or phone, not a native username identifier. Do not invent a synthetic email alias, expose an account-lookup endpoint that leaks identity, or silently change the requirement.

Before building protected account flows, the product owner must choose and record one of these designs:

1. **Adopt Supabase Auth email/phone sign-in.** Explicitly revise `requirements.md`, `docs/CANONICAL_MODEL.md`, and the relevant ADR. Map the Supabase Auth identity to one canonical KRISTOU user and define verified contact/recovery rules.
2. **Preserve username/password.** Specify and threat-model a server-managed credential/session design that remains compatible with Supabase Edge Functions and Postgres. Define password hashing, session minting/verification/revocation, enumeration resistance, rate limits, recovery, and how the verified actor identity is represented to database policies. Do not treat `service_role` access as a substitute for this design.

No protected school data schema or auth implementation should advance past local synthetic tests until this decision is accepted. Supabase Auth documentation describes email and phone as password identifiers; phone/password carries recycled-number risks and should not be adopted without an explicit policy and mitigations.[1]

## Target request/data flow

```text
React/Vite browser
  -> publishable Supabase key (public project identifier, not a secret)
  -> verified user session (only after the identity decision)
  -> Row Level Security for caller-scoped reads/writes

React/Vite browser
  -> narrow Edge Function for privileged/domain operations
  -> input validation + verified identity + domain authorization
  -> transaction-safe SQL operation / database constraints
  -> PostgreSQL + tested RLS + private Storage policies
```

Supabase Edge Functions are server-side TypeScript/Deno functions. They are appropriate for short HTTP operations and orchestration; keep long jobs out of request handlers.[2] RLS and SQL constraints remain part of the security boundary. Any privileged key that bypasses RLS must be held server-side and paired with explicit authorization.

## Phases and acceptance gates

### 0. Snapshot and product decisions

1. Confirm the target repository/default branch and latest HEAD. Keep this plan as subordinate to `AGENTS.md` and the accepted requirements.
2. Record that the current frontend uses mock state and that no backend/schema/auth has been verified. Do not import the old repository's CI, deployment, project references, user records, or historical completion claims.
3. Resolve the username-versus-Supabase-Auth choice above before handling real or even representative protected account data.
4. Confirm that Supabase is the approved managed database/function provider and choose a project owner, organization, region, and project separation strategy. Do not create a hosted project implicitly as part of code work.

**Gate:** accepted auth design is recorded in `docs/DECISIONS.md`; staging/production ownership and region are documented. Until then, proceed only with non-sensitive local tooling and synthetic-only tests.

### 1. Add reproducible local Supabase development

1. Pin a Supabase CLI version in the project toolchain (choose the repo's supported installation method; do not depend on an unpinned global binary).
2. Initialize `supabase/config.toml` and configure local Auth only after the identity policy is chosen.
3. Add local migration, reset, test, function-serve, type-generation, and status commands to `package.json` only when they work in this repository.
4. Keep `.env.example` to placeholders such as `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and server-side-only secret names. Remove fallback project IDs, mock keys, and embedded credentials from source. The publishable key may be present in browser configuration; secret/service-role keys may not.
5. Verify `.gitignore` excludes actual environment files and local Supabase state. Create local-only synthetic `supabase/seed.sql` fixtures with no real student, family, staff, contact, medical, enrollment, or pickup records.

Supabase's local-development workflow supports tracked migrations, repeatable database reset/seed, and later deployment of that history to a linked project.[3]

**Gate:** a clean local checkout can start the local stack and reset the database from committed migrations with deterministic synthetic seed data.

### 2. Define the authentication and canonical identity mapping

1. Implement only the approved path from Phase 0.
2. If Supabase Auth is selected, make `auth.users.id` the authentication-provider identity and define an explicit one-to-one foreign-key mapping to canonical KRISTOU `User.id` (or record the reviewed decision to use the Auth UUID as canonical User ID). Do not copy passwords into application tables.
3. If username/password is preserved, do not build an improvised browser-side password lookup. Keep credential verification and session issuance server-side; use a strong one-way password hash, opaque high-entropy sessions or otherwise reviewed tokens, hashed-at-rest session verifiers, expiry/revocation, generic errors, rate limits, and a documented database-policy identity bridge. Require a security review before exposing any protected table through the Data API.
4. Define account-link behavior for Telegram as a separate explicit one-time, expiring, conflict-failing flow. Telegram identity must resolve to the same canonical KRISTOU User and never merge heuristically.
5. Add auth integration tests for unauthorized access, expiry/revocation, conflicting identities, and any signup/recovery policy before relying on auth in RLS.

**Gate:** a threat model and tests establish how the database and Edge Functions learn the verified canonical actor for every protected request.

### 3. Introduce a minimal foundation schema as migrations

1. Create the first timestamped SQL migration under `supabase/migrations/`; do not create product tables by bulk-copying UI TypeScript types or mock data.
2. Implement only the approved identity/access-control foundation needed for the first vertical slice. Use UUID/FK/unique/check constraints that encode accepted invariants; select `timestamptz` for instants; use `Africa/Tunis` only for business rules that require local school time.
3. Keep canonical identity, role/capability authority, parent-child link, class membership, and teacher assignment distinct. Do not allow frontend-supplied role strings to become authority.
4. Put each security-relevant schema, grant, policy, SQL function, trigger, and storage policy in a reviewable migration. Add indexes from actual foreign-key and policy query patterns.
5. Use transactions/conditional updates for one-time challenge consumption and safety-sensitive state. Avoid premature domain tables, giant JSON records, or generic mutable role state.
6. Add typed generated database types only from the committed schema and regenerate them reproducibly.

**Gate:** `supabase db reset` recreates the schema from zero; migration review confirms no real or speculative feature data was added; constraints are covered by database tests.

### 4. Write grants and RLS before connecting application reads

For every exposed table/view/function/storage object:

1. Identify operations by actor and resource (public, parent, student, teacher, manager, admin, service process) in an access matrix.
2. Enable RLS on exposed tables. Explicitly revoke broad/default grants from `anon` and `authenticated`, then grant only necessary operations. RLS policies do not remove SQL grants.[4]
3. Write least-privilege policies from verified auth identity and canonical relationships. Parents see only linked children and permitted class resources; students only active enrolled classes; teachers only assigned classes; delegated staff only explicit capabilities.
4. Review views and `SECURITY DEFINER` functions for RLS bypass, ownership, `search_path`, grants, and least-privilege execution.
5. Do not expose private child/family/pickup rows through public views, public buckets, realtime subscriptions, or unrestricted RPCs.
6. Write pgTAP tests proving both allows and denies for relevant roles, including cross-parent, cross-class, inactive membership, unauthenticated access, update/delete attempts, and role escalation. Test with actual role/claims rather than inspecting policy source only.
7. Run `supabase test db` locally; break representative policies temporarily in an isolated test branch to prove the deny-case suite fails, then remove the temporary policy change.

Supabase recommends testing both grants and RLS, and its pgTAP workflow exercises the policies locally.[4][5]

**Gate:** every exposed object has an access matrix and a passing allow/deny test; no production data is used.

### 5. Build a narrow server-side Edge Function vertical slice

1. Select one low-risk, useful slice with explicit acceptance criteria. Prefer public approved directory reads first; then use an authenticated parent-scoped operation only after the identity and RLS gates pass. Do not start with pickup release, health records, bulk enrollment, or public exposure of child data.
2. Create one function per coherent capability, with request schema validation, method/content-type checks, bounded payload sizes, CORS allowlist, generic safe errors, correlation IDs, and rate limits where relevant.
3. Verify the session on the server. Pass through caller-scoped access for ordinary operations when possible; never trust user IDs or role/capability claims from request JSON.
4. Put all privileged operations behind an explicit application operation with a policy check. Keep the service-role secret out of `src/`, Vite build outputs, public env, and client errors. If a service credential is truly required, document the exact bypass, least-privilege use, and negative tests.
5. Implement durable multi-row operations with a transaction-safe Postgres function/RPC or a suitable server-side transaction. Make retries idempotent where requests may be repeated.
6. Add local Edge Function tests and integration tests exercising authenticated and unauthenticated calls, invalid input, cross-resource attempts, and failure behavior.

**Gate:** function/API tests and database policy tests pass together; browser code contains no privileged secret; errors/logs do not reveal credentials or private child details.

### 6. Connect the frontend through an explicit data boundary

1. Replace `src/context/AppContext.tsx` mock-driven business state one feature at a time; do not switch the whole UI to direct table access.
2. Keep localizable/theme state separate from server-owned identity, role, child, class, and pickup state.
3. Use generated database types and narrow feature hooks/API modules. Do not create a global store that loads unrelated product domains together.
4. Remove default demo login, role switching as authorization, successful fallback login, and client-only pickup transitions before any production-like deployment.
5. Test loading, empty, error, expired session, and denied states. Verify Arabic RTL and mobile behavior with real-shaped synthetic fixtures only.

**Gate:** the chosen slice has no mock fallback that can be mistaken for live data; the UI reflects server authorization results but does not grant access.

### 7. Add private file storage only when a feature needs it

1. Define allowed file types, size limits, retention, metadata stripping, and ownership before enabling uploads.
2. Create private buckets by default for class, student, family, and enrollment content. Public assets require an explicit public-content owner.
3. Add storage policies matching the same parent/class/staff scope as the feature. Store a canonical media descriptor and semantic attachment in the owning domain, not an unmanaged URL.
4. Test unauthorized download, upload, overwrite, delete, cross-child access, and expired signed access.

**Gate:** storage operations follow a tested domain authorization decision and no private object is readable from a public URL.

### 8. Staging, deployment, and operations

1. Create a separate Supabase staging project only after owner/region/recovery choices are approved. Keep local, staging, and production projects isolated.
2. Link the repository's approved deployment identity to staging. Store database credentials, Supabase secret/service-role keys, auth secrets, and third-party secrets only in protected CI/provider secret stores.
3. Deploy migrations before Edge Functions/client releases that depend on them; review migration locking, backward compatibility, expected downtime, and rollback/forward-fix path.
4. Add CI for formatting/lint/typecheck, frontend tests, Edge Function checks, clean local migration reset, pgTAP RLS tests, and secret scanning. CI verifies source; it never repairs or commits changes.
5. Verify staging health, auth redirects/origins, CORS, function logs, backup/PITR settings, rate limits, storage policies, and audit events. Use synthetic data only.
6. Before production, require explicit owner approval, successful staging acceptance, recovery/restore rehearsal, least-privilege review, access-matrix approval, and a documented rollback/incident contact process.

**Gate:** exact source revision and migration version are recorded with staging evidence. A green build alone is not production approval.

### 9. Implement protected school domains in approved order

After the foundation gates, implement one end-to-end slice at a time, guided by product priority and safeguarding review. A typical order is: canonical identity/access, public content, academic/class membership, one parent-scoped class read, Parent Notes, class content/questions, messaging, food menu/directory management, registration, and pickup. Revisit each domain's owner and RLS matrix before adding tables.

Pickup is not an early demo shortcut: implement arrival and release separately, enforce the release window and staff capability server-side, make release atomic/idempotent, record a minimal audit event, and test concurrent/duplicate/unauthorized release attempts. Do not expose health data until the owner approves the exact field and audience.

## Definition of done for each slice

A slice is complete only when product acceptance is agreed; one canonical owner is identified; migrations, constraints, grants, RLS, and storage policies are source-controlled; unit/database/function/UI tests include deny cases; secrets are absent from browser output; local reset is reproducible; CI is green on the exact branch head; docs are reconciled; and `progress.md` records only actual results and remaining gaps.

## Supabase references

[1]: https://supabase.com/docs/guides/auth/passwords "Supabase password-based authentication"
[2]: https://supabase.com/docs/guides/functions "Supabase Edge Functions"
[3]: https://supabase.com/docs/guides/local-development/database-migrations "Supabase local database migrations"
[4]: https://supabase.com/docs/guides/database/postgres/row-level-security "Supabase Row Level Security"
[5]: https://supabase.com/docs/guides/database/postgres/testing-row-level-security "Supabase RLS testing with pgTAP"
