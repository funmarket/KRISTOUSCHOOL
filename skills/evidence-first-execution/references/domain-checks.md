# Domain Checks — Evidence-First Execution

Consult the matching section(s) before declaring any task in that domain `COMPLETE — VERIFIED`.

## 1. Database, Migrations & RLS
- [ ] Migrations are ordered, reviewable SQL files under `supabase/migrations/` (never dashboard-only edits).
- [ ] Clean local migration replay (`npm run db:reset` with Docker) executed after final SQL edit; standalone Postgres without Supabase Auth/RLS is explicitly labeled a limited substitute, not the reset gate.
- [ ] RLS enabled and forced where required; explicit `REVOKE` / least-privilege column `GRANT`s verified.
- [ ] `pgTAP` allow AND deny tests (`npm run db:test`) executed under non-superuser roles (`anon`, `authenticated`, `service_role`) with RLS actually active (`row_security_active = true`).
- [ ] Concurrency / locking claims proven with genuine multi-session database transactions, not single-session scripts or in-memory JS scheduling.
- [ ] Hosted migration changes never claimed unless read-only live inspection or authorized deployment actually ran.

## 2. Authorization & Identity
- [ ] Server-side identity verification (`auth.uid()`, JWT, or verified Telegram HMAC) enforces access; frontend visibility and client-supplied roles are never treated as authorization.
- [ ] Fail-closed checks on `account_status` (`APPROVED` required for school operations; `PENDING`/`SUSPENDED`/`REJECTED` denied).
- [ ] No heuristic identity merging across email, phone, username, or Telegram ID.
- [ ] Sensitive RPCs (`SECURITY DEFINER`) restrict `EXECUTE` grants, set explicit `search_path`, and re-verify caller authority inside transactions after lock acquisition.

## 3. Frontend, Browser & UI
- [ ] `npm run lint` (`tsc --noEmit`) and `npm run build` (`vite build`) pass with exit code `0` after the last edit.
- [ ] Unit/component/i18n tests verify all three locales (`ar`, `fr`, `en`) and RTL/LTR shell constraints without missing dictionary keys.
- [ ] Denied, unapproved, error, and empty states are verified.
- [ ] Distinguish build/unit verification from live browser verification; do not claim live sign-in or UI workflow works in a browser unless actually tested in a browser or explicitly reported `NOT RUN`.

## 4. APIs & Edge Functions
- [ ] Request validation, HTTP status codes (`401`, `403`, `409`, `503`), and client-side error unwrapping (`FunctionsHttpError`) are tested end-to-end or explicitly scoped as unit/source tests.
- [ ] Service-role keys remain server-side (`SERVICE_ROLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY`) and never appear in `VITE_*` variables, bundles, or logs.
- [ ] Deployed function version parity is checked rather than assumed from local `supabase/functions/*` edits.

## 5. CI, Deployment & Telegram Integration
- [ ] Do not alter protected Telegram linking, challenge, signature validation, caching, session restoration, or deployed Telegram functions unless explicitly instructed.
- [ ] Verify baseline equality on protected sections via byte/line comparison (`diff` / SHA-256), never from memory.
- [ ] Never claim GitHub PRs, merges, Vercel rebuilds, or Supabase deployments unless directly executed and verified.
