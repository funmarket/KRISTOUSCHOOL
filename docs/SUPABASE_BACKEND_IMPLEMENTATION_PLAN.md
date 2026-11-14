# KRISTOU SCHOOL — SUPABASE BACKEND INTEGRATION GUIDE

Status: **SUBORDINATE IMPLEMENTATION GUIDANCE — NOT AN INDEPENDENT QUEUE OR IMPLEMENTATION EVIDENCE**
Revision: **2026-11-14 — DOC-D7 checkpoint amendment**

This reconciliation changes `docs/SUPABASE_BACKEND_IMPLEMENTATION_PLAN.md` only. **Backend implementation remains PAUSED.** The master and six completed document edits remain byte-for-byte protected. Read-only source, GitHub and Supabase metadata/aggregate inspection supports this document; no SQL mutation, account action, migration, function deployment, setting change, commit, push, PR modification or merge is included.

## 1. Authority, single roadmap and checkpoint

Follow [AGENTS.md](../AGENTS.md), [requirements.md](../requirements.md), [structure.md](../structure.md), [CANONICAL_MODEL.md](CANONICAL_MODEL.md), [DECISIONS.md](DECISIONS.md) and [LIVING_BUILD_PLAN.md](LIVING_BUILD_PLAN.md). The latest explicit Owner instruction prevails. Requirements own behavior, structure owns architecture, the canonical model owns facts/writers and ADRs record decisions. This guide explains provider/integration gates; it does not create another product policy, schema authority or backlog.

The single task/dependency roadmap is [KRISTOU SCHOOL Master Execution Plan, revision 3](https://chatgpt.com/library?file_id=libfile_0bc078a5456c81918d4ccb8bae5e37ce&account_id=4376f273-aee7-4c95-abef-35eea9d93180), saved as `KRISTOU_MASTER_EXECUTION_PLAN(1).txt`, SHA-256 `d0213cd47d3cbf94d749a7234a9ab29cc965448c0c39850f9d234978b053e3cd`. It remains an external approved artifact, not a published repository master path. Use the complete continuity-handoff copy with matching fingerprint if necessary. Older `public/assets/aistudio/` copies, the historical plan below and continuation documents are not alternative active queues.

DOC-M0 master revision 3 and DOC-D1…DOC-D7 reconciliations are completed locally. All seven local document reconciliations remain uncommitted and unpublished: requirements, structure, canonical model, decisions, AGENTS, living discipline and this backend guide. PR #15 merged the earlier committed source candidate, not these newer document edits. Their verified recovery snapshots/copies are preserved; the earlier checkout is no longer available during this amendment and has not been recreated, pulled, reset or synchronized. The frozen master still has its older DOC-M0/current-command and DOC-D1-next paragraphs; later instructions/checkpoints establish subsequent progress. Do not rewind finished work or silently change any protected authority to refresh its status.

**Current authorized packet: DOC-D7 checkpoint amendment — docs/SUPABASE_BACKEND_IMPLEMENTATION_PLAN.md only. DOC-D7 reconciliation is completed locally; DOC-D8 has not started.** The amendment is prepared in a separate review copy from the verified DOC-D7 artifact because the original checkout is unavailable; this is not application to a live repository worktree. After this packet, DOC-D8 (`docs/SUPABASE_CONTINUATION_PLAN.md`) remains only the next proposed document, requiring an explicit instruction. Backend resumption requires an explicit Owner instruction after documentation reconciliation. Then follow the master's still-unresolved F0/GOV-C1 verification/release gates; the merge itself has already occurred, while GOV-01 acceptance is not established by merging. GOV-02/F1-G3 delegation still follows GOV-01 acceptance. Do not start another phase chain, rebuild working identity or treat the merged PR as permission for new features.

## 2. Dated inspected baseline — installed is not accepted

This table separates the freshly verified post-merge GitHub checkpoint on 2026-11-14 from the earlier DOC-D7 Supabase/source observations. No Supabase inventory, SQL or deployment operation was repeated in this checkpoint amendment. Refresh mutable facts before future implementation/release. [REMOTE_SCHEMA_INVENTORY.md](REMOTE_SCHEMA_INVENTORY.md) and [progress.md](../progress.md) retain older dated provenance; they are protected and not updated by this packet.

| Surface | Observed state | Evidence limit |
| --- | --- | --- |
| Canonical repository/main — post-merge | `funmarket/KRISTOUSCHOOL`; main `0d10fabeab99ee4dcbd117a4eb47df5b634b0a40` | Fresh GitHub main/commit inspection; old `funmarket/Kristou` is history |
| Last verified local source | `fix/gov01-source-database-parity@2dc828a66968246c76f325edfd603a4771c83555` | Recorded HEAD/tree provenance is preserved; original checkout is now unavailable, so current local HEAD/status cannot be freshly inspected |
| PR #15 — post-merge | Merged and closed; merge commit `0d10fabeab99ee4dcbd117a4eb47df5b634b0a40`; reviewed head `473d889c1b8e86bf71f88f66b67779f4c3502f8e` | Fresh PR metadata; merge does not establish security acceptance, deployment or permission to resume backend work |
| Shared committed source tree | Main and reviewed candidate freshly report `0c2b8e2b3880e4a0b892bead5d40536d68e29a5e`; last verified local HEAD reports the same tree | Three different commits share this committed source tree. Seven unpublished document edits are additional and are not in that tree |
| Existing Supabase target | `KRISTOUSCHOOL / ofppapwofhovhroyjtkc`, eu-west-3, ACTIVE_HEALTHY, PostgreSQL 17.11 | Correct project and metadata, not a replacement-database task or behavioral certification |
| Public tables | Six, each RLS enabled; listed below | Catalog presence/RLS flags do not prove ordinary allow/deny behavior |
| Installed migrations | Seven recorded versions, mapped below | History names alone do not establish SQL/body/grant/source parity |
| Account continuity | 3 Auth users, 3 profiles, 1 approved active Owner, 1 Telegram identity | Aggregate read-only counts; no personal identifiers fetched or account/link mutation performed |
| Functions | `auth-username-signin` ACTIVE v6; `telegram-auth` ACTIVE v9; `telegram-link-challenge` ACTIVE v6 | Version/verify-JWT inventory only; deployed source bodies were not freshly compared or exercised in DOC-D7 |
| Storage | 0 buckets in `storage.buckets` | No provisioned private file workflow is assumed; frontend/public static assets are not proof of Storage integration |
| Realtime | 0 public tables in `supabase_realtime` publication | Does not establish absence of every Broadcast/Presence channel or prove update delivery |
| Frontend | Existing single Vite/React/TypeScript app; Vercel host is recorded in accepted authorities | Exact live frontend SHA, current host settings and candidate-specific behavior were not verified in this document task |

The remaining backend rows above and sections 2.1/2.3 retain the earlier DOC-D7 read-only observations; they are not new post-merge behavioral verification. Earlier pre-merge repository statements are retained verbatim in section 9.1 as dated history. Automatic frontend deployment status, exact deployed version and behavior were not inspected; no manual deployment was performed.

### 2.1 Existing public schema and routines

| Installed table | Actual role in the inspected foundation | What remains separate/future |
| --- | --- | --- |
| `profiles` | Auth-backed account mapping; username/normalized key, requested role, display/contact fields, `account_status`, review metadata and `governance_version` | School-person identity, verified guardian/collector links, student records and a full Student Profile are not this account row |
| `role_assignments` | Canonical role rows/active assignments | Requested role is not a grant; multiple possible rows do not settle multi-active-role precedence DG-04 |
| `telegram_identities` | Linked Telegram account identity | No separate Telegram product account or permission from cached profile data |
| `account_link_challenges` | Hashed verifier, expiry and consumed state | No public secret/read authority or heuristic identity merge |
| `manager_capability_grants` | Manager capability-grant storage | Storage presence does not complete GOV-02 grant/revoke workflow, actual grant loading or UI acceptance |
| `account_governance_audit_logs` | Account-governance action/status/role history | Not a complete Media/Audit/outbox/reporting foundation for every future feature |

Fresh enum metadata has seven registered roles: APP_ADMIN, MANAGER, PARENT, STUDENT, TEACHER, SCHOOL_STAFF, ADMINISTRATIVE_PERSONNEL; no GENERAL_USER. Approval states are PENDING, APPROVED, REJECTED, SUSPENDED, REVOKED. Reuse installed objects rather than adding these again. GENERAL_USER is anonymous public browsing only.

Fresh routine metadata includes `claim_telegram_account_link` and six client-facing governance RPCs: `governance_get_actor_scope`, `governance_list_pending_accounts`, `governance_list_account_directory`, `governance_get_account_detail`, `governance_review_account`, `governance_appoint_privileged_role`; `governance_resolve_caller_role` is the internal resolver. Their catalog metadata reports SECURITY DEFINER. This is not approval of broad execution or proof of current grants/policy behavior. Reuse actual signatures from source/catalog and independently test caller/resource authorization; never expose an internal helper merely because it exists.

No People/Family/Academics/Enrollment/Attendance/Assessment/calendar/Pickup/content product tables were found among the six public tables. Logical concepts in the canonical model are future contracts, not installed SQL names or permission to create them. Private school-domain UI remains partly prototype/local/unavailable; an existing view is not a completed backend connection.

### 2.2 Migration provenance

Source paths below are under `supabase/migrations/`. Fresh post-merge GitHub tree inspection confirms that main now contains seven migration files, including `20261112190435_canonical_account_roles.sql`; the reviewed candidate and last verified local HEAD have the same committed source tree. Repository file count is distinct from the seven installed database-history records observed earlier in DOC-D7. A repository merge alone is not evidence of SQL execution, repaired history or installed statement/grant/body parity. The first four historical source/installed version differences remain mapped below; no SQL or installed-history query was repeated by this amendment.

| Source filename | Installed version/name | Treatment |
| --- | --- | --- |
| `20261110210000_authentication_foundation.sql` | `20261110212125 authentication_foundation` | Historical version/content differences remain mapped; no remote replay |
| `20261110222200_revoke_auth_trigger_execute.sql` | `20261110212204 revoke_auth_trigger_execute` | Historical version mapping; inspect exact effect before any future change |
| `20261110222300_revoke_auth_trigger_execute_public.sql` | `20261110212239 revoke_auth_trigger_execute_public` | Historical mapping; live statement's explicit roles remain a provenance detail |
| `20261111030000_atomic_telegram_account_link.sql` | `20261111150532 atomic_telegram_account_link` | Already installed; not a missing-migration task |
| `20261112190435_canonical_account_roles.sql` | `20261112190435 canonical_account_roles` | Recovered source merged to main through PR #15; installed record was observed earlier, not created by the merge |
| `20261113120000_human_friendly_usernames.sql` | `20261113120000 human_friendly_usernames` | Already installed; matching username-handler release remains separately gated |
| `20261113150000_account_governance_foundation.sql` | `20261113150000 account_governance_foundation` | Merged PR #15 reconciled source safeguards to earlier inspected installed SQL; true RLS/concurrency acceptance remains pending |

Never use blanket db push, history repair, renaming or fabricated applied markers to silence these differences. Do not rerun installed repair SQL, delete accounts or recreate the database. Any actual parity fix is a fresh authorized forward packet with review, isolated proof, recovery and protected postchecks.

### 2.3 Actual source and contract gaps

- `src/lib/supabase.ts` is the existing public-client composition and handwritten `DatabaseSchema`. It declares absent `users`, `children`, `parent_notes`, `pickup_records`; profile Row omits installed `account_status`; Functions/Enums maps are empty. These are source declarations, not actual schema. Governance uses a separate RPC interface/cast in `src/lib/accountGovernance.ts`. Do not create tables to satisfy stale types; apply the contract-refresh gate in section 5.
- `src/lib/auth.ts` rejects direct public phone login and uses the server username resolver; its Web profile loader reads `account_status`. Current role-derived `capabilities` are not completed Manager-grant loading. Preserve accepted auth and place remaining changes in their master tasks.
- `src/context/AppContext.tsx` still has local Parent Notes/Questions state; `src/components/views/RegistrationView.tsx` can set a local submitted flag. `markPickupArrived`/`confirmPickupRelease` return `pickup_backend_unavailable`. No false durable send/submit/release acceptance follows from those paths.
- The governance SQL source has the shared entry advisory lock, READ COMMITTED safeguard and VOLATILE caller resolver. A source guard or in-memory test does not prove real post-wait authorization or last-Owner concurrency. Do not rewrite lock order or weaken tests during documentation work.
- Existing `supabase/config.toml` uses local project ID `kristouschool-local`, PostgreSQL major 17 and the three function entries. `package.json` already has pinned `npx --yes supabase@3.1.0` db:start/stop/reset/test scripts, Node tests and frontend checking/build. Do not initialize the same foundation again. `npm run lint` is frontend TypeScript checking; `tsconfig.json` excludes `supabase/functions`, so it does not certify Deno serving.

## 3. Identity, authorization and protected transports

Follow AUTH-LOGIN-02 and ADR-012/015/016. Public sign-in is chosen username or email plus password; reject phone input before provider/resolver calls. Signup requires full name, password, requested role and email or phone; phone without email requires a valid chosen username. Keep internal provider phone credentials for server-side phone-backed username login. Username-only provisioning is unsupported. Preserve Unicode/NFC normalization, valid Arabic/Latin/accented French/numeric-underscore handles, current form/password handling and verified-contact/approval separation. A typed secondary contact is not an Auth/recovery alias. No synthetic identifiers, browser contact lookup or custom password/session store.

Supabase Auth owns Web credentials/provider sessions; the current account maps Auth/profile identity. People school identity may exist without credentials. Creating/importing a student never approves an app account, assigns roles, verifies guardians or authorizes collection. No matching by name/contact/photo, duplicate User table or feature-owned credential authority.

Browser and Telegram share one React product, backend behavior and durable data. Preserve baseline `09ffacf80daa4f546140053db441abb96c68ef8b`: auth/link/challenge/re-entry/cache/session behavior. Explicit linking uses the authenticated account, signed fresh initData and one-time atomic challenge claim. Established re-entry resolves the linked account without provisioning another account or issuing a Supabase Auth session. A restored Telegram profile is not direct RLS authority. Future private operations need a server-verified identity transport and the same current resource policy; do not silently mint sessions, redesign Telegram or deploy its protected handlers during GOV-01/AUTH-LOGIN-02 or docs.

For every protected operation verify current approved status, effective role/capability and resource scope. Never trust client role/user IDs, requested signup category, editable metadata, stale claims or cached profile data. Anonymous/unapproved/rejected/suspended/revoked actors and removed/expired scope must fail closed even from old sessions/open screens.

Only APP_ADMIN appoints/governs APP_ADMIN/MANAGER; preserve a recoverable last Owner. Approved Administrative Personnel have the ordinary school-office bundle and may govern other ordinary accounts, including peers, never themselves or privileged targets. Managers need explicit delegation. Teacher/Parent/Student/Staff remain assigned-class/linked-child/self/job scoped; role alone never grants full health/history or child-release authority. Recheck callers after waits, protect expected versions/idempotent retries and persist required audit atomically. Non-impersonating oversight changes displayed workspace, not actor/privilege; retain banner and Return to My Home.

For tables, check least-privilege grants and ordinary-principal RLS allows/denies. Review views for proper invoker/access semantics; function/RPC execution needs deliberate grants, ownership, fixed search paths where privileged and independent operation policy. SECURITY DEFINER/service-role paths can bypass row controls; never use them to solve an access error without explicit authorization and deny cases. Keep secrets server-side and out of Vite/public variables, fixtures, logs and screenshots. Do not connect real student/family data through prototypes or seed it into development.

## 4. Feature dependencies and decision gates — master references only

This table explains provider/consumer contracts; it is not an alternative execution order. Actual order, task packets and dependencies remain in the master's register. All eight additions are accepted; exact school values remain their DG gates. Do not invent physical table names, function signatures, retention rules, grading scales or access from UI labels.

| Slice / master references | Required owners and integration gate |
| --- | --- |
| Existing governance GOV-C1, F0-R1/R2/R3, F1 | Reuse installed identity/governance source; prove ordinary RLS, actual concurrency and exact release scope before dependent work. F0-R3 is protected regression/inspection, not the withdrawn Telegram rewrite; GOV-02/F1-G3 follows accepted GOV-01 |
| Records/forms/import F2-A1…A10; Profile PRO-01/02, ACC-01 | People identity, Enrollment eligibility, Academics class/year/subject/membership, Family guardian links and Access remain separate. Manual forms and validated CSV/XLSX preview/confirmed commit share writers; DG-02/DG-03 govern identifiers/templates/conflicts/limits/atomicity, no credential/role/link side effects |
| School/class dates CAL-01/02/03, COM-02/03 | Academics owns operational dates/closures/sessions; Class Community owns private content calendar; Broadcasts publishes references. Global Announcements calendar reaches all seven approved roles without requiring a class; deliberate public projection is separate. Africa/Tunis, date-only holidays and every affected date in multi-day spans; DG-08/DG-14 before register/editor/cancel/reschedule/acknowledgement policy |
| Substitutes CAL-04 | Effective class/subject/session/action and server-time cover; original responsible Teacher distinct from actual actor. DG-09 defines co-teaching/history; no shared passwords/new role/unbounded historical access |
| Attendance/justification ATT-01…05 | People/Academics assignments/register context, Family and private Media where needed. Different teachers have independent registers; class/day alone is insufficient. One counted pupil entry per approved register; Present/Absent/Late/Excused, untouched Not recorded. DG-08 controls same-teacher repeat lessons/correction/visibility/denominator. Parent explanation does not itself set Excused; cancelled/unrecorded sessions are not absences; no school-day absence from one lesson |
| Grades/reports/remarks GRD-01…04 | Assessment owns marks, policy-calculation/review/publication and educational remarks; Profile reads same records. DG-11/DG-12 before scales/weights/missing/exempt/publication/audiences. Published-only permitted child/self output; no draft/restricted-note leakage, assumed zero or editable copied totals |
| Recovery REC-01/02; emergency/minimal safety PRO-01/02 | Identity/provider proof/operator/session policy DG-10 preserves same account/roles/links; People owns DG-13-approved narrow contacts/safety facts. Contact is not automatically guardian/account/collector. DG-07 lifecycle applies; no generic admin reset/merge bypass or full medical dossier |
| Rollover YEAR-01/02; reports REP-01 | DG-15 preview/confirmed audit/retry; retain prior memberships/marks/reports and historical access policy. Reports are scoped source projections, bounded/formula-safe exports with DG-07/DG-16 fields/audiences, not another ledger |
| Admission/content/notes/messages COM, F3, PUB | Distinct Enrollment/Class Community/Parent Notes/Messaging/Broadcasts/Directory/Food Menu/Public Content/Preferences writers; needed Media/Audit/outbox precedes consumers. Parent Notes retain 11 sends, 08:00 inclusive–18:00 exclusive Africa/Tunis, 08:00 reset, private audience and reply exemption. Messages/Questions retain 200-character and no student-private-DM rules |
| Pickup F4-P0…P3 | Current Identity/Access, verified Family/collectors, enrollment/membership, dismissal policy, Audit/Outbox/coordination and recovery. WAITING → PARENT_ARRIVED → RELEASED; only authorized staff physically verify and release. Keep backend-unavailable lock until isolated/staging safety proof and explicit activation; calendar/RSVP/Attendance/AI/timer cannot release |
| All actions UI-01/02, CFG-01, CTR-01, STF-01 | Close actual role-home/menu/form/bell/footer consumers including Governance & Access/School Operations, not just 80 cards. Settings composes owning config; Control Center/reports are permitted projections; DG-19 before new staff request lifecycles. My Profile is not Home; Messages is not Notes |
| Operations OPS-01…03, F5; optional AI-01 | Synthetic isolated CI/staging, meaningful verification, measured performance/recovery, deliberate compatible release and exact deployed candidate. AI remains later explicit activation/API client; app works without it |

Preserve school-only topology, accepted logo/UI/eight homes, Owner Teachers → Classes → Registration, light-default/Pitch Black and AR/FR/EN text within a stable LTR shell/navigation. Do not import Hooma's runtime/Prisma, redesign the app or mirror the shell. Hooma calendar interactions are reference only. No multi-school, student private DMs, payments, bus operations, lunch ordering/payment, automatic pickup or broad medical expansion.

## 5. Per-slice migration, RPC/function, generated-type and UI gate

These gates apply inside a separately authorized vertical slice; none lifts the backend pause.

1. **Freeze actual contract and target.** Follow AGENTS/master preflight: fresh repo/HEAD/PR overlap and exact project/environment, allowed actions, protected accounts/files, prerequisites/DG decisions, canonical writer, all consumers, exact inputs/outputs/errors and exposure/compatibility. Search before adding models/RPCs. Stop the affected action on wrong/stale target, overlap, missing decision or failed relevant safety gate; continue independent authorized work.
2. **Review source-controlled change.** Inspect installed bodies/constraints/grants and legacy migration mapping before a new forward migration. Generate actual filenames only with the approved pinned CLI after checking current help; do not invent an applied timestamp or rewrite history. Encode settled FK/unique/check/state/effective-time/version rules and indexes from real policy/query patterns. Do not bulk-copy mocks/types, create a giant cross-domain migration or introduce cascade cleanup without its own explicit scope. Prefer reviewable/recoverable changes and record rollback/forward-fix limitations honestly.
3. **Prove clean isolated enforcement.** Replay the reviewed source from clean isolated Supabase with synthetic fixtures only; run integrity/grant/RLS allow-and-deny tests as ordinary callers and real API/RPC tests. Cross-account/class/child, old status/grant/link/session, invalid transition, wrong transport and private field/object cases must deny. Demonstrate quota/version/retry/idempotency and genuine simultaneous-session invariants where needed. An in-memory schedule, privileged runner or policy string is insufficient; break a representative isolated policy/behavior to prove the meaningful check can fail, then restore it.
4. **Keep server boundaries narrow.** Existing RPCs remain canonical for their purpose; direct caller-scoped reads may use RLS without another Edge Function per query. For a needed function validate method/content type, bounded payload, schema, identity, origin/CORS, input and domain policy; safe errors/correlation/rate limits; actual Deno packaging/import/dependency behavior. Multi-row invariants use the owning transaction/RPC, not multiple browser calls described as atomic. Secrets stay in server deployment configuration; no broad service-role shortcut. Verify untrusted/malformed/replayed/expired/cross-resource calls, not just successful parsing.
5. **Generate one database-type authority.** Generate/refresh Supabase TypeScript types from the **exact tested schema**, with reproducible supported pinned-tool command and schema fingerprint; freeze one real output path after source inspection. No second handwritten database interface. Deliberately migrate affected consumers away from stale declarations/casts; generated types do not grant access or prove RLS. Do not generate remote types and treat them as proof a different candidate schema passed tests.
6. **Synchronize every consumer.** Update feature adapters, runtime validators/request-response/errors, UI view models and all owning cards/menus/forms/selectors/deep links. Detect missing columns/tables, renamed parameters, stale types, missing grants/Data API exposure and incompatible function payloads. Test actual API success/error/denial and persisted readback. Local state, a generic Home link, a mock result or typecheck is not durable workflow completion. Preserve valid accepted presentation and supported Browser/Telegram identity behavior.
7. **Release only the tested compatible slice.** Separately authorized reviewed migration/RPC/function dependencies precede dependent frontend, with version/schema fingerprints, backward compatibility, protected Owner/link postchecks and rollback/forward-fix. Verify actual deployed function/frontend candidate and approved bounded live flows. Keep unrelated handlers/feature activation untouched. A green CI/build/deploy status or object count cannot substitute for acceptance.

## 6. Storage, realtime, notifications and failure semantics

Media owns generic descriptors/bytes; each product writer controls semantic attachment and audience. Starting inventory has no buckets. Before provisioning first-use private Storage under MED-01, freeze file types/sizes/metadata policy, private object keys/binding, retention/review/deletion and signed-delivery/revocation behavior under DG-07/DG-13 as applicable. Check bucket/object grants/policies and actual unauthorized upload/read/overwrite/delete/cross-child/expired-link cases; upload replacement needs the applicable read/update permissions as well as insert. Published public media requires deliberate public ownership; no unmanaged sensitive URL or public enrollment/class/safety document.

The zero-public-table Realtime publication observation is not proof all realtime is disabled. COM-01/F4-P3 must select the minimal authorized update transport and prove its actual table publication or private channel policy, recipient scope, token/permission changes, unsubscribe/reconnect/current-state recovery and duplicate/out-of-order/missed events. A public topic or client room name is not authorization; DB/API checks do not automatically prove Storage/Broadcast/Presence behavior. No speculative worker fleet or channel enablement occurs in DOC-D7.

For future slices requiring durable delivery, the source mutation and required Audit/outbox handoff must commit atomically. Delivery retries must be bounded/idempotent; notifications must be audience-filtered projections with safe links/access recheck and honest read/delivery states. Delivery failure must not rewrite a committed business event. If an accepted transition committed but fanout is delayed, display confirmed state plus delivery uncertainty and safe readback; never fake rollback or invite duplicate release. Maintain necessary Pickup safety prerequisites and staff fallback. Browser/Telegram/device sound/background restrictions must be represented honestly. These are target integration requirements, not an installed outbox/notification workflow.

Optional queued Table Editor review in ADR-027 is a manual operator diff/transaction aid for later explicitly authorized row work, not migrations, outbox, app authorization, audit or approval/Attendance/Pickup implementation. No preferences or row edits are enabled by this document.

## 7. Verification, recovery, operations and release evidence

Use the existing local config/scripts rather than initializing another project. The repository already declares db:start/stop/reset/test through Supabase CLI 3.1.0, frontend lint/build and Node auth/Telegram tests; the full existing Node invocation is `node --import tsx --test tests/*.test.mjs tests/functions/*.test.mjs`. These commands are reading references, not instructions to run backend work now. Verify current CLI help/runtime before later execution. `docker`, `psql` and a standalone `supabase` binary were absent from PATH during DOC-D7; Node/npm/git are available. This is a dated environment fact, not permanent impossibility or permission to install/alter infrastructure.

Earlier evidence in progress/handoff, **not rerun by DOC-D7**: 49 Node tests passed; typecheck/build passed; seven migrations replayed in standalone PostgreSQL 16.2 with a minimal synthetic Auth schema and pgcrypto declaration omitted; governance pgTAP 26 passed in that limited runner. Foundation pgTAP had **18 passed, 3 failed** own-row isolation assertions with row_security_active=false. Normal Supabase reset failed and true two-session execution was not run in that environment. Keep these failures/limits; a bypass-RLS runner cannot close ordinary isolation. The Owner's successful deployed login/oversight is valid manual evidence of that observed flow, not candidate-specific mutation/RLS/concurrency proof. Current function versions are not handler-body parity or a successful live credential test.

A feature's maturity is separately recorded: planned → UI/contract source → compatible installed backend → real isolated acceptance → staging → explicitly approved live acceptance. Record exact candidate/schema/function versions, generated-contract fingerprint, command/exit/counts/logs, actual UI/data readback and deny/error/retry/concurrency coverage. Existing Node mocks/source guards, frontend compile, catalog metadata and document checks are different evidence classes. No test count is inferred or reused for a changed candidate.

OPS-01/02/03 and DG-05/DG-07/DG-16 govern isolation, CI/staging, safe exports, measured load/query/error objectives, backups/restore and incident ownership. Use synthetic data and bounded/paginated queries/imports/exports; add indexes or infrastructure for measured need, not an invented SLA. Audit exports, prevent spreadsheet formula injection and exclude private/draft/safety fields beyond the approved audience.

Rehearse restore/readback in an isolated target with required database, private object bytes, configuration and identity dependencies; database backup presence alone is not Storage-byte recovery. Define approved recovery objectives, backup access/retention, session/contact/provider dependencies, delivery retry, alerts/escalation and rollback/forward-fix. Do not reset/restore production as a drill, expose secrets in evidence, copy real minors into fixtures or assume provider PITR/monitoring/settings are enabled. Account recovery/contact changes use DG-10 provider/operator proof, collision/replay/rate/session policy and the same canonical account/roles/links; no password reading or unrestricted administrative reset bypass.

Production release is a separate exact Owner-authorized action after applicable staging/security/visual/recovery/performance gates, with correct project/origins/redirects/secrets, compatible backend then frontend, exact deployed candidate and protected postconditions. Preserve default Light, optional Pitch Black, mobile/trilingual/stable-shell/accessibility and Browser/Telegram workflows. Pickup activation has its own safety acceptance and explicit authorization; AI has its later separate activation. The PR #15 merge does not activate these features or close their verification/release gates.

## 8. Document acceptance and continuation boundary

For this checkpoint amendment, verify fresh PR/main/candidate tree metadata and repository migration files, distinguish recorded local HEAD and earlier installed database history, and inspect references, superseded observations, final diff and protected fingerprints. The original checkout is unavailable: verify the master/four DOC-D1…D4 snapshots in the handoff, the surviving DOC-D5/D6 copies and pre-amendment DOC-D7 artifact against their accepted hashes. Preserve those inputs and amend only the separate review copy; do not restore or overwrite a repository. References may be checked against the fresh GitHub tree and accepted recovery text. The old whole-worktree fingerprint check cannot be freshly rerun without that checkout; do not report it as a new pass. Do not automatically update progress/master/another authority; task evidence stays outside git. These checks prove documentation/scope only. The merge does not establish RLS/concurrency acceptance, deployed-handler parity, recovery testing, exact-candidate live behavior or automatic deployment success. All such unresolved gates remain unchanged.

**Next proposed document: DOC-D8 — docs/SUPABASE_CONTINUATION_PLAN.md only, upon explicit instruction. Do not start DOC-D8.** Backend remains paused; no SQL mutation, code/account/PR/deployment action, commit or push is authorized by this guide.

## 9. Provider references and dated research

Current provider behavior must be checked against official documentation/current CLI help when an actual implementation packet needs it. DOC-D7 consulted Supabase's API security, Storage access-control, Broadcast and backup/restore documentation and type-generation reference metadata; it did not execute their examples or apply settings. Project contracts remain the reconciled authorities above.

- [Securing the Data API](https://supabase.com/docs/guides/api/securing-your-api): grants/exposure, RLS and privileged function review are distinct controls.
- [Generating TypeScript types](https://supabase.com/docs/guides/api/rest/generating-types): current provider reference for schema-derived types; exact path/command is frozen in the owning packet.
- [Storage access control](https://supabase.com/docs/guides/storage/security/access-control): object policies and operation-specific upload/read/update permissions require actual feature tests.
- [Broadcast](https://supabase.com/docs/guides/realtime/broadcast): channel-based delivery is not the same inventory as public table publication.
- [Backup and restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore): database and additional function/object transfer have distinct dependencies; no provider migration or restore was performed here.
- Historical provider links are retained with the original plan below; no old command becomes current authorization.

## 9.1 Pre-merge DOC-D7 observations — 2026-11-14 history

The exact observations below were recorded during DOC-D7 before the later confirmed merge. They remain provenance only: **their main SHA, pending-merge/current-command wording and six-file repository count are superseded by the post-merge checkpoint above.** They do not rewind completed DOC-D7, supply another current task or imply the merged commit contains the unpublished reconciliations. The separate original backend-plan history in section 10 remains unchanged.

<details>
<summary>Earlier DOC-D7 checkpoint and migration observations — not current state</summary>

At DOC-D7 start, DOC-M0 master revision 3 and DOC-D1 requirements, DOC-D2 structure, DOC-D3 canonical model, DOC-D4 decisions, DOC-D5 AGENTS and DOC-D6 living discipline are completed locally. The six repository edits remain uncommitted/unpublished. The frozen master still has its older DOC-M0/current-command and DOC-D1-next paragraphs; later instructions/checkpoints establish subsequent progress. Do not rewind finished work or silently change any protected authority to refresh its status.

**Current authorized packet: DOC-D7 — this document only.** After this packet, DOC-D8 (`docs/SUPABASE_CONTINUATION_PLAN.md`) is only the next proposed document, requiring an explicit instruction. Backend resumption requires an explicit Owner instruction after documentation reconciliation. Then follow the master's F0/GOV-C1 prerequisites and existing GOV-01/AUTH-LOGIN-02 closeout; GOV-02/F1-G3 delegation follows GOV-01 acceptance. Do not start a directory-first phase chain, rebuild existing identity or expand PR #15 into all school features.

Fresh read-only inspection for DOC-D7 on 2026-11-14 confirms the following. Refresh mutable facts before future implementation/release. [REMOTE_SCHEMA_INVENTORY.md](REMOTE_SCHEMA_INVENTORY.md) and [progress.md](../progress.md) retain older dated provenance; they are protected and not updated by this packet.

| Historical observation | Recorded state | Original evidence limit |
| --- | --- | --- |
| Canonical repository/main | `funmarket/KRISTOUSCHOOL`; main `32067aa961620facffe4ff906c5598f68d27d6ff` | Fresh GitHub metadata; old `funmarket/Kristou` is history |
| Local source | `fix/gov01-source-database-parity@2dc828a66968246c76f325edfd603a4771c83555` | Local HEAD tree equals PR head tree; commit IDs differ and local document edits are additional |
| PR #15 | Open, draft, unmerged; head `473d889c1b8e86bf71f88f66b67779f4c3502f8e` | Corrective candidate, not a release or implementation authorization; preserve newer overlapping local document hunks in any future authorized publication |

Source paths below are under `supabase/migrations/`. The PR-equivalent checkout has seven files; current main has six and lacks the recovered canonical-roles file. The recorded source/installed mapping is retained from the prior reconciliation and rechecked against fresh filenames/version inventory; full installed statement-body equivalence was not repeated in DOC-D7.

| Source filename | Installed version/name | Original treatment |
| --- | --- | --- |
| `20261112190435_canonical_account_roles.sql` | `20261112190435 canonical_account_roles` | Recovered source in PR #15, not merged to main |
| `20261113150000_account_governance_foundation.sql` | `20261113150000 account_governance_foundation` | PR reconciles source safeguards to earlier inspected installed SQL; true RLS/concurrency acceptance remains pending |

</details>

## 10. Historical backend plan — superseded ordering and state

The complete original document follows verbatim as dated provenance. **Its ORDERED status, numbered phases, old four-table/five-migration inventory, direct-phone wording, create-first-foundation/new-project steps, public-directory-first sequence and old RTL wording are not active policy or permission.** Apply the current master/authorities and scope above. Compatible security/provider guidance is retained in the current integration gates; do not execute historical examples or replace working identity/Telegram behavior to match them.

<details>
<summary>Original backend implementation plan — historical reference only</summary>

# Supabase Backend and Database Integration Plan
> **Historical ordering notice (2026-11-13):** This plan is a staged backend proposal, not the live schema inventory or authorization to run its steps. Current verified backend: four RLS auth tables, five live migrations, Edge Functions v6/v9/v6, with only four source SQL migrations. Follow `docs/CURRENT_STATE_AND_HANDOFF_2026-11-13.md` and the Product Owner's newer packet plan when choosing work; F0-R1 is *local* reset/pgTAP, not production repair.


Status: **ORDERED IMPLEMENTATION PLAN — NOT IMPLEMENTATION EVIDENCE**

This plan establishes a safe route from the current Vite/React prototype to a Supabase-backed product. It does not provision or change any Supabase project. Progress belongs in `progress.md`; accepted product behavior belongs in `requirements.md`; architecture belongs in `structure.md`; canonical data ownership belongs in `docs/CANONICAL_MODEL.md`; decisions belong in `docs/DECISIONS.md`.

## Goal and scope

Use Supabase as the planned platform for managed PostgreSQL, source-controlled database migrations, server-side Edge Functions, and private object storage. Keep the browser as a presentation client. Deliver one complete, tested vertical slice at a time. Do not migrate all demo features or seed fake school records into a hosted environment.

Supabase is selected for the backend/database direction. This does not by itself prove that a project has been provisioned, connected, migrated, or deployed. Hosting for the static frontend is separate and is not selected by this plan.

## Fixed product policy and technical authentication gate

The product owner approved Supabase Auth for shared-app credential verification with email, phone, or custom username plus password. The same signup/sign-in form is available in Browser and Telegram WebView. The custom username is stored in the KRISTOU profile linked one-to-one to `auth.users`; username resolution occurs only in a server-side Edge Function. A signed-in app user explicitly links Telegram to that same canonical User through a short-lived one-time challenge and server-validated Mini App `initData`. Telegram linking does not create an account or issue a Supabase session. The school admission/registration form remains separate from app signup.

The authentication foundation defines the server-side profile trigger, role assignment storage, protected username resolver, Telegram `initData` validation for explicit link confirmation, and one-time linking challenge. Strong provider password handling, generic errors, contact confirmation, rate limits, conflict handling, and service-role isolation remain required at deployment review. Do not treat service-role access as a substitute for authorization.

Private school data remains behind feature-specific access matrices, RLS policies, and allow/deny tests. Supabase Auth documentation describes native email and phone password identifiers; the server-side username resolver supplies the approved custom identifier.[1]

## Target request/data flow

```text
React/Vite browser
  -> publishable Supabase key (public project identifier, not a secret)
  -> Supabase Auth session for the shared app account
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
2. Record that school-domain frontend views still use mock state, while a Supabase Auth/profile foundation and Edge Function source exist. The hosted project is active but migration IDs and the deployed Telegram handler drift from current source; see `docs/REMOTE_SCHEMA_INVENTORY.md`.
3. Preserve the approved email/phone/username shared-app credential model and explicit Telegram identity-linking model. Keep school admission separate from app signup; do not add Telegram-first account creation or a Telegram-issued Supabase session.
4. Confirm that Supabase is the approved managed database/function provider and choose a project owner, organization, region, and project separation strategy. Do not create a hosted project implicitly as part of code work.

**Gate:** the Supabase Auth/profile/role mapping, username resolver, explicit Telegram link confirmation boundary, and deployment secret requirements are recorded in `docs/DECISIONS.md`; private school-domain writes still require separate security gates.

### 1. Add reproducible local Supabase development

1. Pin the Supabase CLI invocation in the project toolchain (`npx --yes supabase@3.1.0`; do not depend on an unpinned global binary).
2. Initialize `supabase/config.toml` and configure local Auth/session behavior for the approved shared-app credentials; Telegram `initData` is used only to confirm the explicit link in this slice.
3. Use the committed `db:start`, `db:reset`, and `db:test` package scripts. They are defined, but local execution remains blocked until Docker is available; do not mark the local database gate passed before reset and pgTAP succeed.
4. Keep `.env.example` to placeholders such as `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and server-side-only secret names. Remove fallback project IDs, mock keys, and embedded credentials from source. The publishable key may be present in browser configuration; secret/service-role keys may not.
5. Verify `.gitignore` excludes actual environment files and local Supabase state. Create local-only synthetic `supabase/seed.sql` fixtures with no real student, family, staff, contact, medical, enrollment, or pickup records.

Supabase's local-development workflow supports tracked migrations, repeatable database reset/seed, and later deployment of that history to a linked project.[3]

**Gate:** a clean local checkout can start the local stack and reset the database from committed migrations with deterministic synthetic seed data.

### 2. Define the authentication and canonical identity mapping

1. Implement only the approved path from Phase 0.
2. Preserve the canonical KRISTOU User as the shared Web/Telegram product identity. If a reviewed design uses Supabase Auth, define an explicit one-to-one mapping from `auth.users.id` to canonical `User.id`; do not copy Supabase-managed passwords into application tables.
3. Web username/password is fixed product behavior. Do not build an improvised browser-side username lookup. Use Supabase Auth for password verification, session issuance, expiry, and revocation; resolve username only in the server-side function and return the provider's normal session. Do not create a parallel password store or custom Web session format. Require a security review before exposing any protected table through the Data API.
4. Define account-link behavior for Telegram as a separate explicit one-time, expiring, conflict-failing flow. Validate signed Telegram `initData`, consume the challenge atomically, attach the Telegram identity to the existing canonical KRISTOU User, and never merge heuristically. This linking operation does not mint or refresh a Supabase Auth session.
5. Add auth integration tests for unauthorized access, expiry/revocation, conflicting identities, and any signup/recovery policy before relying on auth in RLS.

**Gate:** a threat model and tests establish how the database and Edge Functions learn the verified canonical actor for every protected request.

### 3. Introduce a minimal foundation schema as migrations

1. Create the first timestamped SQL migration under `supabase/migrations/`; do not create product tables by bulk-copying UI TypeScript types or mock data.
2. Implement only the approved identity/access-control foundation needed for the first vertical slice. Use UUID/FK/unique/check constraints that encode accepted invariants; select `timestamptz` for instants; use `Africa/Tunis` only for business rules that require local school time.
3. Keep canonical identity, role/capability authority, parent-child link, class membership, teacher assignment, School Staff responsibilities, and Administrative Personnel responsibilities distinct. Do not allow frontend-supplied role strings to become authority.
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

</details>
