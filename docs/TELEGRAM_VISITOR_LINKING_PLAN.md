# Shared-App Signup and Telegram Account Linking
> **Historical implementation packet (2026-11-11) — 2026-11-13 status:** An atomic account-link RPC is now present in the live KRISTOUSCHOOL backend, and `telegram-auth` v9 is deployed. The branch named below is an old implementation reference, not the current execution branch; no browser/Telegram end-to-end acceptance was run in this document reconciliation. Preserve explicit Web-signup-then-link and reject automatic identity merging. See `docs/CURRENT_STATE_AND_HANDOFF_2026-11-13.md`.


**Status:** Active implementation scope, based on the owner's latest clarification on 2026-11-11.

**Branch:** `feature/telegram-visitor-linking` from `main` at `3e978d8955d18718d191e7eb438f424baf2d6622`.

## Approved flow

1. Visitors may browse the school's approved public information in Browser or Telegram without an account.
2. A user creates an app account through the existing shared-app signup form and signs in with that account. The form works in either Browser or Telegram WebView; school admission is a separate flow.
3. While signed in, the user chooses **Connect Telegram**. The server verifies the user's Web session and creates a random, short-lived challenge bound to that canonical account. Only a hash of the challenge is stored.
4. The app opens `https://t.me/kristouschool_bot/dreambig?startapp=<challenge>`. Telegram passes the direct-link parameter to the Mini App. The shared app forwards raw `Telegram.WebApp.initData` to the link-confirmation Edge Function; the challenge is read only from the signed `start_param` after server-side HMAC/freshness validation.
5. A database operation atomically validates and consumes the challenge while attaching the Telegram numeric identity to the same KRISTOU profile. Already-linked-to-another-account, expired, invalid, and reused challenges fail. No name, username, email, or phone matching is used.
6. The Telegram link handler only confirms linking. It does not create an Auth user or issue a Supabase session. Account creation and app sign-in remain the app's normal Web-credential flow.

## Implementation boundary

This slice completes the explicit account-link handoff only. It does not implement Telegram-first account provisioning, a separate Telegram signup system, protected school-domain APIs, or authorization for future Telegram data operations. Browser and Telegram remain one React app and one canonical profile. The bot token and service-role key remain server-side. The Telegram link code is one-time, short-lived, and never stored in plaintext.

The current database foundation has `profiles.id` linked to `auth.users.id`, which fits this flow because the user signs up in the app first. No replacement canonical-user schema is needed for explicit linking.

## Acceptance checks

- Only a signed-in app user can create a challenge; the target user ID comes from the verified Supabase Auth session, not request JSON.
- A fresh genuine Telegram Mini App `initData` signature and its signed `start_param` are required to claim the link.
- Invalid signatures, stale/future timestamps, absent/expired/replayed challenge, duplicate Telegram identity owned by another user, and multiple identities for one profile fail closed.
- Challenge consumption and identity attachment are atomic under retry/concurrent requests.
- Success returns only confirmation; it does not create a profile, issue a session, or return user/private profile data.
- The Web account sign-up/login remains usable, including in Telegram WebView; public visitors stay unauthenticated.
- Synthetic verifier tests use a fake bot token and never claim to prove a real Telegram session.

## Source evidence

Telegram direct links support a `startapp` value, which the Mini App receives as `start_param`; the raw `initData` integrity check uses Telegram's documented two-stage HMAC and should be validated server-side. See [Telegram Mini Apps](https://core.telegram.org/bots/webapps#direct-link-mini-apps) and [validating Mini App data](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app). HoomaUltimate's reference implementation validates raw `tma` data server-side and explicitly resolves linked identities; it is reference behavior only, not KRISTOUSCHOOL implementation evidence. See the inspected [Hooma identity auth middleware](https://github.com/funmarket/HoomaUltimate/blob/6e633cfd83c8139426104226f31bd96603b25cd1/apps/api/src/modules/identity/http/auth.middleware.ts).

## Current exclusions and deployment boundary

No production or staging Supabase changes are included. No Edge Function deployment, BotFather configuration change, real Telegram end-to-end test, account merge, or school-domain data access is authorized by this local implementation task. The configured Telegram bot Mini App short name `dreambig` must exist in BotFather for the supplied direct link to launch the app.
