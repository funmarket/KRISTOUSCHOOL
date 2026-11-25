import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import Module, { createRequire } from 'node:module';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import React, { act } from 'react';
import { installNodeDomShim } from './helpers/nodeDomShim.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

globalThis.__KRISTOU_SUPABASE_URL__ = '';
globalThis.__KRISTOU_SUPABASE_PUBLISHABLE_KEY__ = '';

const authModule = await import('../src/lib/auth.ts');
const academicsModule = await import('../src/lib/domains/academics.ts');
const classCommunityModule = await import('../src/lib/domains/classCommunity.ts');
const homeResolutionModule = await import('../src/components/homepages/access/homePageResolution.ts');

const TEST_BOT_TOKEN = '999999:arch-db-repair-01-test-token';
const TEMP_DIR = path.join('/tmp', 'kristou-arch-db-repair-01-tests');

after(() => {
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
});

function buildSignedTelegramInitData(botToken, fields) {
  const params = new URLSearchParams(fields);
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 25));
}

test('TG-RECOVERY-01 (Client): authenticateTelegramInitData accepts v10 payload without apiToken/setSession, enforces approvals/conflicts, and evicts rejected attempts (TG-12)', async () => {
  authModule.clearTelegramAuthCache?.();

  const makeClient = (returnedUser, extra = {}) => ({
    functions: {
      invoke: async (fnName) => {
        assert.equal(fnName, 'telegram-auth');
        return {
          data: {
            ok: true,
            linked: true,
            user: returnedUser,
            ...extra,
          },
          error: null,
        };
      },
    },
    ...(extra.auth ? { auth: extra.auth } : {}),
  });

  // Missing or non-APPROVED account_status must fail closed even if role is present
  for (const badStatus of [undefined, '', 'PENDING', 'REJECTED', 'SUSPENDED', 'REVOKED']) {
    await assert.rejects(
      () =>
        authModule.authenticateTelegramInitData(
          `init_${String(badStatus)}`,
          makeClient({
            id: 'u-bad',
            username: 'tg_bad',
            role: 'PARENT',
            ...(badStatus !== undefined ? { accountStatus: badStatus } : {}),
            capabilities: ['PARENT'],
          }),
        ),
      /account_not_approved/,
    );
  }

  // Approved account with GENERAL_USER fallback must fail closed
  await assert.rejects(
    () =>
      authModule.authenticateTelegramInitData(
        'init_general',
        makeClient({
          id: 'u-gen',
          username: 'tg_gen',
          role: 'GENERAL_USER',
          account_status: 'APPROVED',
          capabilities: ['GENERAL_USER'],
        }),
      ),
    /account_not_approved/,
  );

  // Conflict: active Web session belonging to another canonical user must fail closed
  await assert.rejects(
    () =>
      authModule.authenticateTelegramInitData('init_conflict_user', {
        functions: {
          invoke: async () => ({
            data: {
              ok: true,
              linked: false,
              user: { id: 'u-tg', username: 'u_tg', role: 'PARENT', account_status: 'APPROVED', capabilities: ['PARENT'] },
            },
            error: null,
          }),
        },
        auth: {
          getSession: async () => ({ data: { session: { user: { id: 'u-web-other' } } }, error: null }),
        },
      }),
    /telegram_identity_conflict/,
  );

  // Valid approved user succeeds WITHOUT apiToken and NEVER invokes auth.setSession
  let setSessionCalled = false;
  const phoneResult = await authModule.authenticateTelegramInitData('init_phone_approved', {
    functions: {
      invoke: async () => ({
        data: {
          ok: true,
          linked: false,
          user: {
            id: 'u-phone-1',
            username: 'karim_parent',
            fullName: 'Karim Mansour',
            email: null,
            role: 'PARENT',
            account_status: 'APPROVED',
            capabilities: ['PARENT'],
            telegramLinked: true,
          },
        },
        error: null,
      }),
    },
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      setSession: async () => {
        setSessionCalled = true;
        return { data: { session: null }, error: null };
      },
    },
  });
  assert.equal(setSessionCalled, false, 'Telegram auth must never call supabase.auth.setSession');
  assert.equal(phoneResult.user.id, 'u-phone-1');
  assert.equal(phoneResult.linked, false);

  // Approved MANAGER preserves MANAGER role and delegated manager_capabilities
  const managerResult = await authModule.authenticateTelegramInitData(
    'init_mgr_1',
    makeClient({
      id: 'u-mgr-1',
      username: 'salma.manager',
      fullName: 'Salma Ben Salah',
      role: 'MANAGER',
      account_status: 'APPROVED',
      capabilities: ['GENERAL_USER', 'MANAGER'],
      manager_capabilities: ['OVERSIGHT:TEACHER_HOME', 'CLASSES_MANAGE'],
      telegramLinked: true,
    }),
  );

  assert.equal(managerResult.linked, true);
  assert.equal(managerResult.user.role, 'MANAGER');
  assert.equal(managerResult.user.accountStatus, 'APPROVED');
  assert.equal(managerResult.user.capabilities?.includes('GENERAL_USER'), false);
  assert.equal(managerResult.user.capabilities?.includes('MANAGER'), true);
  assert.equal(managerResult.user.capabilities?.includes('OVERSIGHT:TEACHER_HOME'), true);
  assert.equal(managerResult.user.capabilities?.includes('CLASSES_MANAGE'), true);

  const ownHome = homeResolutionModule.resolveHomePage(managerResult.user);
  assert.equal(ownHome.homePage, 'MANAGER_HOME');
  assert.equal(ownHome.allowed, true);

  const delegatedHome = homeResolutionModule.resolveHomePage(managerResult.user, 'TEACHER_HOME');
  assert.equal(delegatedHome.homePage, 'TEACHER_HOME');
  assert.equal(delegatedHome.allowed, true);
  assert.equal(delegatedHome.oversightMode, true);

  const deniedOwner = homeResolutionModule.resolveHomePage(managerResult.user, 'OWNER_HOME');
  assert.equal(deniedOwner.allowed, false);

  // TG-12: Test real cache path (without clientOverride): transient failure is evicted so retry succeeds,
  // and resolved response stays cached so start_param is not replayed.
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  const tgAuthOutfile = path.join(TEMP_DIR, 'tg-auth-cache.cjs');
  await build({
    entryPoints: [path.resolve(__dirname, '../src/lib/telegramAuth.ts')],
    outfile: tgAuthOutfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    plugins: [
      {
        name: 'tg12-supabase-mock',
        setup(builder) {
          builder.onResolve({ filter: /(?:^|\/)supabase(\.ts)?$/ }, () => ({
            path: 'mock-supa-tg12',
            namespace: 'tg12',
          }));
          builder.onLoad({ filter: /^mock-supa-tg12$/, namespace: 'tg12' }, () => ({
            contents: `
              export const requireSupabaseClient = () => globalThis.__TG12_CLIENT__;
            `,
          }));
          builder.onResolve({ filter: /^[^./]/ }, (args) => ({
            path: require.resolve(args.path),
            external: true,
          }));
        },
      },
    ],
  });
  const tgAuthBundled = require(tgAuthOutfile);
  tgAuthBundled.clearTelegramAuthCache();

  let invokeCount = 0;
  globalThis.__TG12_CLIENT__ = {
    functions: {
      invoke: async () => {
        invokeCount += 1;
        if (invokeCount === 1) {
          return { data: null, error: new Error('Failed to send a request to the Edge Function') };
        }
        return {
          data: {
            ok: true,
            linked: true,
            user: {
              id: 'u-tg12',
              username: 'tg12.parent',
              fullName: 'Parent TG12',
              role: 'PARENT',
              account_status: 'APPROVED',
              capabilities: ['PARENT'],
              telegramLinked: true,
            },
          },
          error: null,
        };
      },
    },
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
    },
  };

  await assert.rejects(
    () => tgAuthBundled.authenticateTelegramInitData('init_with_start_param=abc'),
    /Failed to send a request to the Edge Function/,
  );
  assert.equal(invokeCount, 1);

  const retrySuccess = await tgAuthBundled.authenticateTelegramInitData('init_with_start_param=abc');
  assert.equal(retrySuccess.linked, true);
  assert.equal(retrySuccess.user.id, 'u-tg12');
  assert.equal(invokeCount, 2, 'Evicted transient failure must allow retry');

  const cachedReplay = await tgAuthBundled.authenticateTelegramInitData('init_with_start_param=abc');
  assert.equal(cachedReplay.user.id, 'u-tg12');
  assert.equal(invokeCount, 2, 'Resolved result must stay cached so start_param is not replayed');
});

test('TG-RECOVERY-01 (Edge Function): telegram-auth follows v10 contract without JWT signing secrets and supports email & phone-only approved accounts', async () => {
  const previousDeno = globalThis.Deno;
  const previousCreateClient = globalThis.__KRISTOU_TEST_TG_CREATE_CLIENT__;

  const mockEnv = {
    ALLOWED_ORIGIN: 'http://localhost:3000',
    TELEGRAM_BOT_TOKEN: TEST_BOT_TOKEN,
    SUPABASE_URL: 'https://ofppapwofhovhroyjtkc.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  };

  let mockDbState = {
    identity: { user_id: 'mgr-1' },
    profile: null,
    roles: [],
    grants: [],
    authUser: null,
    rpcCalls: [],
  };

  globalThis.Deno = {
    env: { get: (k) => mockEnv[k] },
    serve: () => {},
  };

  globalThis.__KRISTOU_TEST_TG_CREATE_CLIENT__ = (_url, key) => ({
    rpc: async (fnName, params) => {
      mockDbState.rpcCalls.push({ fnName, params, key });
      if (fnName === 'claim_telegram_account_link') {
        return { data: null, error: null };
      }
      return { data: null, error: { message: 'unexpected_rpc' } };
    },
    from: (table) => {
      const chain = {
        eq: () => chain,
        maybeSingle: async () => {
          if (table === 'telegram_identities') return { data: mockDbState.identity, error: null };
          return { data: null, error: null };
        },
        single: async () => {
          if (table === 'profiles') return { data: mockDbState.profile, error: null };
          return { data: null, error: null };
        },
        then: (resolve) => {
          if (table === 'role_assignments') {
            return Promise.resolve({ data: mockDbState.roles, error: null }).then(resolve);
          }
          if (table === 'manager_capability_grants') {
            return Promise.resolve({ data: mockDbState.grants, error: null }).then(resolve);
          }
          return Promise.resolve({ data: [], error: null }).then(resolve);
        },
      };
      return { select: () => chain };
    },
    auth: {
      admin: {
        getUserById: async (uid) => {
          assert.equal(key, 'test-service-role-key');
          assert.equal(uid, mockDbState.identity.user_id);
          return { data: { user: mockDbState.authUser }, error: null };
        },
      },
    },
  });

  Module.registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === 'https://esm.sh/@supabase/supabase-js@2') {
        return {
          url: 'data:text/javascript,export const createClient = (...args) => globalThis.__KRISTOU_TEST_TG_CREATE_CLIENT__(...args);',
          shortCircuit: true,
        };
      }
      return nextResolve(specifier, context);
    },
  });

  try {
    const edgeMod = await import('../supabase/functions/telegram-auth/index.ts');
    const nowSec = Math.floor(Date.now() / 1000);
    const buildReq = (initDataStr) =>
      new Request('https://ofppapwofhovhroyjtkc.supabase.co/functions/v1/telegram-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: initDataStr }),
      });

    const validInitData = buildSignedTelegramInitData(TEST_BOT_TOKEN, {
      auth_date: String(nowSec),
      query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
      user: JSON.stringify({ id: 424242, first_name: 'Salma', username: 'salma_tg' }),
    });

    const invoke = async (initDataStr = validInitData) => {
      const res = await edgeMod.handleTelegramAuth(buildReq(initDataStr));
      return { status: res.status, body: await res.json() };
    };

    // Case 1: Invalid / tampered Telegram initData fails closed 401
    const badSigRes = await invoke(`${validInitData.slice(0, -4)}dead`);
    assert.equal(badSigRes.status, 401);
    assert.equal(badSigRes.body.error, 'invalid_telegram_auth');

    // Case 2: Unlinked visitor returns 404 telegram_not_linked cleanly
    mockDbState = { identity: null, profile: null, roles: [], grants: [], authUser: null, rpcCalls: [] };
    const unlinkedRes = await invoke();
    assert.equal(unlinkedRes.status, 404);
    assert.equal(unlinkedRes.body.error, 'telegram_not_linked');

    // Case 3: PENDING, SUSPENDED, and REVOKED profiles rejected 403 account_not_approved
    for (const status of ['PENDING', 'SUSPENDED', 'REVOKED']) {
      mockDbState = {
        identity: { user_id: `u-${status}` },
        profile: {
          id: `u-${status}`,
          username: `${status.toLowerCase()}_tg`,
          full_name: `${status} User`,
          email: null,
          avatar_url: null,
          account_status: status,
        },
        roles: [{ role: 'PARENT' }],
        grants: [],
        authUser: { id: `u-${status}`, phone: '+21620111222', phone_confirmed_at: '2026-11-10T00:00:00Z' },
        rpcCalls: [],
      };
      const rejectedRes = await invoke();
      assert.equal(rejectedRes.status, 403);
      assert.equal(rejectedRes.body.error, 'account_not_approved');
    }

    // Case 4: APPROVED profile without canonical active role rejected 403
    mockDbState = {
      identity: { user_id: 'no-role-1' },
      profile: {
        id: 'no-role-1',
        username: 'norole_tg',
        full_name: 'No Role User',
        email: null,
        avatar_url: null,
        account_status: 'APPROVED',
      },
      roles: [],
      grants: [],
      authUser: { id: 'no-role-1', email: 'norole@kristou.school', email_confirmed_at: '2026-11-10T00:00:00Z' },
      rpcCalls: [],
    };
    const noRoleRes = await invoke();
    assert.equal(noRoleRes.status, 403);
    assert.equal(noRoleRes.body.error, 'account_not_approved');

    // Case 5: Banned auth user fails closed 403 even if profile row looks APPROVED
    mockDbState = {
      identity: { user_id: 'banned-1' },
      profile: {
        id: 'banned-1',
        username: 'banned_tg',
        full_name: 'Banned User',
        email: 'banned@kristou.school',
        avatar_url: null,
        account_status: 'APPROVED',
      },
      roles: [{ role: 'PARENT' }],
      grants: [],
      authUser: {
        id: 'banned-1',
        email: 'banned@kristou.school',
        banned_until: '2099-01-01T00:00:00Z',
      },
      rpcCalls: [],
    };
    const bannedRes = await invoke();
    assert.equal(bannedRes.status, 403);
    assert.equal(bannedRes.body.error, 'account_not_approved');

    // Case 6: APPROVED phone-only account WITHOUT email succeeds 200 with v10 payload (NO session, NO apiToken)
    mockDbState = {
      identity: { user_id: 'phone-only-1' },
      profile: {
        id: 'phone-only-1',
        username: 'phone_tg',
        full_name: 'Phone Only Owner',
        email: null,
        avatar_url: null,
        account_status: 'APPROVED',
      },
      roles: [{ role: 'APP_ADMIN' }],
      grants: [],
      authUser: {
        id: 'phone-only-1',
        email: null,
        phone: '+21620111222',
        phone_confirmed_at: '2026-11-10T00:00:00Z',
      },
      rpcCalls: [],
    };
    const phoneOnlyRes = await invoke();
    assert.equal(phoneOnlyRes.status, 200);
    assert.equal(phoneOnlyRes.body.ok, true);
    assert.equal(phoneOnlyRes.body.linked, false);
    assert.equal(phoneOnlyRes.body.session, undefined, 'Must never issue a GoTrue session object');
    assert.equal('apiToken' in phoneOnlyRes.body, false, 'Must not include apiToken in v10 payload');
    assert.equal(phoneOnlyRes.body.user.id, 'phone-only-1');
    assert.equal(phoneOnlyRes.body.user.role, 'APP_ADMIN');
    assert.equal(phoneOnlyRes.body.user.accountStatus, 'APPROVED');

    // Case 7: Explicit linking with start_param claims challenge atomically and returns { ok: true, linked: true, user }
    const linkInitData = buildSignedTelegramInitData(TEST_BOT_TOKEN, {
      auth_date: String(nowSec),
      query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
      start_param: 'link-verifier-secret-123',
      user: JSON.stringify({ id: 424242, first_name: 'Salma', username: 'salma_tg' }),
    });
    mockDbState = {
      identity: { user_id: 'mgr-1' },
      profile: {
        id: 'mgr-1',
        username: 'salma.mgr',
        full_name: 'Salma Manager',
        email: 'salma@kristou.school',
        avatar_url: null,
        account_status: 'APPROVED',
      },
      roles: [{ role: 'MANAGER' }],
      grants: [{ capability: 'OVERSIGHT:TEACHER_HOME' }, { capability: 'CLASSES_MANAGE' }],
      authUser: {
        id: 'mgr-1',
        email: 'salma@kristou.school',
        email_confirmed_at: '2026-11-10T00:00:00Z',
      },
      rpcCalls: [],
    };
    const okRes = await invoke(linkInitData);
    assert.equal(okRes.status, 200);
    assert.equal(okRes.body.ok, true);
    assert.equal(okRes.body.linked, true);
    assert.equal(mockDbState.rpcCalls[0]?.fnName, 'claim_telegram_account_link');
    assert.equal(okRes.body.session, undefined);
    assert.equal('apiToken' in okRes.body, false);
    assert.equal(okRes.body.user.role, 'MANAGER');
    assert.deepEqual(okRes.body.user.manager_capabilities, ['OVERSIGHT:TEACHER_HOME', 'CLASSES_MANAGE']);
    assert.deepEqual(okRes.body.user.capabilities, ['MANAGER', 'OVERSIGHT:TEACHER_HOME', 'CLASSES_MANAGE']);

    // Case 8: Client roundtrip accepts v10 response cleanly
    const clientRes = await authModule.authenticateTelegramInitData('edge_roundtrip', {
      functions: {
        invoke: async () => ({ data: okRes.body, error: null }),
      },
    });
    assert.equal(clientRes.linked, true);
    assert.equal(clientRes.user.accountStatus, 'APPROVED');
    assert.deepEqual(clientRes.user.capabilities, ['MANAGER', 'OVERSIGHT:TEACHER_HOME', 'CLASSES_MANAGE']);
  } finally {
    globalThis.Deno = previousDeno;
    globalThis.__KRISTOU_TEST_TG_CREATE_CLIENT__ = previousCreateClient;
  }
});

test('TG-RECOVERY-01 (IdentityContext handoff & TG-13): Telegram startup authenticates without setSession, survives INITIAL_SESSION, surfaces server/network authError, and keeps unlinked 404 silent', async () => {
  const dom = installNodeDomShim();
  const classSet = new Set();
  dom.document.documentElement.classList = {
    add: (...cls) => cls.forEach((c) => classSet.add(c)),
    remove: (...cls) => cls.forEach((c) => classSet.delete(c)),
    contains: (c) => classSet.has(c),
  };
  const { createRoot } = await import('react-dom/client');

  fs.mkdirSync(TEMP_DIR, { recursive: true });
  const outfile = path.join(TEMP_DIR, 'identity-tg-handoff.cjs');
  await build({
    entryPoints: [path.resolve(__dirname, '../src/context/IdentityContext.tsx')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    jsx: 'automatic',
    plugins: [
      {
        name: 'arch-repair-identity-mocks',
        setup(builder) {
          builder.onResolve({ filter: /(?:^|\/)supabase(\.ts)?$/ }, () => ({
            path: 'mock-supa',
            namespace: 'repair01',
          }));
          builder.onLoad({ filter: /^mock-supa$/, namespace: 'repair01' }, () => ({
            contents: `
              export const isSupabaseConfigured = true;
              export const supabase = new Proxy({}, {
                get(_, prop) { return globalThis.__REPAIR01_SUPA__?.[prop]; }
              });
              export const requireSupabaseClient = () => supabase;
              export const classifySupabaseError = (err) => ({ status: 'ERROR', errorCode: err?.code || 'error', errorMessage: err?.message || 'Error' });
            `,
          }));
          builder.onResolve({ filter: /(?:^|\/)telegram(\.ts)?$/ }, () => ({
            path: 'mock-tg',
            namespace: 'repair01',
          }));
          builder.onLoad({ filter: /^mock-tg$/, namespace: 'repair01' }, () => ({
            contents: `
              export const initializeTelegramWebApp = () => {};
              export const getTelegramWebAppInitData = () => globalThis.__REPAIR01_TG_INIT__ || null;
              export const createTelegramLinkUrl = (code) => 'https://t.me/KristouBot?startapp=' + code;
            `,
          }));
          builder.onResolve({ filter: /^[^./]/ }, (args) => ({
            path: require.resolve(args.path),
            external: true,
          }));
        },
      },
    ],
  });

  const { IdentityProvider, useIdentity } = require(outfile);

  let activeWebSession = null;
  let authListener = null;
  let signOutCount = 0;
  let invokeBehavior = 'approved';

  globalThis.__REPAIR01_TG_INIT__ = 'auth_date=1700000000&user=approved_parent';
  globalThis.__REPAIR01_SUPA__ = {
    auth: {
      getSession: async () => ({ data: { session: activeWebSession }, error: null }),
      onAuthStateChange: (cb) => {
        authListener = cb;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signOut: async () => {
        signOutCount += 1;
        activeWebSession = null;
        authListener?.('SIGNED_OUT', null);
      },
    },
    from: (table) => {
      const chain = {
        eq: () => chain,
        single: async () => ({
          data:
            table === 'profiles'
              ? {
                  id: 'tg-parent-approved',
                  username: 'nadia.parent',
                  full_name: 'Nadia Ben Youssef',
                  email: null,
                  avatar_url: null,
                  account_status: 'APPROVED',
                  requested_role: 'PARENT',
                }
              : null,
          error: null,
        }),
        maybeSingle: async () => ({
          data: table === 'telegram_identities' ? { telegram_user_id: 987654 } : null,
          error: null,
        }),
        then: (resolve) =>
          Promise.resolve({ data: table === 'role_assignments' ? [{ role: 'PARENT' }] : [], error: null }).then(resolve),
      };
      return { select: () => chain };
    },
    functions: {
      invoke: async () => {
        if (invokeBehavior === 'server_error') {
          return {
            data: null,
            error: {
              context: new Response(JSON.stringify({ error: 'telegram_unavailable' }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
              }),
            },
          };
        }
        if (invokeBehavior === 'unlinked_404') {
          return {
            data: null,
            error: {
              context: new Response(JSON.stringify({ error: 'telegram_not_linked' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
              }),
            },
          };
        }
        return {
          data: {
            ok: true,
            linked: false,
            user: {
              id: 'tg-parent-approved',
              username: 'nadia.parent',
              fullName: 'Nadia Ben Youssef',
              email: null,
              role: 'PARENT',
              account_status: 'APPROVED',
              capabilities: ['PARENT'],
              telegramLinked: true,
            },
          },
          error: null,
        };
      },
    },
  };

  let latestCtx = null;
  function Probe() {
    latestCtx = useIdentity();
    return React.createElement('div', null, latestCtx.currentUser?.id ?? 'none');
  }

  const container = dom.document.createElement('div');
  const root = createRoot(container);
  await act(async () => {
    root.render(React.createElement(IdentityProvider, { languageOverride: 'en' }, React.createElement(Probe)));
    await flushMicrotasks();
  });

  assert.equal(latestCtx.currentUser?.id, 'tg-parent-approved');
  assert.equal(latestCtx.currentUser?.accountStatus, 'APPROVED');
  assert.equal(latestCtx.isAuthenticated, true);
  assert.equal(latestCtx.currentRole, 'PARENT');
  assert.equal(latestCtx.authError, null);

  // INITIAL_SESSION with null GoTrue session MUST NOT wipe Telegram-authenticated user
  await act(async () => {
    await authListener?.('INITIAL_SESSION', null);
    await flushMicrotasks();
  });
  assert.equal(latestCtx.currentUser?.id, 'tg-parent-approved');
  assert.equal(latestCtx.isAuthenticated, true);

  // refreshCurrentUser MUST re-verify and preserve Telegram-authenticated user even without GoTrue session
  let refreshedUser = null;
  await act(async () => {
    refreshedUser = await latestCtx.refreshCurrentUser();
  });
  assert.equal(refreshedUser?.id, 'tg-parent-approved');
  assert.equal(latestCtx.isAuthenticated, true);

  // Conflicting Web session for another user MUST fail closed with telegram_identity_conflict
  await act(async () => {
    await authListener?.('SIGNED_IN', { user: { id: 'other-web-user' } });
    await flushMicrotasks();
  });
  assert.equal(latestCtx.currentUser, null);
  assert.equal(latestCtx.isAuthenticated, false);
  assert.equal(latestCtx.authError, 'telegram_identity_conflict');
  assert.ok(signOutCount >= 1);

  await act(async () => {
    root.unmount();
  });

  // TG-13 Case A: Server/network error (not 404) surfaces error code via authError
  invokeBehavior = 'server_error';
  globalThis.__REPAIR01_TG_INIT__ = 'auth_date=1700000001&start_param=link123&user=err';
  const rootErr = createRoot(container);
  await act(async () => {
    rootErr.render(React.createElement(IdentityProvider, { languageOverride: 'en' }, React.createElement(Probe)));
    await flushMicrotasks();
  });
  assert.equal(latestCtx.currentUser, null);
  assert.equal(latestCtx.authError, 'telegram_unavailable');
  assert.equal(latestCtx.telegramLinkNotice, 'error');
  await act(async () => {
    rootErr.unmount();
  });

  // TG-13 Case B: Unlinked 404 (telegram_not_linked) without start_param stays silent anonymous state
  invokeBehavior = 'unlinked_404';
  globalThis.__REPAIR01_TG_INIT__ = 'auth_date=1700000002&user=anon_tg';
  const rootAnon = createRoot(container);
  await act(async () => {
    rootAnon.render(React.createElement(IdentityProvider, { languageOverride: 'en' }, React.createElement(Probe)));
    await flushMicrotasks();
  });
  assert.equal(latestCtx.currentUser, null);
  assert.equal(latestCtx.authError, null);
  assert.equal(latestCtx.telegramLinkNotice, null);
  await act(async () => {
    rootAnon.unmount();
  });
});

test('FIX-CLS-01: fetchSchoolClassesWithRosters maps camelCase SQL JSON without inventing fake defaults', async () => {
  const client = {
    rpc: async (fnName) => {
      assert.equal(fnName, 'list_school_classes_with_rosters');
      return {
        data: [
          {
            id: 'cls-ce1',
            name: 'CE1-A',
            level: '2ème année (CE1)',
            levelCode: 'CE1',
            academicYear: '2025-2026',
            homeroomTeacherId: 'teacher-42',
            homeroomTeacherName: 'Sonia Trabelsi',
            activeStudentCount: 19,
            capacity: null,
            roomLabel: 'Salle B2',
            roster: [{ studentId: 's-1', studentCode: 'ST-01', fullName: 'Youssef', enrollmentStatus: 'ACTIVE', enrolledAt: '2025-09-15' }],
          },
          {
            id: 'cls-cm2',
            name: 'CM2-B',
            level: '5ème année (CM2)',
            levelCode: 'CM2',
            academicYear: '2024-2025',
            homeroomTeacherName: null,
            activeStudentCount: 24,
            capacity: 30,
            roomLabel: null,
            roster: [],
          },
        ],
        error: null,
      };
    },
  };

  const res = await academicsModule.fetchSchoolClassesWithRosters(client);
  assert.equal(res.ok, true);
  assert.equal(res.data.length, 2);

  assert.equal(res.data[0].levelCode, 'CE1');
  assert.equal(res.data[0].academicYear, '2025-2026');
  assert.equal(res.data[0].homeroomTeacherId, 'teacher-42');
  assert.equal(res.data[0].homeroomTeacherName, 'Sonia Trabelsi');
  assert.equal(res.data[0].activeStudentCount, 19);
  assert.equal(res.data[0].capacity, null);
  assert.equal(res.data[0].roomLabel, 'Salle B2');
  assert.equal(res.data[0].roster.length, 1);

  assert.equal(res.data[1].capacity, 30);
  assert.equal(res.data[1].homeroomTeacherId, null);
  assert.equal(res.data[1].roomLabel, null);

  // Missing required fields (academicYear / activeStudentCount) must fail rather than invent '2026-2027' or 0
  const malformedClient = {
    rpc: async () => ({
      data: [{ id: 'cls-bad', name: 'Bad Class', levelCode: 'CE2' }],
      error: null,
    }),
  };
  const badRes = await academicsModule.fetchSchoolClassesWithRosters(malformedClient);
  assert.equal(badRes.ok, false);
  assert.equal(badRes.errorCode, 'invalid_class_roster_payload');
});

test('FIX-COM-01: classCommunity aligns moderateClassQuestion p_hidden, author_user_id/author_name mapping, and announcement classId guard', async () => {
  const rpcCalls = [];
  const client = {
    rpc: async (fnName, params) => {
      rpcCalls.push({ fnName, params });
      if (fnName === 'moderate_class_question') {
        return { data: { id: params.p_question_id, is_hidden: params.p_hidden }, error: null };
      }
      if (fnName === 'post_class_question') {
        return {
          data: {
            id: 'q-99',
            class_id: params.p_class_id,
            author_user_id: 'parent-user-9',
            author_name: 'Rim Khelifi',
            content: params.p_content,
            created_at: '2026-11-23T10:00:00Z',
          },
          error: null,
        };
      }
      if (fnName === 'reply_class_question') {
        return {
          data: {
            id: 'rep-7',
            question_id: params.p_question_id,
            author_user_id: 'teacher-user-3',
            author_name: 'Mme Amel',
            content: params.p_content,
            created_at: '2026-11-23T10:05:00Z',
          },
          error: null,
        };
      }
      if (fnName === 'create_class_announcement') {
        return {
          data: {
            id: 'ann-5',
            class_id: params.p_class_id,
            title: params.p_title,
            body: params.p_body,
            priority: params.p_priority,
            author_name: 'Mme Amel',
            author_role: 'Enseignant',
            created_at: '2026-11-23T10:10:00Z',
          },
          error: null,
        };
      }
      return { data: null, error: null };
    },
  };

  // 1. moderateClassQuestion uses p_hidden (never p_is_hidden)
  const modRes = await classCommunityModule.moderateClassQuestion('q-99', true, client);
  assert.equal(modRes.ok, true);
  assert.equal(modRes.data.isHidden, true);
  assert.deepEqual(rpcCalls[0], {
    fnName: 'moderate_class_question',
    params: { p_question_id: 'q-99', p_hidden: true },
  });

  // 2. postClassQuestion preserves author_user_id & author_name without fabricating studentId or 'Parent'
  const qRes = await classCommunityModule.postClassQuestion('cls-1', 'Sortie jeudi ?', client);
  assert.equal(qRes.ok, true);
  assert.equal(qRes.data.authorUserId, 'parent-user-9');
  assert.equal(qRes.data.authorName, 'Rim Khelifi');
  assert.equal(qRes.data.studentId, '');
  assert.equal(qRes.data.studentName, 'Rim Khelifi');

  // 3. replyClassQuestion reads author_user_id
  const repRes = await classCommunityModule.replyClassQuestion('q-99', 'Oui à 9h.', client);
  assert.equal(repRes.ok, true);
  assert.equal(repRes.data.authorId, 'teacher-user-3');
  assert.equal(repRes.data.authorName, 'Mme Amel');

  // 4. createClassAnnouncement rejects missing/blank classId BEFORE RPC invocation
  const countBefore = rpcCalls.length;
  const emptyAnn1 = await classCommunityModule.createClassAnnouncement('', 'Titre', 'Contenu', 'NORMAL', client);
  const emptyAnn2 = await classCommunityModule.createClassAnnouncement({ classId: undefined, title: 'T', body: 'B' }, client);
  assert.equal(emptyAnn1.ok, false);
  assert.equal(emptyAnn1.errorCode, 'class_id_required');
  assert.equal(emptyAnn2.ok, false);
  assert.equal(emptyAnn2.errorCode, 'class_id_required');
  assert.equal(rpcCalls.length, countBefore, 'Empty classId must fail closed without invoking create_class_announcement RPC');

  const validAnn = await classCommunityModule.createClassAnnouncement('cls-1', 'Sortie', 'Rendez-vous 8h30', 'URGENT', client);
  assert.equal(validAnn.ok, true);
  assert.equal(validAnn.data.classId, 'cls-1');
  assert.equal(rpcCalls.at(-1).params.p_class_id, 'cls-1');
});
