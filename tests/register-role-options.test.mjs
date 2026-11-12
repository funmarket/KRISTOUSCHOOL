import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { translations } from '../src/i18n/translations.ts';

globalThis.__KRISTOU_SUPABASE_URL__ = '';
globalThis.__KRISTOU_SUPABASE_PUBLISHABLE_KEY__ = '';

const authModule = await import('../src/lib/auth.ts');

const EXPECTED_SEVEN_ROLES = [
  'APP_ADMIN',
  'MANAGER',
  'PARENT',
  'STUDENT',
  'TEACHER',
  'SCHOOL_STAFF',
  'ADMINISTRATIVE_PERSONNEL',
];

const FORBIDDEN_ROLE_OPTIONS = ['GENERAL_USER', 'PUBLIC', 'ADMIN'];

function extractAuthModalOptionValues(source) {
  const selectMatch = source.match(/<select[^>]*value=\{requestedRole\}[\s\S]*?<\/select>/);
  assert.ok(selectMatch, 'Expected requestedRole <select> in AuthModal.tsx');
  const optionMatches = [...selectMatch[0].matchAll(/<option\s+value="([^"]+)"/g)];
  return optionMatches.map((m) => m[1]);
}

test('Test A — Register form contains the exact seven role options and no forbidden roles', () => {
  const authModalSource = fs.readFileSync(new URL('../src/components/AuthModal.tsx', import.meta.url), 'utf8');
  const optionValues = extractAuthModalOptionValues(authModalSource);

  assert.equal(optionValues.length, 7, `Expected exactly 7 options in AuthModal Register selector, found ${optionValues.length}: ${optionValues.join(', ')}`);
  assert.deepEqual(
    new Set(optionValues),
    new Set(EXPECTED_SEVEN_ROLES),
    `Expected exact seven roles ${EXPECTED_SEVEN_ROLES.join(', ')}, got ${optionValues.join(', ')}`,
  );

  for (const forbidden of FORBIDDEN_ROLE_OPTIONS) {
    assert.equal(optionValues.includes(forbidden), false, `Forbidden role ${forbidden} must not appear in Register options`);
  }

  assert.ok(Array.isArray(authModule.REGISTRATION_ROLES), 'Expected REGISTRATION_ROLES to be exported from src/lib/auth.ts');
  assert.equal(authModule.REGISTRATION_ROLES.length, 7);
  assert.deepEqual(new Set(authModule.REGISTRATION_ROLES), new Set(EXPECTED_SEVEN_ROLES));
});

test('Test A.2 — Arabic, French, and English translations exist for all seven registration roles', () => {
  const authModalSource = fs.readFileSync(new URL('../src/components/AuthModal.tsx', import.meta.url), 'utf8');
  for (const role of EXPECTED_SEVEN_ROLES) {
    assert.match(authModalSource, new RegExp(`\\b${role}:\\s*t\\(`), `Expected roleLabel mapping in AuthModal.tsx for ${role}`);
  }

  for (const locale of ['ar', 'fr', 'en']) {
    const dict = translations[locale];
    assert.ok(dict.roleParent && dict.roleParent.length > 0, `Missing roleParent in ${locale}`);
    assert.ok(dict.roleStudent && dict.roleStudent.length > 0, `Missing roleStudent in ${locale}`);
    assert.ok(dict.roleTeacher && dict.roleTeacher.length > 0, `Missing roleTeacher in ${locale}`);
    assert.ok(dict.roleSchoolStaff && dict.roleSchoolStaff.length > 0, `Missing roleSchoolStaff in ${locale}`);
    assert.ok(dict.roleAdministrativePersonnel && dict.roleAdministrativePersonnel.length > 0, `Missing roleAdministrativePersonnel in ${locale}`);
    assert.ok(dict.roleManager && dict.roleManager.length > 0, `Missing roleManager in ${locale}`);
    assert.ok(dict.roleAdmin && dict.roleAdmin.length > 0, `Missing roleAdmin in ${locale}`);
  }
});

test('Test B — Role selector placement: only in Register mode of AuthModal, absent in Sign in, Navbar, HomeView, and RegistrationView', () => {
  const authModalSource = fs.readFileSync(new URL('../src/components/AuthModal.tsx', import.meta.url), 'utf8');
  const navbarSource = fs.readFileSync(new URL('../src/components/Navbar.tsx', import.meta.url), 'utf8');
  const homeSource = fs.readFileSync(new URL('../src/components/views/HomeView.tsx', import.meta.url), 'utf8');
  const registrationViewSource = fs.readFileSync(new URL('../src/components/views/RegistrationView.tsx', import.meta.url), 'utf8');

  // In AuthModal, the role select is inside {mode === 'signup' && <> ... </>}
  const signupBlockMatch = authModalSource.match(/\{mode === 'signup' && <>([\s\S]*?)<\/>\}/);
  assert.ok(signupBlockMatch, 'Expected mode === "signup" block in AuthModal.tsx');
  assert.match(signupBlockMatch[1], /<select[^>]*value=\{requestedRole\}/);

  // Outside the signup block, there must be no <select> in AuthModal
  const outsideSignup = authModalSource.replace(signupBlockMatch[0], '');
  assert.doesNotMatch(outsideSignup, /<select\b/);

  // Navbar only has language select, no role selector
  const navbarSelects = [...navbarSource.matchAll(/<select\b[\s\S]*?<\/select>/g)];
  assert.equal(navbarSelects.length, 1, 'Navbar should only have the language <select>');
  assert.match(navbarSelects[0][0], /value=\{language\}/);

  // HomeView has no <select>
  assert.doesNotMatch(homeSource, /<select\b/);

  // RegistrationView is the separate student admission page (only desiredLevel select, no requestedRole)
  assert.doesNotMatch(registrationViewSource, /requestedRole|SCHOOL_STAFF|ADMINISTRATIVE_PERSONNEL|APP_ADMIN|MANAGER/);
});

test('Test C — Request payload: each of the seven roles produces the exact requested_role payload', async () => {
  assert.equal(typeof authModule.isRegistrationRole, 'function', 'Expected isRegistrationRole helper in src/lib/auth.ts');

  for (const role of EXPECTED_SEVEN_ROLES) {
    assert.equal(authModule.isRegistrationRole(role), true, `Expected ${role} to be a valid RegistrationRole`);
    const capturedCalls = [];
    const mockClient = {
      auth: {
        signUp: async (payload) => {
          capturedCalls.push(payload);
          return { data: { user: { id: '00000000-0000-4000-8000-000000000099' }, session: null }, error: null };
        },
      },
    };

    await authModule.signUpAccount(
      {
        username: `applicant_${role.toLowerCase().slice(0, 12)}`,
        password: 'StrongPassword123!',
        email: `${role.toLowerCase()}@example.com`,
        fullName: `Applicant ${role}`,
        requestedRole: role,
        staffId: ['TEACHER', 'SCHOOL_STAFF', 'ADMINISTRATIVE_PERSONNEL'].includes(role) ? 'STF-100' : undefined,
        admissionId: role === 'STUDENT' ? 'ADM-200' : undefined,
      },
      mockClient,
    );

    assert.equal(capturedCalls.length, 1);
    assert.equal(capturedCalls[0].options.data.requested_role, role, `Expected requested_role to equal ${role}`);
  }

  for (const invalidRole of FORBIDDEN_ROLE_OPTIONS) {
    assert.equal(authModule.isRegistrationRole(invalidRole), false, `Expected ${invalidRole} to be rejected as RegistrationRole`);
  }
});

test('Test D — No privilege escalation: selecting APP_ADMIN or MANAGER does not grant active role authority', async () => {
  const appContextSource = fs.readFileSync(new URL('../src/context/AppContext.tsx', import.meta.url), 'utf8');
  const signupFnMatch = appContextSource.match(/const signup = async[\s\S]*?^\s{2}\};/m);
  assert.ok(signupFnMatch, 'Expected signup function in AppContext.tsx');

  // signup() in AppContext must not set currentUser or currentRoleState from requestedRole
  assert.doesNotMatch(signupFnMatch[0], /setCurrentUser\(/);
  assert.doesNotMatch(signupFnMatch[0], /setCurrentRoleState\(/);
});

test('Test E — Existing form regression: conditional fields and username/contact validation remain intact', async () => {
  const authModalSource = fs.readFileSync(new URL('../src/components/AuthModal.tsx', import.meta.url), 'utf8');

  // Existing conditional field rules preserved
  assert.match(authModalSource, /const isStudent = requestedRole === 'STUDENT';/);
  assert.match(authModalSource, /const isParent = requestedRole === 'PARENT';/);
  assert.match(authModalSource, /const isEmployee = requestedRole === 'SCHOOL_STAFF' \|\| requestedRole === 'ADMINISTRATIVE_PERSONNEL';/);
  assert.match(authModalSource, /const isStaffLike = requestedRole === 'TEACHER' \|\| isEmployee;/);

  // Username validation still enforced
  await assert.rejects(
    () =>
      authModule.signUpAccount({
        username: 'ab', // invalid (< 3 chars)
        password: 'StrongPassword123!',
        email: 'valid@example.com',
        fullName: 'Valid Name',
        requestedRole: 'PARENT',
      }),
    /invalid_username_format/,
  );
});
