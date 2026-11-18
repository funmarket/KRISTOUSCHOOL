import { isTeacherCorrectionWindowOpen, isValidIsoDate } from './dateUtils.ts';
import type {
  AttendanceEntryDraft,
  AttendanceMark,
  AttendanceRegisterData,
  AttendanceRegisterEntry,
  AttendanceSaveEntryPatch,
  AttendanceSaveIntent,
  BackendOpStatus,
  Language,
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
      // MANAGER, SCHOOL_STAFF, and CLASSES_MANAGE do not grant Attendance authority.
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

/**
 * Sets ONLY currently Not Recorded (mark === null) eligible pupils to PRESENT,
 * preserving every existing manual PRESENT / ABSENT / LATE / EXCUSED mark.
 */
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
      // Explicit empty string clears existing server comment; omitted preserves existing.
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
  const archivedBlocked =
    classIsArchived && (!isOffice || isNewRegister);

  const counts = countAttendanceMarks(register.entries, draftByStudentId);
  const isRosterEmpty = register.entries.length === 0;
  const hasUnmarkedEligiblePupils = counts.notRecorded > 0;
  const isDirty = hasDirtyAttendanceDraft(register.entries, draftByStudentId, reasonText);

  const canEditFields = !isTeacherCutoffClosed && !archivedBlocked;
  const requiresCorrectionReason = isSubmitted;
  const hasValidReason = !requiresCorrectionReason || reasonText.trim().length > 0;
  const validReasonLength = reasonText.trim().length <= MAX_ATTENDANCE_TEXT_LENGTH;

  // Save Draft applies only to unsubmitted DRAFT registers (v0 or DRAFT).
  const canSaveDraft =
    canEditFields &&
    !isSubmitted &&
    (isNewRegister ? isDirty : isDirty);

  // Submit applies to DRAFT (must have >=1 pupil and all marked) OR SUBMITTED correction (requires reason + edits).
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

/**
 * Single-flight idempotency intent resolver:
 * - Preserves the exact requestId UUID and payload when retrying an identical failed/uncertain intent.
 * - Issues a fresh requestId UUID ONLY when the mutation payload, version, fingerprint, or intent changes.
 */
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

/**
 * Reconciles unsaved user draft edits onto a newly fetched server register after
 * a version_conflict or roster_conflict without overwriting server state blindly.
 */
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

export function extractSupabaseErrorParts(error: unknown): {
  code: string;
  message: string;
} {
  if (!error || typeof error !== 'object') {
    return {
      code: '',
      message: typeof error === 'string' ? error.trim() : '',
    };
  }
  const rec = error as Record<string, unknown>;
  const code = typeof rec.code === 'string' ? rec.code.trim() : '';
  const message = typeof rec.message === 'string' ? rec.message.trim() : '';
  return { code, message };
}

function localizedPick(ar: string, fr: string, en: string, language: Language): string {
  return language === 'ar' ? ar : language === 'fr' ? fr : en;
}

const KNOWN_ATTENDANCE_BUSINESS_CODES = [
  'actor_unauthenticated',
  'actor_not_approved',
  'insufficient_authority',
  'teacher_assignment_required',
  'version_conflict',
  'roster_conflict',
  'idempotency_conflict',
  'attendance_incomplete',
  'empty_attendance_roster',
  'correction_reason_required',
  'attendance_correction_window_closed',
  'attendance_class_archived',
  'invalid_attendance_date',
  'invalid_attendance_context',
  'invalid_attendance_input',
  'invalid_attendance_entry',
  'invalid_student_id',
  'duplicate_student',
  'student_not_in_register_roster',
  'submitted_mark_required',
  'attendance_requires_read_committed',
] as const;

export type KnownAttendanceErrorCode = (typeof KNOWN_ATTENDANCE_BUSINESS_CODES)[number];

export function matchKnownAttendanceErrorCode(message: string): KnownAttendanceErrorCode | null {
  for (const token of KNOWN_ATTENDANCE_BUSINESS_CODES) {
    if (message === token || message.includes(token)) {
      return token;
    }
  }
  return null;
}

export function classifyAttendanceError(
  error: unknown,
  language: Language = 'en',
): {
  status: BackendOpStatus;
  errorCode: string;
  errorMessage: string;
} {
  const { code, message } = extractSupabaseErrorParts(error);

  if (
    code === 'PGRST202' ||
    code === 'PGRST205' ||
    code === '42883' ||
    code === '42P01' ||
    message.includes('Could not find the function') ||
    message.includes('Could not find the table') ||
    message.includes('schema cache')
  ) {
    return {
      status: 'BLOCKED_BACKEND',
      errorCode: 'backend_unavailable',
      errorMessage: localizedPick(
        'خدمة الحضور والغياب غير متوفرة حالياً على الخادم.',
        'Le service de présence n’est pas encore disponible sur le serveur.',
        'The attendance service is currently unavailable on the server.',
        language,
      ),
    };
  }

  const businessCode = matchKnownAttendanceErrorCode(message);

  if (
    code === '42501' ||
    code === 'PGRST301' ||
    message.includes('row-level security') ||
    businessCode === 'actor_unauthenticated' ||
    businessCode === 'actor_not_approved' ||
    businessCode === 'insufficient_authority' ||
    businessCode === 'teacher_assignment_required'
  ) {
    let errorMessage = localizedPick(
      'ليست لديك الصلاحية اللازمة للوصول إلى سجل الحضور هذا.',
      'Vous n’êtes pas autorisé à accéder à ce registre de présence.',
      'You are not authorized to access this attendance register.',
      language,
    );
    if (businessCode === 'actor_unauthenticated') {
      errorMessage = localizedPick(
        'انتهت جلستك أو لم تعد صالحة. يرجى تسجيل الدخول من جديد.',
        'Votre session a expiré. Veuillez vous reconnecter.',
        'Your session is no longer valid. Please sign in again.',
        language,
      );
    } else if (businessCode === 'actor_not_approved') {
      errorMessage = localizedPick(
        'حسابك غير معتمد أو تم تعليقه. تم حجب سجل الحضور.',
        'Votre compte n’est plus approuvé. L’accès aux présences est bloqué.',
        'Your account is not currently approved for attendance access.',
        language,
      );
    } else if (businessCode === 'teacher_assignment_required') {
      errorMessage = localizedPick(
        'لم تعد مكلفاً بتدريس هذا القسم. تم حجب التعديل والقراءة.',
        'Vous n’êtes plus affecté à cette classe. Accès refusé.',
        'You do not have an active assignment for this class.',
        language,
      );
    }
    return {
      status: 'UNAUTHORIZED',
      errorCode: businessCode ?? (code || 'insufficient_authority'),
      errorMessage,
    };
  }

  if (businessCode) {
    const messages: Record<Exclude<KnownAttendanceErrorCode, 'actor_unauthenticated' | 'actor_not_approved' | 'insufficient_authority' | 'teacher_assignment_required'>, string> = {
      version_conflict: localizedPick(
        'تم تحديث هذا السجل منذ آخر قراءة. تم الاحتفاظ بتعديلاتك المحلية للمراجعة — أعد التحقق قبل الحفظ.',
        'Ce registre a été modifié depuis votre dernier chargement. Vos modifications sont conservées — vérifiez avant d’enregistrer.',
        'This register was updated elsewhere since it loaded. Your local changes are preserved for review before saving.',
        language,
      ),
      roster_conflict: localizedPick(
        'تغيّرت قائمة التلاميذ في القسم على الخادم. يرجى مراجعة القائمة المحدّثة وتأكيد التعديلات.',
        'La liste des élèves de la classe a changé sur le serveur. Veuillez réconcilier la liste actualisée.',
        'The eligible class roster changed on the server. Review the refreshed roster and confirm before saving.',
        language,
      ),
      idempotency_conflict: localizedPick(
        'تم استخدام معرّف الطلب نفسه لمحتوى مختلف. يرجى إعادة التحميل والمحاولة كطلب جديد.',
        'Conflit de demande détecté pour un contenu différent. Rechargez le registre puis réessayez.',
        'A conflicting retry payload was detected for the same request ID. Reload the register and submit cleanly.',
        language,
      ),
      attendance_incomplete: localizedPick(
        'لا يمكن اعتماد السجل قبل تسجيل حالة الحضور لجميع التلاميذ المؤهلين.',
        'Impossible de soumettre : chaque élève éligible doit avoir un statut enregistré.',
        'All eligible pupils must have an explicit attendance mark before submitting.',
        language,
      ),
      empty_attendance_roster: localizedPick(
        'لا يمكن إرسال سجل فارغ بدون تلاميذ مسجلين في القسم.',
        'Impossible de soumettre un registre sans élève inscrit.',
        'Cannot submit an attendance register with an empty roster.',
        language,
      ),
      correction_reason_required: localizedPick(
        'يرجى إدخال سبب التعديل لأن هذا السجل معتمد مسبقاً.',
        'Un motif de correction est obligatoire pour modifier un registre déjà soumis.',
        'A correction reason is required when editing an already submitted register.',
        language,
      ),
      attendance_correction_window_closed: localizedPick(
        'انتهت مهلة تعديل المربي لهذا اليوم (بعد منتصف الليل بتوقيت تونس). يمكن لإدارة المدرسة وحدها إجراء التصحيح.',
        'Le délai de correction enseignant (minuit heure de Tunis) est dépassé. Seule l’administration peut corriger ce registre.',
        'The Teacher correction window (midnight Africa/Tunis) has closed. School Office / Owner correction is required.',
        language,
      ),
      attendance_class_archived: localizedPick(
        'هذا القسم مؤرشف ولا يسمح بإنشاء سجلات جديدة أو تعديل المعلم له.',
        'Cette classe est archivée et n’accepte plus de nouveaux registres.',
        'This class is archived; new registers cannot be created for it.',
        language,
      ),
      invalid_attendance_date: localizedPick(
        'تاريخ السجل أو نطاق التواريخ غير صالح.',
        'La date ou la période sélectionnée est invalide.',
        'The selected attendance date or date range is invalid.',
        language,
      ),
      invalid_attendance_context: localizedPick(
        'تعذر التحقق من سياق القسم أو السنة الدراسية لهذا السجل.',
        'Le contexte classe ou année scolaire est invalide pour ce registre.',
        'Invalid school class or academic year context for attendance.',
        language,
      ),
      invalid_attendance_input: localizedPick(
        'المدخلات غير صالحة أو تتجاوز الحد المسموح به.',
        'Les données saisies sont invalides ou dépassent la limite autorisée.',
        'Attendance input is invalid or exceeds allowed limits.',
        language,
      ),
      invalid_attendance_entry: localizedPick(
        'إحدى خانات الحضور المرسلة غير صالحة.',
        'Une des lignes de présence est invalide.',
        'One or more submitted pupil attendance entries are invalid.',
        language,
      ),
      invalid_student_id: localizedPick(
        'معرف التلميذ المحدد غير صالح.',
        'L’identifiant de l’élève est invalide.',
        'Invalid student identifier.',
        language,
      ),
      duplicate_student: localizedPick(
        'تم اكتشاف تكرار لنفس التلميذ في الطلب.',
        'Élève dupliqué détecté dans la requête.',
        'Duplicate student entry detected in the request.',
        language,
      ),
      student_not_in_register_roster: localizedPick(
        'تلميذ واحد على الأقل غير مسجل ضمن قائمة هذا السجل.',
        'Au moins un élève ne figure pas dans la liste éligible de ce registre.',
        'One or more pupils are not part of this register roster.',
        language,
      ),
      submitted_mark_required: localizedPick(
        'لا يمكن إزالة حالة تلميذ في سجل معتمد إلى «غير مسجل».',
        'Impossible de repasser un élève d’un registre soumis à « Non enregistré ».',
        'Submitted pupils cannot be cleared back to Not Recorded.',
        language,
      ),
      attendance_requires_read_committed: localizedPick(
        'تعذر إتمام عملية الحفظ بسبب إعداد عزل قاعدة البيانات على الخادم.',
        'Impossible d’enregistrer en raison d’un paramètre serveur de transaction.',
        'Save could not complete due to a server transaction configuration error.',
        language,
      ),
    };
    return {
      status: 'ERROR',
      errorCode: businessCode,
      errorMessage: messages[businessCode],
    };
  }

  return {
    status: 'ERROR',
    errorCode: code || 'attendance_operation_failed',
    errorMessage:
      message ||
      localizedPick(
        'تعذر إتمام عملية الحضور والغياب.',
        'Impossible de traiter la demande de présence.',
        'Could not complete the attendance operation.',
        language,
      ),
  };
}

export function validateAttendanceDateSelection(dateStr: string): boolean {
  return isValidIsoDate(dateStr);
}
