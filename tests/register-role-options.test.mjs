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

test('Test F — G1 canonical role reconciliation: APP_ADMIN preserved, EMPLOYEE/PRINCIPAL/GENERAL_USER/PUBLIC/ADMIN fail closed', () => {
  assert.equal(typeof authModule.resolveCanonicalAccountRole, 'function', 'Expected resolveCanonicalAccountRole helper in src/lib/auth.ts');

  // All 7 canonical account roles resolve to themselves (APP_ADMIN never maps to ADMIN)
  for (const role of EXPECTED_SEVEN_ROLES) {
    assert.equal(authModule.resolveCanonicalAccountRole([role]), role, `Expected ${role} to resolve to ${role}`);
    assert.equal(authModule.resolveCanonicalAccountRole(['GENERAL_USER', role]), role, `Expected ['GENERAL_USER', '${role}'] to resolve to ${role}`);
  }

  // APP_ADMIN takes precedence when multiple roles exist
  assert.equal(authModule.resolveCanonicalAccountRole(['PARENT', 'APP_ADMIN']), 'APP_ADMIN');

  // Pending applicant with only GENERAL_USER or no active roles fails closed (null)
  assert.equal(authModule.resolveCanonicalAccountRole([]), null);
  assert.equal(authModule.resolveCanonicalAccountRole(['GENERAL_USER']), null);

  // Legacy / unverified database roles EMPLOYEE and PRINCIPAL fail closed when alone (never promoted to MANAGER)
  assert.equal(authModule.resolveCanonicalAccountRole(['EMPLOYEE']), null);
  assert.equal(authModule.resolveCanonicalAccountRole(['PRINCIPAL']), null);
  assert.equal(authModule.resolveCanonicalAccountRole(['GENERAL_USER', 'EMPLOYEE']), null);
  assert.equal(authModule.resolveCanonicalAccountRole(['GENERAL_USER', 'PRINCIPAL']), null);

  // If a user has both a legacy role and a valid canonical role, the valid canonical role is preserved without promoting the legacy role
  assert.equal(authModule.resolveCanonicalAccountRole(['EMPLOYEE', 'TEACHER']), 'TEACHER');
  assert.equal(authModule.resolveCanonicalAccountRole(['PRINCIPAL', 'APP_ADMIN']), 'APP_ADMIN');

  // Obsolete frontend aliases PUBLIC and ADMIN fail closed
  assert.equal(authModule.resolveCanonicalAccountRole(['PUBLIC']), null);
  assert.equal(authModule.resolveCanonicalAccountRole(['ADMIN']), null);

  // Verify src/types.ts defines AccountRole with APP_ADMIN and excludes PUBLIC, ADMIN, and GENERAL_USER from active types
  const typesSource = fs.readFileSync(new URL('../src/types.ts', import.meta.url), 'utf8');
  assert.match(typesSource, /\bexport type AccountRole\b/);
  assert.match(typesSource, /'APP_ADMIN'/);
  assert.doesNotMatch(typesSource, /'PUBLIC'/);
  assert.doesNotMatch(typesSource, /'ADMIN'/);
  assert.doesNotMatch(typesSource, /'GENERAL_USER'/);
});

test('Test G — loadCanonicalUser behavioral verification and AppContext session-restore signOut on account_not_approved', async () => {
  const makeMockClient = (assignedRoles) => ({
    from: (table) => ({
      select: () => ({
        eq: () => {
          if (table === 'profiles') {
            return {
              single: async () => ({
                data: {
                  id: 'user-1',
                  username: 'test_user',
                  full_name: 'Test User',
                  email: 'test@example.com',
                  avatar_url: null,
                },
                error: null,
              }),
            };
          }
          if (table === 'role_assignments') {
            return {
              eq: async () => ({
                data: assignedRoles.map((r) => ({ role: r })),
                error: null,
              }),
            };
          }
          if (table === 'telegram_identities') {
            return {
              maybeSingle: async () => ({ data: null, error: null }),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        },
      }),
    }),
  });

  // 1. Pending user with only GENERAL_USER fails closed with account_not_approved
  await assert.rejects(
    () => authModule.loadCanonicalUser({ id: 'user-1', email: 'test@example.com' }, makeMockClient(['GENERAL_USER'])),
    /account_not_approved/,
  );

  // 2. Legacy EMPLOYEE or PRINCIPAL without canonical role fails closed with account_not_approved
  await assert.rejects(
    () => authModule.loadCanonicalUser({ id: 'user-1', email: 'test@example.com' }, makeMockClient(['EMPLOYEE'])),
    /account_not_approved/,
  );
  await assert.rejects(
    () => authModule.loadCanonicalUser({ id: 'user-1', email: 'test@example.com' }, makeMockClient(['PRINCIPAL'])),
    /account_not_approved/,
  );

  // 3. Approved APP_ADMIN resolves to role 'APP_ADMIN' and strips GENERAL_USER from capabilities
  const ownerUser = await authModule.loadCanonicalUser(
    { id: 'user-1', email: 'test@example.com' },
    makeMockClient(['GENERAL_USER', 'APP_ADMIN']),
  );
  assert.equal(ownerUser.role, 'APP_ADMIN');
  assert.deepEqual(ownerUser.capabilities, ['APP_ADMIN']);

  // 4. Verify AppContext session restoration paths clear session via signOutAccount() when account_not_approved is thrown
  const appContextSource = fs.readFileSync(new URL('../src/context/AppContext.tsx', import.meta.url), 'utf8');
  const signOutMatches = [...appContextSource.matchAll(/signOutAccount\(\)/g)];
  assert.equal(
    signOutMatches.length >= 4,
    true,
    `Expected signOutAccount() in getSession, onAuthStateChange, login catch, and logout (found ${signOutMatches.length})`,
  );
  assert.doesNotMatch(appContextSource, /'GENERAL_USER'/, 'AppContext.tsx must not use GENERAL_USER as an active role state');
  assert.doesNotMatch(appContextSource, /\bMOCK_USERS\b/, 'AppContext.tsx must not import or use MOCK_USERS role impersonation');
});

test('Test H — authenticateTelegramInitData rejects unapproved Telegram accounts and accepts canonical roles without GENERAL_USER fallback', async () => {
  const makeTelegramClient = (returnedUser) => ({
    functions: {
      invoke: async (fnName) => {
        assert.equal(fnName, 'telegram-auth');
        return {
          data: {
            linked: true,
            user: returnedUser,
          },
          error: null,
        };
      },
    },
  });

  // 1. Unapproved Telegram user where server Edge Function returned role: 'GENERAL_USER' must fail closed with account_not_approved
  await assert.rejects(
    () =>
      authModule.authenticateTelegramInitData(
        'query_id=1&user=pending',
        makeTelegramClient({
          id: 'tg-pending-1',
          username: 'pending_tg',
          fullName: 'Pending Telegram User',
          role: 'GENERAL_USER',
          capabilities: ['GENERAL_USER'],
        }),
      ),
    /account_not_approved/,
  );

  // 2. Unapproved Telegram user with legacy EMPLOYEE role fails closed
  await assert.rejects(
    () =>
      authModule.authenticateTelegramInitData(
        'query_id=2&user=legacy',
        makeTelegramClient({
          id: 'tg-legacy-1',
          username: 'legacy_tg',
          fullName: 'Legacy Telegram User',
          role: 'EMPLOYEE',
          capabilities: ['EMPLOYEE'],
        }),
      ),
    /account_not_approved/,
  );

  // 3. Approved Telegram user with canonical role succeeds and strips GENERAL_USER from capabilities
  const approvedResult = await authModule.authenticateTelegramInitData(
    'query_id=3&user=approved',
    makeTelegramClient({
      id: 'tg-parent-1',
      username: 'parent_tg',
      fullName: 'Approved Parent',
      role: 'PARENT',
      capabilities: ['GENERAL_USER', 'PARENT'],
    }),
  );
  assert.equal(approvedResult.linked, true);
  assert.equal(approvedResult.user.role, 'PARENT');
  assert.deepEqual(approvedResult.user.capabilities, ['PARENT']);
});

test('Test I (AUTH-UX-01 Group A) — Localized registration results across ar, fr, en for immediate and contact-confirmation flows', async () => {
  const authMessages = await import('../src/i18n/authMessages.ts');
  const authModalSource = fs.readFileSync(new URL('../src/components/AuthModal.tsx', import.meta.url), 'utf8');

  assert.equal(
    typeof authMessages.registrationResultMessage,
    'function',
    'Expected registrationResultMessage helper in src/i18n/authMessages.ts',
  );

  // Scenario A — Successful registration without outstanding contact confirmation
  assert.equal(
    authMessages.registrationResultMessage('en', { confirmationRequired: false }),
    'Your account registration has been received. Access to private school spaces requires approval from KRISTOU SCHOOL administration. You will be able to access your school workspace after your account is approved.',
  );
  assert.equal(
    authMessages.registrationResultMessage('fr', { confirmationRequired: false }),
    'Votre demande de création de compte a bien été reçue. L’accès aux espaces privés nécessite l’approbation de l’administration de KRISTOU SCHOOL. Vous pourrez accéder à votre espace scolaire une fois votre compte approuvé.',
  );
  assert.equal(
    authMessages.registrationResultMessage('ar', { confirmationRequired: false }),
    'تم استلام طلب إنشاء حسابك بنجاح. يتطلب الدخول إلى فضاءات المدرسة الخاصة موافقة إدارة مدرسة كريستو. ستتمكن من الدخول إلى فضائك المدرسي بعد الموافقة على حسابك.',
  );

  // Scenario B — Contact verification required: mentions both contact verification AND administrative approval
  for (const locale of ['en', 'fr', 'ar']) {
    const confirmMsg = authMessages.registrationResultMessage(locale, { confirmationRequired: true });
    assert.ok(confirmMsg && confirmMsg.length > 40, `Expected non-empty Scenario B message for ${locale}`);
    assert.NotEqual?.(
      confirmMsg,
      authMessages.registrationResultMessage(locale, { confirmationRequired: false }),
    );
    assert.notEqual(
      confirmMsg,
      authMessages.registrationResultMessage(locale, { confirmationRequired: false }),
      `Expected Scenario B message to differ from Scenario A message in ${locale}`,
    );
    // Must never claim the account is already approved or ready for private workspace sign-in without approval
    assert.doesNotMatch(confirmMsg, /You can now sign in\.|already approved/i);
  }

  // Specific checks on Scenario B content per language
  assert.match(authMessages.registrationResultMessage('en', { confirmationRequired: true }), /email|phone|verification|confirm/i);
  assert.match(authMessages.registrationResultMessage('en', { confirmationRequired: true }), /approval|administration|authorized/i);
  assert.match(authMessages.registrationResultMessage('fr', { confirmationRequired: true }), /vérification|confirmer|e-mail|téléphone/i);
  assert.match(authMessages.registrationResultMessage('fr', { confirmationRequired: true }), /approbation|administration|autorisé/i);
  assert.match(authMessages.registrationResultMessage('ar', { confirmationRequired: true }), /التحقق|تأكيد|البريد|الهاتف/);
  assert.match(authMessages.registrationResultMessage('ar', { confirmationRequired: true }), /موافقة|إدارة/);

  // AuthModal must not contain misleading hardcoded English signup strings
  assert.doesNotMatch(authModalSource, /Account created\. You can now sign in\./);
  assert.doesNotMatch(authModalSource, /Account created\. Confirm your contact method before signing in\./);
  assert.match(authModalSource, /registrationResultMessage/);
});

test('Test J (AUTH-UX-01 Group B) — Sign-in error classification: account_not_approved, invalid_credentials, contact_not_confirmed, and sign_in_failed without false wrong-password or raw leaks', async () => {
  const authMessages = await import('../src/i18n/authMessages.ts');
  const authModalSource = fs.readFileSync(new URL('../src/components/AuthModal.tsx', import.meta.url), 'utf8');
  const appContextSource = fs.readFileSync(new URL('../src/context/AppContext.tsx', import.meta.url), 'utf8');

  assert.equal(typeof authMessages.classifySignInError, 'function', 'Expected classifySignInError in src/i18n/authMessages.ts');

  // 1. Exact classification of account_not_approved
  assert.equal(authMessages.classifySignInError(new Error('account_not_approved')), 'account_not_approved');
  assert.equal(authMessages.classifySignInError('account_not_approved'), 'account_not_approved');
  assert.equal(authMessages.classifySignInError({ code: 'account_not_approved' }), 'account_not_approved');

  // 2. Genuine wrong-password / invalid-credential rejections classify as invalid_credentials
  const providerInvalidCreds = Object.assign(new Error('Invalid login credentials'), {
    name: 'AuthApiError',
    code: 'invalid_credentials',
    status: 400,
  });
  assert.equal(authMessages.classifySignInError(providerInvalidCreds), 'invalid_credentials');
  assert.equal(authMessages.classifySignInError({ code: 'invalid_credentials' }), 'invalid_credentials');
  assert.equal(authMessages.classifySignInError({ code: 'invalid_grant' }), 'invalid_credentials');
  assert.equal(authMessages.classifySignInError(new Error('Invalid credentials')), 'invalid_credentials');
  assert.equal(authMessages.classifySignInError(new Error('Invalid login credentials')), 'invalid_credentials');
  assert.equal(authMessages.classifySignInError('invalid_credentials'), 'invalid_credentials');

  // 3. Stable provider contact-confirmation error codes classify as contact_not_confirmed (never via loose message substring matching)
  assert.equal(authMessages.classifySignInError({ code: 'email_not_confirmed', message: 'Email not confirmed' }), 'contact_not_confirmed');
  assert.equal(authMessages.classifySignInError({ code: 'phone_not_confirmed', message: 'Phone not confirmed' }), 'contact_not_confirmed');
  assert.equal(authMessages.classifySignInError('contact_not_confirmed'), 'contact_not_confirmed');
  assert.equal(authMessages.classifySignInError(new Error('Some arbitrary error mentioning email not confirmed without code')), 'sign_in_failed');

  // 4. Network failures, profile lookup errors, missing config, and unknown errors classify as sign_in_failed (NEVER invalid_credentials)
  assert.equal(authMessages.classifySignInError(new TypeError('Failed to fetch')), 'sign_in_failed');
  assert.equal(authMessages.classifySignInError(new Error('NetworkError when attempting to fetch resource.')), 'sign_in_failed');
  assert.equal(authMessages.classifySignInError(new Error('Profile unavailable')), 'sign_in_failed');
  assert.equal(authMessages.classifySignInError({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }), 'sign_in_failed');
  assert.equal(authMessages.classifySignInError(new Error('postgres: relation "public.secret_table" does not exist')), 'sign_in_failed');
  assert.equal(authMessages.classifySignInError(new Error('Supabase public configuration was not included in this frontend build.')), 'sign_in_failed');
  assert.equal(authMessages.classifySignInError({ unexpected: 'internal_object_payload' }), 'sign_in_failed');
  assert.equal(authMessages.classifySignInError(null), 'sign_in_failed');
  assert.equal(authMessages.classifySignInError(undefined), 'sign_in_failed');

  // 5. Localized messages exist in ar, fr, en and distinguish all 4 sign-in states
  assert.equal(
    authMessages.resolveSignInErrorMessage('en', new Error('account_not_approved')),
    'Your credentials were accepted, but this account does not currently have access to private school workspaces. It may still be awaiting administrative approval. Please contact the school administration if you need assistance.',
  );
  for (const locale of ['en', 'fr', 'ar']) {
    const notApprovedMsg = authMessages.resolveSignInErrorMessage(locale, new Error('account_not_approved'));
    const invalidCredsMsg = authMessages.resolveSignInErrorMessage(locale, providerInvalidCreds);
    const networkFailMsg = authMessages.resolveSignInErrorMessage(locale, new TypeError('Failed to fetch'));
    const profileFailMsg = authMessages.resolveSignInErrorMessage(locale, new Error('Profile unavailable'));
    const unconfirmedMsg = authMessages.resolveSignInErrorMessage(locale, { code: 'email_not_confirmed' });

    assert.ok(notApprovedMsg && notApprovedMsg.length > 40, `Expected localized account_not_approved message in ${locale}`);
    assert.ok(networkFailMsg && networkFailMsg.length > 20, `Expected localized sign_in_failed message in ${locale}`);
    assert.ok(unconfirmedMsg && unconfirmedMsg.length > 30, `Expected localized contact_not_confirmed message in ${locale}`);

    assert.equal(invalidCredsMsg, translations[locale].invalidCredentials, `Expected invalid credentials message in ${locale}`);
    assert.equal(networkFailMsg, authMessages.signInFailedMessage(locale), `Expected network failure to resolve to signInFailedMessage in ${locale}`);
    assert.equal(profileFailMsg, authMessages.signInFailedMessage(locale), `Expected profile lookup failure to resolve to signInFailedMessage in ${locale}`);
    assert.equal(unconfirmedMsg, authMessages.contactNotConfirmedMessage(locale), `Expected email_not_confirmed to resolve to contactNotConfirmedMessage in ${locale}`);

    // Distinctness invariants
    assert.notEqual(notApprovedMsg, invalidCredsMsg, `account_not_approved must not display invalidCredentials in ${locale}`);
    assert.notEqual(networkFailMsg, invalidCredsMsg, `Network failure must not display invalidCredentials in ${locale}`);
    assert.notEqual(profileFailMsg, invalidCredsMsg, `Profile lookup failure must not falsely claim wrong password in ${locale}`);
    assert.notEqual(unconfirmedMsg, invalidCredsMsg, `Contact confirmation error must not display invalidCredentials in ${locale}`);
  }

  // 6. Raw Supabase internals or unknown error objects cannot leak through sign-in or sign-up error resolvers
  const rawDbError = new Error('ERROR: 42501 permission denied for table role_assignments at character 15');
  const unknownErrorObj = { message: 'FATAL: password authentication failed for postgres user supabase_admin', stack: 'at Connection.parseE' };
  for (const locale of ['en', 'fr', 'ar']) {
    const signInResolved = authMessages.resolveSignInErrorMessage(locale, rawDbError);
    const signInObjResolved = authMessages.resolveSignInErrorMessage(locale, unknownErrorObj);
    const signUpResolved = authMessages.resolveSignUpErrorMessage(locale, rawDbError);
    assert.equal(signInResolved, authMessages.signInFailedMessage(locale));
    assert.equal(signInObjResolved, authMessages.signInFailedMessage(locale));
    assert.doesNotMatch(signInResolved, /42501|permission denied|role_assignments/);
    assert.doesNotMatch(signInObjResolved, /FATAL|supabase_admin|Connection\.parseE/);
    assert.doesNotMatch(signUpResolved, /42501|permission denied|role_assignments/);
  }

  // 7. AuthModal and AppContext wire distinct account_not_approved handling without assigning any private role
  assert.match(authModalSource, /resolveSignInErrorMessage|accountNotApprovedMessage/);
  assert.match(appContextSource, /classifySignInError|resolveSignInErrorMessage/);
});

test('Test K (AUTH-UX-01 Groups C & D) — Failed signup handling, preserved sign-in/register interfaces, and ApplicationStatusScreen alignment', async () => {
  const authMessages = await import('../src/i18n/authMessages.ts');
  const authModalSource = fs.readFileSync(new URL('../src/components/AuthModal.tsx', import.meta.url), 'utf8');
  const appStatusSource = fs.readFileSync(new URL('../src/components/homepages/ApplicationStatusScreen.tsx', import.meta.url), 'utf8');
  const telegramSource = fs.readFileSync(new URL('../src/lib/telegram.ts', import.meta.url), 'utf8');

  // 1. Failed signup classification: username format, username unavailable, and generic failure
  assert.equal(authMessages.classifySignUpError(new Error('invalid_username_format')), 'invalid_username_format');
  assert.equal(authMessages.classifySignUpError(new Error('username_unavailable_or_invalid')), 'username_unavailable_or_invalid');
  assert.equal(authMessages.classifySignUpError(new Error('unexpected internal failure')), 'signup_failed');

  for (const locale of ['ar', 'fr', 'en']) {
    assert.equal(
      authMessages.resolveSignUpErrorMessage(locale, new Error('invalid_username_format')),
      authMessages.usernameRuleMessage(locale),
    );
    assert.equal(
      authMessages.resolveSignUpErrorMessage(locale, new Error('username_unavailable_or_invalid')),
      authMessages.usernameUnavailableMessage(locale),
    );
    assert.equal(
      authMessages.resolveSignUpErrorMessage(locale, new Error('unexpected internal failure')),
      authMessages.signupFailedMessage(locale),
    );
    // Failed signup message never says registration was received or approved
    assert.doesNotMatch(
      authMessages.resolveSignUpErrorMessage(locale, new Error('unexpected internal failure')),
      /registration has been received|bien été reçue|تم استلام طلب/,
    );
  }

  // 2. AuthModal preserves email, phone, and username sign-in interface and clears signupNotice on failed signup
  assert.match(authModalSource, /\{t\('username'\)\} \/ Email \/ \{t\('phone'\)\}/);
  assert.match(authModalSource, /if \(!result\.success\) \{\s*const code = result\.errorCode \?\? classifySignUpError\(result\.error\);\s*setErrorState\(\{ kind: 'signup', code \}\);\s*return;\s*\}/);

  // 3. ApplicationStatusScreen PENDING copy matches approved KRISTOU SCHOOL administration review text
  assert.match(appStatusSource, /Access to private school spaces requires approval from KRISTOU SCHOOL administration\./);
  assert.match(appStatusSource, /L’accès aux espaces privés nécessite l’approbation de l’administration de KRISTOU SCHOOL\./);
  assert.match(appStatusSource, /يتطلب الدخول إلى فضاءات المدرسة الخاصة موافقة إدارة مدرسة كريستو\./);

  // 4. Telegram linking module remains intact
  assert.match(telegramSource, /createTelegramLinkUrl/);
});

test('Test L (AUTH-ID-01 Group F) — Parent-friendly optional username, Tunisian +216 phone guidance, and trilingual messages across ar, fr, en', async () => {
  const authMessages = await import('../src/i18n/authMessages.ts');
  const authModalSource = fs.readFileSync(new URL('../src/components/AuthModal.tsx', import.meta.url), 'utf8');

  // 1. AuthModal no longer forces username with HTML required or ASCII-only pattern attribute
  assert.doesNotMatch(
    authModalSource,
    /pattern="\[A-Za-z0-9\]\[A-Za-z0-9\._-\]\{2,49\}"/,
    'AuthModal must not restrict username input to an ASCII-only HTML pattern',
  );
  assert.doesNotMatch(
    authModalSource,
    /if \(!username\.trim\(\)/,
    'AuthModal must not unconditionally reject empty username when email or phone is provided',
  );

  // 2. Trilingual messages exist for optional username guidance, Tunisian phone format, username-only blocker, and secondary phone verification
  assert.equal(typeof authMessages.identifierChoiceGuidanceMessage, 'function');
  assert.equal(typeof authMessages.phoneRuleMessage, 'function');
  assert.equal(typeof authMessages.usernameOnlyUnsupportedMessage, 'function');

  for (const locale of ['ar', 'fr', 'en']) {
    const ruleMsg = authMessages.usernameRuleMessage(locale);
    const choiceMsg = authMessages.identifierChoiceGuidanceMessage(locale);
    const phoneMsg = authMessages.phoneRuleMessage(locale);
    const usernameOnlyMsg = authMessages.usernameOnlyUnsupportedMessage(locale);
    const invalidPhoneMsg = authMessages.resolveSignUpErrorMessage(locale, new Error('invalid_phone_format'));
    const secondaryPhoneMsg = authMessages.registrationResultMessage(locale, {
      confirmationRequired: true,
      secondaryPhoneVerificationRequired: true,
    });

    assert.ok(ruleMsg && ruleMsg.length > 20, `Missing usernameRuleMessage in ${locale}`);
    assert.ok(choiceMsg && choiceMsg.length > 20, `Missing identifierChoiceGuidanceMessage in ${locale}`);
    assert.ok(phoneMsg && phoneMsg.length > 15, `Missing phoneRuleMessage in ${locale}`);
    assert.ok(usernameOnlyMsg && usernameOnlyMsg.length > 20, `Missing usernameOnlyUnsupportedMessage in ${locale}`);
    assert.equal(invalidPhoneMsg, phoneMsg, `Expected invalid_phone_format to resolve to phoneRuleMessage in ${locale}`);
    assert.notEqual(
      secondaryPhoneMsg,
      authMessages.registrationResultMessage(locale, { confirmationRequired: true, secondaryPhoneVerificationRequired: false }),
      `Expected secondaryPhoneVerificationRequired notice to include secondary phone verification explanation in ${locale}`,
    );

    // Must not expose developer jargon in parent-facing UI messages
    for (const msg of [ruleMsg, choiceMsg, phoneMsg, usernameOnlyMsg, secondaryPhoneMsg]) {
      assert.doesNotMatch(msg, /canonical principal|E\.164|normalized identifier|JWT/i);
    }
  }
});





