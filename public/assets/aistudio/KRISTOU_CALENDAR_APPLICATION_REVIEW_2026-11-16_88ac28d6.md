# KRISTOU SCHOOL — Gemini Calendar application review

Verdict: **CORRECTION REQUIRED — do not publish this candidate.** Review only; no application/database source corrections, publication, merge, deployment or hosted SQL performed.

## Exact evidence

- Supplied calendar_wiring_evidence.zip: 49,652 bytes; SHA256 `9784c564fc4246dc0385e6192a6e1cc5afda0965f632733e86b6b3089671e5f4` independently confirmed.
- Fresh GitHub main lookup: `funmarket/KRISTOUSCHOOL@71d8c22dbfee70e7804919586d113404dc71efcb`, matching Gemini's stated baseline.
- Exported unified diff reconstructed successfully on that exact baseline; only header paths normalized for local application. Original export preserved unchanged.
- 13 changed tracked files: 12 application/test files plus authorized generated-types synchronization; 184 other tracked files unchanged. Detailed hashes are retained in independent-source-audit.json.
- All 29 protected manifest entries independently checked successfully. EXPORT_SUMMARY.md incorrectly says 30; Gemini's chat correctly says 29.
- Generated database.types.ts is exactly the supplied Codex payload: 78,793 bytes; SHA256 `bcc1ba2b0aef21c460693b3636247deef4dacd63e58dceed3cca84650478420b`.

## Publication blockers

### 1. Backend support is asserted from local assignment/picker inputs

`src/lib/calendar/calendarAudience.ts:80–95` marks TEACHER_CLASSES supported when a Teacher picker has options. Lines 113–125 mark ALL_MY_CLASSES supported when assigned classes exist. Neither condition establishes installation of the reviewed feed/RPC/cancellation prerequisites. A direct, personally executed pure-function check confirms both flags become true using only those local inputs.

`src/components/views/Shared/SchoolCalendarPanel.tsx:1093` permits opening the create form on canCreateResolved and !isUnauthorized. Its create form, submit-disable logic and handleCreate likewise do not exclude BLOCKED_BACKEND. Therefore a missing-contract response can coexist with active creation controls. Errors from the RPC remain honestly classified, but that is not the required unavailable-before-installation behavior.

The read adapter unconditionally switches to the new feed and creation adapter unconditionally uses the new RPC; this is not a legacy-compatible release before installation. Preserve these prepared adapters, but keep affected operations unavailable until the actual reviewed backend and matching read/cache wiring are established. Do not invent a readiness RPC, data-writing probe or global/single-class fallback. Coordinate backend installation through the separate manual approval gate; do not change SQL to solve this application issue.

### 2. New/expanded fabricated service checks violate the no-mocks instruction

`tests/calendar-audience-takeover.test.mjs:46` expands createMockSupabase with fabricated Teacher accounts, assignment maps, governance RPC responses and create_school_calendar_event persistence. The new mock returns `class_id: null` for TEACHER_CLASSES/ALL_MY_CLASSES (around line 163), contradicting the database's mandatory non-null targeted anchor. It consequently permits a simulated success the actual contract forbids.

Changed readiness/workflow tests also inject fabricated feed responses; expanded mounted/custom-DOM checks are not real browser or authorization evidence. This is a source compliance finding, not merely a labeling problem. Preserve historical baseline tests/logs and valid application changes; remove/replace the newly added mocked scenarios with direct pure-function assertions where sufficient, and mark genuine integration checks NOT RUN without legitimate prerequisites. Do not rewrite this mock into a second pretend backend or delete unrelated historical coverage.

## Valid work to preserve

Source inspection confirms the new RPC argument mapping, exact feed column projection, audience-aware PostgREST class filter, stable month overlap/order/range pagination, and existing own-RSVP retrieval. No new list RPC or per-class event creation loop was introduced. The returned creation row is not given fabricated target IDs in production; refresh remains the canonical readback path.

Both SchoolCalendarPanel's hydrated authorized-class filter and ClassCommunityView's selected-class filter use the new audience helpers. Direct pure-function checks confirm a secondary visible target matches even when the legacy anchor differs, and unrelated scope is denied. Existing month request ownership, assignment/account scope keys and cancellation/refresh safeguards remain in source. No claim of actual browser or live authorization acceptance is made from these observations.

## Personally executed checks

Command on the reconstructed final candidate:

`npx --yes bun@1.4.4 install --frozen-lockfile && npm run lint && npm run build && node --test tests/*.test.mjs tests/functions/*.test.mjs`

Exit0: frozen installation, TypeScript, production build and 135/135 Node tests passed, zero failures/skips. This existing suite includes mocked/custom-DOM tests; running it as regression evidence does not accept those additions or establish the actual workflow.

Independent log: `.evidence/logs/20261116T182950Z_independent-calendar-app-candidate.log`.

Additional direct pure-function guard/secondary-target checks: exit0, `.evidence/logs/20261116T183054Z_independent-pure-audience-review.log`. These use ordinary function inputs, no service substitutes or network calls.

## Remaining acceptance gates

Hosted installation/function/grant/policy verification and actual authenticated browser/API persistence remain NOT RUN for this candidate. Reviewed backend installation has not been established; legitimate approved test sessions with existing class/child relationships and reliable candidate browser access have not been provided. Missing access is not an instruction to create production fixtures or repeat implementation cycles.

The prior hosted function-definition query rejection remains recorded in the preserved database packet; no direct/indirect retry occurred during this review. PR21, Directory24, Teacher T1/T2 and Attendance remain separate. Original Gemini ZIP, logs and final database evidence remain preserved.
