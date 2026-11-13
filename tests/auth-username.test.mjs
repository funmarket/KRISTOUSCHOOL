import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AuthApiError,
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';

globalThis.__KRISTOU_SUPABASE_URL__ = '';
globalThis.__KRISTOU_SUPABASE_PUBLISHABLE_KEY__ = '';

const usernameModule = await import('../src/lib/username.ts');
const authModule = await import('../src/lib/auth.ts');
const authMessages = await import('../src/i18n/authMessages.ts');

test('1. Existing legacy ASCII usernames remain valid and normalized consistently', () => {
  assert.equal(usernameModule.isValidUsername('bashir_2026'), true);
  assert.equal(usernameModule.isValidUsername('Teacher.Name-1'), true);
  assert.equal(usernameModule.isValidUsername('  user.name  '), true);
  assert.equal(usernameModule.normalizeUsernameDisplay?.('  Teacher.Name-1  '), 'Teacher.Name-1');
  assert.equal(usernameModule.normalizeUsernameKey?.('  Teacher.Name-1  '), 'teacher.name-1');
});

test('2. Human-friendly usernames: accepts Arabic, French accented Latin, and multiword names with spaces', () => {
  const validExamples = [
    'mohamed',
    'Mohamed',
    'Mohamed Ben Ali',
    'Sarra Ben Amor',
    'Fatma Zahra',
    'Fatma-Zahra',
    'Élodie',
    'Amélie Martin',
    'Ahmed_2026',
    'Sarra-Ben-Amor',
    'محمد',
    'محمد علي',
    'فاطمة الزهراء',
    'أمينة بن عمر',
    'مُحَمَّد عَلِيّ',
  ];

  for (const example of validExamples) {
    assert.equal(
      usernameModule.isValidUsername(example),
      true,
      `Expected human-friendly username "${example}" to be accepted`,
    );
  }
});

test('3. Username normalization: preserves display spelling/accents, collapses internal whitespace, and normalizes NFC keys', () => {
  assert.equal(typeof usernameModule.normalizeUsernameDisplay, 'function');
  assert.equal(typeof usernameModule.normalizeUsernameKey, 'function');
  assert.equal(typeof usernameModule.validateUsername, 'function');

  // Leading/trailing and repeated internal spaces
  assert.equal(
    usernameModule.normalizeUsernameDisplay('   Mohamed    Ben   Ali  '),
    'Mohamed Ben Ali',
  );
  assert.equal(
    usernameModule.normalizeUsernameKey('   Mohamed    Ben   Ali  '),
    'mohamed ben ali',
  );

  // Case insensitivity for key while preserving visible case in display
  assert.equal(usernameModule.normalizeUsernameDisplay('Sarra Ben Amor'), 'Sarra Ben Amor');
  assert.equal(
    usernameModule.normalizeUsernameKey('Sarra Ben Amor'),
    usernameModule.normalizeUsernameKey('sarra   ben amor'),
  );

  // Unicode NFC vs NFD equivalence (e.g. Élodie decomposed vs composed)
  const nfcElodie = 'Élodie'.normalize('NFC');
  const nfdElodie = 'Élodie'.normalize('NFD');
  assert.equal(usernameModule.isValidUsername(nfcElodie), true);
  assert.equal(usernameModule.isValidUsername(nfdElodie), true);
  assert.equal(
    usernameModule.normalizeUsernameDisplay(nfdElodie),
    nfcElodie,
  );
  assert.equal(
    usernameModule.normalizeUsernameKey(nfdElodie),
    usernameModule.normalizeUsernameKey(nfcElodie),
  );
});

test('4. Username safety: rejects too-short, too-long, control/invisible/bidi characters, and email/phone-looking strings', () => {
  assert.equal(usernameModule.isValidUsername(''), false);
  assert.equal(usernameModule.isValidUsername('   '), false);
  assert.equal(usernameModule.isValidUsername('ab'), false);
  assert.equal(usernameModule.isValidUsername('مب'), false);
  assert.equal(usernameModule.isValidUsername('a'.repeat(51)), false);
  assert.equal(usernameModule.isValidUsername('.starts-with-punctuation'), false);
  assert.equal(usernameModule.isValidUsername('ends-with-punctuation.'), false);
  assert.equal(usernameModule.isValidUsername('double..dot'), false);

  // Invisible / control / bidirectional-spoofing characters
  assert.equal(usernameModule.isValidUsername('Mohamed\u200BBen Ali'), false);
  assert.equal(usernameModule.isValidUsername('Mohamed\u202EBen Ali'), false);
  assert.equal(usernameModule.isValidUsername('Mohamed\nBen Ali'), false);
  assert.equal(usernameModule.isValidUsername('Mohamed\u0000Ben Ali'), false);

  // Identifier-looking strings (must not collide with email or phone resolution)
  assert.equal(usernameModule.isValidUsername('parent@example.com'), false);
  assert.equal(usernameModule.isValidUsername('+21620123456'), false);
  assert.equal(usernameModule.isValidUsername('20 123 456'), false);
  assert.equal(usernameModule.isValidUsername('00216 55 123 456'), false);

  const emailCheck = usernameModule.validateUsername?.('parent@example.com');
  assert.equal(emailCheck?.valid, false);
  assert.equal(emailCheck?.reason, 'looks_like_email');

  const phoneCheck = usernameModule.validateUsername?.('20 123 456');
  assert.equal(phoneCheck?.valid, false);
  assert.equal(phoneCheck?.reason, 'looks_like_phone');
});

test('5. Tunisian (+216) and international E.164 phone validation and normalization', () => {
  assert.equal(typeof usernameModule.normalizePhoneInput, 'function');
  assert.equal(typeof usernameModule.isValidPhoneInput, 'function');

  // Tunisian 8-digit local numbers with spaces/hyphens normalize to +216XXXXXXXX
  assert.equal(usernameModule.normalizePhoneInput('20 123 456'), '+21620123456');
  assert.equal(usernameModule.normalizePhoneInput('55123456'), '+21655123456');
  assert.equal(usernameModule.normalizePhoneInput('98-765-432'), '+21698765432');
  assert.equal(authModule.normalizePhone('20 123 456'), '+21620123456');
  assert.equal(authModule.isPhoneIdentifier('20 123 456'), true);

  // Explicit +216 and 00216 and international E.164 numbers
  assert.equal(usernameModule.normalizePhoneInput('+216 20 123 456'), '+21620123456');
  assert.equal(usernameModule.normalizePhoneInput('00216 20 123 456'), '+21620123456');
  assert.equal(usernameModule.normalizePhoneInput('+33 6 12 34 56 78'), '+33612345678');
  assert.equal(authModule.normalizePhone('+33 6 12 34 56 78'), '+33612345678');

  // Rejects malformed or ambiguous unprefixed foreign-length numbers (never guesses foreign country codes)
  assert.equal(usernameModule.isValidPhoneInput('12345'), false);
  assert.equal(usernameModule.isValidPhoneInput('0612345678'), false);
  assert.equal(usernameModule.isValidPhoneInput('1234567890'), false);
  assert.equal(usernameModule.isValidPhoneInput('01234567'), false);
  assert.equal(authModule.isPhoneIdentifier('1234567890'), false);
});

test('6. Actual username authentication transport (signInAccount with SDK FunctionsHttpError, FunctionsFetchError, FunctionsRelayError, AuthApiError)', async () => {
  // Case 1: HTTP 401 verified invalid_credentials response from auth-username-signin Edge Function
  const client401 = {
    functions: {
      invoke: async (fnName, opts) => {
        assert.equal(fnName, 'auth-username-signin');
        assert.equal(opts.body.username, 'Mohamed Ben Ali');
        assert.equal(opts.body.usernameKey, 'mohamed ben ali');
        const response = new Response(JSON.stringify({ error: 'invalid_credentials' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
        return { data: null, error: new FunctionsHttpError(response) };
      },
    },
  };

  await assert.rejects(
    async () => {
      try {
        await authModule.signInAccount('  Mohamed   Ben Ali ', 'WrongPass123!', client401);
      } catch (err) {
        assert.equal(
          authMessages.classifySignInError(err),
          'invalid_credentials',
          `Expected HTTP 401 invalid_credentials FunctionsHttpError to classify as invalid_credentials, got ${authMessages.classifySignInError(err)}`,
        );
        throw err;
      }
    },
  );

  // Case 2: HTTP 503 auth_unavailable from auth-username-signin Edge Function
  const client503 = {
    functions: {
      invoke: async () => {
        const response = new Response(JSON.stringify({ error: 'auth_unavailable' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
        return { data: null, error: new FunctionsHttpError(response) };
      },
    },
  };

  await assert.rejects(
    async () => {
      try {
        await authModule.signInAccount('Mohamed Ben Ali', 'CorrectPass123!', client503);
      } catch (err) {
        assert.equal(
          authMessages.classifySignInError(err),
          'sign_in_failed',
          'Expected HTTP 503 auth_unavailable to classify as sign_in_failed, never invalid_credentials',
        );
        throw err;
      }
    },
  );

  // Case 3: Network / relay errors (FunctionsFetchError and FunctionsRelayError)
  const clientNetworkError = {
    functions: {
      invoke: async () => ({
        data: null,
        error: new FunctionsFetchError(new TypeError('Failed to fetch')),
      }),
    },
  };

  await assert.rejects(
    async () => {
      try {
        await authModule.signInAccount('فاطمة الزهراء', 'CorrectPass123!', clientNetworkError);
      } catch (err) {
        assert.equal(authMessages.classifySignInError(err), 'sign_in_failed');
        throw err;
      }
    },
  );

  const clientRelayError = {
    functions: {
      invoke: async () => ({
        data: null,
        error: new FunctionsRelayError(new Response('Relay failure', { status: 502 })),
      }),
    },
  };

  await assert.rejects(
    async () => {
      try {
        await authModule.signInAccount('فاطمة الزهراء', 'CorrectPass123!', clientRelayError);
      } catch (err) {
        assert.equal(authMessages.classifySignInError(err), 'sign_in_failed');
        throw err;
      }
    },
  );

  // Case 4: Malformed 200 response (missing session/user)
  const clientMalformed = {
    functions: {
      invoke: async () => ({
        data: { unexpected: true },
        error: null,
      }),
    },
  };

  await assert.rejects(
    async () => {
      try {
        await authModule.signInAccount('Élodie', 'CorrectPass123!', clientMalformed);
      } catch (err) {
        assert.equal(
          authMessages.classifySignInError(err),
          'sign_in_failed',
          'Malformed response without session/user must classify as sign_in_failed, not invalid_credentials',
        );
        throw err;
      }
    },
  );

  // Case 5: Valid session and user preservation
  let setSessionCalledWith = null;
  const mockSession = { access_token: 'jwt-123', refresh_token: 'ref-123' };
  const mockUser = { id: 'canonical-user-001', email: 'mohamed@example.com' };
  const clientValid = {
    functions: {
      invoke: async (fnName, opts) => {
        assert.equal(fnName, 'auth-username-signin');
        assert.equal(opts.body.username, 'Mohamed Ben Ali');
        assert.equal(opts.body.usernameKey, 'mohamed ben ali');
        return { data: { session: mockSession, user: mockUser }, error: null };
      },
    },
    auth: {
      setSession: async (session) => {
        setSessionCalledWith = session;
        return { data: { session, user: mockUser }, error: null };
      },
    },
  };

  const validResult = await authModule.signInAccount('  Mohamed   Ben Ali  ', 'CorrectPass123!', clientValid);
  assert.deepEqual(validResult.session, mockSession);
  assert.deepEqual(validResult.user, mockUser);
  assert.deepEqual(setSessionCalledWith, mockSession);

  // Case 6: Credentials accepted, no active role -> account_not_approved
  const unapprovedDbClient = {
    from: (table) => ({
      select: () => ({
        eq: () => {
          if (table === 'profiles') {
            return {
              single: async () => ({
                data: {
                  id: mockUser.id,
                  username: 'Mohamed Ben Ali',
                  full_name: 'Mohamed Ben Ali',
                  email: 'mohamed@example.com',
                  avatar_url: null,
                },
                error: null,
              }),
            };
          }
          if (table === 'role_assignments') {
            return {
              eq: async () => ({
                data: [{ role: 'GENERAL_USER' }],
                error: null,
              }),
            };
          }
          return { maybeSingle: async () => ({ data: null, error: null }) };
        },
      }),
    }),
  };

  await assert.rejects(
    async () => {
      try {
        await authModule.loadCanonicalUser(validResult.user, unapprovedDbClient);
      } catch (err) {
        assert.equal(authMessages.classifySignInError(err), 'account_not_approved');
        throw err;
      }
    },
  );

  // Case 7: Contact not confirmed (supported provider code via Edge Function HTTP 403 or direct AuthApiError)
  const clientUnconfirmed = {
    functions: {
      invoke: async () => {
        const response = new Response(JSON.stringify({ error: 'email_not_confirmed' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
        return { data: null, error: new FunctionsHttpError(response) };
      },
    },
  };

  await assert.rejects(
    async () => {
      try {
        await authModule.signInAccount('Mohamed Ben Ali', 'CorrectPass123!', clientUnconfirmed);
      } catch (err) {
        assert.equal(authMessages.classifySignInError(err), 'contact_not_confirmed');
        throw err;
      }
    },
  );

  const clientEmailUnconfirmed = {
    auth: {
      signInWithPassword: async () => ({
        data: { session: null, user: null },
        error: new AuthApiError('Email not confirmed', 400, 'email_not_confirmed'),
      }),
    },
  };

  await assert.rejects(
    async () => {
      try {
        await authModule.signInAccount('mohamed@example.com', 'CorrectPass123!', clientEmailUnconfirmed);
      } catch (err) {
        assert.equal(authMessages.classifySignInError(err), 'contact_not_confirmed');
        throw err;
      }
    },
  );
});

test('7. Registration Combination Matrix (Combinations A through G) and Full-Name Non-Uniqueness', async () => {
  // Combination A: Username only (Yes / No / No) -> BLOCKED cleanly without fabricating fake email/phone or calling signUp
  let signUpCalledForA = false;
  const clientA = {
    auth: {
      signUp: async () => {
        signUpCalledForA = true;
        return { data: {}, error: null };
      },
    },
  };

  await assert.rejects(
    () =>
      authModule.signUpAccount(
        {
          username: 'Mohamed Ben Ali',
          password: 'StrongPassword123!',
          fullName: 'Mohamed Ben Ali',
          requestedRole: 'PARENT',
        },
        clientA,
      ),
    /username_only_requires_contact_or_backend_auth/,
  );
  assert.equal(signUpCalledForA, false, 'Combination A must never call supabase.auth.signUp with fabricated email/phone');
  assert.equal(
    authMessages.classifySignUpError(new Error('username_only_requires_contact_or_backend_auth')),
    'username_only_unsupported',
  );

  // Combination B: Email only (No / Yes / No) -> Succeeds without requiring a username
  const callsB = [];
  const clientB = {
    auth: {
      signUp: async (payload) => {
        callsB.push(payload);
        return { data: { user: { id: 'user-b' }, session: null }, error: null };
      },
    },
  };
  const resB = await authModule.signUpAccount(
    {
      password: 'StrongPassword123!',
      email: '  Parent.B@Example.com ',
      fullName: 'Amélie Martin',
      requestedRole: 'PARENT',
    },
    clientB,
  );
  assert.equal(callsB.length, 1);
  assert.equal(callsB[0].email, 'parent.b@example.com');
  assert.equal(callsB[0].phone, undefined);
  assert.equal(callsB[0].options.data.username, undefined);
  assert.equal(callsB[0].options.data.full_name, 'Amélie Martin');
  assert.equal(resB.secondaryPhoneVerificationRequired, false);

  // Combination C: Phone only (No / No / Yes) -> Succeeds with Tunisian 8-digit phone, no username required
  const callsC = [];
  const clientC = {
    auth: {
      signUp: async (payload) => {
        callsC.push(payload);
        return { data: { user: { id: 'user-c' }, session: null }, error: null };
      },
    },
  };
  const resC = await authModule.signUpAccount(
    {
      password: 'StrongPassword123!',
      phone: '20 123 456',
      fullName: 'أمينة بن عمر',
      requestedRole: 'PARENT',
    },
    clientC,
  );
  assert.equal(callsC.length, 1);
  assert.equal(callsC[0].phone, '+21620123456');
  assert.equal(callsC[0].email, undefined);
  assert.equal(callsC[0].options.data.username, undefined);
  assert.equal(callsC[0].options.data.full_name, 'أمينة بن عمر');
  assert.equal(resC.secondaryPhoneVerificationRequired, false);

  // Combination D: Username + Email (Yes / Yes / No) -> Accepts Arabic/French/multiword username + email
  const callsD = [];
  const clientD = {
    auth: {
      signUp: async (payload) => {
        callsD.push(payload);
        return { data: { user: { id: 'user-d' }, session: null }, error: null };
      },
    },
  };
  const resD = await authModule.signUpAccount(
    {
      username: '  فاطمة   الزهراء ',
      password: 'StrongPassword123!',
      email: 'fatma@example.com',
      fullName: 'فاطمة الزهراء',
      requestedRole: 'PARENT',
    },
    clientD,
  );
  assert.equal(callsD.length, 1);
  assert.equal(callsD[0].email, 'fatma@example.com');
  assert.equal(callsD[0].options.data.username, 'فاطمة الزهراء');
  assert.equal(callsD[0].options.data.username_normalized, 'فاطمة الزهراء');
  assert.equal(resD.secondaryPhoneVerificationRequired, false);

  // Combination E: Username + Phone (Yes / No / Yes) -> Accepts multiword username + Tunisian phone
  const callsE = [];
  const clientE = {
    auth: {
      signUp: async (payload) => {
        callsE.push(payload);
        return { data: { user: { id: 'user-e' }, session: null }, error: null };
      },
    },
  };
  const resE = await authModule.signUpAccount(
    {
      username: '  Mohamed   Ben Ali ',
      password: 'StrongPassword123!',
      phone: '55 987 654',
      fullName: 'Mohamed Ben Ali',
      requestedRole: 'PARENT',
    },
    clientE,
  );
  assert.equal(callsE.length, 1);
  assert.equal(callsE[0].phone, '+21655987654');
  assert.equal(callsE[0].email, undefined);
  assert.equal(callsE[0].options.data.username, 'Mohamed Ben Ali');
  assert.equal(callsE[0].options.data.username_normalized, 'mohamed ben ali');
  assert.equal(resE.secondaryPhoneVerificationRequired, false);

  // Combination F: Email + Phone (No / Yes / Yes) -> Creates single canonical account via primary email credential, records pending_phone, reports secondaryPhoneVerificationRequired: true
  const callsF = [];
  const clientF = {
    auth: {
      signUp: async (payload) => {
        callsF.push(payload);
        return { data: { user: { id: 'user-f' }, session: null }, error: null };
      },
    },
  };
  const resF = await authModule.signUpAccount(
    {
      password: 'StrongPassword123!',
      email: 'family.f@example.com',
      phone: '98 111 222',
      fullName: 'Mohamed Ben Ali', // Same full name as User E is allowed!
      requestedRole: 'PARENT',
    },
    clientF,
  );
  assert.equal(callsF.length, 1, 'Must create only ONE canonical account');
  assert.equal(callsF[0].email, 'family.f@example.com');
  assert.equal(callsF[0].phone, undefined);
  assert.equal(callsF[0].options.data.username, undefined);
  assert.equal(callsF[0].options.data.pending_phone, '+21698111222');
  assert.equal(resF.secondaryPhoneVerificationRequired, true);

  // Combination G: Username + Email + Phone (Yes / Yes / Yes) -> Creates single canonical account with username, primary email, and pending_phone
  const callsG = [];
  const clientG = {
    auth: {
      signUp: async (payload) => {
        callsG.push(payload);
        return { data: { user: { id: 'user-g' }, session: null }, error: null };
      },
    },
  };
  const resG = await authModule.signUpAccount(
    {
      username: 'Sarra Ben Amor',
      password: 'StrongPassword123!',
      email: 'sarra@example.com',
      phone: '+216 22 333 444',
      fullName: 'Sarra Ben Amor',
      requestedRole: 'TEACHER',
      staffId: 'STF-77',
    },
    clientG,
  );
  assert.equal(callsG.length, 1, 'Must create only ONE canonical account');
  assert.equal(callsG[0].email, 'sarra@example.com');
  assert.equal(callsG[0].options.data.username, 'Sarra Ben Amor');
  assert.equal(callsG[0].options.data.username_normalized, 'sarra ben amor');
  assert.equal(callsG[0].options.data.pending_phone, '+21622333444');
  assert.equal(resG.secondaryPhoneVerificationRequired, true);
});

test('8. Secondary phone remains unverified / disabled for login after F/G signup; only provider-verified aliases resolve to canonical User.id', async () => {
  const canonicalUserId = '00000000-0000-4000-8000-000000000777';
  const mockSession = { access_token: 'tok-777', refresh_token: 'ref-777' };
  let phoneVerifiedInAuthUsers = false;

  const getMockAuthUser = () => ({
    id: canonicalUserId,
    email: 'sarra@example.com',
    phone: phoneVerifiedInAuthUsers ? '+21622333444' : undefined,
    user_metadata: {
      username: 'Sarra Ben Amor',
      username_normalized: 'sarra ben amor',
      pending_phone: '+21622333444',
    },
  });

  const multiAliasClient = {
    auth: {
      signInWithPassword: async (creds) => {
        if (creds.email === 'sarra@example.com' && creds.password === 'CorrectPass!') {
          return { data: { session: mockSession, user: getMockAuthUser() }, error: null };
        }
        // Only succeeds if the phone is actually verified on auth.users, NEVER from pending_phone metadata
        if (phoneVerifiedInAuthUsers && creds.phone === '+21622333444' && creds.password === 'CorrectPass!') {
          return { data: { session: mockSession, user: getMockAuthUser() }, error: null };
        }
        return {
          data: { session: null, user: null },
          error: new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'),
        };
      },
      setSession: async (session) => ({ data: { session, user: getMockAuthUser() }, error: null }),
    },
    functions: {
      invoke: async (fnName, opts) => {
        assert.equal(fnName, 'auth-username-signin');
        if (opts.body.usernameKey === 'sarra ben amor' && opts.body.password === 'CorrectPass!') {
          return { data: { session: mockSession, user: getMockAuthUser() }, error: null };
        }
        const response = new Response(JSON.stringify({ error: 'invalid_credentials' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
        return { data: null, error: new FunctionsHttpError(response) };
      },
    },
    from: (table) => ({
      select: () => ({
        eq: () => {
          if (table === 'profiles') {
            return {
              single: async () => ({
                data: {
                  id: canonicalUserId,
                  username: 'Sarra Ben Amor',
                  full_name: 'Sarra Ben Amor',
                  email: 'sarra@example.com',
                  avatar_url: null,
                },
                error: null,
              }),
            };
          }
          if (table === 'role_assignments') {
            return {
              eq: async () => ({
                data: [{ role: 'PARENT' }],
                error: null,
              }),
            };
          }
          return { maybeSingle: async () => ({ data: null, error: null }) };
        },
      }),
    }),
  };

  // Sign in via human-friendly username (with extra spaces/different case)
  const viaUsername = await authModule.signInAccount('  sarra   ben amor ', 'CorrectPass!', multiAliasClient);
  const canonicalViaUsername = await authModule.loadCanonicalUser(viaUsername.user, multiAliasClient);

  // Sign in via email
  const viaEmail = await authModule.signInAccount('  SARRA@example.com ', 'CorrectPass!', multiAliasClient);
  const canonicalViaEmail = await authModule.loadCanonicalUser(viaEmail.user, multiAliasClient);

  assert.equal(canonicalViaUsername.id, canonicalUserId);
  assert.equal(canonicalViaEmail.id, canonicalUserId);
  assert.equal(canonicalViaUsername.role, 'PARENT');

  // Before phone verification, the secondary phone (+21622333444 stored only in pending_phone) MUST NOT authenticate
  await assert.rejects(
    () => authModule.signInAccount('22 333 444', 'CorrectPass!', multiAliasClient),
  );

  // Only if/when the provider has verified and attached the phone to auth.users does phone sign-in resolve to the same canonical User.id
  phoneVerifiedInAuthUsers = true;
  const viaPhone = await authModule.signInAccount('22 333 444', 'CorrectPass!', multiAliasClient);
  const canonicalViaPhone = await authModule.loadCanonicalUser(viaPhone.user, multiAliasClient);
  assert.equal(canonicalViaPhone.id, canonicalUserId);
});

test('9. Prepared SQL migration preserves 7-role model, avoids unsupported PostgreSQL regex escapes, and preserves username_normalized column/index', async () => {
  const fs = await import('node:fs/promises');
  const sql = await fs.readFile(new URL('../supabase/migrations/20261113120000_human_friendly_usernames.sql', import.meta.url), 'utf8');

  // Strip SQL comments before checking executable statements
  const executableSql = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  assert.equal(/GENERAL_USER/i.test(executableSql), false, 'Migration must not reintroduce GENERAL_USER');
  assert.equal(/handle_new_user/i.test(executableSql), false, 'Migration must not unnecessarily replace handle_new_user()');
  assert.equal(/\\p\{/i.test(executableSql), false, 'Migration must not use unsupported PostgreSQL \\p{...} regex escapes');
  assert.equal(/drop\s+column\s+if\s+exists\s+username_normalized/i.test(executableSql), false, 'Migration must not drop username_normalized');
  assert.equal(/drop\s+index\s+if\s+exists\s+public\.profiles_username_normalized_key/i.test(executableSql), false, 'Migration must not drop profiles_username_normalized_key');
  assert.equal(/create\s+or\s+replace\s+function\s+public\.normalize_username_display/i.test(executableSql), true);
  assert.equal(/create\s+or\s+replace\s+function\s+public\.is_valid_username/i.test(executableSql), true);
  assert.equal(/add\s+constraint\s+profiles_username_format/i.test(executableSql), true);
});

