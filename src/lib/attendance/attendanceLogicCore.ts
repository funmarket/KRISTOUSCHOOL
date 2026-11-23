import type {
  AttendanceEntryDraft,
  AttendanceMark,
  AttendanceRegisterEntry,
  User,
} from '../../types.ts';

export type AttendanceAccessMode =
  | 'STAFF_TEACHER'
  | 'STAFF_OFFICE'
  | 'FAMILY_PARENT'
  | 'FAMILY_STUDENT'
  | 'UNAUTHORIZED';

export const ATTENDANCE_MARKS: readonly AttendanceMark[] = [
  'PRESENT',
  'ABSENT',
  'LATE',
  'EXCUSED',
] as const;

export const MAX_ATTENDANCE_PATCH_ITEMS = 100;
export const MAX_ATTENDANCE_TEXT_LENGTH = 1000;

export function resolveAttendanceAccessMode(
  user: User | null | undefined,
): AttendanceAccessMode {
  if (!user || user.accountStatus !== 'APPROVED') {
    return 'UNAUTHORIZED';
  }
  switch (user.role) {
    case 'TEACHER':
      return 'STAFF_TEACHER';
    case 'APP_ADMIN':
    case 'ADMINISTRATIVE_PERSONNEL':
      return 'STAFF_OFFICE';
    case 'PARENT':
      return 'FAMILY_PARENT';
    case 'STUDENT':
      return 'FAMILY_STUDENT';
    default:
      return 'UNAUTHORIZED';
  }
}

export function canCallStaffAttendanceEndpoints(user: User | null | undefined): boolean {
  const mode = resolveAttendanceAccessMode(user);
  return mode === 'STAFF_TEACHER' || mode === 'STAFF_OFFICE';
}

export function canCallFamilyAttendanceHistory(user: User | null | undefined): boolean {
  const mode = resolveAttendanceAccessMode(user);
  return mode === 'FAMILY_PARENT' || mode === 'FAMILY_STUDENT';
}

export function buildAttendanceActorScopeKey(user: User | null | undefined): string {
  if (!user) return 'anonymous';
  const assigned = Array.isArray(user.assignedClassIds)
    ? [...user.assignedClassIds].sort().join(',')
    : '';
  const linked = Array.isArray(user.linkedChildrenIds)
    ? [...user.linkedChildrenIds].sort().join(',')
    : '';
  return `${user.id}|${user.role}|${user.accountStatus ?? 'UNKNOWN'}|cls:${assigned}|ch:${linked}`;
}

export function isAttendanceRegisterResultApplicable(params: {
  isMounted: boolean;
  requestSeq: number;
  currentRequestSeq: number;
  originActorScopeKey: string;
  originClassId: string;
  originSchoolDate: string;
  originTeacherUserId: string;
  currentActorScopeKey: string;
  currentAccessMode: AttendanceAccessMode;
  currentClassId: string;
  currentSchoolDate: string;
  currentTeacherUserId: string;
}): boolean {
  if (!params.isMounted) return false;
  if (params.requestSeq !== params.currentRequestSeq) return false;
  if (
    params.currentAccessMode !== 'STAFF_TEACHER' &&
    params.currentAccessMode !== 'STAFF_OFFICE'
  ) {
    return false;
  }
  if (params.originActorScopeKey !== params.currentActorScopeKey) return false;
  if (!params.originClassId || params.originClassId !== params.currentClassId) return false;
  if (!params.originSchoolDate || params.originSchoolDate !== params.currentSchoolDate) return false;
  if (params.originTeacherUserId !== params.currentTeacherUserId) return false;
  return true;
}

export function isAttendanceHistoryResultApplicable(params: {
  isMounted: boolean;
  requestSeq: number;
  currentRequestSeq: number;
  originActorScopeKey: string;
  originStudentId: string;
  originFromDate: string;
  originToDate: string;
  currentActorScopeKey: string;
  currentAccessAllowed: boolean;
  currentStudentId: string;
  currentFromDate: string;
  currentToDate: string;
}): boolean {
  if (!params.isMounted) return false;
  if (params.requestSeq !== params.currentRequestSeq) return false;
  if (!params.currentAccessAllowed) return false;
  if (params.originActorScopeKey !== params.currentActorScopeKey) return false;
  if (!params.originStudentId || params.originStudentId !== params.currentStudentId) return false;
  if (params.originFromDate !== params.currentFromDate) return false;
  if (params.originToDate !== params.currentToDate) return false;
  return true;
}

export function isAttendanceAuditStateApplicable(params: {
  actorScopeKey: string;
  visibleRegisterId: string | null | undefined;
  auditActorScopeKey: string;
  auditRegisterId: string;
}): boolean {
  if (!params.visibleRegisterId) return false;
  if (!params.auditRegisterId) return false;
  if (params.auditActorScopeKey !== params.actorScopeKey) return false;
  if (params.auditRegisterId !== params.visibleRegisterId) return false;
  return true;
}

export function cloneAttendanceDraft(
  draftByStudentId: Readonly<Record<string, AttendanceEntryDraft>>,
): Record<string, AttendanceEntryDraft> {
  const copy: Record<string, AttendanceEntryDraft> = {};
  for (const [studentId, entry] of Object.entries(draftByStudentId)) {
    copy[studentId] = {
      mark: entry.mark,
      internalComment: entry.internalComment,
    };
  }
  return copy;
}

export function getEffectiveAttendanceEntry(
  serverEntry: AttendanceRegisterEntry,
  draftByStudentId: Readonly<Record<string, AttendanceEntryDraft>>,
): { mark: AttendanceMark | null; internalComment: string } {
  const draft = draftByStudentId[serverEntry.studentId];
  if (!draft) {
    return {
      mark: serverEntry.mark,
      internalComment: serverEntry.internalComment,
    };
  }
  return {
    mark: draft.mark,
    internalComment: draft.internalComment,
  };
}

export function applyMarkAllPresentToNotRecorded(
  entries: readonly AttendanceRegisterEntry[],
  draftByStudentId: Readonly<Record<string, AttendanceEntryDraft>>,
): Record<string, AttendanceEntryDraft> {
  const next: Record<string, AttendanceEntryDraft> = { ...draftByStudentId };
  for (const entry of entries) {
    const current = getEffectiveAttendanceEntry(entry, next);
    if (current.mark === null) {
      next[entry.studentId] = {
        mark: 'PRESENT',
        internalComment: current.internalComment,
      };
    }
  }
  return next;
}

export function hasDirtyAttendanceDraft(
  entries: readonly AttendanceRegisterEntry[],
  draftByStudentId: Readonly<Record<string, AttendanceEntryDraft>>,
  reasonText: string,
): boolean {
  if (reasonText.trim().length > 0) {
    return true;
  }
  for (const entry of entries) {
    const draft = draftByStudentId[entry.studentId];
    if (!draft) continue;
    if (draft.mark !== entry.mark || draft.internalComment !== entry.internalComment) {
      return true;
    }
  }
  return false;
}

export function countAttendanceMarks(
  entries: readonly AttendanceRegisterEntry[],
  draftByStudentId: Readonly<Record<string, AttendanceEntryDraft>>,
): {
  total: number;
  notRecorded: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
} {
  let notRecorded = 0;
  let present = 0;
  let absent = 0;
  let late = 0;
  let excused = 0;
  for (const entry of entries) {
    const { mark } = getEffectiveAttendanceEntry(entry, draftByStudentId);
    if (mark === null) notRecorded += 1;
    else if (mark === 'PRESENT') present += 1;
    else if (mark === 'ABSENT') absent += 1;
    else if (mark === 'LATE') late += 1;
    else if (mark === 'EXCUSED') excused += 1;
  }
  return {
    total: entries.length,
    notRecorded,
    present,
    absent,
    late,
    excused,
  };
}
