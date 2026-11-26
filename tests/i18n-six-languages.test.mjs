import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { translations } from '../src/i18n/translations.ts';
import { es } from '../src/i18n/locales/es.ts';
import { de } from '../src/i18n/locales/de.ts';
import { pt } from '../src/i18n/locales/pt.ts';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SIX_LANGUAGES = ['ar', 'fr', 'en', 'es', 'de', 'pt'];
const NEW_LANGUAGES = ['es', 'de', 'pt'];

async function bundleTsModule(entryRelPath, outfileName) {
  const outdir = path.join('/tmp', 'kristou-i18n-six-tests');
  fs.mkdirSync(outdir, { recursive: true });
  const outfile = path.join(outdir, outfileName);
  await build({
    entryPoints: [path.resolve(__dirname, entryRelPath)],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'silent',
    plugins: [
      {
        name: 'external-deps',
        setup(builder) {
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

const { HOMEPAGE_BADGE_LABELS, HOMEPAGE_COMMON_TEXT, pickText } = await bundleTsModule(
  '../src/i18n/homepages.ts',
  'homepages.cjs',
);
const { getTelegramLinkCopy, telegramLinkCopy } = await bundleTsModule(
  '../src/i18n/telegram-link.ts',
  'telegram-link.cjs',
);
const { contentT } = await bundleTsModule('../src/i18n/content.ts', 'content.cjs');
const {
  accountNotApprovedMessage,
  contactNotConfirmedMessage,
  identifierChoiceGuidanceMessage,
  phoneRuleMessage,
  phoneSignInNotSupportedMessage,
  registrationResultMessage,
  resolveSignInErrorMessage,
  resolveSignUpErrorMessage,
  signInFailedMessage,
  signupFailedMessage,
  usernameOnlyUnsupportedMessage,
  usernameRequiredForPhoneRegistrationMessage,
  usernameRuleMessage,
  usernameUnavailableMessage,
} = await bundleTsModule('../src/i18n/authMessages.ts', 'authMessages.cjs');
const { loadMyPreferences, saveMyPreferences } = await bundleTsModule(
  '../src/lib/domains/preferences.ts',
  'preferences.cjs',
);
const { formatAttendanceDateLabel, formatAttendanceTimestamp } = await bundleTsModule(
  '../src/lib/attendance/dateUtils.ts',
  'dateUtils.cjs',
);

const ALLOWED_ENGLISH_COGNATES = new Set([
  'canteenBrand',
  'levelCp',
  'levelCe1',
  'levelCe2',
  'levelCm1',
  'levelCm2',
  'error', // Spanish: Error
  'navigation', // German: Navigation
]);

test('I18N-1: translations dictionary has identical keys and non-empty strings across all 6 languages', () => {
  assert.deepEqual(Object.keys(translations).sort(), [...SIX_LANGUAGES].sort());
  const enKeys = Object.keys(translations.en).sort();
  assert.ok(enKeys.length >= 250, `Expected at least 250 translation keys, got ${enKeys.length}`);

  for (const lang of SIX_LANGUAGES) {
    const dict = translations[lang];
    const keys = Object.keys(dict).sort();
    assert.deepEqual(keys, enKeys, `Translation keys mismatch for language "${lang}"`);

    for (const key of enKeys) {
      const value = dict[key];
      assert.equal(typeof value, 'string', `Expected string for ${lang}.${key}`);
      assert.ok(value.trim().length > 0, `Expected non-empty value for ${lang}.${key}`);
    }
  }

  // Verify standalone locale files match translations exports and have zero English copy-paste fallbacks
  assert.equal(translations.es, es);
  assert.equal(translations.de, de);
  assert.equal(translations.pt, pt);

  for (const lang of NEW_LANGUAGES) {
    const dict = translations[lang];
    for (const key of enKeys) {
      if (ALLOWED_ENGLISH_COGNATES.has(key)) continue;
      assert.notEqual(
        dict[key],
        translations.en[key],
        `Untranslated English fallback detected at ${lang}.${key}: "${dict[key]}"`,
      );
    }
  }
});

test('I18N-2: Zero ...en or ...fr spreads in src/i18n/ source files', () => {
  const i18nFiles = [
    '../src/i18n/translations.ts',
    '../src/i18n/locales/es.ts',
    '../src/i18n/locales/de.ts',
    '../src/i18n/locales/pt.ts',
    '../src/i18n/homepages.ts',
    '../src/i18n/authMessages.ts',
    '../src/i18n/telegram-link.ts',
    '../src/i18n/content.ts',
  ];
  for (const relPath of i18nFiles) {
    const src = fs.readFileSync(path.resolve(__dirname, relPath), 'utf8');
    assert.doesNotMatch(src, /\.\.\.\s*(en|fr|ar)\b/, `${relPath} must not spread another language object`);
  }
});

test('I18N-3: homepages badges, common copy, telegramLinkCopy, authMessages, and contentT cover all 6 languages', () => {
  for (const [pageKey, localized] of Object.entries(HOMEPAGE_BADGE_LABELS)) {
    for (const lang of SIX_LANGUAGES) {
      assert.ok(localized[lang]?.trim().length > 0, `Missing badge label for ${pageKey}.${lang}`);
    }
    for (const lang of NEW_LANGUAGES) {
      assert.notEqual(localized[lang], localized.en, `Untranslated badge label at ${pageKey}.${lang}`);
    }
    assert.equal(pickText(localized, 'es'), localized.es);
    assert.equal(pickText(localized, 'de'), localized.de);
    assert.equal(pickText(localized, 'pt'), localized.pt);
  }

  for (const [textKey, localized] of Object.entries(HOMEPAGE_COMMON_TEXT)) {
    for (const lang of SIX_LANGUAGES) {
      assert.ok(localized[lang]?.trim().length > 0, `Missing common text for ${textKey}.${lang}`);
    }
    for (const lang of NEW_LANGUAGES) {
      assert.notEqual(localized[lang], localized.en, `Untranslated common text at ${textKey}.${lang}`);
    }
  }

  const tgEnKeys = Object.keys(telegramLinkCopy.en).sort();
  for (const lang of SIX_LANGUAGES) {
    const copy = getTelegramLinkCopy(lang);
    assert.deepEqual(Object.keys(copy).sort(), tgEnKeys, `telegramLinkCopy keys mismatch for ${lang}`);
    for (const k of tgEnKeys) {
      assert.ok(copy[k].trim().length > 0, `Empty telegramLinkCopy.${lang}.${k}`);
      if (NEW_LANGUAGES.includes(lang)) {
        assert.notEqual(copy[k], telegramLinkCopy.en[k], `Untranslated telegramLinkCopy.${lang}.${k}`);
      }
    }
  }

  const authResolvers = [
    usernameRuleMessage,
    identifierChoiceGuidanceMessage,
    phoneRuleMessage,
    usernameOnlyUnsupportedMessage,
    phoneSignInNotSupportedMessage,
    usernameRequiredForPhoneRegistrationMessage,
    usernameUnavailableMessage,
    accountNotApprovedMessage,
    contactNotConfirmedMessage,
    signInFailedMessage,
    signupFailedMessage,
    (lang) => registrationResultMessage(lang, { confirmationRequired: true, secondaryPhoneVerificationRequired: true }),
    (lang) => resolveSignInErrorMessage(lang, 'invalid_credentials'),
    (lang) => resolveSignUpErrorMessage(lang, 'invalid_email_format'),
  ];
  for (const fn of authResolvers) {
    const enMsg = fn('en');
    for (const lang of NEW_LANGUAGES) {
      const msg = fn(lang);
      assert.ok(msg.trim().length > 0, `Empty auth message for ${lang}`);
      assert.notEqual(msg, enMsg, `Auth message fell back to English for ${lang}: ${msg}`);
    }
  }

  const contentSamples = [
    ['announcements', 'ann-1', 'title'],
    ['homework', 'hw-1', 'title'],
    ['calendar', 'cal-1', 'title'],
    ['menu', '0', 'day'],
    ['teachers', 'teach-1', 'title'],
    ['admins', 'admin-1', 'title'],
    ['notifications', 'n-1', 'title'],
  ];
  for (const [section, id, field] of contentSamples) {
    const enVal = contentT('en', section, id, field, '__FALLBACK__');
    assert.notEqual(enVal, '__FALLBACK__');
    for (const lang of NEW_LANGUAGES) {
      const val = contentT(lang, section, id, field, '__FALLBACK__');
      assert.notEqual(val, '__FALLBACK__', `Missing contentT for ${lang}.${section}.${id}.${field}`);
      assert.notEqual(val, enVal, `Untranslated contentT for ${lang}.${section}.${id}.${field}`);
    }
  }
});

test('I18N-4: Navbar selector exposes all 6 languages and preserves LTR shell', () => {
  const navbarSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/Navbar.tsx'), 'utf8');
  for (const lang of SIX_LANGUAGES) {
    assert.match(navbarSrc, new RegExp(`<option\\s+value="${lang}">`), `Navbar missing <option value="${lang}">`);
  }
  assert.match(navbarSrc, /<header[\s\S]*?dir="ltr"/, 'Navbar <header> must preserve dir="ltr"');

  const prefsCtxSrc = fs.readFileSync(path.resolve(__dirname, '../src/context/PreferencesContext.tsx'), 'utf8');
  assert.match(
    prefsCtxSrc,
    /const dir:\s*'rtl'\s*\|\s*'ltr'\s*=\s*language\s*===\s*'ar'\s*\?\s*'rtl'\s*:\s*'ltr'/,
    'PreferencesContext must keep RTL strictly for Arabic and LTR for fr/en/es/de/pt',
  );
});

test('I18N-5: Domain preferences loader/saver accepts all 6 languages and rejects unsupported codes', async () => {
  for (const lang of SIX_LANGUAGES) {
    const fakeLoadClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                language: lang,
                theme: 'light',
                notification_sound: 'Kristou Bell',
                sound_muted: false,
                vibration_enabled: true,
              },
              error: null,
            }),
          }),
        }),
      }),
    };
    const loaded = await loadMyPreferences('user-1', fakeLoadClient);
    assert.equal(loaded.ok, true);
    assert.equal(loaded.data?.language, lang);

    const fakeSaveClient = {
      rpc: async (_fn, args) => ({
        data: {
          language: args.p_language,
          theme: 'light',
          notification_sound: 'Kristou Bell',
          sound_muted: false,
          vibration_enabled: true,
        },
        error: null,
      }),
    };
    const saved = await saveMyPreferences({ language: lang }, fakeSaveClient);
    assert.equal(saved.ok, true);
    assert.equal(saved.data?.language, lang);
  }

  for (const badLang of ['it', 'ja', 'ES', '']) {
    let rpcCalls = 0;
    const spySaveClient = {
      rpc: async () => {
        rpcCalls += 1;
        return { data: null, error: null };
      },
    };
    const rejectedSave = await saveMyPreferences({ language: badLang }, spySaveClient);
    assert.equal(rejectedSave.ok, false);
    assert.equal(rejectedSave.status, 'ERROR');
    assert.equal(rejectedSave.errorCode, 'invalid_language');
    assert.equal(rpcCalls, 0, `Unsupported language "${badLang}" must not invoke rpc`);

    const badLoadClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                language: badLang,
                theme: 'light',
                notification_sound: 'Kristou Bell',
                sound_muted: false,
                vibration_enabled: true,
              },
              error: null,
            }),
          }),
        }),
      }),
    };
    const rejectedLoad = await loadMyPreferences('user-1', badLoadClient);
    assert.equal(rejectedLoad.ok, false);
    assert.equal(rejectedLoad.status, 'ERROR');
    assert.equal(rejectedLoad.errorCode, 'operation_failed');
    assert.equal(rejectedLoad.data, undefined);
  }
});

test('I18N-6: Date formatters work cleanly for all 6 languages', () => {
  for (const lang of SIX_LANGUAGES) {
    const dateLbl = formatAttendanceDateLabel('2026-11-12', lang);
    const tsLbl = formatAttendanceTimestamp('2026-11-12T10:30:00Z', lang);
    assert.ok(dateLbl && dateLbl !== '2026-11-12', `Expected formatted date for ${lang}, got ${dateLbl}`);
    assert.ok(tsLbl && tsLbl !== '—' && tsLbl !== '2026-11-12T10:30:00Z', `Expected formatted timestamp for ${lang}, got ${tsLbl}`);
  }
});
