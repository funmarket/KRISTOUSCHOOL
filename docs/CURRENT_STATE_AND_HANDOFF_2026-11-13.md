# KRISTOU SCHOOL — Fresh Current-State Checkpoint and Agent Handoff

**Verified snapshot:** 2026-11-13 (Africa/Tunis). **Repository:** `funmarket/KRISTOUSCHOOL`. **Classification:** evidence snapshot / onboarding index, NOT a second product requirements document, NOT a migration authorization, and NOT proof of complete functionality.

> Read `AGENTS.md` and the established authorities in their required order. This file disambiguates dated claims and points to current work; the latest explicit Product Owner decision still takes precedence. Recheck mutable facts before making any change.

## 1. Exact observed state

| Evidence surface | Read-only observation on 2026-11-13 | Important limitation |
| --- | --- | --- |
| GitHub `main` | `5d9f95c4cd96a8c1b83662f4605ef0bf668acabd`; previous application code commit `ee4e912de4ed5a0d5ad6f62ce2b96b22b9b95372` | Main is a historical baseline as soon as a new commit lands |
| GitHub open PRs | 0 at inspection | Recheck before any branch, publication or merge |
| `supabase/migrations/` source | Four SQL files: authentication foundation, two trigger EXECUTE hardening migrations and atomic Telegram account linking | Source files are NOT equivalent to applied remote history |
| Hosted Supabase | Project `KRISTOUSCHOOL`, ref `ofppapwofhovhroyjtkc`; four RLS-enabled public auth tables: `profiles`, `role_assignments`, `telegram_identities`, `account_link_challenges` | No verified live People/Academics/Family/Enrollment/Pickup school-domain persistence |
| Live migration history | Five versions: `20261110212125`, `20261110212204`, `20261110212239`, `20261111150532`, `20261112190435` | Fifth `canonical_account_roles` source file is NOT present in the inspected repository; do not fabricate or replay it |
| Live roles | Exactly seven `app_role` enum values: `APP_ADMIN`, `MANAGER`, `PARENT`, `STUDENT`, `TEACHER`, `SCHOOL_STAFF`, `ADMINISTRATIVE_PERSONNEL` | `GENERAL_USER` is NOT a registered role; it denotes only unauthenticated public browsing |
| Live protection | One active `APP_ADMIN` assignment; `claim_telegram_account_link` RPC exists; `authenticated` cannot SELECT link-challenge rows | Aggregate checks do not prove every access-control path |
| Deployed Edge Functions | `auth-username-signin` v6, `telegram-auth` v9, `telegram-link-challenge` v6, each ACTIVE | Deployed version/source is not a successful end-to-end login test |
| Source/runtime mismatch | Committed `telegram-auth` has obsolete `GENERAL_USER` fallback; deployed v9 has different no-role handling | Do not redeploy outdated source |
| Frontend host | Vercel has been used for the application | An old 2026-11-11 browser-bundle configuration observation is HISTORICAL, not current proof of Vercel environment values |

**Privacy:** Do not place real school-person names, user emails, child information, auth tokens or other personal identifiers into documentation or logs.

## 2. Product Owner decisions — current contract, not implementation evidence

- **Single school:** KRISTOU SCHOOL only. One canonical React/TypeScript product for Browser and Telegram WebView; one Supabase backend and canonical User.
- **Public:** Visitors browse approved public pages anonymously. No `GENERAL_USER` signup, persisted role or authentication fallback.
- **Seven registered role choices:** `APP_ADMIN`, `MANAGER`, `ADMINISTRATIVE_PERSONNEL`, `TEACHER`, `SCHOOL_STAFF`, `PARENT`, `STUDENT`. A requested role is never an active assignment.
- **Privilege governance:** Only an authorized `APP_ADMIN` appoints/governs `APP_ADMIN` and `MANAGER`. `MANAGER` operational authority is explicitly delegated; Owner sovereignty is not implied by a Manager label.
- **Administrative Personnel:** Approved `ADMINISTRATIVE_PERSONNEL` automatically receive the ordinary school-administration bundle (student/class records, academics/curriculum/teacher support, admissions, guidance, parent relations, individual entry, and Excel/CSV import). They may manage lifecycle actions of *other* ordinary-role accounts (including other Administrative Personnel), but never their own or `APP_ADMIN`/`MANAGER` targets. This is the approved target, **not yet verified as server-side enforcement**.
- **School records:** People, Academics, Enrollment, Family, and Access Control have separate authoritative ownership. Creating/importing a student record does not silently create an app account, approval, guardian link, or pickup collector.
- **Security:** Approval must precede private access; Telegram explicit linking remains optional and must not auto-merge identities. Parent arrival is not physical child release; Pickup remains locked pending staff-authorized atomic server tests.
- **UI:** Preserve seven registration choices, eight homepages (public + seven account roles), existing Owner menu order Teachers -> Classes -> Registration, stable LTR navigation, mobile-first design, AR/FR/EN, light/dark mode.

### Latest Product Owner request: AUTH-ID-01 (Google AI Studio, not yet published)

The Owner subsequently requested **optional login identifiers**: username only, email only, phone only, or any two/all three, with a password and full name; allow ordinary Arabic and French/accented/multiword human-readable usernames and make sign-in accessible to older parents. This **supersedes earlier requirements that username AND email/phone are always mandatory**. It is an **approved desired behavior**, not a claim that GitHub or Supabase already supports all seven combinations.

Critical engineering gates: Supabase Auth password credentials are normally tied to email/phone; username-only identity requires a genuine, secure server-backed credential/verification and recovery architecture. A user-entered secondary email/phone is not automatically an Auth-verified login alias. The live DB currently enforces ASCII-only normalized username constraints. No fake email/phone aliases, password storage in public tables, automatic identity merging, weaker approval, or production migration is allowed. If full support cannot be verified, report the unsupported combinations as BLOCKED rather than complete.

The prior `AUTH-UX-01` / `AUTH-UX-01-FIX1` multilingual account-feedback code and the newer `AUTH-ID-01` effort are **AI Studio workspace work until actual changed files are pushed**. Do not import Gemini report claims into `progress.md` as GitHub implementation facts.

## 3. What current source demonstrably does NOT prove

- The seven option selector is in committed `src/components/AuthModal.tsx`, but the committed UI still requires a username plus email or phone, with the old ASCII-only format. Flexible combination support is a new task.
- `src/lib/auth.ts` uses `auth-username-signin` for username/password, direct Supabase Auth for email/password or phone/password, and an active `role_assignments` lookup; this source alone does not prove live sign-in success.
- Committed Classes/Registration/Parent Notes/student Questions views contain prototype or local-only paths. Most school-domain operations lack verified durable backend/RLS; keep the Pickup server safety lock.
- Five live migrations versus four source migration files need non-destructive reconciliation, not blind migration history repair.
- Supabase Edge Function v9 and committed `telegram-auth` are different; never deploy the older source over current production.
- There are no current test-run results from this documentation-only checkpoint. Historical test reports and Vercel status do not prove new code or browser flows.

## 4. Document register and authority

| Document | Purpose / current reading instruction |
| --- | --- |
| `AGENTS.md` | Mandatory execution, authority and safety. Start here. |
| `requirements.md` | Binding product behavior, including the dated flexible-identifier and seven-role owner changes. |
| `structure.md` | Canonical one-school architecture, domain boundaries and runtime ownership. |
| `docs/CANONICAL_MODEL.md` | Product data/authorization conceptual truth; do not confuse targets with migrated tables. |
| `docs/DECISIONS.md` | Durable accepted decisions; dated addenda supersede older ADR wording. |
| `docs/LIVING_BUILD_PLAN.md` | Execution quality / No Drift, not a product authority or permission for the next packet. |
| `docs/SUPABASE_BACKEND_IMPLEMENTATION_PLAN.md` | Earlier staged backend proposal; historical steps must be checked against this checkpoint. |
| `docs/SUPABASE_CONTINUATION_PLAN.md` | Historical November 11 remote diagnosis and phase proposal; **not** today's remote inventory. |
| `docs/CONTINUATION_HANDOFF_2026-11-10.md` | Historical handoff; dated status, branch and immediate-next-task sections are not current. |
| `docs/REMOTE_SCHEMA_INVENTORY.md` | Historic 11/11 inventory plus updated 11/13 live read-only summary. |
| `docs/EDGE_FUNCTION_DEPLOYMENT.md` | Operational guidance; no deployment authorized, live function versions require recheck. |
| `docs/TELEGRAM_VISITOR_LINKING_PLAN.md` | Original linking acceptance contract; its old branch/exclusions are historical. |
| `progress.md` | Dated GitHub/source/runtime evidence only; no Gemini AI Studio-only work represented as merged. |
| `public/assets/aistudio/KRISTOU_MASTER_EXECUTION_PLAN_c4fb8203.txt` | 31-packet planning reference, not implementation authorization; stored as a static public asset, not a governing canonical document. |
| `public/assets/aistudio/KRISTOU_PRODUCT_OWNER_DECISIONS_SPEC_3e5dd948.txt` | User-supplied consolidation of earlier owner decisions; newer direct instructions (including AUTH-ID-01) prevail. |

**Old user-uploaded files and the former `funmarket/Kristou` repository are historical only. Never confuse KRISTOU SCHOOL with `funmarket/VQULTIMATE`, `VQgemini` or `VibeQuestGuardians`.** A mistaken 2026-11-13 VQULTIMATE-only documentation change is NOT part of KRISTOU.

## 5. Resume protocol

1. Obtain and inspect the exact AI Studio patch/export if continuing Gemini work; never assume GitHub contains unpushed AI Studio edits.
2. Read `AGENTS.md` and all primary authorities, then this evidence checkpoint and the latest direct Owner instruction.
3. Fresh-check GitHub branch/HEAD/open PRs, affected source and tests; independently verify Supabase target, applied versions and deployed function source before security-sensitive action.
4. One `CURRENT_COMMAND` only. Preserve source ownership and owner decisions; no automatic jump from docs to F0-R1, migration repair, release or feature implementation.
5. For F0 work, F0-R1 is isolated **local** Supabase Docker reset + pgTAP; F0-R2 is non-destructive schema/history parity; F0-R3 reconciles committed/deployed Telegram auth; F0-R4 reconciles governing docs. Do not characterize F0-R1 as a production migration.
6. Do not commit directly to `main`, merge, deploy, or mutate production without the applicable specific authorization and exact-state evidence.
7. For every PASS, identify exact environment, source revision/patch hash, test command, runner output and limitation. An audit report is not an implementation.

**This snapshot is documentation-only.** No tests, migrations, account changes, deployments, or user-facing feature fixes were performed by preparing it.
