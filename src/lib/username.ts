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
const ALLOWED_USERNAME_CHARS_PATTERN = /^[\p{L}\p{M}\p{Nd} ._-]+$/u;
const VALID_START_PATTERN = /^[\p{L}\p{Nd}]/u;
const VALID_END_PATTERN = /[\p{L}\p{M}\p{Nd}]$/u;
const CONSECUTIVE_PUNCTUATION_PATTERN = /[._-]{2,}/;
const PHONE_LIKE_CHARS_ONLY_PATTERN = /^[+\d\s().-]+$/u;

/**
 * Normalizes a human-readable username for display:
 * - Applies Unicode NFC normalization
 * - Trims leading and trailing whitespace
 * - Collapses repeated internal spaces into a single space
 * - Preserves original letter casing, Arabic script, and French accents
 */
export function normalizeUsernameDisplay(value: string): string {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFC')
    .replace(/^[\s\u00A0]+|[\s\u00A0]+$/g, '')
    .replace(/[\s\u00A0]+/g, ' ');
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

  const codePointLength = [...display].length;
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

  if (!ALLOWED_USERNAME_CHARS_PATTERN.test(display)) {
    return { valid: false, reason: 'invalid_characters' };
  }

  if (
    !VALID_START_PATTERN.test(display) ||
    !VALID_END_PATTERN.test(display) ||
    CONSECUTIVE_PUNCTUATION_PATTERN.test(display)
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

