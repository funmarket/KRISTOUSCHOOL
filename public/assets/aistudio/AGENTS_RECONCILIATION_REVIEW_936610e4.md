# AGENTS reconciliation — review proposal only

Not applied, not approved and not a replacement for either preserved original. No AGENTS execution is authorized by the requirements-only packet.

## Inspected inputs

- Accepted DOC-D5: `AGENTS_DOC_D5_ACCEPTED.md`, 16,198 bytes, SHA-256 `1bf715b55be6b9ac4102ada81beb8e807f28d3764f99fc8721c322c9ee00c19b`.
- Published `AGENTS.md` at main `f87f751cef265f95243c9e9eff2bc3b03fab5706`: 7,774 bytes, SHA-256 `5428b7caf7f3d56a4c6b049991f03de01eae5a445c80e104d9627a5634577a79`. Independently fetched from GitHub during this preparation.
- New candidate: `AGENTS_RECONCILIATION_PROPOSED.md`, 18084 bytes, SHA-256 `b1f285403c111d47e1148b096347f1fe2e4eebf83bd7aef406a289bd13e046ac`. **Its hash differs from both originals by design.**

## Proposed decisions for review

| Published addition | Proposal treatment |
|---|---|
| Read skills/evidence-first-execution/SKILL.md and run start-of-task environment proof | Added to DOC-D5 onboarding step 1; bash invocation avoids permission/mode changes. Actual missing tools must be reported, not invented. |
| If you cannot prove it, do not report it as done | Published sentence retained verbatim after the DOC-D5 onboarding gate. |
| run_logged.sh, evidence outside version control, exact commands/exits/counts and report template | Added to DOC-D5 verification paragraph, retaining DOC-D5's explicit external-evidence rule and one-document authorization. No scripts, project .evidence, modes, .gitignore or other authorities are changed merely to satisfy a convention. |
| Non-Git AI Studio reality (new adaptation, not a claim copied from published AGENTS) | Added to exact-state preflight: local branch/HEAD/index unavailable; workspace inventories prove local preservation; GitHub remote evidence remains separate. No Git initialization or fabricated HEAD. |

Five edit locations relative to accepted DOC-D5: proposal revision marker, onboarding item 1, proof sentence, non-Git preflight adaptation, verification/logging paragraph. The rest of DOC-D5 remains unchanged. This preserves its public username/email rule, phone-backed internal path, protected Telegram behavior, Owner/account continuity, one-document instruction, master identity, source hierarchy and security/release requirements. The published AGENTS' older public phone-login/multi-authority update wording is not reintroduced; it was not a new f87f751 change and conflicts with accepted DOC-D5/current Owner scope.

Dated DOC-D5 checkpoints are retained as historical text. The proposal does not pretend PR #15 is still pending today, nor refresh later documents. The newer main/merge state is recorded in the handoff manifest. Reviewing this proposal is separate from accepting it; an approved AGENTS-only packet must name its exact final bytes/hash after any requested review changes.

The previous Gemini reply reports a non-Git workspace and missing ZIP inputs. Those are agent-reported observations, not independently reproduced access to that session. Its report also acknowledges a transient workspace write and recursive deletion while calling the final state zero-mutation. New prompts require truthful disclosure of transient actions and prohibit recursive cleanup. The earlier delivered prompt's Living Build Plan hash is actually 64 hex characters and matches the attached original bytes; Gemini's reproduced shortened string is not adopted as authority.

## Complete diff: accepted DOC-D5 → proposal

``````diff
--- DOC_D5/AGENTS.md
+++ PROPOSED/AGENTS.md
@@ -2,7 +2,7 @@
 
 Status: **MANDATORY REPOSITORY INSTRUCTIONS**
 
-Revision: **2026-11-14 — DOC-D5**. This reconciliation changes `AGENTS.md` only. Backend implementation remains paused; document consistency is not implementation or production-readiness evidence.
+Revision: **2026-11-14 — DOC-D5 plus published evidence-first instructions: REVIEW PROPOSAL ONLY, NOT APPLIED**. This reconciliation changes `AGENTS.md` only. Backend implementation remains paused; document consistency is not implementation or production-readiness evidence.
 
 These rules apply to every developer, coding agent, automation, and delegated worker in `funmarket/KRISTOUSCHOOL`. The product is KRISTOU SCHOOL. The old `funmarket/Kristou` repository is read-only migration history; do not assume its branches, deployment, code, tests, or infrastructure are current here. This repository is only for one school: KRISTOU SCHOOL. Keep every feature, identity, and data relationship inside this school unless the product owner explicitly changes this decision.
 
@@ -10,14 +10,14 @@
 
 Before selecting an implementation task, editing files, creating a branch, delegating, committing, opening a pull request, or deploying:
 
-1. Read this entire `AGENTS.md`.
+1. Read this entire `AGENTS.md` and the published `skills/evidence-first-execution/SKILL.md`. Follow its start-of-task protocol; inspect and run `bash skills/evidence-first-execution/scripts/env_proof.sh` before claims or edits when available. If a required tool or script is unavailable, record the actual limitation and use a read-only equivalent where the Owner permits it; never invent output or install tools without authorization.
 2. Read the latest explicit Owner instruction and available continuity handoff, then the approved master revision 3 referenced below in full. Read `README.md`, `requirements.md`, `structure.md`, `docs/CANONICAL_MODEL.md`, `docs/DECISIONS.md`, `docs/LIVING_BUILD_PLAN.md`, `docs/SUPABASE_BACKEND_IMPLEMENTATION_PLAN.md`, and `progress.md` in full. Read the dated evidence checkpoint `docs/CURRENT_STATE_AND_HANDOFF_2026-11-13.md`, `docs/REMOTE_SCHEMA_INVENTORY.md` and relevant `docs/EDGE_FUNCTION_DEPLOYMENT.md`. Read the older `docs/CONTINUATION_HANDOFF_2026-11-10.md`, `docs/SUPABASE_CONTINUATION_PLAN.md` and `docs/TELEGRAM_VISITOR_LINKING_PLAN.md` as historical/subordinate context, and inspect the actual repository tree. Their old immediate-next-task, inventory and auth wording cannot override newer accepted decisions.
 3. Confirm the repository, branch, HEAD and fresh main/open-PR state. Inspect uncommitted and overlapping work. Verify local document candidates against the handoff fingerprints; GitHub's older documents are not substitutes for accepted unpublished edits. If a previous workspace is unavailable, verify embedded snapshots in a separate non-repository review location; never blindly overwrite current source.
 4. Distinguish accepted product requirements, architecture/data-authority contracts, proposed/ordered plans, and currently verified implementation facts.
 5. Trace the owning source and affected consumers. Search for existing tables, policies, functions, components, environment variables, tests, and docs before creating a parallel owner.
 6. Resolve any contradictions using the source-of-truth order below. If a material decision is unresolved, stop before implementing behavior that depends on it.
 
-A previous agent's summary, an old commit, a green build on another repository, or a plan checklist does not satisfy this gate.
+A previous agent's summary, an old commit, a green build on another repository, or a plan checklist does not satisfy this gate. Apply the Evidence-First Execution rule on every task: **if you cannot prove it, do not report it as done.**
 
 ### Approved master and documentation-transition checkpoint
 
@@ -67,9 +67,9 @@
 
 During the current documentation pause, reconcile **one explicitly authorized document at a time**. Preserve all other authorities and completed local edits byte-for-byte, including the master; do not automatically update `progress.md` or the master. Record task evidence outside the repository and report unresolved cross-document discrepancies for their assigned packets. In a later implementation packet, update only the authorities included in its actual authorization. If the behavior cannot be delivered safely without an out-of-scope authority change, stop that dependent change and explain the required scope; do not silently expand it.
 
-Before mutation, emit the master's exact-state preflight: literal current command, exact target, fresh main and work-branch HEAD, working-tree changes, open PR overlap, target environment/Owner-continuity evidence when relevant (otherwise NOT USED), allowed actions, forbidden targets, assumptions, material unknowns, unresolved contradictions and proceed/blocked decision. Keep a scoped task contract and baseline fingerprints outside the repository. Recheck final diff, references, protected-file fingerprints and HEAD before reporting; stop on unexpected changes, unresolved overlap, stale targets or a failed relevant security gate. Do not start the next packet automatically.
+Before mutation, emit the master's exact-state preflight: literal current command, exact target, fresh main and work-branch HEAD, working-tree changes, open PR overlap, target environment/Owner-continuity evidence when relevant (otherwise NOT USED), allowed actions, forbidden targets, assumptions, material unknowns, unresolved contradictions and proceed/blocked decision. Keep a scoped task contract and baseline fingerprints outside the repository. In a non-Git AI Studio workspace, record local branch/HEAD/index as UNAVAILABLE rather than creating Git metadata. Use actual workspace before/after bytes, modes and file inventories to prove local preservation. Verify remote commits/trees independently through GitHub when available; a remote commit is not proof of local workspace identity, and workspace hashes are not Git verification. Apply the Owner's explicit one-document scope and report unavailable Git checks without substituting invented results. Recheck final diff, references, protected-file fingerprints and HEAD before reporting; stop on unexpected changes, unresolved overlap, stale targets or a failed relevant security gate. Do not start the next packet automatically.
 
-Run relevant verification for the changed layer. Database work must include local migration/reset validation, pgTAP RLS policy tests for allow and deny cases, and function/API integration tests. Report exact commands and results; state explicitly what was not run. Never claim a remote migration, release, or deployment without fresh evidence.
+Run relevant verification for the changed layer using the published `skills/evidence-first-execution/scripts/run_logged.sh` where available, and use `skills/evidence-first-execution/references/report-template.md` to report exact commands, timestamps, exit codes, observed counts and proof paths, including failures, blocked and not-run checks. Keep evidence out of version control. During document-only work, retain this document's external-evidence requirement: inspect the logging script first and route its output outside project sources; if it writes a relative `.evidence/`, invoke it from the verified external evidence location with absolute script/command paths or use an equivalent external logger. Do not change scripts, modes, `.gitignore`, project configuration or extra authorities merely to satisfy a logging convention. Database work must include local migration/reset validation, pgTAP RLS policy tests for allow and deny cases, and function/API integration tests. Report exact commands and results; state explicitly what was not run. Never claim a remote migration, release, or deployment without fresh evidence.
 
 For prose, verify source/decision alignment, coverage, supersession, references and exact diff; application tests are not required merely to edit documentation. Separate planned behavior, source presence, installed objects, isolated tests, staging and live acceptance. Table/RPC presence, generated types, source guards, in-memory schedules and RLS-bypassing runners do not prove ordinary authorization or genuine concurrency. Preserve failures and unrun checks. Accept the Owner-reported working live login/oversight as manual evidence of that observed flow; it is not proof of every mutation or the unmerged candidate's exact live revision.
 
``````

## Complete diff: published AGENTS → proposal

``````diff
--- PUBLISHED/AGENTS.md
+++ PROPOSED/AGENTS.md
@@ -1,6 +1,8 @@
 # KRISTOU SCHOOL — AGENT AND CONTRIBUTOR RULES
 
 Status: **MANDATORY REPOSITORY INSTRUCTIONS**
+
+Revision: **2026-11-14 — DOC-D5 plus published evidence-first instructions: REVIEW PROPOSAL ONLY, NOT APPLIED**. This reconciliation changes `AGENTS.md` only. Backend implementation remains paused; document consistency is not implementation or production-readiness evidence.
 
 These rules apply to every developer, coding agent, automation, and delegated worker in `funmarket/KRISTOUSCHOOL`. The product is KRISTOU SCHOOL. The old `funmarket/Kristou` repository is read-only migration history; do not assume its branches, deployment, code, tests, or infrastructure are current here. This repository is only for one school: KRISTOU SCHOOL. Keep every feature, identity, and data relationship inside this school unless the product owner explicitly changes this decision.
 
@@ -8,14 +10,24 @@
 
 Before selecting an implementation task, editing files, creating a branch, delegating, committing, opening a pull request, or deploying:
 
-1. Read this entire `AGENTS.md` and `skills/evidence-first-execution/SKILL.md` (mandatory for every task; run its start-of-task protocol via `skills/evidence-first-execution/scripts/env_proof.sh` before making claims or edits).
-2. Read `README.md`, `requirements.md`, `structure.md`, `docs/CANONICAL_MODEL.md`, `docs/DECISIONS.md`, `docs/LIVING_BUILD_PLAN.md`, `docs/SUPABASE_BACKEND_IMPLEMENTATION_PLAN.md`, and `progress.md` in full. Read the dated evidence checkpoint `docs/CURRENT_STATE_AND_HANDOFF_2026-11-13.md` and other relevant documents under `docs/`, including the older `docs/CONTINUATION_HANDOFF_2026-11-10.md` and `docs/SUPABASE_CONTINUATION_PLAN.md` as historical context, and inspect the actual repository tree.
-3. Confirm the repository, branch, and HEAD. Inspect open changes and overlapping work.
+1. Read this entire `AGENTS.md` and the published `skills/evidence-first-execution/SKILL.md`. Follow its start-of-task protocol; inspect and run `bash skills/evidence-first-execution/scripts/env_proof.sh` before claims or edits when available. If a required tool or script is unavailable, record the actual limitation and use a read-only equivalent where the Owner permits it; never invent output or install tools without authorization.
+2. Read the latest explicit Owner instruction and available continuity handoff, then the approved master revision 3 referenced below in full. Read `README.md`, `requirements.md`, `structure.md`, `docs/CANONICAL_MODEL.md`, `docs/DECISIONS.md`, `docs/LIVING_BUILD_PLAN.md`, `docs/SUPABASE_BACKEND_IMPLEMENTATION_PLAN.md`, and `progress.md` in full. Read the dated evidence checkpoint `docs/CURRENT_STATE_AND_HANDOFF_2026-11-13.md`, `docs/REMOTE_SCHEMA_INVENTORY.md` and relevant `docs/EDGE_FUNCTION_DEPLOYMENT.md`. Read the older `docs/CONTINUATION_HANDOFF_2026-11-10.md`, `docs/SUPABASE_CONTINUATION_PLAN.md` and `docs/TELEGRAM_VISITOR_LINKING_PLAN.md` as historical/subordinate context, and inspect the actual repository tree. Their old immediate-next-task, inventory and auth wording cannot override newer accepted decisions.
+3. Confirm the repository, branch, HEAD and fresh main/open-PR state. Inspect uncommitted and overlapping work. Verify local document candidates against the handoff fingerprints; GitHub's older documents are not substitutes for accepted unpublished edits. If a previous workspace is unavailable, verify embedded snapshots in a separate non-repository review location; never blindly overwrite current source.
 4. Distinguish accepted product requirements, architecture/data-authority contracts, proposed/ordered plans, and currently verified implementation facts.
 5. Trace the owning source and affected consumers. Search for existing tables, policies, functions, components, environment variables, tests, and docs before creating a parallel owner.
 6. Resolve any contradictions using the source-of-truth order below. If a material decision is unresolved, stop before implementing behavior that depends on it.
 
 A previous agent's summary, an old commit, a green build on another repository, or a plan checklist does not satisfy this gate. Apply the Evidence-First Execution rule on every task: **if you cannot prove it, do not report it as done.**
+
+### Approved master and documentation-transition checkpoint
+
+The single consolidated roadmap is **KRISTOU SCHOOL Master Execution Plan, revision 3**, saved as `KRISTOU_MASTER_EXECUTION_PLAN(1).txt`: [approved master](https://chatgpt.com/library?file_id=libfile_0bc078a5456c81918d4ccb8bae5e37ce&account_id=4376f273-aee7-4c95-abef-35eea9d93180), SHA-256 `d0213cd47d3cbf94d749a7234a9ab29cc965448c0c39850f9d234978b053e3cd`. It is an external approved artifact, not yet a published repository master path. Use its complete embedded copy in the continuity handoff if needed and verify the fingerprint. Do not invent a repository location, create a rival roadmap or silently replace it with an older public planning asset.
+
+At this dated DOC-D5 checkpoint, master reconciliation DOC-M0 and the four document reconciliations DOC-D1 (`requirements.md`), DOC-D2 (`structure.md`), DOC-D3 (`docs/CANONICAL_MODEL.md`) and DOC-D4 (`docs/DECISIONS.md`) are completed locally. The four repository edits remain uncommitted/unpublished and must be preserved byte-for-byte during DOC-D5. The master retains its older DOC-M0/current-command and DOC-D1-next paragraphs verbatim; the later handoff and Owner instructions establish subsequent progress. Do not rewind completed work or silently edit the master to refresh its status.
+
+Other authorities remain pending their individual reconciliation. The old active queue in `docs/LIVING_BUILD_PLAN.md`, historical backend/continuation phases and `public/assets/aistudio/` copies supply neither a competing current queue nor permission to resume implementation. Preserve historical contents until their exact update/publication scope is authorized. DOC-D6 (`docs/LIVING_BUILD_PLAN.md`) is only the next proposed document, not automatically authorized by DOC-D5.
+
+PR #15 is the separate corrective GOV-01/AUTH-LOGIN-02 candidate, draft and unmerged at this checkpoint; recheck mutable state before later action. Its documentation overlaps the four accepted local edits. Any future authorized publication/rebase/merge must preserve their newer contracts and inspect incoming hunks. Backend resumption requires an explicit Owner instruction after document reconciliation; then use the master's GOV-C1 closeout scope, not a Telegram rewrite or all-features expansion of PR #15.
 
 ## 2. Source-of-truth order
 
@@ -30,7 +42,7 @@
 7. current repository code, database, and runtime as evidence of what is implemented—not permission to override a newer target rule;
 8. `progress.md` for verified implementation evidence only.
 
-The Supabase backend plan is an ordered proposal subordinate to the owner's instructions and accepted requirements. It is not proof of implementation or authorization to change product policy.
+The approved master consolidates task order/dependencies; it does not replace product, architecture or data authorities. `AGENTS.md` governs contributor behavior. The Supabase backend plan is a subordinate historical proposal during this transition, not another active queue, implementation proof or authorization to change product policy. Newer explicit Owner decisions override stale clauses until each authority is reconciled in its authorized packet; record the discrepancy without expanding scope.
 
 ## 3. Non-negotiable safety and quality rules
 
@@ -41,7 +53,9 @@
 - Do not put student, child, family, health, enrollment, or pickup data into public projections or production mock fixtures.
 - Pickup arrival and child release are distinct. Parents/authorized pickup actors may announce arrival; only authorized staff may confirm physical release through server-verified policy and an atomic state transition.
 - No heuristic identity merging. Never merge people by name, email, phone, username, or photo.
-- Preserve the approved Web email/phone/username-plus-password and Telegram WebApp login/linking policy. Custom username resolution remains server-side; no synthetic email aliases, browser-side contact lookup, or client-supplied role authorization.
+- Preserve AUTH-LOGIN-02: public sign-in accepts chosen username or email plus password; reject direct phone input before provider/resolver calls. Signup requires full name, password, requested role and email or phone; phone without email also requires a valid chosen username, while username is optional with email. Keep internal provider phone credentials for server-side phone-backed username resolution; username-only provisioning remains unsupported. Preserve Unicode/NFC normalization, valid Arabic/Latin/accented French and numeric-underscore handles, current form/password handling and approval separation. A typed secondary contact is not a verified Auth/recovery alias. No synthetic email aliases, browser-side contact lookup, or client-supplied role authorization.
+- Preserve Telegram auth/link/challenge/re-entry/cache/session behavior against `09ffacf80daa4f546140053db441abb96c68ef8b`. Linking is explicit, fresh signed initData is server-validated and the one-time challenge is claimed atomically. Established re-entry resolves the same linked account without creating an account or issuing a Supabase Auth session. A restored profile is not direct RLS authority; future private operations require verified current server identity and resource scope. The withdrawn lifecycle rewrite stays withdrawn; no protected-handler redeployment during documentation reconciliation or GOV-01/AUTH-LOGIN-02.
+- Preserve existing accounts, approved Owner access and Telegram link; no replacement database, second bootstrap or account cleanup. Role-workspace oversight changes presentation, not the actual actor or authority; retain its banner and Return to My Home. Preserve accepted UI/logo, eight homes, Owner Teachers → Classes → Registration ordering, mobile-first AR/FR/EN and stable LTR shell/navigation. All eight accepted additions remain in scope under the reconciled authorities; unresolved school policies are named decision gates, not permission to guess or reinstate old exclusions.
 - No secrets in source, browser bundles, examples, tests, logs, or screenshots. Use placeholders in `.env.example` and managed secrets for deployed functions.
 - All schema changes must be reversible/reviewable migrations committed to `supabase/migrations/`; do not make dashboard-only production schema changes.
 - Do not describe partial/demo behavior as secure, complete, tested, or deployed.
@@ -49,16 +63,26 @@
 
 ## 4. Change and verification discipline
 
-For each task, make the smallest complete change from authoritative source through affected consumers and tests. Use test-first development where useful. Do not weaken tests to make a change pass. Update all affected authorities in the same task: product behavior in `requirements.md`, architecture in `structure.md`, data authority in `docs/CANONICAL_MODEL.md`, decisions in `docs/DECISIONS.md`, method in `docs/LIVING_BUILD_PLAN.md`, and evidence in `progress.md`.
+For each task, make the smallest complete change within the Owner's actual authorized scope. For implementation, trace authoritative source through affected consumers and tests. Use test-first development where useful. Do not weaken tests to make a change pass. Identify affected authorities: product behavior in `requirements.md`, architecture in `structure.md`, data authority in `docs/CANONICAL_MODEL.md`, decisions in `docs/DECISIONS.md`, method in `docs/LIVING_BUILD_PLAN.md`, and evidence in `progress.md`. Identification is not permission to edit them all.
 
-Run relevant verification for the changed layer using `skills/evidence-first-execution/scripts/run_logged.sh` and record proofs under `.evidence/` (kept out of version control). Database work must include local migration/reset validation, pgTAP RLS policy tests for allow and deny cases, and function/API integration tests. Report exact commands, exit codes, observed counts, and results using `skills/evidence-first-execution/references/report-template.md`; state explicitly what was not run or blocked. Never claim a remote migration, release, or deployment without fresh evidence.
+During the current documentation pause, reconcile **one explicitly authorized document at a time**. Preserve all other authorities and completed local edits byte-for-byte, including the master; do not automatically update `progress.md` or the master. Record task evidence outside the repository and report unresolved cross-document discrepancies for their assigned packets. In a later implementation packet, update only the authorities included in its actual authorization. If the behavior cannot be delivered safely without an out-of-scope authority change, stop that dependent change and explain the required scope; do not silently expand it.
+
+Before mutation, emit the master's exact-state preflight: literal current command, exact target, fresh main and work-branch HEAD, working-tree changes, open PR overlap, target environment/Owner-continuity evidence when relevant (otherwise NOT USED), allowed actions, forbidden targets, assumptions, material unknowns, unresolved contradictions and proceed/blocked decision. Keep a scoped task contract and baseline fingerprints outside the repository. In a non-Git AI Studio workspace, record local branch/HEAD/index as UNAVAILABLE rather than creating Git metadata. Use actual workspace before/after bytes, modes and file inventories to prove local preservation. Verify remote commits/trees independently through GitHub when available; a remote commit is not proof of local workspace identity, and workspace hashes are not Git verification. Apply the Owner's explicit one-document scope and report unavailable Git checks without substituting invented results. Recheck final diff, references, protected-file fingerprints and HEAD before reporting; stop on unexpected changes, unresolved overlap, stale targets or a failed relevant security gate. Do not start the next packet automatically.
+
+Run relevant verification for the changed layer using the published `skills/evidence-first-execution/scripts/run_logged.sh` where available, and use `skills/evidence-first-execution/references/report-template.md` to report exact commands, timestamps, exit codes, observed counts and proof paths, including failures, blocked and not-run checks. Keep evidence out of version control. During document-only work, retain this document's external-evidence requirement: inspect the logging script first and route its output outside project sources; if it writes a relative `.evidence/`, invoke it from the verified external evidence location with absolute script/command paths or use an equivalent external logger. Do not change scripts, modes, `.gitignore`, project configuration or extra authorities merely to satisfy a logging convention. Database work must include local migration/reset validation, pgTAP RLS policy tests for allow and deny cases, and function/API integration tests. Report exact commands and results; state explicitly what was not run. Never claim a remote migration, release, or deployment without fresh evidence.
+
+For prose, verify source/decision alignment, coverage, supersession, references and exact diff; application tests are not required merely to edit documentation. Separate planned behavior, source presence, installed objects, isolated tests, staging and live acceptance. Table/RPC presence, generated types, source guards, in-memory schedules and RLS-bypassing runners do not prove ordinary authorization or genuine concurrency. Preserve failures and unrun checks. Accept the Owner-reported working live login/oversight as manual evidence of that observed flow; it is not proof of every mutation or the unmerged candidate's exact live revision.
+
+Use current evidence-first-execution, understand, superpowers and build-web-apps instructions for relevant work, with Supabase/GitHub capabilities when needed. Discover actual tools; do not invent results or use unavailable tooling as an uninvestigated excuse. For UI work, preserve accepted design and verify the applicable responsive/language/theme/host and interaction states; do not generate mockups or change components merely to demonstrate tool use during document work. Keep this collaboration single-writer unless delegation is explicitly authorized or required by applicable instructions.
 
 Before consequential writes, re-check HEAD and inspect incoming changes. Never force-push, reset a shared branch, overwrite another contributor, commit directly to `main`, or merge a pull request without explicit owner approval. Use a focused branch and repository contribution conventions. The current repository has no verified long-lived integration branch; create work from the latest reviewed default branch unless the owner establishes another workflow.
 
 ## 5. Backend and Supabase boundaries
 
-Supabase is the selected platform direction, not current implementation evidence. The intended source-controlled surface is `supabase/config.toml`, ordered migrations, seed data containing synthetic-only records, RLS tests, and separately scoped Edge Functions. Use Supabase CLI local development before linking a remote project. Keep schema/security behavior reproducible in migrations.
+Continue the existing Supabase project `KRISTOUSCHOOL / ofppapwofhovhroyjtkc`; provider selection and object presence are not acceptance evidence. The source-controlled surface includes `supabase/config.toml`, ordered migrations, synthetic-only seed data, RLS tests and scoped Edge Functions. Verify exact target, installed/source migration mapping, grants/RLS and deployed handler versions before relevant operations. Use clean isolated replay and ordinary allowed/denied principals before protected changes; never reset hosted data, blindly push/repair history or replay already-installed repair SQL. Keep schema/security behavior reproducible in migrations. Vercel is the observed frontend host, not deployment authorization; old Kristou Railway/Cloudflare configuration is historical.
 
 Edge Functions are server-side transport/orchestration boundaries, not cross-domain business authorities. Keep domain policy in small domain-owned application modules and database constraints/RLS. Use the caller's verified identity for ordinary user operations where the selected auth design permits it. Any use of a secret/service-role credential must be narrowly scoped, justified, and followed by explicit server-side authorization; RLS bypass is never a substitute for policy.
 
-The product-policy choice is settled: use Supabase Auth for Web email/phone credentials plus a server-side custom-username resolver, and validate/link Telegram WebApp identities explicitly to the same canonical user. Private school-domain access still requires its own RLS and deny-case gate.
+Supabase Auth owns provider credentials/sessions; public login and internal phone-backed resolution follow AUTH-LOGIN-02 above. Do not introduce custom password/session stores or another auth system. Private school-domain access still requires its own RLS and deny-case gate in each actual Browser/Telegram transport.
+
+Each authorized schema/RPC/function-contract change must follow ADR-024 and the reconciled architecture/model: inspect actual contracts and all callers, replay/test in isolation, generate one authoritative Supabase TypeScript type owner from the exact tested schema with command/fingerprint, and update affected adapters/validators/UI. Verify real API errors, denies and durable readback. Release compatible backend dependencies before dependent frontend and verify exact deployed versions/recovery path. Handwritten types or casts cannot justify creating absent tables. No such implementation, release or account action is authorized during this document pause.
``````
