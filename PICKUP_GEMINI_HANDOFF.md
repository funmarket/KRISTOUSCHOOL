# KRISTOU SCHOOL — PICKUP & DISMISSAL (G0 + G1) HANDOFF

- **Target Repository:** `funmarket/KRISTOUSCHOOL` (sync against `main` SHA `b2fe987f98e51f46e16ab544d65f3ff8b82e29a1`)
- **Active Scope Completed:** Packet **G0 (Immediate Safe UI)** + Packet **G1 (Typed Client Contract & Wiring)** + Step 3 Remediation & Hardening in `/app/applet`
- **Verification Timestamp (UTC):** `2026-11-25T22:19:51Z`
- **Backend Status:** **FAIL-CLOSED (`pickup_backend_unavailable`)** — Zero `.from()` / `.rpc()` calls and zero database/Supabase mutations exist in G0+G1.

---

## 1. Completed Scope & Invariants Enforced

1. **Zero Public Asset Leak (Step 3 Fix 1):**
   - Removed all internal specification and audit `.pdf` files from `public/assets/aistudio/` so Vite does not copy internal docs into `dist/`.
2. **Fail-Closed Read/Write Adapters (`src/lib/domains/pickup.ts`):**
   - Typed contracts for `PickupCycleRecord`, `PickupReadResult`, `AnnounceArrivalInput`, `ConfirmReleaseInput`, `PickupCommandOutcome`, `PickupMutationEntry`, and `PickupNotificationDeliveryStatus`.
   - `fetchPickupBoardCycles`, `announcePickupArrival`, `confirmPickupRelease`, and `readPickupOperationReceipt` fail closed with `pickup_backend_unavailable`.
3. **Request-Scoped `UNKNOWN_OUTCOME` Recovery (`src/context/usePickupState.ts`, `PickupBoardSections.tsx` — Step 3 Fix 2):**
   - Pending `UNKNOWN_OUTCOME` entries store `{ requestId, operation, payload }`.
   - Generic `refreshPickupBoard()` preserves `UNKNOWN_OUTCOME` unless the server board returns a record superseding `payload.expectedVersion` / target state.
   - Blind submissions with a different `requestId` stay blocked; explicit retry reuses the exact stored `requestId` and `payload` after checking `readOperationReceipt(requestId, cycleId)`.
   - `verifyPickupOperationReceipt(cycleId)` resolves `SUCCESS` / `CONFLICT` / `DENIED` or retains `UNKNOWN_OUTCOME` on `UNAVAILABLE`.
4. **Correct Normal Release Lifecycle & Window Independence (`src/lib/domains/pickup.ts` — Step 3 Fix 3):**
   - `canActorTriggerReleaseUi` requires `cycle.state === 'PARENT_ARRIVED'` (strictly blocks `'WAITING'` and `'RELEASED'`), `revocationStatus === 'NONE'`, `actorCanConfirmRelease === true`, `attendanceEligibility === 'ELIGIBLE'`, active authorized collector, and allows release even when `windowStatus === 'CLOSED'` once the parent has arrived (disallowing only `'UNAVAILABLE'`).
5. **Notification Delivery Separated from Custody State (`src/lib/domains/pickup.ts`, `PickupBoardSections.tsx`, `src/i18n/translations.ts` — Step 3 Fix 4):**
   - Added `deriveNotificationDeliveryStatus(cycle, mutation)` returning `'NONE' | 'QUEUED' | 'RETRYING' | 'DELIVERED' | 'UNAVAILABLE'`.
   - `derivePickupPresentationState` never overwrites committed `'PARENT_ARRIVED'` or `'RELEASED'` custody state with `'PENDING_RETRY'` or `'CLOSED_WINDOW'`.
   - UI renders primary custody badge alongside a distinct secondary delivery status badge (`pickup-delivery-status-badge-*` / `pickup-staff-delivery-badge-*`).
6. **Caught Command Rejections & Authoritative Readback on `SUCCESS` (`src/context/usePickupState.ts` — Step 3 Fix 5):**
   - Rejected `announceArrival` / `confirmRelease` promises are caught and converted to `UNKNOWN_OUTCOME` (never stuck in `SUBMITTING`).
   - `SUCCESS` without a valid committed `updatedRecord` triggers `readOperationReceipt` + `fetchCycles` readback verification before clearing/marking success, falling back to `UNKNOWN_OUTCOME` if unconfirmed.
7. **Actor-Change UI Reset (`src/components/views/PickupBoardView.tsx`, `src/components/views/pickup/PickupBoardSections.tsx` — Step 3 Fix 6):**
   - Keyed `PickupParentSection` and `PickupStaffQueueSection` by `currentUser?.id ?? 'anon'` and added `useEffect` resets on `currentUserId` so collector selection, verification/handoff checkboxes, and queue filters reset immediately on actor switch.
8. **Role Access Alignment (Addendum Sec 01):**
   - Approved `MANAGER` receives default `'pickup'` tab access regardless of unrelated capability flags; `APP_ADMIN`, `ADMINISTRATIVE_PERSONNEL`, `TEACHER`, and `PARENT` retain `'pickup'` tab access; `SCHOOL_STAFF` stays deny-by-default unless granted pickup capabilities; `STUDENT` is strictly excluded.
   - `SCHOOL_STAFF` and `TEACHER` show a non-default physical release notice when `actorCanConfirmRelease` is `false`.

---

## 2. Modified & Created Files (Post-Step 3 SHA-256)

### Created Files (G0 + G1 + Step 3)
- `src/lib/domains/pickup.ts` (`426` lines) — `c550d68761369a3e9bbeb5f858625e64a5dc682f9184f6bc38b13574194a84a3`
- `src/context/usePickupState.ts` (`416` lines) — `4eae9c3807eb4ce71d2deeca3e9085a5e2b2e095f27245da194db78f069d06ce`
- `src/components/views/pickup/PickupChildAvatar.tsx` (`35` lines) — `f6a299264b4ff4e4acdd6e39a20b6d0de4b04f7a6c4bbab2c49161a8e6f9c36b`
- `src/components/views/pickup/PickupBoardSections.tsx` (`434` lines) — `232d775fce4ec9bcfda06dc1cd134c224c3f268bd86735123edc50a6a73c7222`
- `tests/pickup-g0-g1-contract.test.mjs` — `7cdcf0c5b38869489bf59dbc838728e13ec91e3d90d1162ae0856acc71e2ed0d`
- `PICKUP_GEMINI_HANDOFF.md` — this handoff file

### Modified Existing Files (G0 + G1 + Step 3)
- `src/types.ts` (`292` lines) — `6a428c7e65888fe98f49cafd7c729870aca510f6753ddaf31941523fd7a8d2df`
- `src/context/appContextTypes.ts` — `c09467605791085c8d0a7eca9e1cd386f0edced5aee1634f1b4a6ec115c39a6a`
- `src/context/useSchoolDataHydration.ts` — `600230965d1f668d17a9d095e47f9639467ee574a073e473e0ee418c204085bd`
- `src/context/useCommunityAndNotesActions.ts` — `fa23cea148bb843294ff2e7780cb32e3ae0f854e1694d1a57c15610d647193e5`
- `src/context/AppContext.tsx` — `e0d3c6fe905f47bf89ee94b5347862b142d99f56f8a6c74d638ec6ebfa784595`
- `src/components/homepages/access/appTabAccess.ts` — `092dc6cab9f00a0edb51979b7a204a6f4d41754af6fe0b56a7fb539418d81e2e`
- `src/components/homepages/ManagerHomePage.tsx` — `6e728b5f9f9d78bbe2ba02ec8e95cb7e1576c61d4ef71640011f90793a07abbe`
- `src/components/homepages/SchoolStaffHomePage.tsx` — `99b729f534741f97b285b3d08fdb78a516c5ae6b8c3ee61c5d57928a41eb66a3`
- `src/components/views/PickupBoardView.tsx` (`159` lines) — `86798af0b24c0c475352c0515d63a9f306c4831dd57627aabfbcb04be6413307`
- `src/i18n/translations.ts` — `47f2afdf3be8b69db759203bcefb5289b00790156b9d48eed8c6347dc8ae0089`
- `tests/role-homepages.test.mjs` — `2119c0838b3e96af13fee7e17422fae95578056008cadd2ad8abe02aac19b1ed`

### Deleted Public PDF Files (Step 3 Fix 1)
- Removed `public/assets/aistudio/KRISTOU_SCHOOL_Pickup_Implementation_Decision_Addendum_rev1_2026-11-25_6ced748d.pdf`
- Removed `public/assets/aistudio/KRISTOU_SCHOOL_Pickup_Product_and_Implementation_Audit_rev3_2026-11-25_83a63d46.pdf`
- Removed `public/assets/aistudio/KRISTOU_SCHOOL_Pickup_Product_and_Implementation_Specification_v2_210755e3.pdf`

---

## 3. Protected Files Verified Unchanged (SHA-256)

- `supabase/config.toml`: `22e5ac40b6c8ee5b9e3f06158f8d544d6c39a3ac0bb2726fdcda44144b88c29b`
- `src/lib/database.types.ts`: `f50b90c3a11d59068f4b5b7c82194d449f7e8f5b6090959b90705aa1aa4eb080`
- `src/lib/telegramPrivateOperations.ts`: `24d167537404cc501aed094b601d09d7f99e07c6097597822eb818ec36a9dee6`
- `package.json`: `1a7c5edb1a1f5071df20e8e5d53951c8ed4e1133957887f33856c836f40c283a`

---

## 4. Verification Results (Freshly Executed After Final Code Edits)

- `node --test tests/pickup-g0-g1-contract.test.mjs` → **PASS (`5/5`, exit `0`)**
- `node --test tests/role-homepages.test.mjs tests/bottom-nav-bar.test.mjs tests/fix-03-fail-closed-guards.test.mjs tests/arch-09-parent-notes-state-ownership.test.mjs tests/p1-followup-regressions.test.mjs tests/account-governance.test.mjs tests/arch-08-global-invariants.test.mjs` → **PASS (exit `0`)**
- `npm test` → **PASS (`254/254`, `0` failures, exit `0`)**
- `npm run lint` (`tsc --noEmit`) → **PASS (exit `0`)**
- `npm run build` (`vite build`) → **PASS (exit `0`)**
- `find public -name "*.pdf"` and `find dist -name "*.pdf"` → **0 files (empty)**

---

## 5. Remaining Work for Packet G2+ (Backend / Supabase & Wiring)

1. Author reversible Supabase migrations for pickup windows, pickup cycles (`WAITING -> PARENT_ARRIVED -> RELEASED`), authorized collectors, per-actor release revocation/grants, idempotency operation receipts (`request_id`), and notification outbox (`Africa/Tunis` server time).
2. **Default Release Authority + Revocation Rule:** Enforce server-side inside every release transaction and projection that `APP_ADMIN`, `MANAGER`, and `ADMINISTRATIVE_PERSONNEL` hold default physical-release authority unless explicitly revoked per account by `APP_ADMIN` (while `SCHOOL_STAFF` and `TEACHER` hold no default release authority unless explicitly granted by server policy).
3. **Narrow Attendance Eligibility Projection:** Enforce an Attendance-owned narrow eligibility projection (`PRESENT`/`LATE` from the designated submitted responsible-teacher register, handling `EXCUSED`, `DRAFT`, null/missing registers, corrections, and class transfers) rather than exposing broad attendance registers.
4. Enforce server-side RLS + atomic RPC transitions (`PARENT_ARRIVED !== RELEASED`, in-person/handoff attestation requirements, and optimistic `expected_version` conflict checks) and grant least-privilege execute permissions.
5. Wire `fetchPickupBoardCycles`, `announcePickupArrival`, `confirmPickupRelease`, and `readPickupOperationReceipt` in `src/lib/domains/pickup.ts` (and Telegram Mini App verified private operations if applicable) to the deployed backend RPCs/gateway and regenerate `src/lib/database.types.ts` via Supabase CLI.

---

## 6. Sync Instructions (GitHub Workspace)

- Create/checkout branch from `funmarket/KRISTOUSCHOOL` `main` (`b2fe987f98e51f46e16ab544d65f3ff8b82e29a1`).
- Sync the **16 created/modified application/test files plus `PICKUP_GEMINI_HANDOFF.md` (17 files total)**, explicitly **exclude `.aistudio/`**, ensure zero `.pdf` files under `public/`, re-run `npm test && npm run lint && npm run build`, and keep protected files (`supabase/*`, `src/lib/database.types.ts`, `src/lib/telegramPrivateOperations.ts`, `package.json`) untouched.

---

## 7. Explicit Non-Claims

- No Supabase tables, migrations, RLS policies, RPCs, or Edge Functions were created, modified, or deployed in this packet.
- No live hosted database queries or production pickups were executed; all Pickup runtime adapters remain fail-closed (`pickup_backend_unavailable`) pending backend G2+ delivery.
