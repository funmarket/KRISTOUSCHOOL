import { isTeacherCorrectionWindowOpen } from './dateUtils.ts';
import { countAttendanceMarks, hasDirtyAttendanceDraft, MAX_ATTENDANCE_PATCH_ITEMS, MAX_ATTENDANCE_TEXT_LENGTH, type AttendanceAccessMode } from './attendanceLogicCore.ts';
import type {
  AttendanceEntryDraft,
  AttendanceRegisterData,
  AttendanceRegisterEntry,
  AttendanceSaveEntryPatch,
  AttendanceSaveIntent,
} from '../../types.ts';


export function buildAttendanceEntriesPayload(
  entries: readonly AttendanceRegisterEntry[],
  draftByStudentId: Readonly<Record<string, AttendanceEntryDraft>>,
): {
  ok: true;
  patches: AttendanceSaveEntryPatch[];
} | {
  ok: false;
  errorCode: 'invalid_attendance_input' | 'max_patch_items_exceeded';
  errorMessage: string;
} {
  const patches: AttendanceSaveEntryPatch[] = [];

  for (const entry of entries) {
    const draft = draftByStudentId[entry.studentId];
    if (!draft) continue;

    const markChanged = draft.mark !== entry.mark;
    const commentChanged = draft.internalComment !== entry.internalComment;
    if (!markChanged && !commentChanged) continue;

    if (draft.internalComment.length > MAX_ATTENDANCE_TEXT_LENGTH) {
      return {
        ok: false,
        errorCode: 'invalid_attendance_input',
        errorMessage: `Comment exceeds ${MAX_ATTENDANCE_TEXT_LENGTH} characters.`,
      };
    }

    const patch: AttendanceSaveEntryPatch = {
      studentId: entry.studentId,
      mark: draft.mark,
    };
    if (commentChanged) {
      patch.internalComment = draft.internalComment;
    }
    patches.push(patch);
  }

  if (patches.length > MAX_ATTENDANCE_PATCH_ITEMS) {
    return {
      ok: false,
      errorCode: 'max_patch_items_exceeded',
      errorMessage: `At most ${MAX_ATTENDANCE_PATCH_ITEMS} pupil updates can be saved per request.`,
    };
  }

  return { ok: true, patches };
}

export interface RegisterActionAvailability {
  isSubmitted: boolean;
  isNewRegister: boolean;
  isTeacherCutoffClosed: boolean;
  canEditFields: boolean;
  canSaveDraft: boolean;
  canSubmitOrCorrect: boolean;
  requiresCorrectionReason: boolean;
  hasUnmarkedEligiblePupils: boolean;
  isRosterEmpty: boolean;
  isDirty: boolean;
}

export function resolveRegisterActionAvailability(params: {
  register: AttendanceRegisterData | null;
  accessMode: AttendanceAccessMode;
  classIsArchived?: boolean;
  draftByStudentId: Readonly<Record<string, AttendanceEntryDraft>>;
  reasonText: string;
  now?: Date;
}): RegisterActionAvailability {
  const { register, accessMode, classIsArchived = false, draftByStudentId, reasonText, now } = params;
  if (!register || (accessMode !== 'STAFF_TEACHER' && accessMode !== 'STAFF_OFFICE')) {
    return {
      isSubmitted: false,
      isNewRegister: true,
      isTeacherCutoffClosed: false,
      canEditFields: false,
      canSaveDraft: false,
      canSubmitOrCorrect: false,
      requiresCorrectionReason: false,
      hasUnmarkedEligiblePupils: false,
      isRosterEmpty: true,
      isDirty: false,
    };
  }

  const isTeacher = accessMode === 'STAFF_TEACHER';
  const isOffice = accessMode === 'STAFF_OFFICE';
  const isSubmitted = register.status === 'SUBMITTED';
  const isNewRegister = register.version === 0 && register.registerId === null;
  const isTeacherCutoffClosed =
    isTeacher && isSubmitted && !isTeacherCorrectionWindowOpen(register.schoolDate, now);
  const archivedBlocked = classIsArchived && (!isOffice || isNewRegister);

  const counts = countAttendanceMarks(register.entries, draftByStudentId);
  const isRosterEmpty = register.entries.length === 0;
  const hasUnmarkedEligiblePupils = counts.notRecorded > 0;
  const isDirty = hasDirtyAttendanceDraft(register.entries, draftByStudentId, reasonText);

  const canEditFields = !isTeacherCutoffClosed && !archivedBlocked;
  const requiresCorrectionReason = isSubmitted;
  const hasValidReason = !requiresCorrectionReason || reasonText.trim().length > 0;
  const validReasonLength = reasonText.trim().length <= MAX_ATTENDANCE_TEXT_LENGTH;

  const canSaveDraft = canEditFields && !isSubmitted && isDirty;

  const canSubmitOrCorrect =
    canEditFields &&
    !isRosterEmpty &&
    !hasUnmarkedEligiblePupils &&
    validReasonLength &&
    (!isSubmitted || (hasValidReason && isDirty));

  return {
    isSubmitted,
    isNewRegister,
    isTeacherCutoffClosed,
    canEditFields,
    canSaveDraft,
    canSubmitOrCorrect,
    requiresCorrectionReason,
    hasUnmarkedEligiblePupils,
    isRosterEmpty,
    isDirty,
  };
}

export function createSavePayloadSignature(params: {
  classId: string;
  schoolDate: string;
  teacherUserId: string | null;
  expectedVersion: number;
  rosterFingerprint: string;
  submit: boolean;
  reason: string | null;
  entries: readonly AttendanceSaveEntryPatch[];
}): string {
  const normalizedEntries = [...params.entries]
    .sort((a, b) => a.studentId.localeCompare(b.studentId))
    .map((item) => ({
      studentId: item.studentId,
      mark: item.mark,
      ...(item.internalComment !== undefined ? { internalComment: item.internalComment } : {}),
    }));

  return JSON.stringify({
    classId: params.classId,
    schoolDate: params.schoolDate,
    teacherUserId: params.teacherUserId ?? null,
    expectedVersion: params.expectedVersion,
    rosterFingerprint: params.rosterFingerprint,
    submit: params.submit,
    reason: params.reason ?? null,
    entries: normalizedEntries,
  });
}

function generateUuidV4Fallback(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function resolveAttendanceSaveIntent(
  existingIntent: AttendanceSaveIntent | null,
  params: {
    classId: string;
    schoolDate: string;
    teacherUserId: string | null;
    expectedVersion: number;
    rosterFingerprint: string;
    submit: boolean;
    reason: string | null;
    entries: AttendanceSaveEntryPatch[];
  },
  createUuid: () => string = generateUuidV4Fallback,
): AttendanceSaveIntent {
  const normalizedReason = params.reason && params.reason.trim().length > 0 ? params.reason.trim() : null;
  const payloadSignature = createSavePayloadSignature({
    ...params,
    reason: normalizedReason,
  });

  if (existingIntent && existingIntent.payloadSignature === payloadSignature) {
    return existingIntent;
  }

  return {
    requestId: createUuid(),
    payloadSignature,
    classId: params.classId,
    schoolDate: params.schoolDate,
    teacherUserId: params.teacherUserId ?? null,
    expectedVersion: params.expectedVersion,
    rosterFingerprint: params.rosterFingerprint,
    submit: params.submit,
    reason: normalizedReason,
    entries: params.entries.map((e) => ({ ...e })),
    confirmedSavePendingRefresh: false,
  };
}

export interface ConflictReconciliationResult {
  preservedDraftByStudentId: Record<string, AttendanceEntryDraft>;
  droppedStudentIds: string[];
  addedUnmarkedStudentNames: string[];
}

export function reconcileConflictWithFreshRegister(
  freshRegister: AttendanceRegisterData,
  previousDraftByStudentId: Readonly<Record<string, AttendanceEntryDraft>>,
  previousServerEntries: readonly AttendanceRegisterEntry[],
): ConflictReconciliationResult {
  const freshIds = new Set(freshRegister.entries.map((e) => e.studentId));
  const previousIds = new Set(previousServerEntries.map((e) => e.studentId));
  const preservedDraftByStudentId: Record<string, AttendanceEntryDraft> = {};
  const droppedStudentIds: string[] = [];

  for (const [studentId, draft] of Object.entries(previousDraftByStudentId)) {
    const prevServer = previousServerEntries.find((e) => e.studentId === studentId);
    const wasModified =
      !prevServer ||
      draft.mark !== prevServer.mark ||
      draft.internalComment !== prevServer.internalComment;
    if (!wasModified) continue;

    if (freshIds.has(studentId)) {
      preservedDraftByStudentId[studentId] = { ...draft };
    } else {
      droppedStudentIds.push(studentId);
    }
  }

  const addedUnmarkedStudentNames = freshRegister.entries
    .filter((entry) => !previousIds.has(entry.studentId) && entry.mark === null)
    .map((entry) => entry.fullName);

  return {
    preservedDraftByStudentId,
    droppedStudentIds,
    addedUnmarkedStudentNames,
  };
}
