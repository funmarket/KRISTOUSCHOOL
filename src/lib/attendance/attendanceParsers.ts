import { isValidIsoDate } from './dateUtils.ts';
import type {
  AttendanceAuditEvent,
  AttendanceMark,
  AttendanceRegisterData,
  AttendanceRegisterEntry,
  AttendanceRegisterStatus,
  AttendanceSaveReceipt,
  BackendOpResult,
  StudentAttendanceRecord,
} from '../../types.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_MARKS = new Set<AttendanceMark>(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']);

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function parseOptionalMark(value: unknown): { ok: true; value: AttendanceMark | null } | { ok: false } {
  if (value === null) return { ok: true, value: null };
  if (typeof value === 'string' && VALID_MARKS.has(value as AttendanceMark)) {
    return { ok: true, value: value as AttendanceMark };
  }
  return { ok: false };
}

export function parseRegisterEntry(raw: unknown): AttendanceRegisterEntry | null {
  if (!isPlainObject(raw)) return null;
  if (!isValidUuid(raw.studentId)) return null;
  if (raw.membershipId !== null && !isValidUuid(raw.membershipId)) return null;
  if (!isNonEmptyString(raw.fullName)) return null;
  if (typeof raw.studentCode !== 'string') return null;

  const markRes = parseOptionalMark(raw.mark);
  if (!markRes.ok) return null;

  if (raw.internalComment !== null && typeof raw.internalComment !== 'string') {
    return null;
  }

  return {
    studentId: raw.studentId,
    membershipId: raw.membershipId,
    fullName: raw.fullName,
    studentCode: raw.studentCode,
    mark: markRes.value,
    internalComment: raw.internalComment ?? '',
  };
}

/**
 * Strictly validates the JSON object returned by `get_attendance_register`.
 */
export function parseAttendanceRegisterResponse(
  data: unknown,
  expected: {
    classId: string;
    schoolDate: string;
    teacherUserId?: string | null;
  },
): BackendOpResult<AttendanceRegisterData> {
  if (!isPlainObject(data)) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'invalid_rpc_payload',
      errorMessage: 'Attendance register response format is invalid.',
    };
  }

  if (
    (data.registerId !== null && !isValidUuid(data.registerId)) ||
    !isValidUuid(data.academicYearId) ||
    !isValidUuid(data.classId) ||
    !isValidUuid(data.teacherUserId) ||
    !isValidIsoDate(data.schoolDate) ||
    typeof data.version !== 'number' ||
    !Number.isInteger(data.version) ||
    data.version < 0 ||
    (data.status !== 'DRAFT' && data.status !== 'SUBMITTED') ||
    !isNonEmptyString(data.rosterFingerprint) ||
    (data.submittedAt !== null && typeof data.submittedAt !== 'string') ||
    !Array.isArray(data.entries)
  ) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'malformed_rpc_payload',
      errorMessage: 'Attendance register metadata is malformed.',
    };
  }

  if (data.classId !== expected.classId || data.schoolDate !== expected.schoolDate) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'mismatched_register_scope',
      errorMessage: 'Register metadata does not match requested class/date scope.',
    };
  }

  if (
    expected.teacherUserId &&
    expected.teacherUserId.trim().length > 0 &&
    data.teacherUserId !== expected.teacherUserId
  ) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'mismatched_teacher_scope',
      errorMessage: 'Register teacher scope does not match expected teacher.',
    };
  }

  const entries: AttendanceRegisterEntry[] = [];
  const seenStudentIds = new Set<string>();
  for (const rawEntry of data.entries) {
    const parsed = parseRegisterEntry(rawEntry);
    if (!parsed) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'malformed_register_entries',
        errorMessage: 'Attendance register contains malformed student entry rows.',
      };
    }
    if (seenStudentIds.has(parsed.studentId)) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'duplicate_register_entry',
        errorMessage: 'Attendance register contains duplicate student entries.',
      };
    }
    seenStudentIds.add(parsed.studentId);
    entries.push(parsed);
  }

  return {
    ok: true,
    status: 'READY',
    data: {
      registerId: data.registerId,
      academicYearId: data.academicYearId,
      classId: data.classId,
      teacherUserId: data.teacherUserId,
      schoolDate: data.schoolDate,
      status: data.status as AttendanceRegisterStatus,
      version: data.version,
      rosterFingerprint: data.rosterFingerprint,
      submittedAt: data.submittedAt,
      entries,
    },
  };
}

/**
 * Strictly validates save receipt data returned by `save_attendance_register`.
 */
export function parseAttendanceSaveReceipt(
  data: unknown,
  expectedRequestId?: string,
): BackendOpResult<AttendanceSaveReceipt> {
  if (!isPlainObject(data)) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'invalid_rpc_payload',
      errorMessage: 'Attendance save receipt format is invalid.',
    };
  }

  if (!isValidUuid(data.registerId) || !isValidUuid(data.requestId)) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'malformed_rpc_payload',
      errorMessage: 'Attendance save receipt identifiers are invalid.',
    };
  }

  if (typeof data.version !== 'number' || !Number.isInteger(data.version) || data.version < 1) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'malformed_rpc_payload',
      errorMessage: 'Attendance save receipt version is invalid.',
    };
  }

  if (data.status !== 'DRAFT' && data.status !== 'SUBMITTED') {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'malformed_rpc_payload',
      errorMessage: 'Attendance save receipt status is invalid.',
    };
  }

  if (expectedRequestId && data.requestId !== expectedRequestId) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'mismatched_request_receipt',
      errorMessage: 'Returned save receipt does not match the submitted request ID.',
    };
  }

  return {
    ok: true,
    status: 'READY',
    data: {
      registerId: data.registerId,
      version: data.version,
      status: data.status as AttendanceRegisterStatus,
      requestId: data.requestId,
    },
  };
}

/**
 * Strictly validates rows returned by `list_student_attendance`.
 */
export function parseStudentAttendanceList(data: unknown): BackendOpResult<StudentAttendanceRecord[]> {
  if (!Array.isArray(data)) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'invalid_rpc_payload',
      errorMessage: 'Student attendance history format is invalid.',
    };
  }

  const parsed: StudentAttendanceRecord[] = [];
  for (const raw of data) {
    if (!isPlainObject(raw)) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'malformed_rpc_payload',
        errorMessage: 'Student attendance history entry is malformed.',
      };
    }
    if (
      !isValidUuid(raw.register_id) ||
      !isValidUuid(raw.class_id) ||
      !isValidUuid(raw.teacher_user_id) ||
      !isValidIsoDate(raw.school_date) ||
      typeof raw.mark !== 'string' ||
      !VALID_MARKS.has(raw.mark as AttendanceMark)
    ) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'malformed_rpc_payload',
        errorMessage: 'Student attendance history record contains invalid fields.',
      };
    }

    parsed.push({
      registerId: raw.register_id,
      classId: raw.class_id,
      teacherUserId: raw.teacher_user_id,
      schoolDate: raw.school_date,
      mark: raw.mark as AttendanceMark,
    });
  }

  return { ok: true, status: 'READY', data: parsed };
}

/**
 * Strictly validates rows returned by `list_attendance_audit`.
 */
export function parseAttendanceAuditList(
  data: unknown,
  expectedRegisterId?: string,
): BackendOpResult<AttendanceAuditEvent[]> {
  if (!Array.isArray(data)) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'invalid_rpc_payload',
      errorMessage: 'Attendance audit history format is invalid.',
    };
  }

  const parsed: AttendanceAuditEvent[] = [];
  for (const raw of data) {
    if (!isPlainObject(raw)) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'malformed_rpc_payload',
        errorMessage: 'Attendance audit row is malformed.',
      };
    }
    if (
      typeof raw.id !== 'number' ||
      !Number.isInteger(raw.id) ||
      !isValidUuid(raw.register_id) ||
      typeof raw.register_version !== 'number' ||
      !Number.isInteger(raw.register_version) ||
      !isValidUuid(raw.responsible_teacher_user_id) ||
      !isValidUuid(raw.actor_user_id) ||
      !isNonEmptyString(raw.event_type) ||
      !isNonEmptyString(raw.recorded_at)
    ) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'malformed_rpc_payload',
        errorMessage: 'Attendance audit record contains invalid fields.',
      };
    }

    if (raw.reason !== null && typeof raw.reason !== 'string') {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'malformed_rpc_payload',
        errorMessage: 'Attendance audit reason is malformed.',
      };
    }

    if (expectedRegisterId && raw.register_id !== expectedRegisterId) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'mismatched_register_scope',
        errorMessage: 'Audit event does not belong to the requested register.',
      };
    }

    parsed.push({
      id: raw.id,
      registerId: raw.register_id,
      registerVersion: raw.register_version,
      responsibleTeacherUserId: raw.responsible_teacher_user_id,
      actorUserId: raw.actor_user_id,
      eventType: raw.event_type,
      reason: raw.reason,
      beforeState: raw.before_state ?? null,
      afterState: raw.after_state ?? null,
      recordedAt: raw.recorded_at,
    });
  }

  return { ok: true, status: 'READY', data: parsed };
}
