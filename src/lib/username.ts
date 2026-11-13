export type UsernameValidationReason =
  | 'empty'
  | 'too_short'
  | 'too_long'
  | 'control_or_invisible'
  | 'looks_like_email'
  | 'looks_like_phone'
  | 'invalid_characters'
  | 'invalid_boundaries';

export interface UsernameValidationResult {
  valid: boolean;
  reason?: UsernameValidationReason;
  display?: string;
  key?: string;
}

const CONTROL_OR_INVISIBLE_PATTERN = /[\p{Cc}\p{Cf}\p{Cs}\p{Cn}\r\n\u2028\u2029]/u;
const CONSECUTIVE_PUNCTUATION_PATTERN = /[._-]{2,}/;
const PHONE_LIKE_CHARS_ONLY_PATTERN = /^[+\d\s().-]+$/u;

/**
 * Shared Unicode code-point whitelist contract (aligned with PostgreSQL
 * public.is_username_letter_or_digit_codepoint and Edge Function validation):
 * - ASCII digits (U+0030..U+0039), uppercase (U+0041..U+005A), lowercase (U+0061..U+007A)
 * - Latin-1 letters (U+00C0..U+00D6, U+00D8..U+00F6, U+00F8..U+00FF; excludes §, ×, ÷)
 * - Latin Extended-A/B (U+0100..U+024F) and Latin Extended Additional (U+1E00..U+1EFF)
 * - Arabic letters (U+0621..U+063A, U+0641..U+064A, U+066E..U+066F, U+0671..U+06D3, U+06D5, U+06FA..U+06FC, U+06FF)
 * - Arabic-Indic digits (U+0660..U+0669) and Extended Arabic-Indic digits (U+06F0..U+06F9)
 */
export function isUsernameLetterOrDigitCodePoint(cp: number): boolean {
  return (
    (cp >= 0x0030 && cp <= 0x0039) ||
    (cp >= 0x0041 && cp <= 0x005a) ||
    (cp >= 0x0061 && cp <= 0x007a) ||
    (cp >= 0x00c0 && cp <= 0x00d6) ||
    (cp >= 0x00d8 && cp <= 0x00f6) ||
    (cp >= 0x00f8 && cp <= 0x00ff) ||
    (cp >= 0x0100 && cp <= 0x024f) ||
    (cp >= 0x1e00 && cp <= 0x1eff) ||
    (cp >= 0x0621 && cp <= 0x063a) ||
    (cp >= 0x0641 && cp <= 0x064a) ||
    (cp >= 0x0660 && cp <= 0x0669) ||
    (cp >= 0x066e && cp <= 0x066f) ||
    (cp >= 0x0671 && cp <= 0x06d3) ||
    cp === 0x06d5 ||
    (cp >= 0x06f0 && cp <= 0x06f9) ||
    (cp >= 0x06fa && cp <= 0x06fc) ||
    cp === 0x06ff
  );
}

/**
 * Shared Unicode combining-mark whitelist (aligned with PostgreSQL
 * public.is_username_mark_codepoint):
 * - Combining Diacritical Marks (U+0300..U+036F)
 * - Arabic Harakat / Tashkeel combining marks (U+064B..U+065F, U+0670)
 */
export function isUsernameMarkCodePoint(cp: number): boolean {
  return (
    (cp >= 0x0300 && cp <= 0x036f) ||
    (cp >= 0x064b && cp <= 0x065f) ||
    cp === 0x0670
  );
}

/**
 * Allowed internal separators: space (U+0020), hyphen-minus (U+002D),
 * full stop (U+002E), low line (U+005F).
 */
export function isUsernameSeparatorCodePoint(cp: number): boolean {
  return cp === 0x0020 || cp === 0x002d || cp === 0x002e || cp === 0x005f;
}

export function isAllowedUsernameCodePoint(cp: number): boolean {
  return (
    isUsernameLetterOrDigitCodePoint(cp) ||
    isUsernameMarkCodePoint(cp) ||
    isUsernameSeparatorCodePoint(cp)
  );
}

/**
 * Normalizes a human-readable username for display:
 * - Applies Unicode NFC normalization
 * - Trims leading and trailing ASCII spaces (U+0020)
 * - Collapses repeated internal ASCII spaces into a single space
 * - Preserves original letter casing, Arabic script, and French accents
 */
export function normalizeUsernameDisplay(value: string): string {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFC')
    .replace(/^ +| +$/g, '')
    .replace(/ {2,}/g, ' ');
}

/**
 * Produces the canonical lowercase NFC lookup/uniqueness key for a username.
 */
export function normalizeUsernameKey(value: string): string {
  return normalizeUsernameDisplay(value).toLowerCase();
}

/**
 * Validates and normalizes Tunisian (+216) 8-digit numbers and explicit international E.164 numbers.
 * Never guesses a foreign country code by blindly prepending '+' to ambiguous digit strings.
 */
export function isValidPhoneInput(value: string, defaultCountryCode = '+216'): boolean {
  try {
    normalizePhoneInput(value, defaultCountryCode);
    return true;
  } catch {
    return false;
  }
}

export function normalizePhoneInput(value: string, defaultCountryCode = '+216'): string {
  if (typeof value !== 'string') {
    throw new Error('invalid_phone_format');
  }
  const trimmed = value.normalize('NFC').trim();
  if (!trimmed || !/^[+\d\s()-]+$/.test(trimmed)) {
    throw new Error('invalid_phone_format');
  }

  const compact = trimmed.replace(/[\s()-]/g, '');
  if (!compact) {
    throw new Error('invalid_phone_format');
  }

  const e164Candidate = compact.startsWith('00') ? `+${compact.slice(2)}` : compact;

  if (e164Candidate.startsWith('+')) {
    if (!/^\+[1-9]\d{7,14}$/.test(e164Candidate)) {
      throw new Error('invalid_phone_format');
    }
    if (e164Candidate.startsWith('+216') && !/^\+216[2-9]\d{7}$/.test(e164Candidate)) {
      throw new Error('invalid_phone_format');
    }
    return e164Candidate;
  }

  // Local national number without '+' or '00': only accept validated 8-digit Tunisian numbers in +216 context
  if (defaultCountryCode === '+216' && /^[2-9]\d{7}$/.test(compact)) {
    return `+216${compact}`;
  }

  throw new Error('invalid_phone_format');
}

export function validateUsername(value: string): UsernameValidationResult {
  if (typeof value !== 'string') {
    return { valid: false, reason: 'empty' };
  }

  if (CONTROL_OR_INVISIBLE_PATTERN.test(value)) {
    return { valid: false, reason: 'control_or_invisible' };
  }

  const display = normalizeUsernameDisplay(value);
  if (!display) {
    return { valid: false, reason: 'empty' };
  }

  const codePoints = Array.from(display, (ch) => ch.codePointAt(0)!);
  const codePointLength = codePoints.length;
  if (codePointLength < 3) {
    return { valid: false, reason: 'too_short' };
  }
  if (codePointLength > 50) {
    return { valid: false, reason: 'too_long' };
  }

  if (display.includes('@')) {
    return { valid: false, reason: 'looks_like_email' };
  }

  if (isValidPhoneInput(display) || PHONE_LIKE_CHARS_ONLY_PATTERN.test(display)) {
    return { valid: false, reason: 'looks_like_phone' };
  }

  for (let i = 0; i < codePoints.length; i++) {
    const cp = codePoints[i];
    if (!isAllowedUsernameCodePoint(cp)) {
      return { valid: false, reason: 'invalid_characters' };
    }
    if (isUsernameMarkCodePoint(cp)) {
      const prev = i > 0 ? codePoints[i - 1] : -1;
      if (!isUsernameLetterOrDigitCodePoint(prev) && !isUsernameMarkCodePoint(prev)) {
        return { valid: false, reason: 'invalid_characters' };
      }
    }
  }

  const firstCp = codePoints[0];
  const lastCp = codePoints[codePoints.length - 1];
  if (
    !isUsernameLetterOrDigitCodePoint(firstCp) ||
    (!isUsernameLetterOrDigitCodePoint(lastCp) && !isUsernameMarkCodePoint(lastCp)) ||
    CONSECUTIVE_PUNCTUATION_PATTERN.test(display) ||
    display.includes('  ')
  ) {
    return { valid: false, reason: 'invalid_boundaries' };
  }

  return {
    valid: true,
    display,
    key: display.toLowerCase(),
  };
}

export function isValidUsername(value: string): boolean {
  return validateUsername(value).valid;
}


