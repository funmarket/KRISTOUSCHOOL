import type { Language } from '../../types.ts';

export const TUNIS_TIMEZONE = 'Africa/Tunis';
export const MAX_STUDENT_ATTENDANCE_RANGE_DAYS = 366;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const tunisDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TUNIS_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const tunisPartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TUNIS_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/**
 * Returns today's calendar date in Africa/Tunis as YYYY-MM-DD without UTC day drift.
 */
export function getTunisTodayIsoDate(now: Date = new Date()): string {
  const parts = tunisDateFormatter.formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  if (year && month && day) {
    return `${year}-${month}-${day}`;
  }
  return tunisDateFormatter.format(now);
}

/**
 * Strictly validates a YYYY-MM-DD date string against real calendar dates.
 */
export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) {
    return false;
  }
  const [yStr, mStr, dStr] = value.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/**
 * Pure YYYY-MM-DD day arithmetic avoiding browser timezone shifts.
 */
export function addDaysIso(isoDate: string, deltaDays: number): string {
  if (!isValidIsoDate(isoDate)) {
    return isoDate;
  }
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const year = String(dt.getUTCFullYear()).padStart(4, '0');
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function diffIsoDays(fromDate: string, toDate: string): number {
  if (!isValidIsoDate(fromDate) || !isValidIsoDate(toDate)) {
    return Number.NaN;
  }
  const [fy, fm, fd] = fromDate.split('-').map(Number);
  const [ty, tm, td] = toDate.split('-').map(Number);
  const fromMs = Date.UTC(fy, fm - 1, fd);
  const toMs = Date.UTC(ty, tm - 1, td);
  return Math.round((toMs - fromMs) / 86_400_000);
}

export function isWithinAttendanceHistoryRange(fromDate: string, toDate: string): boolean {
  if (!isValidIsoDate(fromDate) || !isValidIsoDate(toDate)) {
    return false;
  }
  const diff = diffIsoDays(fromDate, toDate);
  return Number.isFinite(diff) && diff >= 0 && diff <= MAX_STUDENT_ATTENDANCE_RANGE_DAYS;
}

/**
 * Teacher submitted-register correction cutoff is the end of that Africa/Tunis schoolDate
 * (i.e. next Africa/Tunis midnight after schoolDate).
 */
export function isTeacherCorrectionWindowOpen(schoolDate: string, now: Date = new Date()): boolean {
  if (!isValidIsoDate(schoolDate)) {
    return false;
  }
  const tunisToday = getTunisTodayIsoDate(now);
  return tunisToday <= schoolDate;
}

/**
 * Computes milliseconds until the next Africa/Tunis midnight boundary (+250ms buffer)
 * so Teacher views automatically recheck the date cutoff across midnight transitions.
 */
export function getNextTunisMidnightDelayMs(now: Date = new Date()): number {
  const parts = tunisPartsFormatter.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const second = Number(parts.find((p) => p.type === 'second')?.value ?? '0');

  const elapsedTodaySeconds = hour * 3600 + minute * 60 + second;
  const remainingSeconds = Math.max(1, 86_400 - elapsedTodaySeconds);
  return remainingSeconds * 1000 + 250;
}

const ATTENDANCE_LOCALE_MAP: Record<Language, string> = {
  ar: 'ar-TN',
  fr: 'fr-TN',
  en: 'en-GB',
  es: 'es-ES',
  de: 'de-DE',
  pt: 'pt-PT',
};

export function formatAttendanceDateLabel(isoDate: string, language: Language): string {
  if (!isValidIsoDate(isoDate)) return isoDate;
  const [y, m, d] = isoDate.split('-').map(Number);
  const utcNoon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const locale = ATTENDANCE_LOCALE_MAP[language] ?? 'en-GB';
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: TUNIS_TIMEZONE,
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(utcNoon);
  } catch {
    return isoDate;
  }
}

export function formatAttendanceTimestamp(isoTimestamp: string | null | undefined, language: Language): string {
  if (!isoTimestamp) return '—';
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) return isoTimestamp;
  const locale = ATTENDANCE_LOCALE_MAP[language] ?? 'en-GB';
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: TUNIS_TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(parsed);
  } catch {
    return isoTimestamp;
  }
}
