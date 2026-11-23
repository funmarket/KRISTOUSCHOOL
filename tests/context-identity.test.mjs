import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import React, { act } from 'react';
import { installNodeDomShim } from './helpers/nodeDomShim.mjs';

const dom = installNodeDomShim();
const classSet = new Set();
dom.document.documentElement.classList = {
  add: (...cls) => cls.forEach((c) => classSet.add(c)),
  remove: (...cls) => cls.forEach((c) => classSet.delete(c)),
  contains: (c) => classSet.has(c),
};
const { createRoot } = await import('react-dom/client');

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function bundleIdentityContext() {
  const outdir = path.join('/tmp', 'kristou-arch02-tests');
  fs.mkdirSync(outdir, { recursive: true });
  const outfile = path.join(outdir, 'identity-context.cjs');

  await build({
    entryPoints: [path.resolve(__dirname, '../src/context/IdentityContext.tsx')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    jsx: 'automatic',
    plugins: [
      {
        name: 'arch02-identity-mocks',
        setup(builder) {
          builder.onResolve({ filter: /lib\/supabase(\.ts)?$/ }, () => ({
            path: 'mock-supabase',
            namespace: 'arch02',
          }));
          builder.onLoad({ filter: /^mock-supabase$/, namespace: 'arch02' }, () => ({
            contents: `
              export const supabase = new Proxy({}, {
                get(_, prop) {
                  return globalThis.__ARCH02_SUPABASE__?.[prop];
                }
              });
            `,
          }));
          builder.onResolve({ filter: /lib\/auth(\.ts)?$/ }, () => ({
            path: 'mock-auth',
            namespace: 'arch02',
          }));
          builder.onLoad({ filter: /^mock-auth$/, namespace: 'arch02' }, () => ({
            contents: `
              export const loadCanonicalUser = (...args) => globalThis.__ARCH02_AUTH__.loadCanonicalUser(...args);
              export const signInAccount = (...args) => globalThis.__ARCH02_AUTH__.signInAccount(...args);
              export const signOutAccount = (...args) => globalThis.__ARCH02_AUTH__.signOutAccount(...args);
              export const signUpAccount = (...args) => globalThis.__ARCH02_AUTH__.signUpAccount(...args);
              export const createTelegramLinkChallenge = (...args) => globalThis.__ARCH02_AUTH__.createTelegramLinkChallenge(...args);
              export const authenticateTelegramInitData = (...args) => globalThis.__ARCH02_AUTH__.authenticateTelegramInitData(...args);
            `,
          }));
          builder.onResolve({ filter: /lib\/telegram(\.ts)?$/ }, () => ({
            path: 'mock-telegram',
            namespace: 'arch02',
          }));
          builder.onLoad({ filter: /^mock-telegram$/, namespace: 'arch02' }, () => ({
            contents: `
              export const initializeTelegramWebApp = () => {};
              export const getTelegramWebAppInitData = () => globalThis.__ARCH02_TG_INIT_DATA__ || null;
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
  return require(outfile);
}

const { IdentityProvider, useIdentity } = await bundleIdentityContext();

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

test('ARCH-02 Gate 1: Line-count reduction (AppContext <= 1,100 lines, IdentityContext <= 420 lines) and zero direct .from/.rpc calls', () => {
  const appCtxPath = path.resolve(__dirname, '../src/context/AppContext.tsx');
  const idCtxPath = path.resolve(__dirname, '../src/context/IdentityContext.tsx');

  const appCtxSrc = fs.readFileSync(appCtxPath, 'utf8');
  const idCtxSrc = fs.readFileSync(idCtxPath, 'utf8');

  const countLines = (txt) => txt.split('\n').length - (txt.endsWith('\n') ? 1 : 0);
  const appLines = countLines(appCtxSrc);
  const idLines = countLines(idCtxSrc);

  assert.ok(appLines <= 1100, `AppContext.tsx must be <= 1,100 lines (got ${appLines})`);
  assert.ok(idLines <= 420, `IdentityContext.tsx must be <= 420 lines (got ${idLines})`);

  for (const [name, src] of [
    ['AppContext.tsx', appCtxSrc],
    ['IdentityContext.tsx', idCtxSrc],
  ]) {
    assert.doesNotMatch(src, /\.(from|rpc)\(/, `${name} must not contain direct .from( or .rpc( calls`);
    assert.doesNotMatch(src, /'GENERAL_USER'/, `${name} must not use GENERAL_USER as an active role state`);
  }
});

test('ARCH-02 Gate 2: IdentityContext hydrates approved session and fails closed with signOutAccount() on account_not_approved', async () => {
  let signOutCount = 0;
  let authChangeListener = null;
  let canonicalMode = 'unapproved';

  globalThis.__ARCH02_TG_INIT_DATA__ = null;
  globalThis.__ARCH02_SUPABASE__ = {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: 'u-pending', email: 'pending@kristou.test' } } },
        error: null,
      }),
      onAuthStateChange: (cb) => {
        authChangeListener = cb;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
  };
  globalThis.__ARCH02_AUTH__ = {
    loadCanonicalUser: async (sessionUser) => {
      if (canonicalMode === 'unapproved') {
        throw new Error('account_not_approved');
      }
      return {
        id: sessionUser.id,
        username: 'sami.parent',
        fullName: 'Sami Trabelsi',
        role: 'PARENT',
        accountStatus: 'APPROVED',
        capabilities: ['PARENT'],
      };
    },
    signInAccount: async () => ({ user: { id: 'u-1' } }),
    signOutAccount: async () => {
      signOutCount += 1;
    },
    signUpAccount: async () => ({ session: null, secondaryPhoneVerificationRequired: false }),
    createTelegramLinkChallenge: async () => ({ linkUrl: 'https://t.me/kristou_bot?start=123' }),
    authenticateTelegramInitData: async () => ({ user: null, linked: false }),
  };

  let latestIdentity = null;
  function Probe() {
    latestIdentity = useIdentity();
    return null;
  }

  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(IdentityProvider, { languageOverride: 'en' }, React.createElement(Probe)));
    await flushMicrotasks();
  });

  // Unapproved session on initial getSession must trigger signOutAccount() and keep currentUser null
  assert.equal(signOutCount, 1);
  assert.equal(latestIdentity.currentUser, null);
  assert.equal(latestIdentity.isAuthenticated, false);
  assert.equal(latestIdentity.isAuthLoading, false);

  // Auth state change with approved user hydrates canonical user
  canonicalMode = 'approved';
  await act(async () => {
    await authChangeListener('SIGNED_IN', { user: { id: 'u-approved', email: 'sami@kristou.test' } });
  });

  assert.equal(latestIdentity.currentUser?.id, 'u-approved');
  assert.equal(latestIdentity.currentRole, 'PARENT');
  assert.equal(latestIdentity.isAuthenticated, true);

  // Auth state change with unapproved user revokes session and clears currentUser
  canonicalMode = 'unapproved';
  await act(async () => {
    await authChangeListener('TOKEN_REFRESHED', { user: { id: 'u-revoked', email: 'sami@kristou.test' } });
  });

  assert.equal(signOutCount, 2);
  assert.equal(latestIdentity.currentUser, null);
  assert.equal(latestIdentity.isAuthenticated, false);

  await act(async () => {
    root.unmount();
  });
  dom.document.body.removeChild(container);
});

test('ARCH-02 Gate 3: IdentityContext login, register, logout, and refreshCurrentUser preserve error codes and prevent privilege escalation', async () => {
  let signOutCount = 0;
  let shouldApproveLogin = false;

  globalThis.__ARCH02_SUPABASE__ = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  };
  globalThis.__ARCH02_AUTH__ = {
    loadCanonicalUser: async (u) => {
      if (!shouldApproveLogin) {
        throw new Error('account_not_approved');
      }
      return {
        id: u.id,
        username: 'owner.kristou',
        fullName: 'Kristou Owner',
        role: 'APP_ADMIN',
        accountStatus: 'APPROVED',
        capabilities: ['APP_ADMIN'],
      };
    },
    signInAccount: async (identifier, pass) => {
      if (pass === 'wrong') {
        const err = new Error('Invalid login credentials');
        err.code = 'invalid_credentials';
        throw err;
      }
      return { user: { id: 'u-login', email: identifier } };
    },
    signOutAccount: async () => {
      signOutCount += 1;
    },
    signUpAccount: async () => ({
      session: null,
      secondaryPhoneVerificationRequired: true,
    }),
    createTelegramLinkChallenge: async () => ({ linkUrl: 'https://t.me/kristou_bot?start=abc' }),
    authenticateTelegramInitData: async () => ({ user: null, linked: false }),
  };

  let latestIdentity = null;
  function Probe() {
    latestIdentity = useIdentity();
    return null;
  }

  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(IdentityProvider, { languageOverride: 'en' }, React.createElement(Probe)));
    await flushMicrotasks();
  });

  // 1. Login with wrong password classifies as invalid_credentials and signs out
  let badRes;
  await act(async () => {
    badRes = await latestIdentity.login('owner@kristou.test', 'wrong');
  });
  assert.equal(badRes.success, false);
  assert.equal(badRes.errorCode, 'invalid_credentials');
  assert.equal(latestIdentity.currentUser, null);
  assert.equal(signOutCount, 1);

  // 2. Login with valid password but unapproved account classifies as account_not_approved and signs out
  let unapprovedRes;
  await act(async () => {
    unapprovedRes = await latestIdentity.login('owner@kristou.test', 'correct');
  });
  assert.equal(unapprovedRes.success, false);
  assert.equal(unapprovedRes.errorCode, 'account_not_approved');
  assert.equal(latestIdentity.currentUser, null);
  assert.equal(signOutCount, 2);

  // 3. Register requesting APP_ADMIN never grants active currentUser or currentRole
  let regRes;
  await act(async () => {
    regRes = await latestIdentity.register({
      fullName: 'Applicant',
      email: 'applicant@kristou.test',
      password: 'Password123!',
      requestedRole: 'APP_ADMIN',
    });
  });
  assert.equal(regRes.success, true);
  assert.equal(regRes.confirmationRequired, true);
  assert.equal(regRes.secondaryPhoneVerificationRequired, true);
  assert.equal(latestIdentity.currentUser, null);
  assert.equal(latestIdentity.currentRole, null);

  // 4. Approved login succeeds and sets currentUser; logout clears currentUser and increments generation
  shouldApproveLogin = true;
  const genBeforeLogin = latestIdentity.identityContext.generation;
  let okRes;
  await act(async () => {
    okRes = await latestIdentity.signIn('owner@kristou.test', 'correct');
  });
  assert.equal(okRes.success, true);
  assert.equal(latestIdentity.currentUser?.role, 'APP_ADMIN');
  assert.equal(latestIdentity.isAuthenticated, true);
  assert.ok(latestIdentity.identityContext.generation > genBeforeLogin);

  const genAtLogin = latestIdentity.identityContext.generation;
  await act(async () => {
    latestIdentity.logout();
  });
  assert.equal(latestIdentity.currentUser, null);
  assert.equal(latestIdentity.currentRole, null);
  assert.equal(latestIdentity.isAuthenticated, false);
  assert.ok(latestIdentity.identityContext.generation > genAtLogin);

  await act(async () => {
    root.unmount();
  });
  dom.document.body.removeChild(container);
});
