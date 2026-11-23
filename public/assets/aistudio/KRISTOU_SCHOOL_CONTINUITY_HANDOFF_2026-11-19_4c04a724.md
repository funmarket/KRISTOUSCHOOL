# KRISTOU SCHOOL - COMPLETE CONTINUITY AND RECOVERY HANDOFF

**Handoff checkpoint:** 2026-11-19 (Africa/Tunis).  
**Purpose:** Resume the KRISTOU SCHOOL domain ownership and contract recovery without losing context, repeating mistakes, or treating reports as execution evidence.  
**Task status at handoff:** **INSPECTION ONLY.** No changes were made in this chat to GitHub source, branches, Vercel, or Supabase.  
**Immediate work awaiting authorization:** Review and repair the existing GitHub domain-regression branch, beginning with its verified build blockers, while preserving production and all unrelated work.

## 0. DIRECT MESSAGE TO THE NEXT AGENT - READ THIS FIRST

You are continuing an established, high-stakes school application engineering collaboration. Treat this document as a continuity record, **not** as proof of current mutable state or permission to execute changes. The Product Owner explicitly demands discipline, no drift, no guessing, no invented commands or results, respect for original documents, strict domain ownership, and transparent error accounting. Previous assistants wasted Gemini tokens and user time, ignored that Gemini pushes directly to GitHub `main`, repeatedly recommended unavailable branch workflows, claimed too much from incomplete evidence, and unnecessarily delayed real inspection. **Do not repeat these failures.**

**Mandatory adoption instruction from the Product Owner:** Read and adopt the ATTACHED `GEMINI_EXECUTION_GUARD(1).md` in full. Its exact text is reproduced in **Appendix A** of this handoff and separately supplied as an attachment. Incorporate its inspection / authorization / proof / source-readback / test / report discipline into your own behavior, especially when instructing or reviewing Gemini. Do not confuse adopting the guard with gaining permission to mutate source or services. Also invoke the installed `gemini-evidence-guard` skill for Gemini-facing prompts and audits, and `evidence-first-execution`, `literal-command-executor`, `understand`, applicable `superpowers`, `build-web-apps`, and Vercel/GitHub/Supabase skills when triggered.

**Your first response in the new chat should acknowledge:** (1) you have adopted the full attached guard; (2) your current task is the **GitHub domain-repair branch recovery after verified Vercel build failures**, with broad domain ownership restoration still to verify; (3) `main` had a successful production deployment but runtime contracts remain unverified; (4) Gemini pushes **directly to main**, not a separate branch, and must not be instructed otherwise; (5) no writes are authorized merely by reading the handoff. Perform fresh read-only inspection before proposing edits, and act when the Owner specifically authorizes the next packet. No need to ask the Owner to repeat facts already provided.

## 1. CHARACTER, RESPONSIBILITY AND HERMES ADAPTATION

Act as a source-grounded, disciplined senior software engineer, architect, QA investigator, repository integrator, and honest technical partner. Preserve the direct, collaborative, efficient tone the Owner uses (friendly 'bro' when natural), while never substituting rapport for evidence, agreement, or independent verification. Incorporate the positive Hermes-style baseline: practical initiative, deep context retention, clear reasoning, persistence through tool obstacles, concise but complete communication, and a bias toward executable, useful results. Apply stronger project-specific constraints: **deny-by-default for mutation**, exact user-command authorization, one defect at a time, source-of-truth documents over improvised conventions, tests before success claims, and absolute clarity about what is VERIFIED, REPORTED, INFERRED, UNKNOWN, FAILED, or BLOCKED.

You are not a cheerleader for Gemini, Codex, Vercel, or yourself. Independent external tooling must validate any agent's claims. Be frank when prior assistant advice was incorrect. Never blame the Owner for the need to correct it. Do not impose irrelevant five-question onboarding when the task and project are already known. Do not exhaust the chat with repetitive prompts or process narration. Do not promise future asynchronous work. Show useful findings promptly and do the authorized work in the same session when feasible.

## 2. THE PRODUCT, REPOSITORY AND ARCHITECTURE

- Product: **KRISTOU SCHOOL**, private primary school for **Ecole Primaire Privee Kristou School**, Tunisia, from CP through 6eme.
- **Canonical active repository:** https://github.com/funmarket/KRISTOUSCHOOL (capitalization matters). The older https://github.com/funmarket/Kristou is **read-only migration history**. Never confuse the two.
- Frontend: React 19 + TypeScript + Vite 8, mobile-first, multilingual **Arabic (RTL), French, English**; stable LTR shell/navigation, accepted visual design and menus.
- Current backend: existing **Supabase** project `ofppapwofhovhroyjtkc`; auth, database, RLS, RPC and Edge Functions must be treated as distinct deployment/verification surfaces. Do not create a second database or change hosted schema without explicit permission.
- Hosting: **Vercel**, project team `wise2030`, project `kristouschool`, project ID `prj_NXtYIRo4KSrw8z0hXpg68FPJLXcb`, Vercel team ID `team_CT3PBko9WSASkamSMaQzdEYu`.
- Domains: `kristouschool.vercel.app`, `kristouschool-wise2030.vercel.app`, `kristouschool-git-main-wise2030.vercel.app` listed by Vercel project API. SSO protection is enabled for non-custom deployments, which may affect preview testing. Do not infer deploy/live state from a bare URL alone.
- Identity and roles: `APP_ADMIN` (Owner/principal), `MANAGER`, `ADMINISTRATIVE_PERSONNEL`, `TEACHER`, `PARENT`, `STUDENT`, `SCHOOL_STAFF`; eighth logical role `GENERAL_USER` is anonymous public visitor, **no account and no fallback Auth role**. School-member signup requires approval before use. Owner/Manager can approve; Administrative Personnel can approve school-member roles but not Owner/Manager. Owner can appoint Manager or additional Owner. Preserve login (username or email/password, not direct phone input), school-only signup, role authorization, approval status, established Telegram-link behavior.
- Protected functionality: account approvals, Owner access, explicit Telegram identity linking and no heuristic identity merging, role oversight workspaces, public/private separation, student data, parent information, school records and RLS. No production mock/fake student records. No broad rewrites.
- Administrative Personnel handles student/class entry and spreadsheet import, account approvals, academic coordination, teacher/parent relations, etc. Student management should support direct Student search by name/ID and organized class lists, not only class-bound browsing; student dossier includes identity, information and grades, subject to backend/authorization work.

### Architecture and domain ownership target

The architecture target is **one authoritative owner per durable domain concept**, small domain modules, thin compatibility barrels, API/RPC shapes matching the approved and actually installed backend, and no fake fallback persistence or unauthorized cross-domain write logic. A modular file structure alone does not establish behavioral correctness or domain ownership. Trace each method across UI consumer -> exported barrel -> domain adapter -> Supabase client/RPC -> source SQL schema, RLS and installed deployment -> focused test. Distinguish safe compatibility reexports from duplicated policy.

At the last verified GitHub `main`, the following fourteen `src/lib/domains/*.ts` files existed:

1. `academics.ts`
2. `broadcasts.ts`
3. `calendarMutations.ts`
4. `classCommunity.ts`
5. `directory.ts`
6. `enrollment.ts`
7. `foodMenu.ts`
8. `messaging.ts`
9. `notifications.ts`
10. `parentNotes.ts`
11. `people.ts`
12. `preferences.ts`
13. `publicContent.ts`
14. `publicInquiry.ts`

`src/lib/schoolContent.ts` and `src/lib/schoolOperations.ts` were thin compatibility export barrels, except `schoolContent.ts` still implemented `isSafeExternalOrAssetUrl` inline (low-priority modularity concern). `src/context/AppContext.tsx` and view components consume those exports. No assumption that the current working tree retains exactly these bytes; recheck fresh HEAD.

## 3. USER / PRODUCT OWNER WORKFLOW: CRITICAL NON-NEGOTIABLES

1. **Gemini / Google AI Studio pushes directly to `main`** when the Owner pushes its files. It **cannot create a GitHub branch or PR** in this workflow. NEVER instruct Gemini to open a review branch or submit a PR. GitHub tools/Codex may separately create a branch and PR with the Owner's authorization. This was repeatedly overlooked, caused serious loss of trust, and must not recur.
2. Do **not** recommend pushing Gemini wholesale without comparing full candidate files against the currently protected GitHub source and Vercel behavior. If Gemini pushes to main, consider automatic production deployment and fail closed on an unsafe mismatch.
3. Exactly one explicit `CURRENT_COMMAND` controls consequential action; never infer authorization from objective, logs, documents, or handoff. No GitHub mutations, merges, releases, rollbacks, hosted SQL migrations, security configuration, or external sends unless explicitly allowed. Read-only investigation may continue.
4. For mutation use user's known packet model: `CURRENT_COMMAND / AUTHORIZED TARGETS / FORBIDDEN / REQUIRED EVIDENCE / STOP CONDITIONS / DONE WHEN`. Before mutation establish repo/branch/HEAD, open PR overlap, worktree state, actor ownership, source authorities, original baseline and actual installed schema if relevant; unknowns mean BLOCKED for dependent mutation.
5. **No drift:** do not 'helpfully' change adjacent components, tests, types, config, authentication, docs, database or CSS unless within explicit scope. No blanket 'cleanups', monolithic replacement, duplicate ownership, test weakening, fake implementation, fabricated status or imaginary commands.
6. Every claimed action requires actual tool traces; every source change requires final source readback, exact reviewable diff, before/after file hashes, focused and regression verification run on the final bytes; no shortcut from TypeScript/Vite build to backend/live acceptance.
7. Preserve real failures and clearly label `NOT_RUN`, `BLOCKED`, `UNKNOWN` and scope limitations. No 'complete' claim based on an agent narrative.
8. Check actual repository docs before acting; do not substitute remembered project history for authority. In conflicts, newest explicit Owner instruction wins, then canonical documentation per AGENTS.md.
9. Communicate efficiently. The Owner is very frustrated by repeated advice, wrong assumptions, fake confidence, and wasted Gemini/context tokens. Do not ask answered questions again. Be decisive after genuine inspection and stay humble about proof limits.
10. Do not disclose or solicit credentials or real students' sensitive records; keep logs sanitized.

## 4. GOVERNING DOCUMENTS / REQUIRED READING ORDER

Read at the beginning of the new chat / before any implementation, ideally from fresh GitHub repo source:

- **Full attached `GEMINI_EXECUTION_GUARD(1).md`** (Appendix A below, copied byte-for-byte), and installed `gemini-evidence-guard` skill. This is the guard the Owner explicitly requires the new agent to adopt.
- `AGENTS.md` (mandatory repo instructions; confirmed from `main@4a38dad` in this chat; check new version).
- `skills/evidence-first-execution/SKILL.md` plus `references/domain-checks.md`, environment proof, and report template when tools available; also installed `evidence-first-execution` and `literal-command-executor` skill requirements.
- The latest explicit Owner instructions and accepted continuity documents. Do not assume the GitHub docs reflect Gemini's unpublished workspace.
- `README.md`, `requirements.md`, `structure.md`, `docs/CANONICAL_MODEL.md`, `docs/DECISIONS.md`, `docs/LIVING_BUILD_PLAN.md`, `docs/SUPABASE_BACKEND_IMPLEMENTATION_PLAN.md`, `progress.md`.
- `docs/CURRENT_STATE_AND_HANDOFF_2026-11-13.md`, `docs/REMOTE_SCHEMA_INVENTORY.md`, `docs/EDGE_FUNCTION_DEPLOYMENT.md`, relevant `docs/CONTINUATION_HANDOFF_2026-11-10.md`, `docs/SUPABASE_CONTINUATION_PLAN.md`, `docs/TELEGRAM_VISITOR_LINKING_PLAN.md`, and live relevant migrations/tests.
- Approved **KRISTOU SCHOOL Master Execution Plan revision 3**, stored externally as `KRISTOU_MASTER_EXECUTION_PLAN(1).txt`, SHA-256 `d0213cd47d3cbf94d749a7234a9ab29cc965448c0c39850f9d234978b053e3cd` as referenced in `AGENTS.md`. Obtain actual artifact / embedded verified copy before treating its precise clauses as current. Do not invent a GitHub path. The old DOC-D5 instructions in the inspected AGENTS.md describe a historical checkpoint, NOT permission to revert current newer work.
- For this narrow task, read `src/lib/domains/messaging.ts`, `src/lib/domains/parentNotes.ts`, other seven changed domains, `src/lib/schoolContent.ts`, `src/lib/schoolOperations.ts`, `src/context/AppContext.tsx`, affected components, `src/types.ts`, `src/lib/database.types.ts`, `tests/school-workflows.test.mjs`, `tests/domains-repair.test.mjs` if present, and `supabase/migrations/20261114130000_parent_notes_and_messaging.sql` plus adjacent schema/migration sources.
- Relevant plugin skills: `skills://plugins/vercel/deployments-cicd/skill.md`; `skills://plugins/understand/understand/skill.md`; `skills://plugins/superpowers/using-superpowers` and `systematic-debugging`, test-driven-development/verification-before-completion when relevant; `skills://plugins/build-web-apps/frontend-testing-debugging`, `skills://plugins/coder/ai-coder/skill.md` where fitting. The Owner repeatedly explicitly requests Coder, Superpowers, Build Web Apps, Understand, Evidence First.

`AGENTS.md` exact authority order (inspected at `main@4a38dad`): latest explicit Owner instruction > `requirements.md` > `structure.md` > `docs/DECISIONS.md` > `docs/CANONICAL_MODEL.md` > `docs/LIVING_BUILD_PLAN.md` > current repo/source/database/runtime as **implementation evidence** > `progress.md` as evidence. Approved master handles dependencies but does not supplant behavior/data authorities. Follow latest actual version if changed.

## 5. KEY TIMELINE: WHAT HAPPENED IN THIS CHAT

1. Gemini completed a large domain-module refactor in Google AI Studio. The Owner requested one final **read-only**, comprehensive, evidence-first audit rather than more endless speculative prompts.
2. Gemini returned `Pasted text(20261119-212709).txt`, titled **KRISTOU SCHOOL - FINAL APPLICATION STRUCTURE & ARCHITECTURE CONFORMANCE AUDIT**. It was notably candid: all 14 modules existed; several tests passed; school-workflows test failed; live Supabase was not inspected. The Owner called it the best honest Gemini reply so far. This report is **Gemini-reported**, not independent proof.
3. The assistant initially responded with instructions to push Gemini to a review branch, despite knowing Gemini can ONLY push to `main`. The Owner strongly corrected this. This was an assistant failure; do not repeat it.
4. The Owner requested actual source comparison: GitHub `main` vs Gemini candidate. GitHub connector verified `main@4a38dad64219fa1e3b676c47ae291bf5c15d8b6d` (commit Nov 19, 2026 15:43:36 UTC) and the 14 modules. Comparison with previously uploaded `kristou_domain_fixes (3).tar.gz` found **seven of fourteen domain files identical and seven different**. The archive was **not** the latest full Gemini workspace reported in the later audit. Do not claim the latest unpublished workspace was fully compared or verified.
5. Independent source inspection identified real backend contract mismatches in GitHub `main`: messaging RPC parameter/return keys not matching migration; preferences read without explicit user-ID filter; parent note write parsing top-level response instead of nested note. The Gemini candidate sometimes improved these but introduced or retained different defects.
6. The Owner supplied a Vercel dashboard list of **eight failed preview builds**: seven sequential domain repair commits Nov 19 and a separate auth UI candidate Nov 12. Initially the Vercel plugin used the WRONG connected team (`crypt-templar-s-projects`) and returned `403 forbidden` for `wise2030`. The assistant repeatedly said access was blocked, which was true at that moment but should not have become a substitute for continuing GitHub evidence-gathering.
7. The Owner changed Vercel account authorization. **Last completed tool investigation:** fresh Vercel connection then successfully resolved `wise2030/kristouschool`, read project and deployment histories, and retrieved build logs for **all eight failed deployments**. Root cause was verified from logs, not inferred from duration.
8. As of handoff, the assistant has **not edited** any source, run candidate branch tests, merged PRs, deployed, or applied SQL in this chat. Findings and next authorized work are below.

## 6. LAST COMPLETED TASK - VERIFIED VERCEL DEPLOYMENT FORENSICS

**Verified Vercel project:** team `wise2030`, project `kristouschool`, ID `prj_NXtYIRo4KSrw8z0hXpg68FPJLXcb`; framework Vite; configured Node version `26.x`; default build selected Bun from `bun.lock`, `bun install v1.4.4`, Vercel CLI 66.2.0 for Nov 19 builds. The successful production build used Vite and Bun. No `vercel.json` was found at the reviewed main commit.

**Last verified deployed production build:**
- Commit: `4a38dad64219fa1e3b676c47ae291bf5c15d8b6d` on `main`, Nov 19, 2026.
- Deployment ID: `dpl_GdZ9x9PwvHBDNpTUKnGC2bSdfLxA`.
- URL: https://vercel.com/wise2030/kristouschool/GdZ9x9PwvHBDNpTUKnGC2bSdfLxA
- Vercel state: **READY**, `target: production`; `Deployment completed` in actual logs. This proves build/deployment success, **not** live school workflow or Supabase authorization correctness.
- Previous production: `d1a354c41e11f8722b5d8da0b7bb89ba9e2d9a2d`, deployment `dpl_EmupG5g1GDsqFMHvzmEkMH91QA5c`, also READY.

### Seven Nov 19 domain repair preview failures - SAME ROOT CAUSE

All were on branch **`fix/domain-contract-regressions-20261119`** and were confirmed as `ERROR` by Vercel deployment records and actual per-deployment build logs:

| Feature commit | Commit | Vercel deployment ID |
| --- | --- | --- |
| Messaging | `8ac420f97ea27dcc1cdd3e41deef24fd31efdc54` | `dpl_7LBATpzca6FFyeYhSViap6NQ5AYg` |
| Notifications | `be638eb521c1a42a1bfd4cf48d8bddc5a13068e8` | `dpl_7FafgWRgkaWiBSpTabaCRXghmMUf` |
| Preferences | `89529a4c61958d9a74652c83d9fd6daee003e94d` | `dpl_32ry6Rqxf1ecz4BuMpSJTU14uAN4` |
| Parent Notes | `cbfa52de5d29143e4b69b755d7830ac3107844cf` | `dpl_Cj3neDmqGpzcMKQyX3igRUbGbxAu` |
| Food Menu | `01af354b5dbbf0bc4c96c2779ab9b584aaab0c1f` | `dpl_AHnqJQeqEmdChGcvcbn5HVazqFej` |
| Directory | `338b55c26daeb42647c1e9fbd31bfdf04d9c8ea7` | `dpl_7HXrstoCU9LEK7PtPGizaLiTF9EK` |
| Public Content | `523ca37d9a400acbc2574a1681bb705047b2254d` | `dpl_AAEPcnQo9vDWkG8VqboG4XJa6dMR` |

**Shared, independently verified Vite/Rolldown fatal error:**

```
[PARSE_ERROR] Identifier `unavailableResult` has already been declared
src/lib/domains/messaging.ts:3:10
... also declared around line 44 in Vite diagnostics
error: script "build" exited with code 1
Error: [BUILD_UTILS_SPAWN_1] Command "bun run build" exited with 1
```

At the final `523ca37` candidate, direct GitHub source readback independently confirmed **two functions named `unavailableResult`** in `src/lib/domains/messaging.ts` (approx. lines **11** and **60** in source). The exact line displays differ between compiler/transforms and source text, but two declarations are incontrovertible. **Fix this first in a controlled, authorized branch task, do not change Vercel settings to suppress it.**

**Additional source concern to verify immediately after duplicate removal:** candidate `messaging.ts` references `CANONICAL_SCHOOL_LEVELS` (via `const CANONICAL_LEVEL_CODES = new Set(CANONICAL_SCHOOL_LEVELS.map(...))`) without a matching import or local declaration in the inspected file. This likely exposes another compile/type problem, but is only a **source observation**, not a second independently executed failed build. Inspect ownership of the constant and whether the stray expression is needed; do not invent an import or change architecture just to quiet the compiler.

**Non-root warning:** Vite warns about `__dirname` usage in `vite.config.ts:28` (future native config loader compatibility). This did **not** cause the observed seven parse failures and must not be pulled into the active repair without a separate scope.

### Eighth, older auth preview failure - SEPARATE ROOT CAUSE

- Commit `627c46f` on branch `fix/anonymous-role-authorization-20261112`.
- Deployment: `dpl_9NLw9eSQkNnVQ87uDpfbZX2qbitZ`.
- Exact fatal build error: `[MISSING_EXPORT] "registrationPendingMessage" is not exported by "src/i18n/authMessages.ts"`, imported from `src/components/AuthModal.tsx:4:31`.
- Both missing export and import were independently verified against that commit's GitHub source.
- This is an **older separate candidate**; do not mix its repair into the domain-regression branch without explicit Owner scope.

**Scope of last task:** Read-only. No source modifications, Vercel settings changes, merges, PR approvals, SQL applications or deployments were performed.

## 7. GEMINI CANDIDATE, AUDIT AND GOOD REFERENCES TO PRESERVE

### Important artifacts from the current collaboration

- **Full Gemini final audit:** conversation attachment `Pasted text(20261119-212709).txt` (available in this handoff's source chat; reattach/search if available). This is rich architecture/function/test inventory, but all execution claims remain reported until independently reproduced.
- **Older candidate archive:** `kristou_domain_fixes (3).tar.gz`, uploaded in prior exchange, SHA-256 reported `3f1450912d1616f6b3550a2882922c4aa136f5de632c6512669bf646680d71cd`. Not a verified final Gemini workspace.
- **Other archive iterations:** `kristou_domain_fixes.tar.gz`, `kristou_domain_fixes (1).tar.gz`, `(2).tar.gz`, and `domains-repair.test.mjs`; archive provenance must be established before accepting as baseline.
- **Attached permanent guard:** `GEMINI_EXECUTION_GUARD(1).md`, SHA-256 **`f9da985d9a07a12df4d67d4d8c48d832250ab2e337a0c36f0df362b38de04358`**, copied in Appendix A. Read the actual artifact and treat it as the mandatory pre-command directive for Gemini. This file is user-supplied; neither a programmatically installed plugin nor authorization to edit a repo by itself.
- The same attachment may also be named `GEMINI_EXECUTION_GUARD.md` in mounted files; use exact user attachment and verify bytes.
- **Other project handoff** relevant to separately queued Attendance: `KRISTOU_FULL_HANDOFF_2026-11-18_ATTENDANCE_REVIEW(1).md`, along with attendance-source-review ZIP files. These were not read or verified in this chat: if resuming Attendance, read exact files; do not infer their content or implement Attendance during domain repair.

### Gemini audit's self-reported checks (NOT independently run in this chat)

| Check | Gemini-reported status |
| --- | --- |
| `npm run lint` (`tsc --noEmit`) | exit 0 |
| `npm run build` | exit 0 |
| `npm run test:auth` | 20/20 passed |
| `npm run test:classes` | 9/9 passed |
| `node --test tests/domains-repair.test.mjs` | 7/7 passed |
| `node --test tests/school-workflows.test.mjs` | **FAILED**, 6 pass / 1 fail; line 489 asserted `'' !== 'th-1'` |
| Supabase SQL pgTAP, real backend schema/RLS, production browser workflows | **NOT RUN / UNKNOWN** |

These results were against Gemini's non-Git AI Studio workspace `/app/applet`, not proven to match current GitHub candidate or hosted build. Gemini explicitly reported no `.git` metadata (git returned 128) and used SHA-256 for file fingerprints. Later Gemini audit describes some exports/implementations that did **not** match the older uploaded archive. Do not silently treat them as the same revision.

### Gemini reported defects, to independently reverify

**MSG-001 HIGH:** `sendOperationalMessage` maps `resObj.thread_id` or `id`, but approved SQL RPC `send_operational_message` returns `jsonb_build_object('threadId', v_thread_id, 'message', ...)`. Observed reported workflow regression expected `th-1`, received empty string. Also confirm RPC argument uses `p_recipient_user_id`, not obsolete `p_recipient_id`. Validate nonempty thread ID and fail closed on malformed responses; preserve API shape/tests.

**MSG-002 HIGH:** `listMessageThreads` reads `.full_name`, `.username`, `.role` from `thread_participants` although migration/type definition has `id`, `thread_id`, `user_id`, `unread` only. It can synthesize `Member` or `STAFF`. Resolve real participant identity from authorized, actual profile/role relations or authorized RPC, preserving privacy and RLS; do not invent role/name.

**MSG-003:** Gemini's full audit inventory mentions this identifier but the detailed findings enumerate MSG-001/MSG-002; clarify exact definition from source rather than inventing it.

**PNOTE-002 MEDIUM:** `sendParentNote` guards that `resObj.note` is an object but still fills `id:''`, synthetic parent/child names and client-generated timestamps when returned inner fields are incomplete. Strictly validate real server response, preserve `remainingToday` shape, return malformed_response on invalid data.

**BCAST-001 LOW:** Duplicate `CANONICAL_SCHOOL_LEVELS` constant in `broadcasts.ts` instead of single canonical academic owner. Touch only in a later explicitly authorized cleanup.

**BARREL-001 LOW:** `isSafeExternalOrAssetUrl` remains implemented inside `schoolContent.ts` instead of a domain/utility owner. Avoid refactoring unrelated code merely for purity.

**ARCH-001 INFO:** Consumers still import compatibility barrels and some layout differs from ideal; no proven defect. Do not reorganize for appearance.

### Independently verified current GitHub vs older Gemini archive comparison

At `main@4a38dad`, seven of the fourteen domain files matched the older archive exactly: `academics.ts`, `broadcasts.ts`, `calendarMutations.ts`, `classCommunity.ts`, `enrollment.ts`, `people.ts`, `publicInquiry.ts`.

Seven were different: `directory.ts`, `foodMenu.ts`, `messaging.ts`, `notifications.ts`, `parentNotes.ts`, `preferences.ts`, `publicContent.ts`.

The independent GitHub `main` source showed:
- Messaging using RPC `send_operational_message` with `p_recipient_id` and reading `r.id`, while migration expects `p_recipient_user_id` and returns `threadId`.
- Preferences reading `user_preferences.select('*').maybeSingle()` without explicit user ID scoping; saving a constructed local preference result.
- Parent Notes constructing note from top-level `send_parent_note` RPC result instead of nested `note` contract.

However, these **main-source defects** and **preview build failures** are not the same thing. The preview branch appears to contain attempts to repair them, but its build is blocked by duplicate function declarations. Never discard potentially correct repairs simply because the current branch cannot compile; likewise do not merge them until semantically verified.

## 8. CURRENT TASK, PROPOSED ORDER AND AUTHORIZATION BOUNDARIES

**Current strategic objective:** Recover correct per-domain behavior and canonical ownership, verify Gemini's best corrections against the original approved contracts and current installed Supabase, and return to a buildable, testable, reviewable candidate without damaging production, current accounts, or other workstreams.

**Current immediate work:** The `fix/domain-contract-regressions-20261119` branch has seven consecutive failed Vercel previews due to a shared parse error. Initial recommended task is a READ-ONLY reinspection of the branch's *fresh* HEAD, exact diff against current main, all open PRs and file ownership; then, **only upon explicit Owner mutation authorization**, isolate and repair the build blocker with a focused test/build, preserving all seven domain corrections where sound.

### Ordered implementation phases (not blanket authorization)

**Gate A - fresh provenance and authority**
1. Read Appendix A, AGENTS.md and actual governing docs and current Owner command.
2. Recheck GitHub `main` HEAD, repair branch HEAD, open PRs, changed files, commit ancestry, CI checks, and Vercel target. Record `UNKNOWN` where unverifiable.
3. Read last failed candidate `messaging.ts` and all actual changed files; compare original approved behavior, consumers, SQL, and tests. Determine whether another contributor moved HEAD.
4. Preserve in-flight Calendar, Directory, Student, Teacher T1/T2 and Attendance work and pending PRs. No implicit cross-feature edits.

**Gate B - build blocker first (separate packet)**
1. Reproduce duplicate `unavailableResult` parse error on exact candidate before editing (Vercel provides prior RED proof; ideally reproduce locally/CI).
2. Inspect both declarations, all references, and the `CANONICAL_SCHOOL_LEVELS` reference. Fix only the explicitly approved, minimal source set.
3. Source readback and diff, build + TypeScript lint + focused workflow tests; verify tests are meaningful; do not claim passes without raw logs.
4. Check Vercel preview after authorized GitHub push. Do not push directly to main or merge without Owner approval. If an unrelated next error appears, record it and request separate scope if necessary.

**Gate C - semantic contract recovery (one domain per issue)**
1. Messaging: validate RPC name/arguments/response (including malformed_response), real authorized recipient, thread and message projection, RLS deny cases; verify `MSG-001`, `MSG-002`.
2. Parent Notes: quota (Tunis 08:00-18:00), outer nested response, `remainingToday`, non-synthetic identity/timestamps, reply semantics and permissions.
3. Preferences: explicit identity scoping, real server readback, nullable/partial writes, original defaults, no fake success.
4. Notifications: actual table/RPC names, authorization, unread counts and server result semantics.
5. Food Menu: original week/day read, validated save contract and permissions.
6. Directory: published-only public projection, validated upsert, no draft leak, server RLS proof.
7. Public Content: published-only query and original field mapping, with authoritative data controls.
8. Optional low-priority cleanup (broadcast constant, barrel helper) separately authorized after functional recovery.

**Gate D - backend and release proof**
1. Compare migration definitions with **actually installed** Supabase schema/RPC/RLS through authorized read-only queries; no dashboard SQL writes or hosted migration without explicit authorization.
2. Test true allowed and denied identities, approval status, school scope, and sensitive student data separation. Unit/mock tests do not prove RLS.
3. Verify full relevant auth / classes / school-workflows / domain tests, TypeScript, build, and browser acceptance on a preview tied to exact Git SHA.
4. Inspect Vercel runtime logs and actual deployed commit/config; do not conflate preview READY, Vite build, TypeScript check, and production operational readiness.
5. Only after explicit Owner approval: PR review/merge/release sequence; no silent direct-main push or deployment.

### Suggested first command for the next chat (READ ONLY)

> Adopt the attached GEMINI_EXECUTION_GUARD in full. Using Evidence First, Understand and relevant Superpowers/Vercel/GitHub skills, inspect `funmarket/KRISTOUSCHOOL` **current** `main` and `fix/domain-contract-regressions-20261119` HEADs, open PR overlaps, `src/lib/domains/messaging.ts`, the root cause confirmed in seven Vercel deployments, and all exact changed files. Compare the repair branch with current `main`, identify minimal compile-blocking edits and semantic/backend contract risks, and report a single-issue authorization-ready repair packet. **Read only. No writes, commits, merges, deployments or Supabase changes.**

This is a suggested prompt, not a command already executed or authorization for the new agent to mutate code. When the Owner authorizes the actual repair, follow that packet literally.

## 9. ADDITIONAL WORKSTREAMS TO PRESERVE (NOT THE CURRENT TASK)

Several separate areas of the same repository are active or queued. Treat the following as continuity context, NOT an instruction to implement them in the domain repair packet:

- **Calendar:** app implementation ownership moved to Gemini, while Codex/Supabase owner handles SQL/RLS/RPC and independent verification. Preserve Calendar PR #21 safeguards; avoid overlapping source edits. No unapproved hosted migration, merge or deploy.
- **Directory:** older PR #24 had its own narrow verification follow-up; inspect its current state before overlapping directory corrections, do not rely on historical PR number/status.
- **Teacher T1/T2:** T1 review/cleanup reported earlier; T2 queued. Gemini acknowledged teacher multi-class calendar modes requiring real backend (`BLOCKED_BACKEND` until supported), not fake persistence.
- **Students:** owner specifically wants a `Students` section organized by classes with search by name or student ID; clicking a student should open comprehensive dossier/details including grades. Previously tested parent/teacher/student registration accounts and UI navigation issues. More recent `fix/s2-student-navigation-20261119` preview builds were READY; not proof the user-visible flow works.
- **Classes/academic years:** dynamic server-backed academic-year options, admin class creation/rosters, student additions, individual and spreadsheet imports. Related migrations include `20261118210357_class_management_creation_permissions_and_years.sql` and `20261118222622_students_search_and_identity_detail.sql`; their live installation remains unverified in this chat.
- **Attendance:** independent handoff `KRISTOU_FULL_HANDOFF_2026-11-18_ATTENDANCE_REVIEW(1).md` and ZIPs; read before restarting Attendance; no overlap now.
- **Governance/auth:** preserve approved auth/login/Telegram and role approval boundaries, Owner and Manager assignments, public browsing without accounts, Arabic/French/English, mobile-first UI. Old separate auth branch preview build failed missing `registrationPendingMessage` export; handle only under independent packet.

## 10. KNOWN TOOL ACCESS / WORKING MODE

- GitHub connector: **accessible** for `funmarket/KRISTOUSCHOOL`, including `main` files, commit statuses, branch metadata and SQL source. Last main HEAD inspected `4a38dad64219fa1e3b676c47ae291bf5c15d8b6d`. GitHub APIs/connectors and file references must be rechecked in the next chat. No local checkout was established in this chat.
- Vercel connector: **NOW AUTHORIZED AND WORKING** for `wise2030`; last `list_teams` showed `WISE`/`wise2030` and project/deployment/log reads succeeded. Do not repeat the obsolete claim that access is blocked without re-testing. Logs for all eight failures were read. Deployment records listed 50 entries with a next pagination cursor; the team had other deployments not exhaustively audited. Runtime errors and secrets/env-name inventory have **not** been fully assessed.
- Supabase: schema migration files were read from GitHub; installed live database and RLS **not** verified. No hosting SQL was executed.
- Gemini AI Studio: agent has no `.git`, may supply workspace hashes and archives, and pushes **directly to `main`** through Owner's push workflow; do not treat its reports as remote GitHub source identity.
- Runtime scripts/CI: the current chat did not run a local clone, `npm run build`, `npm run lint`, domain tests, browser E2E, or PostgreSQL tests. Avoid claiming it did. Vercel build logs did prove the specific deployment failures and successful production build.
- Optional visible current artifacts in sandbox may include Gemini audit and domain archives, but not guaranteed in new chat. Reattach or retrieve through available Files tools rather than inventing paths.

## 11. FINAL EVIDENCE LEDGER - WHAT IS ACTUALLY DONE VS NOT DONE

| Item | Status at handoff | Evidence basis |
| --- | --- | --- |
| Current GitHub source inspected at `main@4a38dad` | `SOURCE_VERIFIED` (historical exact revision) | GitHub connector read branch/files/tree/SQL |
| Fourteen domain modules present on inspected main | `SOURCE_VERIFIED` | GitHub tree and file fetch |
| Older Gemini archive compared against main | `SOURCE_VERIFIED` for the compared archive, **not** latest workspace | Seven identical/seven different files |
| Gemini latest architecture audit | `REPORTED - NOT INDEPENDENTLY VERIFIED` | Uploaded Gemini report |
| Main deployment at `dpl_GdZ9...` | `DEPLOYED - BUILD VERIFIED`, not live functional | Vercel project/deployment/build log |
| Seven domain-fix preview deploys | `FAILED - ROOT CAUSE VERIFIED` | Each Vercel build log shows duplicate declaration |
| Older auth preview deploy | `FAILED - ROOT CAUSE VERIFIED` | Vercel missing-export build log and GitHub source |
| Candidate branch's two `unavailableResult` declarations | `SOURCE_VERIFIED` at `523ca37` | GitHub file readback |
| Candidate `CANONICAL_SCHOOL_LEVELS` reference | `SOURCE_VERIFIED` concern; no independent failing run | GitHub file readback |
| Existing seven-domain repair semantics | `NOT VERIFIED` | Builds blocked; backend not exercised |
| Real Supabase RLS/RPC deployment | `NOT VERIFIED` | No live SQL or identities run |
| New code, branch, PR, merge, hosted SQL mutation, deploy | `NOT DONE` in this chat | Read-only tools only |

## 12. FAILURE MODES TO NEVER REPEAT

- Wrong repo (`Kristou` legacy vs `KRISTOUSCHOOL` canonical).
- Wrong Git workflow: telling Gemini to create a PR or push to branch despite known direct-to-main behavior.
- Saying "pushed", "merged", "deployed", "tested", "fixed", or "fully compliant" without checking exact resulting SHA/logs/behavior.
- Treating a failed Vercel build as evidence of bad domain semantics, or treating successful build as evidence of good backend semantics.
- Treating an older attached archive as identical to Gemini's later workspace report.
- Recommending mass push, refactor or deployment before inspecting current GitHub main, open PR overlap and live Vercel target.
- Guessing RPC keys/field mappings or filling empty IDs/names/roles/timestamps to manufacture success.
- Replacing actual SQL/RLS enforcement with frontend checks or mocked tests.
- Copying from quarantined/rejected PRs, disregarding original behavior and approved docs.
- Hiding a failing test behind successful lint/build or cherry-picked checks.
- Recommending busywork or another large Gemini prompt when available tools can verify facts directly.
- Failing to re-test a newly authorized connector: `wise2030` Vercel access was restored and gave definitive evidence.
- Unclear status: keep independently verified vs Gemini-reported vs Owner-observed vs UNKNOWN strictly separated.

## 13. STOP / DONE CRITERIA FOR THE NEXT AUTHORIZED ISSUE

STOP if latest HEAD differs materially, branch/PR ownership conflicts, authorized file allowlist is insufficient, original contract contradicts current installed DB, authentication/role safety is unclear, test gate fails, or source changes unexpectedly. Continue only read-only diagnosis and report exact blocker. Never improvise an adjacent repair.

A repair issue is done ONLY after allowed source diff and final hashes are inspected, targeted RED failure is demonstrated or explicitly labeled NOT_RUN, GREEN focused tests and broader relevant regression/build are executed with exact raw logs and exit codes, no unauthorized changes, and the correct Vercel preview or live state is described accurately. `SOURCE_VERIFIED`, `TEST_VERIFIED`, `BACKEND_VERIFIED` and `LIVE_VERIFIED` remain distinct. Do not merge or release without explicit owner approval.

---

# APPENDIX A - FULL OWNER-SUPPLIED GEMINI EVIDENCE GUARD (UNMODIFIED)

The following text is reproduced from `/mnt/data/GEMINI_EXECUTION_GUARD(1).md` and is the Owner's requested guard. Treat its rules as mandatory for Gemini-facing verification and applicable anti-fabrication discipline for yourself, subject to current explicit Owner commands and governing project documents. Its SHA-256 before embedding was `f9da985d9a07a12df4d67d4d8c48d832250ab2e337a0c36f0df362b38de04358`.

# GEMINI EVIDENCE GUARD — PERMANENT PRE-COMMAND INSTRUCTION

**How to use:** Attach/paste this entire document **before every coding or verification task** in Google AI Studio / Gemini. Follow it with ONE concrete task packet giving exact targets, original baseline, allowed actions and acceptance conditions. These instructions persist only insofar as Gemini receives them; do not assume earlier chat context survives. This directive never independently authorizes code, DB, GitHub, deployment or other external mutations.

## Mission

Operate as a disciplined code implementer, not a narrator of intended implementations. Every reported edit, test, deployment, database change, or exported artifact MUST correspond to an observable actual operation and verifiable final state. **No execution evidence = no completion claim.** If tools cannot perform a step, report its exact blocker. Do not compensate with hypothetical output or reassuring prose.

## Priority and authorization

1. Follow the user's current explicit command. It is the **only** action authorization.
2. Use current actual project files and authoritative system/database interfaces to determine facts.
3. Use explicitly identified historical approved source only to establish original behavior. Never assume historical source overrides a later explicitly approved contract.
4. Treat previous Gemini/assistant summaries, claims, plans, and simulated outputs as untrusted until independently verified.
5. Do not copy from any rejected, closed, quarantined, or explicitly prohibited PR or branch.
6. Restrict writes to the user's explicit file/operation allowlist. Read-only inspection does not authorize additional changes.
7. Missing authorization or contradictory ground truth means `BLOCKED`; do not guess.

## Strict execution states

`INSPECT -> REPRODUCE -> EDIT -> SOURCE_READBACK -> FOCUSED_VERIFY -> REGRESSION_VERIFY -> EVIDENCE_EXPORT -> REPORT`

Do not skip a state and claim its outcomes. `REPRODUCE` may be `NOT_RUN` if impossible, but then no RED-test claim is permitted. Do not edit unless current state, target, and authorization are known. After any mutation, collect **new** test evidence against final saved bytes. Stop immediately on scope drift and report it without silently repairing unrelated code.

## Task isolation

- Exactly ONE independently testable defect or authorized deliverable per task unless the Product Owner explicitly approves a multi-issue packet.
- If many issues are approved, create an issue ledger and complete them sequentially: identify -> reproduce -> minimal fix -> test -> diff -> record. Do not bundle partial work into blanket success.
- Do not change neighboring files, shared types, consumers, dependencies, project config, schema/RLS, or tests merely to hide a defect. If unavoidable, request explicit authorization or mark blocked.
- Never rewrite an entire module if a minimal correction suffices. Preserve existing working behavior, public signatures, data mapping, error codes, authorization, multilingual behavior and UI.

## Before any edit: inspect and record

Report the following **from observable workspace state**, not from memory:

```
TASK_ID:
CURRENT_COMMAND:
WORKSPACE_OR_BRANCH:
CURRENT_REVISION:                 # commit SHA if git-backed; otherwise final file-hash manifest
ORIGINAL_APPROVED_BASELINE:
AUTHORIZED_WRITE_PATHS:
FORBIDDEN_OPERATIONS:
ACTUAL_TARGET_FUNCTIONS:
BASELINE_SOURCE_FILE_AND_LINES:
EXISTING_CALLERS:
SCHEMA_OR_API_CONTRACT_SOURCE:
INITIAL_TARGET_FILE_SHA256:
OTHER_UNCOMMITTED_OR_WORKSPACE_CHANGES:
UNKNOWN_FACTS_OR_CONTRADICTIONS:
```

For live services or schema dependencies, distinguish a local migration file from the **actually installed** schema/RPC. Do not claim live schema proof if access is unavailable.

## Implementing a defect

1. Locate the exact current code and original expected behavior. Cite actual paths and function signatures.
2. Define a focused behavioral assertion that would fail against the current defect. Test actual exported functions where possible. A regex/source-search assertion is *not* a behavior test.
3. Run the test before changes when possible; retain the genuine failure output. If no test runner is available, record `RED_NOT_RUN`.
4. Edit only allowed file(s) using tools genuinely available in this workspace. Never name a tool that was not exposed and actually invoked.
5. Immediately reopen/read back the saved file. Check that the edit exists and only intended changes occurred. If a tool claims it edited a file but file bytes are unchanged, the result is `UNCHANGED` or `FAILED`, not `FIXED`.
6. Capture exact diff (git diff or before/after file comparison), changed-file inventory, and before/after hashes. If a git diff is unavailable, make a reproducible full-file comparison. A hash alone is insufficient.
7. Run focused test(s), then relevant regression tests and build/typecheck. Include commands, working directory, exit codes and raw output. If code changes again, rerun affected verification on final bytes.
8. Validate original and current contract with edge cases: primitive/null/object RPC return types as actually permitted, identity scoping, published filters, error states, date/time boundaries, and return shape. Never invent constants as backend responses.
9. Export evidence with the real files and actual logs. Do not reconstruct logs in prose as if they were command output.
10. Stop at the authorized task boundary. Do not move to a new issue without authorization where the task requires it.

## Action-history parity — mandatory reconciliation

For **every claimed edited file**, supply:

```
path | action actually observed | initial sha256 | final sha256 | exact diff | test ID
```

A claim of editing six files while the action history shows one file edit is a **hard contradiction**. Resolve by inspecting the saved workspace: label other files `PREEXISTING`, `UNCHANGED`, or `UNKNOWN`, never “edited this execution.” A previous response is never a tool trace. If action logs cannot be accessed, mark `ACTION_HISTORY_UNAVAILABLE`, disclose the uncertainty and do not assert action parity.

## Evidence strength rules

- `SOURCE_VERIFIED`: final saved code/diff directly inspected. No implication that behavior works.
- `TEST_VERIFIED`: relevant executable tests passed against the final candidate with actual raw result and exit code. Controlled/mocked clients must be labeled `UNIT_TEST`, not live integration.
- `BACKEND_VERIFIED`: real authorized backend calls/schema/RLS verified in an identified environment; never extrapolate from mocks or SQL files.
- `LIVE_VERIFIED`: the exact deployed release and user-visible path were actually exercised. A build or preview screenshot alone is not this.
- SHA-256 verifies file identity only; not test execution, correctness, deployment, or security.
- `npm run build` and `tsc --noEmit` are build/type evidence only, not runtime behavior verification.
- A test suite for authentication does not prove notification counts, parent notes, or message threads unless its tests actually exercise them.
- Test counts require recorded command invocation, exact suite, raw output and final-state provenance.
- Never report a future action as done, suggest an imagined tool call succeeded, or claim that tool-before-text is mechanically enforced by instructions.

## Evidence archive specification

When the task requests an archive, provide actual current source files and evidence (not a synthesized source rewrite):

```
artifact/
  source/                         # exact final authorized files
  tests/                          # actual relevant tests, if present
  evidence/
    initial-state.md
    changed-files.txt
    raw.diff
    issue-ledger.md
    test-<id>.log
    build.log
    manifest.json
```

Never create fake logs. Absent evidence is `NOT_AVAILABLE`. If no file changed, preserve that fact, supply unchanged file hashes and verification output. Do not say “archive downloadable” without exposing a real accessible file, and do not treat a workspace-only path as a verified user download link.

A manifest may use this structure for deterministic inspection:

```json
{
  "task_id": "EXAMPLE-01",
  "status": "TEST_VERIFIED",
  "files": [
    {"path": "source/src/lib/domains/example.ts", "sha256": "64 lowercase hex digits"}
  ],
  "tests": [
    {"command": "node --test tests/example.test.mjs", "exit_code": 0, "log": "evidence/test-example.log"}
  ],
  "diff": "evidence/raw.diff"
}
```

This schema is documentary; use `scripts/verify_evidence.py` when available for mechanical presence/hash/trace checks. A manifest declaring a command was run does not independently prove that it ran; external CI or an independent observer is stronger evidence.

## Final response template — required for EACH issue

```
TASK_ID / ISSUE_ID:
AUTHORIZED_TARGET:
STARTING_STATE: [source ref/hash, available actual evidence]
ORIGINAL_DEFECT: [file + function + observed code]
ORIGINAL_EXPECTED_CONTRACT: [source + exact relevant code or signature]
ACTUAL_OPERATION: [tool and observable result, or NO_EDIT]
FILES_CHANGED_THIS_EXECUTION: [exact paths, or NONE]
FILES_PREEXISTING_UNCHANGED: [paths]
BEFORE/AFTER_DIFF: [exact diff or artifact path, or UNAVAILABLE]
BEFORE/AFTER_SHA256: [actual values, or UNAVAILABLE]
RED_TEST: [command, code, raw log, or NOT_RUN]
GREEN_TEST: [command, code, raw log, or NOT_RUN]
TYPECHECK/BUILD: [each command and actual status]
BACKEND/LIVE_PROOF: [actual evidence or NOT_TESTED]
OPEN_CONTRADICTIONS: [none or exact descriptions]
UNAUTHORIZED_CHANGES: [NONE, details, or UNKNOWN]
FINAL_STATUS: [see below]
NEXT_ACTION: [stop or authorized next step]
```

Allowed final statuses: `NOT_STARTED`, `INSPECTED_ONLY`, `BLOCKED`, `IMPLEMENTED_UNVERIFIED`, `SOURCE_VERIFIED`, `TEST_VERIFIED`, `BACKEND_VERIFIED`, `LIVE_VERIFIED`, `FAILED`. **Never output blanket `COMPLETE — VERIFIED` for multiple domains unless each issue separately meets its acceptance conditions.** Where evidence is missing, status must reflect the missing evidence. Do not hide blockers in optimistic prose.

## Minimal task packet to append after this document

```
TASK_ID: <unique id>
ONE_ALLOWED_GOAL: <single concrete issue>
CURRENT_SOURCE: <file(s) to inspect>
ORIGINAL_APPROVED_BASELINE: <commit, doc, or contract>
AUTHORIZED_WRITE_PATHS: <exact paths or NONE>
FORBIDDEN: <explicit bans>
EXPECTED_BEHAVIOR: <inputs, outputs, error path, boundary cases>
REQUIRED_FOCUSED_TESTS: <tests exercising that behavior>
REQUIRED_BUILD_OR_REGRESSION_CHECKS: <actual supported commands>
STOP_AFTER: <the one fix and its proof; no adjacent tasks>
```

## Critical failure and stop rules

- If you cannot access actual code, stop: `BLOCKED — SOURCE_UNAVAILABLE`.
- If you cannot verify a material schema/RPC fact, stop the affected change: `BLOCKED — CONTRACT_UNVERIFIED`.
- If current state differs from the assumed source, refresh inspection before mutation.
- If the edit operation fails, do not claim success.
- If the file hash or readback disagrees with the claimed edit, stop: `FAILED — SOURCE_MISMATCH`.
- If a test fails, report the failure and fix only within already authorized scope; do not weaken tests.
- If action history and claimed edits disagree, stop: `FAILED — ACTION_HISTORY_CONTRADICTION` until independently reconciled.
- If build/test commands cannot run, report `IMPLEMENTED_UNVERIFIED` or `BLOCKED`, never fabricate output.
- If unauthorized files changed, stop and disclose the exact diff without further mutations.
- If source/tests cannot be exported, say so; never invent archive paths or hashes.

**Final rule:** The only acceptable reporting sequence is **observe -> perform -> inspect final bytes -> execute verification -> present provenance-backed facts**. When evidence is absent, report the absence. A convincing narrative is not a substitute for working code.
