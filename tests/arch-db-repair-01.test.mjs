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

test('FIX-TG-01 (Client): authenticateTelegramInitData enforces APPROVED accountStatus, rejects GENERAL_USER, and preserves MANAGER grants', async () => {
  const makeClient = (returnedUser) => ({
    functions: {
      invoke: async (fnName) => {
        assert.equal(fnName, 'telegram-auth');
        return { data: { linked: true, user: returnedUser }, error: null };
      },
    },
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

  // Approved account with GENERAL_USER fallback must still fail closed
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

  // Approved MANAGER receives accountStatus APPROVED, merged capabilities, and delegated oversight access
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
});

test('FIX-TG-01 (Edge Function): telegram-auth rejects non-APPROVED accounts, removes GENERAL_USER fallback, and resolves manager_capability_grants', async () => {
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
  };

  globalThis.Deno = {
    env: { get: (k) => mockEnv[k] },
    serve: () => {},
  };

  globalThis.__KRISTOU_TEST_TG_CREATE_CLIENT__ = () => ({
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
    const validInitData = buildSignedTelegramInitData(TEST_BOT_TOKEN, {
      auth_date: String(nowSec),
      query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
      user: JSON.stringify({ id: 424242, first_name: 'Salma', username: 'salma_tg' }),
    });

    const invoke = async () => {
      const req = new Request('https://ofppapwofhovhroyjtkc.supabase.co/functions/v1/telegram-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: validInitData }),
      });
      const res = await edgeMod.handleTelegramAuth(req);
      return { status: res.status, body: await res.json() };
    };

    // Case 1: PENDING profile rejected 403
    mockDbState = {
      identity: { user_id: 'pending-1' },
      profile: {
        id: 'pending-1',
        username: 'pending_tg',
        full_name: 'Pending User',
        email: null,
        avatar_url: null,
        account_status: 'PENDING',
      },
      roles: [{ role: 'PARENT' }],
      grants: [],
    };
    const pendingRes = await invoke();
    assert.equal(pendingRes.status, 403);
    assert.equal(pendingRes.body.error, 'account_not_approved');

    // Case 2: APPROVED profile without canonical active role rejected 403 (no GENERAL_USER fallback)
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
    };
    const noRoleRes = await invoke();
    assert.equal(noRoleRes.status, 403);
    assert.equal(noRoleRes.body.error, 'account_not_approved');

    // Case 3: APPROVED MANAGER receives account_status + manager_capabilities + merged capabilities
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
    };
    const okRes = await invoke();
    assert.equal(okRes.status, 200);
    assert.equal(okRes.body.user.account_status, 'APPROVED');
    assert.equal(okRes.body.user.accountStatus, 'APPROVED');
    assert.equal(okRes.body.user.role, 'MANAGER');
    assert.deepEqual(okRes.body.user.manager_capabilities, ['OVERSIGHT:TEACHER_HOME', 'CLASSES_MANAGE']);
    assert.deepEqual(okRes.body.user.capabilities, ['MANAGER', 'OVERSIGHT:TEACHER_HOME', 'CLASSES_MANAGE']);

    // Verify client roundtrip with exact server JSON payload
    const clientRes = await authModule.authenticateTelegramInitData('edge_roundtrip', {
      functions: {
        invoke: async () => ({ data: okRes.body, error: null }),
      },
    });
    assert.equal(clientRes.user.accountStatus, 'APPROVED');
    assert.deepEqual(clientRes.user.capabilities, ['MANAGER', 'OVERSIGHT:TEACHER_HOME', 'CLASSES_MANAGE']);
  } finally {
    globalThis.Deno = previousDeno;
    globalThis.__KRISTOU_TEST_TG_CREATE_CLIENT__ = previousCreateClient;
  }
});

test('FIX-TG-01 (IdentityContext handoff): Telegram startup authenticates approved user into isAuthenticated true', async () => {
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

  globalThis.__REPAIR01_TG_INIT__ = 'auth_date=1700000000&user=approved_parent';
  globalThis.__REPAIR01_SUPA__ = {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: async () => {},
    },
    functions: {
      invoke: async () => ({
        data: {
          linked: false,
          user: {
            id: 'tg-parent-approved',
            username: 'nadia.parent',
            fullName: 'Nadia Ben Youssef',
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
