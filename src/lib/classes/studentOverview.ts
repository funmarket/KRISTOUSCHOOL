import type { ClassStudentRosterItem, SchoolClassSummary } from '../../types.ts';

export function formatSafeEnrollmentDate(rawDate: string | null | undefined, language: string = 'en'): string {
  if (!rawDate || typeof rawDate !== 'string') return '—';
  const trimmed = rawDate.trim();
  if (!trimmed) return '—';

  // Validate date-only calendar components (YYYY-MM-DD) strictly before formatting
  const parts = trimmed.split('T')[0].split('-');
  if (parts.length === 3) {
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (isNaN(y) || isNaN(m) || isNaN(d) || m < 1 || m > 12 || d < 1 || d > 31) {
      return trimmed;
    }
    const testDate = new Date(Date.UTC(y, m - 1, d));
    if (
      testDate.getUTCFullYear() !== y ||
      testDate.getUTCMonth() !== m - 1 ||
      testDate.getUTCDate() !== d
    ) {
      return trimmed; // Impossible calendar date -> return honest fallback / raw string
    }
  }

  const dateObj = new Date(trimmed.includes('T') ? trimmed : `${trimmed}T00:00:00Z`);
  if (isNaN(dateObj.getTime())) {
    return trimmed;
  }
  try {
    const localeMap: Record<string, string> = { ar: 'ar-TN', fr: 'fr-FR', en: 'en-US', es: 'es-ES', de: 'de-DE', pt: 'pt-PT' };
    const locale = localeMap[language] ?? 'en-US';
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(dateObj);
  } catch {
    return trimmed;
  }
}

export interface StudentOverviewSelectionInput {
  currentUser: { id: string; role?: string; accountStatus?: string; assignedClassIds?: string[] } | null | undefined;
  selectedClassId: string | null | undefined;
  selectedStudentId: string | null | undefined;
  selectionActorId: string | null | undefined;
  classes: readonly SchoolClassSummary[];
  rosters: Record<string, readonly ClassStudentRosterItem[]>;
  backendStatus: string | null | undefined;
}

export function resolveStudentOverviewSelection(input: StudentOverviewSelectionInput): {
  allowed: boolean;
  schoolClass: SchoolClassSummary | null;
  student: ClassStudentRosterItem | null;
} {
  if (
    !input.currentUser ||
    input.currentUser.accountStatus !== 'APPROVED' ||
    input.currentUser.role !== 'TEACHER' ||
    !input.selectedClassId ||
    !input.selectedStudentId ||
    !input.selectionActorId ||
    input.selectionActorId !== input.currentUser.id ||
    input.backendStatus !== 'READY'
  ) {
    return { allowed: false, schoolClass: null, student: null };
  }

  const assigned = input.currentUser.assignedClassIds ?? [];
  if (!assigned.includes(input.selectedClassId)) {
    return { allowed: false, schoolClass: null, student: null };
  }

  const schoolClass = input.classes.find((c) => c.id === input.selectedClassId) ?? null;
  if (!schoolClass) {
    return { allowed: false, schoolClass: null, student: null };
  }

  const roster = input.rosters[input.selectedClassId];
  // Distinguish confirmed removal from temporary loading: if roster is not an array, it's temporary loading (deny)
  if (!Array.isArray(roster)) {
    return { allowed: false, schoolClass: null, student: null };
  }

  const student = roster.find((s) => s.studentId === input.selectedStudentId) ?? null;
  if (!student) {
    return { allowed: false, schoolClass: null, student: null };
  }

  return { allowed: true, schoolClass, student };
}
