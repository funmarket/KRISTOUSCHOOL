import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('anonymous visitors never receive an account role alias', () => {
  const types = read('src/types.ts');
  const context = read('src/context/AppContext.tsx');

  assert.match(types, /export type AccountRole\s*=/);
  assert.match(types, /role: AccountRole;/);
  assert.doesNotMatch(types, /PublicVisitorRole|\bUserRole\b|GENERAL_USER/);
  assert.match(context, /currentRole: AccountRole \| null;/);
  assert.match(context, /currentUser\?\.role \?\? null/);
  assert.doesNotMatch(context, /GENERAL_USER|\bsetCurrentRole\b|setCurrentRoleState|MOCK_USERS/);
});

test('signup role type accepts only canonical account roles', () => {
  const auth = read('src/lib/auth.ts');
  const modal = read('src/components/AuthModal.tsx');

  assert.match(auth, /export type SignupRole = RegistrationRole;/);
  assert.match(modal, /type RegistrationRole = SignupRole;/);
  assert.doesNotMatch(auth, /GENERAL_USER|\bUserRole\b/);
  assert.doesNotMatch(modal, /GENERAL_USER/);

  const options = [...modal.matchAll(/<option value="(APP_ADMIN|MANAGER|PARENT|STUDENT|TEACHER|SCHOOL_STAFF|ADMINISTRATIVE_PERSONNEL)"/g)]
    .map((match) => match[1]);
  assert.equal(options.length, 7);
  assert.equal(new Set(options).size, 7);
});

test('Telegram frontend rejects absent or unapproved canonical role', () => {
  const auth = read('src/lib/auth.ts');
  assert.match(auth, /resolveCanonicalAccountRole\(\[rawUser\.role \?\? '', \.\.\.capabilities\]\)/);
  assert.match(auth, /if \(!roleName\) throw new Error\('account_not_approved'\);/);
  assert.doesNotMatch(auth, /roleMap\[roleName\] \?\? 'GENERAL_USER'/);
});

test('Telegram edge rejects identities without an active canonical role', () => {
  const edge = read('supabase/functions/telegram-auth/index.ts');
  assert.match(edge, /allowedRoles\.includes\(role\)/);
  assert.match(edge, /if \(!role\) return json\(\{ error: 'account_not_approved' \}, 403\);/);
  assert.doesNotMatch(edge, /GENERAL_USER/);
});

test('registration notice reports pending school review in all three locales', () => {
  const messages = read('src/i18n/authMessages.ts');
  const modal = read('src/components/AuthModal.tsx');
  assert.match(messages, /export function registrationPendingMessage/);
  assert.match(modal, /registrationPendingMessage\(language, result\.confirmationRequired === true\)/);
  for (const locale of ['en', 'fr', 'ar']) {
    assert.match(messages, new RegExp(`\\b${locale}:\\s*['"]`));
  }
});
