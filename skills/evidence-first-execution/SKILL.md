---
name: evidence-first-execution
description: Mandatory evidence-first execution discipline for KRISTOU SCHOOL. Prevents fabricated pass claims, stale verification, and scope drift. Use at the start and end of every task.
---

# Evidence-First Execution

This skill exists because agents fail in one predictable way: they report the *appearance* of work instead of the work. Tests "pass" that never ran. Fixes are "applied" that were only planned. Migrations are "deployed" that were only written. Each false claim looks small, but the person relying on the report builds on top of it, and the damage compounds.

The rule that governs everything below:

> **If you cannot prove it, do not report it as done.**

This skill supplements the project's own rules (architecture, roles, safety limits, acceptance criteria in `AGENTS.md` and `docs/LIVING_BUILD_PLAN.md`). It never replaces or relaxes them. Where the two conflict, the stricter rule wins.

## How to use this skill

1. Read this file fully at the start of the task.
2. Do the **Start-of-task protocol** (section 2) before claiming anything about what is or is not possible.
3. Work through the **Execution loop** (section 3), using the scripts in `scripts/` to capture real evidence.
4. Re-run the **Drift check** (section 8) at every milestone and before any final report.
5. Write the final report using `references/report-template.md`.
6. Read `references/domain-checks.md` when the work touches databases, authorization, frontend/browser behavior, APIs, CI/deploy, or third-party integrations.

---

## 1. What counts as pretending (all prohibited)

Do not:

- Claim a test passed when you did not run it, or ran something different.
- Invent test counts, commands, logs, exit codes, screenshots, commit SHAs, URLs, or deployment results.
- Report implementation when you only read code.
- Report a fix when you only wrote a plan, a diff you did not apply, or SQL you did not execute.
- Report a migration as applied because the SQL file exists.
- Claim production success from local files or from another agent's report.
- Claim something works without running a verification check after your **last** edit.
- Reuse pre-edit test results, stale logs, or another branch's passing CI as proof for current code.
- Claim baseline parity without actually comparing the files/sections byte-for-byte or statement-by-statement.
- Present standalone/mocked/bypassed execution (for example, Postgres with RLS bypassed or in-memory concurrency tests) as proof of RLS isolation, Docker-backed reset, or multi-session database locking.
- Hide missing tools, skipped checks, or failed assertions behind vague phrasing like "looks good" or "verified".

---

## 2. Start-of-task protocol

Before selecting implementation steps, editing code, or claiming what is possible or blocked:

1. **Inspect the workspace and environment first** by running:
   ```bash
   bash skills/evidence-first-execution/scripts/env_proof.sh
   ```
   Confirm current working directory, git status/branch/HEAD (or explicitly record if `.git` is absent), available runtimes (`node`, `npm`, `tsx`, `python3`), and database/container tools (`docker`, `psql`, `supabase`).
2. **Read governing project authorities** per `AGENTS.md` Section 1 (`AGENTS.md`, `requirements.md`, `structure.md`, `docs/CANONICAL_MODEL.md`, `docs/DECISIONS.md`, `docs/LIVING_BUILD_PLAN.md`, `progress.md`, and relevant `docs/`).
3. **Initialize `.evidence/TASK_CONTRACT.md`** stating:
   - Exact requested outcome and authorized scope.
   - Protected / out-of-bounds areas (e.g., protected Telegram flow, no unauthorized hosted mutations, no GitHub push/merge without approval).
   - Required acceptance checks before completion.
   - Known environment constraints observed by `env_proof.sh` (never guessed).
4. **Separate verified facts from claims** in existing docs/reports before acting on them.

---

## 3. Execution loop

For every task or sub-task:

1. **Trace the owning source**: Identify the authoritative file(s), schema, function(s), UI consumers, translations, and tests before editing.
2. **Establish a baseline / red check when fixing bugs**: Run the failing check or baseline suite first via `scripts/run_logged.sh` so you observe the baseline state directly.
3. **Implement the smallest complete change**: Edit only authorized files from authoritative source through affected consumers, tests, and docs.
4. **Verify after the final edit**: Every code or SQL change requires fresh post-edit verification executed through:
   ```bash
   bash skills/evidence-first-execution/scripts/run_logged.sh <label> <command...>
   ```
5. **Record evidence in `.evidence/ledger.tsv`**: Verify every executed check has an exit code, timestamp, exact command, and log path under `.evidence/logs/`.
6. **Reconcile project authorities**: Update affected documentation (`requirements.md`, `structure.md`, `docs/CANONICAL_MODEL.md`, `docs/DECISIONS.md`, `docs/LIVING_BUILD_PLAN.md`, `progress.md`) in the same task when behavior, architecture, or verified evidence changes.

---

## 4. Proof standards

Every verification claim in your final report or `progress.md` must cite:

- **Exact command** run (verbatim).
- **Exit code** observed.
- **Exact output counts** (e.g., `49 passed, 0 failed`, not "all tests passed").
- **Scope and limitations** (e.g., standalone PostgreSQL without RLS vs Docker Supabase stack; synthetic unit test vs live browser/Supabase sign-in).
- **Log file path** under `.evidence/logs/`.

Never extrapolate:
- Unit test pass != integration pass.
- `tsc --noEmit` + `vite build` != runtime/browser UI acceptance.
- Local migration SQL file != applied hosted migration.
- Standalone SQL execution as superuser != RLS enforcement proof.

---

## 5. Final reporting & status vocabulary

Always structure final reports according to `references/report-template.md` and use only these exact status labels:

- **`COMPLETE — VERIFIED`**: Every authorized requirement was implemented and verified directly with passing post-edit checks; no unverified gaps remain within scope.
- **`PARTIALLY IMPLEMENTED`**: Some authorized changes or checks succeeded, while others remain incomplete or unverified; exact remaining items are listed.
- **`PREPARED — NOT VERIFIED`**: Artifacts (such as migrations or plans) were written/reconciled, but target runtime/database verification could not run.
- **`BLOCKED`**: Progress on the gate stopped due to a missing dependency, missing tool (e.g., Docker unavailable), or missing owner authorization, with exact failing command/exit code recorded.
- **`FAILED`**: A check or implementation failed and remains unresolved.
- **`NOT RUN`**: Explicitly list checks that were not executed rather than omitting them.

---

## 6. Domain-specific checks

Before claiming completion in any specialized layer, execute the relevant checklist in `references/domain-checks.md`:
- Database, Migrations & RLS
- Authorization & Identity
- Frontend, Browser & UI (including RTL, `ar`/`fr`/`en`, and denied/error states)
- APIs & Edge Functions
- Deployment, CI & Third-Party Integrations (including KRISTOU SCHOOL Telegram boundaries)

---

## 7. Delegated work & external summaries

If referencing work from an earlier session, another branch, a sub-agent, or a tool summary:
- Treat it as a hypothesis until you inspect the actual files on disk and re-run verification yourself in the current workspace.
- Never copy old test numbers into a new report after files have changed.

---

## 8. Drift check

Run a drift check at every milestone and before writing your final report:

1. **Scope check**: Did you touch any file outside the authorized scope? Did you preserve protected Telegram linking/auth/challenge/cache/session code and existing `AUTH-ID-01` / `AUTH-LOGIN-02` / `GOV-01` safeguards?
2. **Evidence freshness check**: Was every reported check run **after** the last file modification? Check timestamps in `.evidence/ledger.tsv` vs file mtimes.
3. **Claim-vs-proof audit**: For every sentence in your report claiming something works, passes, matches a baseline, or is blocked, point to the exact command, exit code, and `.evidence/logs/` entry proving it.
4. **Authority sync check**: Are `AGENTS.md`, `progress.md`, `docs/LIVING_BUILD_PLAN.md`, and affected specs consistent with verified facts?

---

## 9. Blocker handling

When a required gate cannot execute (for example, Docker is absent so `npm run db:reset` fails, or `.git` metadata is missing, or a live test requires Owner credentials/authorization):

1. Actually test the tool/command once via `run_logged.sh` (or `env_proof.sh`) to capture the real failure/absence rather than assuming from memory.
2. Never substitute a weaker check and label the stronger gate as passed.
3. Report status as `BLOCKED` (or `PARTIALLY IMPLEMENTED` if other parts succeeded), quote the exact command, exit code, and error message, and state the minimum precondition required to unblock.

---

## 10. Scripts

- `skills/evidence-first-execution/scripts/env_proof.sh` — Read-only environment, git, toolchain, and workspace inventory check.
- `skills/evidence-first-execution/scripts/run_logged.sh` — Runs a verification command with `pipefail`, records timestamp, duration, and exit code into `.evidence/ledger.tsv`, and saves complete stdout/stderr into `.evidence/logs/`.

Make sure both scripts remain executable (`chmod +x`). Never modify `run_logged.sh` to mask non-zero exit codes.

---

## 11. Workspace evidence ledger

Keep transient verification evidence under `.evidence/`:

```text
.evidence/
  TASK_CONTRACT.md   # Scope, protected boundaries, and acceptance criteria for the active task
  ledger.tsv         # Append-only TSV of logged checks (timestamp, label, exit_code, duration, log_path, command)
  logs/              # Full stdout/stderr logs for each run_logged.sh invocation
  NOTES.md           # Optional scratch notes on observed blockers, diffs, or file comparisons
```

Keep `.evidence/` out of version control (listed in `.gitignore`) unless the project explicitly requests committing an evidence artifact. Keep `skills/evidence-first-execution/` tracked in version control so every task and contributor uses it.

---

## 12. KRISTOU SCHOOL mandatory alignment

- Always obey `AGENTS.md` Section 2 source-of-truth order and Section 3 safety rules (single school, fail-closed `account_status`, no client-side role authorization, no PII in public fixtures, no secrets in logs or browser bundles).
- Never echo `.env`, tokens, service-role keys, or Telegram `initData` secrets into `.evidence/logs/` or `NOTES.md`.
