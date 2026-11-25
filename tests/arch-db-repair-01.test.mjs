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

const supabaseModule = await import('../src/lib/supabase.ts');
const { createClient } = await import('@supabase/supabase-js');

const TEST_JWT_SECRET = 'tg-parity-01-test-postgrest-jwt-secret-32b';

function decodeJwtForTest(token) {
  const parts = token.split('.');
  assert.equal(parts.length, 3, 'Expected 3-part JWT');
  const [headerB64, payloadB64, sigB64] = parts;
  const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  return { header, payload, signingInput: `${headerB64}.${payloadB64}`, sigB64 };
}

function verifyHs256JwtForTest(token, secret) {
  const { header, payload, signingInput, sigB64 } = decodeJwtForTest(token);
  assert.equal(header.alg, 'HS256');
  const expectedSig = crypto.createHmac('sha256', secret).update(signingInput).digest('base64url');
  assert.equal(sigB64, expectedSig, 'JWT signature must verify with server HS256 secret');
  return payload;
}

function makeTestHs256Jwt(claims, secret = TEST_JWT_SECRET) {
  const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signingInput = `${headerB64}.${payloadB64}`;
  const sigB64 = crypto.createHmac('sha256', secret).update(signingInput).digest('base64url');
  return `${signingInput}.${sigB64}`;
}

test('TG-PARITY-01 (Client): authenticateTelegramInitData attaches in-memory API bearer without calling setSession, validates claims, and rejects unapproved/conflicting states', async () => {
  supabaseModule.clearTelegramApiAuthorization();
  authModule.clearTelegramAuthCache?.();

  const futureExp = Math.floor(Date.now() / 1000) + 900;
  const makeClient = (returnedUser, extra = {}) => ({
    functions: {
      invoke: async (fnName) => {
        assert.equal(fnName, 'telegram-auth');
        return {
          data: {
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
    assert.equal(supabaseModule.getTelegramApiAuthorization(), null);
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

  // Missing or invalid apiToken when apiToken is required fails closed without anon fallback
  await assert.rejects(
    () =>
      authModule.authenticateTelegramInitData('init_missing_api_token', {
        requireApiToken: true,
        functions: {
          invoke: async () => ({
            data: {
              linked: false,
              user: { id: 'u-1', username: 'u1', role: 'PARENT', account_status: 'APPROVED', capabilities: ['PARENT'] },
            },
            error: null,
          }),
        },
      }),
    /telegram_api_authorization_unavailable/,
  );

  await assert.rejects(
    () =>
      authModule.authenticateTelegramInitData('init_wrong_sub_token', {
        functions: {
          invoke: async () => ({
            data: {
              linked: false,
              apiToken: makeTestHs256Jwt({ sub: 'other-user', role: 'authenticated', exp: futureExp }),
              user: { id: 'u-1', username: 'u1', role: 'PARENT', account_status: 'APPROVED', capabilities: ['PARENT'] },
            },
            error: null,
          }),
        },
      }),
    /telegram_api_authorization_unavailable/,
  );

  // Conflict: active Web session belonging to another canonical user must fail closed
  await assert.rejects(
    () =>
      authModule.authenticateTelegramInitData('init_conflict_user', {
        functions: {
          invoke: async () => ({
            data: {
              linked: false,
              apiToken: makeTestHs256Jwt({ sub: 'u-tg', role: 'authenticated', exp: futureExp }),
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
  assert.equal(supabaseModule.getTelegramApiAuthorization(), null);

  // Valid approved user attaches in-memory bearer token and NEVER invokes auth.setSession
  let setSessionCalled = false;
  const validPhoneToken = makeTestHs256Jwt({ sub: 'u-phone-1', role: 'authenticated', exp: futureExp });
  const phoneResult = await authModule.authenticateTelegramInitData('init_phone_approved', {
    functions: {
      invoke: async () => ({
        data: {
          linked: false,
          apiToken: validPhoneToken,
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
  assert.equal(phoneResult.apiToken, validPhoneToken);
  assert.equal(phoneResult.user.id, 'u-phone-1');
  assert.equal(supabaseModule.getTelegramApiAuthorization()?.userId, 'u-phone-1');
  assert.equal(supabaseModule.getTelegramApiAuthorization()?.token, validPhoneToken);

  // Approved MANAGER preserves MANAGER role and delegated manager_capabilities
  const mgrToken = makeTestHs256Jwt({ sub: 'u-mgr-1', role: 'authenticated', exp: futureExp });
  const managerResult = await authModule.authenticateTelegramInitData(
    'init_mgr_1',
    makeClient(
      {
        id: 'u-mgr-1',
        username: 'salma.manager',
        fullName: 'Salma Ben Salah',
        role: 'MANAGER',
        account_status: 'APPROVED',
        capabilities: ['GENERAL_USER', 'MANAGER'],
        manager_capabilities: ['OVERSIGHT:TEACHER_HOME', 'CLASSES_MANAGE'],
        telegramLinked: true,
      },
      { apiToken: mgrToken },
    ),
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

  supabaseModule.clearTelegramApiAuthorization();
});

test('TG-PARITY-01 (Edge Function): telegram-auth supports email & phone-only approved accounts, explicit link claim, signing-secret guard, and rejects invalid/unlinked/suspended/revoked/banned', async () => {
  const previousDeno = globalThis.Deno;
  const previousCreateClient = globalThis.__KRISTOU_TEST_TG_CREATE_CLIENT__;
  supabaseModule.clearTelegramApiAuthorization();

  const mockEnv = {
    ALLOWED_ORIGIN: 'http://localhost:3000',
    TELEGRAM_BOT_TOKEN: TEST_BOT_TOKEN,
    SUPABASE_URL: 'https://ofppapwofhovhroyjtkc.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    APP_JWT_SECRET: TEST_JWT_SECRET,
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
      assert.equal(rejectedRes.body.apiToken, undefined);
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

    // Case 6: APPROVED phone-only account WITHOUT email succeeds 200 with signed apiToken and NO session object
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
    assert.equal(phoneOnlyRes.body.session, undefined, 'Must never issue a GoTrue session object');
    assert.equal(typeof phoneOnlyRes.body.apiToken, 'string');
    const phoneJwtClaims = verifyHs256JwtForTest(phoneOnlyRes.body.apiToken, TEST_JWT_SECRET);
    assert.equal(phoneJwtClaims.sub, 'phone-only-1');
    assert.equal(phoneJwtClaims.role, 'authenticated');
    assert.equal(phoneJwtClaims.aud, 'authenticated');
    assert.equal(phoneOnlyRes.body.user.id, 'phone-only-1');
    assert.equal(phoneOnlyRes.body.user.role, 'APP_ADMIN');
    assert.equal(phoneOnlyRes.body.user.accountStatus, 'APPROVED');

    // Case 7: Explicit linking with start_param claims challenge atomically and issues apiToken for linked MANAGER
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
    assert.equal(okRes.body.linked, true);
    assert.equal(mockDbState.rpcCalls[0]?.fnName, 'claim_telegram_account_link');
    assert.equal(okRes.body.session, undefined);
    const mgrClaims = verifyHs256JwtForTest(okRes.body.apiToken, TEST_JWT_SECRET);
    assert.equal(mgrClaims.sub, 'mgr-1');
    assert.equal(mgrClaims.role, 'authenticated');
    assert.equal(okRes.body.user.role, 'MANAGER');
    assert.deepEqual(okRes.body.user.manager_capabilities, ['OVERSIGHT:TEACHER_HOME', 'CLASSES_MANAGE']);
    assert.deepEqual(okRes.body.user.capabilities, ['MANAGER', 'OVERSIGHT:TEACHER_HOME', 'CLASSES_MANAGE']);

    // Case 8: Client roundtrip attaches exact apiToken and verifies real @supabase/supabase-js transport for all 9 operations
    const clientRes = await authModule.authenticateTelegramInitData('edge_roundtrip', {
      functions: {
        invoke: async () => ({ data: okRes.body, error: null }),
      },
    });
    assert.equal(clientRes.user.accountStatus, 'APPROVED');
    assert.deepEqual(clientRes.user.capabilities, ['MANAGER', 'OVERSIGHT:TEACHER_HOME', 'CLASSES_MANAGE']);
    assert.equal(supabaseModule.getTelegramApiAuthorization()?.token, okRes.body.apiToken);

    const capturedRequests = [];
    const transportUrl = 'https://ofppapwofhovhroyjtkc.supabase.co';
    const transportAnonKey = 'sb_anon_public_key_example';
    const spyFetch = async (input, init) => {
      const reqUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const headers = new Headers(init?.headers);
      capturedRequests.push({
        url: reqUrl,
        authorization: headers.get('Authorization'),
        apikey: headers.get('apikey'),
      });
      if (reqUrl.includes('/rest/v1/user_notifications')) {
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (reqUrl.includes('/rest/v1/user_preferences')) {
        return new Response(JSON.stringify(null), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const realSupa = createClient(transportUrl, transportAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: supabaseModule.createTelegramAuthorizedFetch(transportUrl, transportAnonKey, spyFetch) },
    });

    await realSupa.rpc('governance_get_actor_scope');
    await realSupa.rpc('governance_list_pending_accounts', { p_limit: 25, p_offset: 0 });
    await realSupa.rpc('governance_list_account_directory', { p_limit: 25, p_offset: 0 });
    await realSupa.rpc('governance_get_account_detail', { p_target_user_id: 'u-2' });
    await realSupa.from('user_notifications').select('id,category,title,body,target_tab,target_ref_id,is_read,created_at');
    await realSupa.rpc('mark_user_notification_read', { p_notification_id: 'n-1' });
    await realSupa.rpc('mark_all_user_notifications_read');
    await realSupa.from('user_preferences').select('language,theme,notification_sound,sound_muted,vibration_enabled').maybeSingle();
    await realSupa.rpc('upsert_my_preferences', { p_language: 'fr' });

    assert.equal(capturedRequests.length, 9);
    for (const req of capturedRequests) {
      assert.equal(req.authorization, `Bearer ${okRes.body.apiToken}`, `Expected Telegram bearer JWT on ${req.url}`);
      assert.notEqual(req.authorization, `Bearer ${transportAnonKey}`, `Must never fall back to anon on ${req.url}`);
      assert.equal(req.apikey, transportAnonKey);
    }

    // Conflict protection in transport: Web session for another user ID fails closed 403 before network call
    const conflictReqCountBefore = capturedRequests.length;
    const conflictingWebJwt = makeTestHs256Jwt({ sub: 'different-web-user', role: 'authenticated', exp: nowSec + 600 });
    const conflictRes = await supabaseModule.createTelegramAuthorizedFetch(transportUrl, transportAnonKey, spyFetch)(
      `${transportUrl}/rest/v1/user_preferences`,
      { headers: { Authorization: `Bearer ${conflictingWebJwt}`, apikey: transportAnonKey } },
    );
    assert.equal(conflictRes.status, 403);
    assert.equal(capturedRequests.length, conflictReqCountBefore, 'Conflicting web vs Telegram identity must not hit network');

    // Missing signing secret fails closed 503 BEFORE claim_telegram_account_link runs
    mockDbState.rpcCalls = [];
    delete mockEnv.APP_JWT_SECRET;
    const unconfiguredRes = await invoke(linkInitData);
    assert.equal(unconfiguredRes.status, 503);
    assert.equal(unconfiguredRes.body.error, 'telegram_auth_signing_unconfigured');
    assert.equal(mockDbState.rpcCalls.length, 0, 'Must not consume link challenge when signing secret is missing');
  } finally {
    supabaseModule.clearTelegramApiAuthorization();
    globalThis.Deno = previousDeno;
    globalThis.__KRISTOU_TEST_TG_CREATE_CLIENT__ = previousCreateClient;
  }
});

test('TG-PARITY-01 (IdentityContext handoff): Telegram startup authenticates without setSession, survives INITIAL_SESSION/refreshCurrentUser, rejects Web conflict, and clears on SIGNED_OUT', async () => {
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
              export const clearTelegramApiAuthorization = () => { globalThis.__REPAIR01_TG_TOKEN__ = null; };
              export const setTelegramApiAuthorization = (tok, uid) => {
                globalThis.__REPAIR01_TG_TOKEN__ = { token: tok, userId: uid };
                return globalThis.__REPAIR01_TG_TOKEN__;
              };
              export const getTelegramApiAuthorization = () => globalThis.__REPAIR01_TG_TOKEN__ || null;
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

  const expFuture = Math.floor(Date.now() / 1000) + 900;
  const tgToken = makeTestHs256Jwt({ sub: 'tg-parent-approved', role: 'authenticated', exp: expFuture });
  let activeWebSession = null;
  let authListener = null;
  let tokenSnapshotWhenAuthenticated = null;
  let signOutCount = 0;

  globalThis.__REPAIR01_TG_TOKEN__ = null;
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
      invoke: async () => ({
        data: {
          linked: false,
          apiToken: tgToken,
          expiresInSeconds: 900,
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
      }),
    },
  };

  let latestCtx = null;
  function Probe() {
    latestCtx = useIdentity();
    if (latestCtx.currentUser && !tokenSnapshotWhenAuthenticated) {
      tokenSnapshotWhenAuthenticated = globalThis.__REPAIR01_TG_TOKEN__?.token ?? null;
    }
    return React.createElement('div', null, latestCtx.currentUser?.id ?? 'none');
  }

  const container = dom.document.createElement('div');
  const root = createRoot(container);
  await act(async () => {
    root.render(React.createElement(IdentityProvider, { languageOverride: 'en' }, React.createElement(Probe)));
    await flushMicrotasks();
  });

  assert.equal(tokenSnapshotWhenAuthenticated, tgToken, 'Telegram API bearer must be active BEFORE currentUser is committed');
  assert.equal(latestCtx.currentUser?.id, 'tg-parent-approved');
  assert.equal(latestCtx.currentUser?.accountStatus, 'APPROVED');
  assert.equal(latestCtx.isAuthenticated, true);
  assert.equal(latestCtx.currentRole, 'PARENT');

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
  assert.equal(globalThis.__REPAIR01_TG_TOKEN__, null);
  assert.ok(signOutCount >= 1);

  await act(async () => {
    root.unmount();
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
