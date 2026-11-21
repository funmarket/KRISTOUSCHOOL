# KRISTOU SCHOOL — LIVING BUILD PLAN

Status: **ACTIVE BUILD DISCIPLINE**
Revision: **2026-11-21 — ARCH-MASTER-01 execution and proof gates; DOC-D6 history retained**

## LIVE EXECUTION CHECKPOINT — 2026-11-21 / ARCH-MASTER-01

**ACTIVE STATUS: this section supersedes the dated task-status and next-step language below, but preserves historical text unchanged.** It strengthens execution discipline only. It does not change product authority in requirements.md, domain/architecture authority in structure.md, database truth in CANONICAL_MODEL.md, or accepted decisions. The latest explicit Owner command is required for each mutation and each new ARCH packet.

### Verified source checkpoint and evidence limitations

- Canonical repository: \`funmarket/KRISTOUSCHOOL\`. Verified source \`main\` at this checkpoint: \`6c932c07661cf2f35649bdccbffc7409a6dfb6fe\`.
- **ARCH-01: PR #36 MERGED**, 2026-11-21, merge/main SHA \`6c932c07661cf2f35649bdccbffc7409a6dfb6fe\`; prior branch HEAD \`8db21cacd29fc048f96c327af1875d6a749dddab\`. \`AppContext.tsx\` physically shrank 1,813 → 1,436 lines. \`PreferencesContext.tsx\` and \`NotificationContext.tsx\` exist in merged source.
- On the exact merged main, independently executed *controlled React browser* ARCH-01 tests 13/13 PASS; canonical Messages browser tests 5/5 PASS; Node suite 183/183 PASS; frozen dependency install, lint/typecheck, build and \`git diff --check\` all exit 0. These prove only the specific executed checks and their source revision. They do not prove real hosted RLS, authenticated production user flows, or Telegram live behavior.
- **Historical procedural exception, permanently recorded:** Original ARCH-01 source changes and commit lacked contemporaneous Literal Command Executor preflight/begin/postcheck proof. Historical process compliance remains **NOT VERIFIED**; later tests or gatekeeper use cannot retroactively certify the original work. Do not suppress this exception.
- Protected Students PR #33 remains OPEN / DRAFT at \`6dfa1aac7e5f740bd9240f950b33778451774fb6\`; do not edit, absorb, merge, close or silently rebase it.
- **ARCH-02 is NOT STARTED / LOCKED**. No automatic advancement from ARCH-01 merger or passing tests. It requires a new exact Owner implementation authorization and fresh source/ownership inspection.
- Older DOC-D6 "backend paused" and "next DOC-D7" wording and historical GOV queue below are dated checkpoints, not the current task. This update grants **no** Supabase mutation, production deployment, CI setting changes, auth/Telegram edits, or application-code changes.

### Sequential monolith decomposition packet contract

One packet is active at a time. Each packet gets its own explicit Owner authorization, fresh baseline, file allowlist, evidence ledger, isolated branch, draft PR, separately authorized merge, post-merge exact-main verification and STOP. The next packet is never auto-authorized.

| Packet | Physical target | Acceptance threshold and status |
|---|---|---|
| ARCH-00 | Fresh main/PR/owner/consumer/line-count baseline | Historical inspection only; refresh before each packet |
| ARCH-01 | Separate Preferences and Notification state from AppContext; preserve \`useApp()\` | MERGED IN SOURCE; AppContext 1,436 ≤1,500; historical process exception above remains |
| ARCH-02 | Extract \`IdentityContext.tsx\` — one session/auth owner | LOCKED; AppContext ≤1,050 and IdentityContext ≤400 |
| ARCH-03 | Extract \`AppShell.tsx\` and typed \`routeModel.ts\` from \`App.tsx\` | LOCKED; App.tsx ≤150 |
| ARCH-04 | Decompose \`ClassesManagementView.tsx\` into focused UI | LOCKED; original view ≤450 |
| ARCH-05 | Decompose \`StudentsManagementView.tsx\`, reconcile protected PR #33 only by separate approval | LOCKED; original view ≤350 |
| ARCH-06 | Re-export-only schoolContent/schoolOperations barrels and canonical domain-owned types | LOCKED; types.ts ≤300; domain-file writes require exact separate authorization |
| ARCH-07a | \`StaffAttendanceRegisterPanel.tsx\` | LOCKED; ≤450 |
| ARCH-07b | \`SchoolCalendarPanel.tsx\` | LOCKED; ≤450 |
| ARCH-07c | \`OwnerGovernanceWorkspace.tsx\` | LOCKED; ≤450 |
| ARCH-07d | \`PerformanceView.tsx\` | LOCKED; ≤450 |
| ARCH-07e | \`PublicHomePage.tsx\` | LOCKED; ≤450 |
| ARCH-07f | \`ClassCommunityView.tsx\` | LOCKED; ≤450 |
| ARCH-08 | Whole-repository ownership/remaining-monolith/dependency/CI/document reconciliation audit | **PROPOSED ONLY**, not authorized |

Extracted focused view components should normally be ≤400 lines. Line counts are physical acceptance checks, not permission to scatter ownership. \`move → prove → remove\`; never leave two active owners, create catch-all services or unused placeholder files. Preserve all existing AR/FR/EN UX, roles, approvals, account identity, Telegram link/re-entry, Calendar/Attendance/Parent Notes contracts, school records, and the existing single Supabase project.

### Non-negotiable deterministic execution and proof system

1. **Before any source edit, branch/ref write, commit, push, PR/merge, deployment or database mutation**, load applicable Evidence-First Execution, Literal Command Executor, Superpowers, Understand and Build Web Apps instructions. Run the available environment proof or a recorded equivalent. Determine exact repo/branch/main SHA, clean/dirty state, PR overlap, current schema where relevant, installed tools and independent test environment.
2. Create an off-repository **literal task contract** holding the latest Owner command verbatim; one \`CURRENT_COMMAND\`; exact target paths and allowed/forbidden actions; prerequisite evidence IDs; fresh fingerprints; decision and approval gates. Do not extrapolate authorization from roadmap entries, convenience or previous success.
3. Use the deterministic \`gatekeeper.py\` controller for every consequential write: \`init\` → \`evidence\` → fresh \`preflight\` token → \`begin\` → **exactly one logical mutation** → read-back and focused verification → \`postcheck\` → \`advance\` → final \`finalize\`. Store state outside repository and never hand-edit controller state. Controller refusal, missing tool, expired token, mismatch, or \`STOP_ON_DRIFT\` blocks the affected mutation; start a new verified controller state rather than bypassing it.
4. Evidence-first execution loop for testable changes: establish an actual behavior baseline and observe a meaningful **RED** failure before the implementation; minimal fix; **GREEN**; isolate a **negative control** that deliberately breaks the protected behavior and proves the test detects it; restore source byte-for-byte; rerun on the exact final candidate. A timeout caused by test infrastructure is not sufficient RED proof. Do not weaken or skip tests.
5. At each gate, preserve an append-only, timestamped evidence ledger and full raw logs. Each row requires: packet ID, exact user authorization quote, repo/main/branch HEAD, worktree state, file allowlist, candidate fingerprint, environment, exact command, exit code, actually printed pass/fail/skip counts (if tests), evidence path, what the result proves and does not prove, and status \`PASS | FAIL | NOT VERIFIED | BLOCKED | NOT STARTED\`. Keep credentials and child/family private data out of logs. Zero tests collected is never a pass; do not hide skips or masked exit codes.
6. The **Hard Evidence Block** for every implementation packet must identify all changed files and before/after line counts, SHA-256 and Git blob hashes, full diff and \`git diff --check\`, canonical state and durable write owner, imports/dependency cycles, type and error contract, focused and surrounding real test logs, actual browser interaction, regression RED/GREEN/negative-control trace, and any deny/concurrency evidence where relevant. Distinguish controlled React fixture, real RLS server, preview deployment READY, authenticated live preview and production checks. **Never substitute one evidence class for another**.
7. A **draft PR** requires independent exact-head review and CI/preview evidence when applicable. A green build, preview READY, or mergeable flag never authorizes merging. Owner approval must name exact packet and PR. After a separately authorized merge, independently verify resultant main tree, rerun required post-merge tests, confirm protected branches remained unchanged, obtain Owner acceptance of the evidence block, then STOP. Starting the next packet requires its own Owner command.
8. Fail closed on missing historical authorization records, failed security deny cases, unexpected modified files, changed/stale branch, weak tests, conflicts, unverified server state, or inability to inspect a material contract. Mark missing proof **NOT VERIFIED** or **BLOCKED** and report it; never invent logs, approvals, SHA values, migrations, tests, or completed architecture.
9. Public/browser presentation never authorizes protected behavior. Use verified server identity, least-privilege RPC/grants/RLS and the canonical domain adapters for protected operations. Never change hosted SQL, Auth/Telegram handlers, accounts, approved roles, student/guardian records or deployment under an architecture documentation update.

### Proof implementation boundary of this documentation-only update

This update **installs mandatory written execution and evidence obligations in this file**. It does **not** create or configure CI workflows, GitHub branch protection, executable acceptance scripts, Supabase migrations, deployment, or a new runtime service. Any **automated enforcement** implementation requires its own explicitly scoped packet, evidence and approval. Do not claim written process rules are already machine-enforced.

---

### Current continuation — 2026-11-18

The DOC-D6 pause/next-document wording below is retained as historical context;
later explicit Owner instructions resumed implementation. For the Owner-authorized
student/Teacher dossier, forms, relationships and notes continuation, read
[Student and Teacher dossier reconciliation](STUDENT_TEACHER_DOSSIER_PLAN.md).
It maps missing work to the approved master's existing F2/PRO/ATT/GRD/COM task IDs,
records current Owner decisions and identifies the first bounded Students read packet.
It does not replace the master or claim that a planned feature is implemented.
PR #30 is merged at source baseline `2b943580e0a98ed5223b90c613d36f661928f42a`;
its backend contract and still-needed frontend wiring are tracked separately.
New hosted SQL still requires exact-SQL review and manual approval.

This packet reconciles `docs/LIVING_BUILD_PLAN.md` only. Backend implementation remains **PAUSED**. The master and five accepted local document edits are protected; no code, Supabase, account, PR, commit, push, merge, configuration or deployment action is included. A document check establishes text consistency, never a working connection or production readiness.

This document defines how work is performed; it is not a feature backlog, product-requirements file or independent execution queue. Read [AGENTS.md](../AGENTS.md), this document, the approved master and latest explicit Owner instruction before each task. A roadmap entry or successful prerequisite does not authorize the next action.

## 1. Permanent authorities

- `requirements.md` — accepted product behavior and acceptance rules.
- `structure.md` — architecture, runtime boundaries, and domain ownership.
- `docs/CANONICAL_MODEL.md` — canonical data, write ownership, and invariants.
- `docs/DECISIONS.md` — accepted and proposed architecture decisions.
- `docs/SUPABASE_BACKEND_IMPLEMENTATION_PLAN.md` — subordinate historical backend proposal awaiting DOC-D7; its independent phases are not an active queue.
- `progress.md` — verified implementation evidence only.
- `docs/CURRENT_STATE_AND_HANDOFF_2026-11-13.md` — dated evidence checkpoint and document-status index (not a competing product or architecture authority).

**Single roadmap:** [KRISTOU SCHOOL Master Execution Plan, revision 3](https://chatgpt.com/library?file_id=libfile_0bc078a5456c81918d4ccb8bae5e37ce&account_id=4376f273-aee7-4c95-abef-35eea9d93180), saved as `KRISTOU_MASTER_EXECUTION_PLAN(1).txt`, SHA-256 `d0213cd47d3cbf94d749a7234a9ab29cc965448c0c39850f9d234978b053e3cd`. It owns task order, dependencies and decision-gate references. It is an external approved artifact, not a published in-repository master path. The complete handoff copy can be verified against that fingerprint; do not substitute an older static asset or create another roadmap.

The master retains its older DOC-M0/current-command and DOC-D1-next paragraphs verbatim. Later Owner instructions and the continuity checkpoint establish completed DOC-D1…DOC-D5; do not rewind finished work or silently update the master. Section 8 below records this document's dated continuation boundary. Earlier execution notes/checklist are preserved as explicitly superseded history in section 9.

The product owner's newest explicit instruction overrides older project documents. This plan controls execution quality, not product scope. The old `funmarket/Kristou` repository is historical reference and is not current implementation or deployment evidence. The current product scope is KRISTOU SCHOOL only; agents must not introduce other schools, shared-school registries, or data spanning schools unless the owner explicitly changes the decision.

When present, read `docs/CONTINUATION_HANDOFF_2026-11-10.md` and `docs/SUPABASE_CONTINUATION_PLAN.md` as historical context, together with current dated evidence and the latest continuity handoff. Their old next actions, inventories, identifier policies and implementation phases do not supply current commands. `public/assets/aistudio/` planning copies are historical; no deletion, rename or publication is authorized here. Authority follows AGENTS.md: latest Owner instruction, requirements behavior, structure architecture, decisions, canonical data/write authority, execution discipline, current implementation facts and dated progress evidence.

## 2. Build loop for every task

### A. Understand and inspect

Before editing, state the exact outcome; confirm repo, branch, HEAD and fresh main/open-PR state; inspect uncommitted and overlapping work; read relevant authorities; identify product/UI/backend/data/infrastructure scope; and separate facts from assumptions. Emit the master's preflight fields: literal current command, exact target, main/work HEADs, worktree/PR overlap, environment and Owner-continuity evidence when relevant (otherwise NOT USED), allowed/forbidden actions, assumptions, material unknowns, unresolved contradictions and proceed/blocked decision. Keep the scoped task contract, before fingerprints, commands/results and final diff outside the repository during document packets.

Verify the accepted local documents and master against their recorded fingerprints. GitHub's older versions do not replace unpublished accepted candidates. If the workspace is missing, verify embedded snapshots in a separate non-repository review location and inspect fresh incoming source; never blindly restore over another writer.

Use evidence-first-execution, understand, superpowers and build-web-apps practices as relevant, with current Supabase/GitHub tools when needed. Discover actual capabilities; do not invent tool output or run unrelated design/browser work to claim tool use. Trace the actual source through every affected consumer:

```text
UI/state -> contract/transport -> verified identity -> server authorization
-> domain operation -> migration/constraint/RLS -> storage/outbox/realtime
-> deployment/runtime, only when in scope
```

Search for existing models, policies, functions, routes, components, environment variables, scripts, and tests. Do not edit until the source owner and smallest complete change are clear.

### B. Scope and implement

Solve one requested issue end-to-end within its explicit allowed targets/actions. Do not add speculative tables/features, unrelated cleanup, broad refactors, duplicate owners, or another contributor's work. Use narrow domain ownership and explicit application orchestration for cross-domain behavior. Test-first development is preferred when practical. Never weaken tests to force a pass.

Before a behavior change, freeze the owning operation and consumers, exact input/output/error shapes, decision gates, RED/GREEN and deny/concurrency assertions, protected regression, postconditions and stop rules. Observe a meaningful failing behavioral check where testable; then implement, run focused and neighboring checks, and prove relevant persistence/authorization/retry behavior. For prose, identify the initial conflicting passages and verify source/decision alignment, references, history and diff instead of inventing application tests.

Use the master's dependency register, not a second checklist here. All eight additions remain accepted; unknown school policy values stay in DG-01…DG-19 and block only dependent work. Preserve one write owner per fact and the providers needed by its consumers: People/Family/Enrollment/Academics before scoped school operations; approved session/assignment/substitute context before Attendance/Assessment writes; private Media/Audit/durable delivery primitives before their consumers. Teacher registers remain independent; same-teacher repeated-lesson granularity, grading formulas and historical audiences require their named gates. Calendar/RSVP/acknowledgement never becomes pupil Attendance or physical release.

Each feature packet must wire its real existing cards, menus, forms and affected consumers, with honest loading/empty/denied/error/conflict/offline/retry and durable readback. Preserve the master's 80-card coverage and nested-action checks (UI-01/UI-02, ADR-025); navigation, an Open label or local saved state is not completion. No production mock fallback, duplicate roster or backend-only dependency accumulation.

### C. Update documentation

Identify each affected authority; edit only those actually authorized by the packet:

- product behavior -> `requirements.md`;
- architecture/ownership -> `structure.md`;
- canonical data authority -> `docs/CANONICAL_MODEL.md`;
- durable architectural choice -> `docs/DECISIONS.md`;
- execution discipline -> `AGENTS.md` / this file;
- verified implementation evidence -> `progress.md`.

During this documentation pause, reconcile **one explicitly authorized document at a time**. Preserve the master and all completed local edits byte-for-byte. Do not automatically update `progress.md`, AGENTS.md or another authority; keep task evidence outside git and report discrepancies for their assigned document packets. A later implementation packet must include its necessary authority updates in the actual approved scope. If a safe complete change requires an out-of-scope authority edit, stop that dependent operation and explain the required scope rather than expanding it silently.

Do not create a second document competing with an existing authority.

### D. Verify and report

Run relevant checks and report the exact branch/HEAD or uncommitted fingerprint, files changed, docs updated, environment, commands, exit codes, actual passed/failed/skipped counts, evidence paths and limitations. Review the final diff and references; compare all protected fingerprints and HEAD with the starting state. Distinguish local, committed, pushed, merged, deployed and live-verified states. Preserve actual failures/unrun checks; an older run on another candidate is not a fresh pass.

A successful build is not evidence of secure authorization or deployed behavior. Source strings, mocked API success, RLS-present flags and in-memory schedules do not prove actual DB/API/storage access, ordinary row isolation or genuine two-session concurrency. Record the Owner's successful live login/non-impersonating oversight as valid manual evidence of that observed flow; neither erase it nor promote it to all-mutation or exact-candidate release acceptance. Do not automatically start the next task.

## 3. Non-drift rules

Do not guess missing product behavior; silently alter identity or architecture; create duplicate models/tables/routes/policies/auth state/API clients; mix unrelated domains in monolithic modules; use catch-all business `shared`, `common`, `utils`, or `management` modules; implement frontend-only authorization; hardcode secrets; patch production data directly; present mock or partial behavior as complete; or alter unrelated files because they look old.

PostgreSQL is durable business truth. Redis or another cache is transient only unless explicitly decided otherwise. Object storage owns bytes. Browser and Telegram WebView are contexts of the same product and canonical data.

## 4. Supabase safety gates

1. Continue existing `KRISTOUSCHOOL / ofppapwofhovhroyjtkc`. Before relevant operations inspect exact installed/source migration mapping, schema, grants/RLS and handler versions; inventory is not acceptance. No replacement database, second Owner bootstrap, account cleanup, blind db push/history repair or replay of installed repair SQL. Handle parity in its authorized scope; never redeploy protected Telegram handlers merely to make source/runtime match.
2. Use Supabase CLI local development and committed migrations as the schema source of truth. Avoid dashboard-only schema changes.
3. Follow AUTH-LOGIN-02: public login is username or email plus password; reject direct phone input before provider/resolver calls. Signup needs email or phone, with a valid chosen username required for phone without email. Keep provider phone credentials internally for server-side username resolution; username-only provisioning remains unsupported. Preserve Unicode/NFC handles, form/password handling, verification/approval separation and explicit Telegram linking; no custom password/session store or unverified alias promotion.
4. Before exposing any table/view/function/storage path, document access rules and explicitly inspect grants and RLS. Test allowed and denied operations with pgTAP and function/API tests.
5. Do not put service-role keys or database credentials in browser code. For any server-side RLS bypass, show why it is necessary and implement independent server-side identity/resource authorization and deny-case tests.
6. Prefer local synthetic data; never import child/family data into development fixtures.
7. Safety-critical pickup release must be staff-authorized, atomic, auditable, and distinct from parent arrival.
8. Keep local, staging, and production credentials/data isolated. Do not link, repair migration history, migrate, or deploy production without explicit owner authorization and a verified recovery plan.
9. Apply ADR-024 and the architecture/model contract-refresh gate to every authorized schema/RPC/function-contract change: inspect actual contracts and all callers; clean isolated replay; ordinary allowed/denied DB/API principals; one generated Supabase TypeScript type owner from the exact tested schema with generation command/fingerprint; update adapters, validators and every affected UI consumer. Detect absent columns/tables, renamed parameters, stale types and missing grants/exposure. Handwritten types/casts cannot justify fabricating schema or prove policy.
10. Verify constraints, transaction/retry/idempotency, current actor/resource scope and genuine concurrency where required. Caller revocation after waiting and last-Owner safety need real two-session acceptance; service-role/bypass-RLS runners cannot prove ordinary isolation. Private storage and realtime paths need their own audience, revocation/reconnect and failure checks.
11. Compatible backend dependencies precede dependent frontend release. Verify exact installed schema/functions and deployed frontend candidate, protected postconditions and rollback/forward-fix; no blanket deployment or activation permission follows from these gates. Restore rehearsals run in isolation with required database/object/configuration/identity dependencies and approved measurable objectives; database backup presence alone is not Storage-byte recovery. Optional queued Table Editor review (ADR-027) is not migrations, an outbox, business authorization or permission for row writes during this pause.

## 5. One-product topology gate

For changes to frontend entry, routing, auth transport, Telegram runtime, API transport, build, or deployment, verify that Browser and Telegram use the same canonical frontend and canonical backend/data authority; Telegram code is host/runtime adaptation only; no duplicate feature/state/API/asset owner is introduced; the selected build/deployment path is current; and the change follows move -> prove -> remove rather than copy -> hide -> retain.

## 6. Parallel work and repository safety

Keep this collaboration single-writer unless delegation is explicitly authorized or required by applicable instructions. Snapshot HEAD before work. Re-check before consequential writes or commits. If HEAD changes, stop and inspect the new diff; stop when overlap or ownership is unclear. Never force-push, hard-reset shared branches, overwrite another writer, commit directly to `main`, or merge without explicit approval. No long-lived integration branch is asserted yet; use the latest reviewed default branch for focused work until the owner approves a different workflow.

## 7. Completion standard

A task is complete only to the extent that source, tests, docs and runtime evidence prove for its exact scope. For database work, verify local migrations from a clean state, integrity constraints, RLS grants/policies, allow/deny tests, function authorization and secret boundaries. For UI work, preserve the approved logo/design/eight homes, Owner Teachers → Classes → Registration order, mobile-first AR/FR/EN and Light/Pitch Black; Arabic text must work within the stable LTR shell/navigation, without global mirroring. Verify applicable Browser/Telegram interactions, keyboard/touch/accessibility and loading/empty/denied/error/conflict/retry states at the actual candidate.

Feature maturity is separate: planned → UI/contract source → compatible installed backend → real isolated acceptance → staging → explicitly approved live acceptance. All existing/new feature consumers, release compatibility and meaningful domain deny cases remain gates. Production readiness additionally requires approved operational, recovery and measured performance evidence; no document check or provider status certifies it.

Keep existing accounts, approved Owner access, Telegram link and non-impersonating oversight (actual actor, banner and Return to My Home). Preserve the `09ffacf80daa4f546140053db441abb96c68ef8b` Telegram auth/link/challenge/re-entry/cache/session baseline. Later re-entry resolves the linked account without provisioning another account or issuing a Supabase Auth session; restored profile data is not direct RLS authority. Future private operations must verify current server identity/resource scope. The withdrawn Telegram lifecycle rewrite remains withdrawn; no protected-handler deployment during docs or GOV-01/AUTH-LOGIN-02.

Keep Pickup backend-blocked until its own isolated/staging safety acceptance and explicit activation. Only authorized staff physically verifies and releases; a parent arrival, attendance mark, calendar event, timer, AI or notification cannot release. A durable committed transition with delayed delivery stays committed; show delivery uncertainty and safe readback rather than fake rollback or duplicate release.

Record actual evidence in `progress.md` only when that file is authorized; during document packets preserve it and keep scoped evidence outside the repository. Stop on unexpected protected changes, wrong/stale target, unresolved overlap, missing prerequisite or failed relevant security acceptance. Do not guess school policy, weaken a test or change another domain to manufacture completion.

## 8. Current documentation checkpoint and continuation boundary — 2026-11-14

**CURRENT_COMMAND at this dated checkpoint: DOC-D6 — reconcile docs/LIVING_BUILD_PLAN.md only. Backend implementation is PAUSED.** This section records the authorized scope; it is not a new feature queue or standing authorization for later actions.

- Completed before this packet: DOC-M0 master revision 3 and DOC-D1 requirements, DOC-D2 structure, DOC-D3 canonical model, DOC-D4 decisions, DOC-D5 AGENTS.md. Five repository edits are local/uncommitted/unpublished; preserve them and the master byte-for-byte. Their earlier next-task paragraphs are dated checkpoints, not conflicting current commands.
- Fresh source checkpoint for DOC-D6: main `32067aa961620facffe4ff906c5598f68d27d6ff`; local `fix/gov01-source-database-parity@2dc828a66968246c76f325edfd603a4771c83555`; PR #15 open/draft/unmerged at `473d889c1b8e86bf71f88f66b67779f4c3502f8e`. Local HEAD and PR HEAD source trees match, but commit IDs differ and local document edits are additional. Recheck mutable state before later consequential actions.
- PR #15 overlaps this file and DOC-D1…D4. Later authorized publication/rebase/merge must inspect incoming hunks and preserve newest accepted contracts, not restore obsolete login/Attendance policies or the old queue. No PR modification or publication occurs in DOC-D6.
- Supabase/account/function/runtime state was not reverified by this document packet. Dated inventories and earlier test results retain their original environment and limits. Genuine ordinary RLS/concurrency acceptance, matching username-handler release and candidate-specific live governance verification remain unfinished; the Owner's manual login/oversight acceptance remains valid in its observed scope.
- Backend resumption requires an explicit Owner instruction after document reconciliation. Use the master's GOV-C1 closeout and prerequisite gates; GOV-02/F1-G3 delegation follows GOV-01 acceptance. Do not reopen Telegram, restart completed auth work or expand the corrective PR into all accepted school features. Subsequent feature dependencies and decision gates remain in the master, not another checklist here.

**Next proposed document: DOC-D7 — docs/SUPABASE_BACKEND_IMPLEMENTATION_PLAN.md only, upon explicit instruction. Do not start DOC-D7 automatically.** The master and other authorities are unchanged by DOC-D6; no code, SQL, accounts, configuration, commit, push, PR change/merge or deployment is included. Document review/checks do not implement or certify any planned connection.

## 9. Superseded execution history

The following exact earlier note and checklist are retained for provenance. **Every current/active-command label and unchecked action inside this history is superseded by the latest Owner scope and section 8 above.** Historical checkmarks describe earlier reported work, not fresh tests or implementation permission. Their original evidence limits remain; do not execute these as a second queue.

<details>
<summary>Historical November 13 freshness note — not current source status</summary>

**Execution freshness note (2026-11-13):** F0-R1 is isolated local Docker/Supabase reset + pgTAP, NOT source fixes or hosted migration. The newest AUTH-ID-01 work is occurring in Google AI Studio and must not be reported as GitHub implementation until actual changed files are published. No next packet is self-authorizing. Refer to the dated current-state checkpoint before using older continuation plans.

</details>

<details>
<summary>Historical November 14 closeout checklist — no longer an active queue</summary>

## 8. Active Owner-approved closeout checklist — 2026-11-14

This is the current repository execution queue. Earlier F0 ordering/status statements are historical. Complete source, database, consumers and verification together; do not accumulate unapplied backend dependencies. Maintain this checklist instead of creating competing queues.

**CURRENT_COMMAND:** GOV-01 / AUTH-LOGIN-02 post-push source reconciliation. Baseline main@32067aa961620facffe4ff906c5598f68d27d6ff. Work is on a focused review branch; no main commit or merge is included.

- [x] Owner published accumulated AI Studio changes; independently inspect exact commit.
- [x] Preserve username/email sign-in and username requirement for phone-without-email signup.
- [x] Verify Web loader queries account_status and fails closed.
- [x] Restore shared AppContext to the protected 09ffacf baseline; preserve Telegram sections/handlers.
- [x] Retrieve installed migration SQL read-only; recover missing canonical roles file and reconcile GOV-01 source to installed safeguards.
- [x] Independently run Node suite, typecheck and build; record precise evidence in progress.md.
- [x] Replay source migrations in isolated standalone PostgreSQL with a minimal Auth schema (limited substitute, not the Supabase reset gate).
- [ ] Complete Docker-backed Supabase reset and RLS pgTAP acceptance. Standalone mode bypasses RLS and cannot satisfy this gate.
- [ ] Run genuine two-session last-Owner and post-wait caller-revocation tests. Do not substitute in-memory scheduling.
- [ ] Review focused PR and merge only with explicit Owner approval.
- [ ] Verify production Web login and Owner governance workflow against deployed frontend revision.
- [ ] Close matching username-handler release: compare deployed v6 with tested source, deploy only that handler under its explicit release instruction, then verify username sign-in. Unicode schema is already installed; do not rerun it.
- [ ] Start GOV-02 only after GOV-01 acceptance: Owner-only audited narrow capability grant/revoke RPCs and existing delegation UI together.

**Standing Telegram instruction:** Do not reopen Telegram lifecycle enforcement or alter linking, challenge, handler, cache or session behavior during this cycle. Regression checks and restoring the agreed baseline are in scope; a new Telegram implementation or deployment requires a separate Owner instruction.

**Preservation:** Existing project, accounts, approved Owner and Telegram link remain. No second bootstrap, replacement database, account cleanup or unrelated UI work.

</details>
