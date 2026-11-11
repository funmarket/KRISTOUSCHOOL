# KRISTOU SCHOOL — Edge Function deployment notes

**Status:** Operational guidance; deployment is not authorized by this document.
**Target project:** `KRISTOUSCHOOL` (`ofppapwofhovhroyjtkc`) when the owner explicitly authorizes a deployment.

## Runtime secret contract

Store secrets only in the target Supabase project's Edge Function secrets. Never place secret values in this repository, Vite variables, browser output, shell history, screenshots, or logs.

| Name | Consumer | Purpose |
|---|---|---|
| `SERVICE_ROLE_KEY` | all server functions that need a privileged Supabase client | Preferred service-role secret name. The current functions retain backward compatibility with `SUPABASE_SERVICE_ROLE_KEY`. |
| `TELEGRAM_BOT_TOKEN` | `telegram-auth` | Server-side validation of Telegram Mini App `initData`; never send this token to the browser. |
| `ALLOWED_ORIGIN` | browser-facing functions | Exact allowed web origin, with no trailing slash (for production: `https://kristouschool.vercel.app`). Configure a separate local origin for local development. |

Supabase's hosted runtime supplies project URL and anon key variables to functions. Do not set any privileged credential under a `VITE_` name.

## Function contracts in source

- `auth-username-signin`: `verify_jwt=false`; it validates the submitted credentials itself and returns the normal Supabase Auth session only after successful password verification.
- `telegram-link-challenge`: `verify_jwt=true`; it requires the existing signed-in app user's bearer token to create a short-lived linking challenge.
- `telegram-auth`: `verify_jwt=false`; it validates signed Telegram `initData` itself, confirms a one-time link when `start_param` is present, and returns the already-linked canonical profile on ordinary Mini App opens. It does not create users or mint Supabase Auth sessions.

The deployed live `telegram-auth` v8 has the corrected HMAC verifier, atomic link RPC, and lookup for already-linked users on ordinary Mini App opens. The matching frontend change is on the feature branch and must be merged/deployed through Vercel before automatic Telegram entry is available in the UI. Telegram login is a verified app identity, not a Supabase Auth session; future private database operations must continue through server-verified Telegram paths unless a separate Supabase session design is approved.

## Safe order before any hosted change

1. Review and merge the source-only reconciliation PR; confirm the exact commit on `main`.
2. Complete a clean local `supabase db reset` and `supabase test db` using the pinned CLI and synthetic fixtures.
3. The owner-authorized `atomic_telegram_account_link` migration is applied; the live migration history still uses different version IDs for the original three migrations. Do not run `db push`, mark unrelated migrations applied, or attempt to baseline the remote project until a non-destructive mapping is reviewed.
4. Obtain explicit owner authorization for the exact production migration and function deployment. Apply the required migration before deploying the functions that call its RPC; record the exact project, migration IDs, function versions, and smoke-test outcomes.
5. Verify required secret **names** are configured in the correct project without displaying or logging their values. Test preflight/CORS and invalid-request protection first. A real link test requires a fresh Telegram WebApp session and the configured bot short name.

Example function deployment command (do not run until steps 1–4 and separate owner authorization are complete):

```sh
npx --yes supabase@3.1.0 functions deploy auth-username-signin --project-ref ofppapwofhovhroyjtkc
npx --yes supabase@3.1.0 functions deploy telegram-link-challenge --project-ref ofppapwofhovhroyjtkc
npx --yes supabase@3.1.0 functions deploy telegram-auth --project-ref ofppapwofhovhroyjtkc
```

## Separate Vercel browser configuration

The browser client needs the public Vite build variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`). For compatibility, `vite.config.ts` selectively maps `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` or `SUPABASE_ANON_KEY` into browser-safe build constants; it does not expose the `SUPABASE_` prefix globally. These are separate from Edge Function secrets. Vite embeds the selected values during the frontend build, so add them to the Vercel environment(s) that need the app and create a fresh deployment after changing them. Only the URL and publishable/anon key belong in the browser build—never `SERVICE_ROLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or a bot token.

## Local verification

From a clean checkout with Docker available:

```sh
npm run db:start
npm run db:reset
npm run db:test
npm run db:stop
```

The database test uses synthetic Auth users and verifies RLS enablement, grants, trigger/RPC execution boundaries, and self-only profile/role/Telegram rows. It is not a substitute for function/API integration tests or a hosted Telegram end-to-end test.
