# Evidence-First Report Template

Use this structure for every task completion or milestone report. Do not omit failed, blocked, or unrun checks.

## Status
Use one exact label:
- `COMPLETE — VERIFIED`
- `PARTIALLY IMPLEMENTED`
- `PREPARED — NOT VERIFIED`
- `BLOCKED`
- `FAILED`

## 1. Scope & Baseline
- **Goal / Command:**
- **Branch / HEAD:** (or explicitly state if `.git` is unavailable in this workspace)
- **Protected boundaries preserved:**

## 2. Files Changed
List every created, modified, or deleted file and why. State explicitly if application/SQL/function files were untouched.

## 3. Executed Checks (Post-Last-Edit)
| Check | Exact Command | Exit Code | Observed Result & Counts | Scope / Limits | Evidence Log |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

## 4. Not Run / Blocked
| Check / Gate | Status (`BLOCKED` / `NOT RUN`) | Exact Reason / Error | Precondition to Unblock | Evidence Log (if attempted) |
| --- | --- | --- | --- | --- |
| | | | | |

## 5. Drift Check
- Scope stayed within authorization: yes/no
- All reported checks ran after the final edit: yes/no
- Affected authorities reconciled (`AGENTS.md`, `requirements.md`, `structure.md`, `docs/*`, `progress.md`): yes/no (list which)

## 6. Next Authorized Step
State the exact next gate or await explicit Owner decision; do not auto-start unapproved work.
