import { supabase, isSupabaseConfigured } from '../supabase.ts';
import { isValidIsoDate } from './dateUtils.ts';
import {
  classifyAttendanceError,
  MAX_ATTENDANCE_PATCH_ITEMS,
  MAX_ATTENDANCE_TEXT_LENGTH,
} from './logic.ts';
import {
  isValidUuid,
  isNonEmptyString,
  parseAttendanceRegisterResponse,
  parseAttendanceSaveReceipt,
  parseStudentAttendanceList,
  parseAttendanceAuditList,
} from './attendanceParsers.ts';
import type {
  AttendanceAuditEvent,
  AttendanceRegisterData,
  AttendanceSaveEntryPatch,
  AttendanceSaveReceipt,
  BackendOpResult,
  Language,
  StudentAttendanceRecord,
  StudentSelfRecord,
} from '../../types.ts';

export async function fetchAttendanceRegister(params: {
  classId: string;
  schoolDate: string;
  teacherUserId?: string | null;
  language?: Language;
}): Promise<BackendOpResult<AttendanceRegisterData>> {
  const lang = params.language ?? 'en';
  if (!isValidUuid(params.classId) || !isValidIsoDate(params.schoolDate)) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'invalid_attendance_input',
      errorMessage: 'Class and valid school date are required.',
    };
  }
  if (params.teacherUserId && !isValidUuid(params.teacherUserId)) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'invalid_attendance_input',
      errorMessage: 'Responsible teacher reference is invalid.',
    };
  }
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      status: 'BLOCKED_BACKEND',
      errorCode: 'backend_unavailable',
      errorMessage: 'Attendance backend service is unavailable.',
    };
  }

  try {
    const args: {
      p_class_id: string;
      p_school_date: string;
      p_teacher_user_id?: string;
    } = {
      p_class_id: params.classId,
      p_school_date: params.schoolDate,
    };
    if (params.teacherUserId) {
      args.p_teacher_user_id = params.teacherUserId;
    }

    const { data, error } = await supabase.rpc('get_attendance_register', args);
    if (error) {
      return { ok: false, ...classifyAttendanceError(error, lang) };
    }
    return parseAttendanceRegisterResponse(data, {
      classId: params.classId,
      schoolDate: params.schoolDate,
      teacherUserId: params.teacherUserId,
    });
  } catch (err) {
    return { ok: false, ...classifyAttendanceError(err, lang) };
  }
}

export async function saveAttendanceRegister(params: {
  classId: string;
  schoolDate: string;
  expectedVersion: number;
  rosterFingerprint: string;
  requestId: string;
  entries: AttendanceSaveEntryPatch[];
  submit: boolean;
  reason?: string | null;
  teacherUserId?: string | null;
  language?: Language;
}): Promise<BackendOpResult<AttendanceSaveReceipt>> {
  const lang = params.language ?? 'en';
  if (
    !isValidUuid(params.classId) ||
    !isValidIsoDate(params.schoolDate) ||
    typeof params.expectedVersion !== 'number' ||
    !Number.isInteger(params.expectedVersion) ||
    params.expectedVersion < 0 ||
    !isNonEmptyString(params.rosterFingerprint) ||
    !isValidUuid(params.requestId) ||
    !Array.isArray(params.entries)
  ) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'invalid_attendance_input',
      errorMessage: 'Invalid attendance save parameters.',
    };
  }

  if (params.entries.length > MAX_ATTENDANCE_PATCH_ITEMS) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'batch_size_exceeded',
      errorMessage: `Cannot patch more than ${MAX_ATTENDANCE_PATCH_ITEMS} student entries at once.`,
    };
  }

  for (const entry of params.entries) {
    if (!isValidUuid(entry.studentId)) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'invalid_attendance_input',
        errorMessage: 'Invalid student identifier in patch entry.',
      };
    }
    if (
      entry.mark !== null &&
      entry.mark !== 'PRESENT' &&
      entry.mark !== 'ABSENT' &&
      entry.mark !== 'LATE' &&
      entry.mark !== 'EXCUSED'
    ) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'invalid_attendance_input',
        errorMessage: 'Invalid attendance mark in patch entry.',
      };
    }
    if (entry.internalComment && entry.internalComment.length > MAX_ATTENDANCE_TEXT_LENGTH) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'comment_too_long',
        errorMessage: `Internal comment exceeds maximum length of ${MAX_ATTENDANCE_TEXT_LENGTH} characters.`,
      };
    }
  }

  if (params.reason && params.reason.length > MAX_ATTENDANCE_TEXT_LENGTH) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'reason_too_long',
      errorMessage: `Submission reason exceeds maximum length of ${MAX_ATTENDANCE_TEXT_LENGTH} characters.`,
    };
  }

  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      status: 'BLOCKED_BACKEND',
      errorCode: 'backend_unavailable',
      errorMessage: 'Attendance backend service is unavailable.',
    };
  }

  try {
    const { data, error } = await supabase.rpc('save_attendance_register', {
      p_class_id: params.classId,
      p_school_date: params.schoolDate,
      p_expected_version: params.expectedVersion,
      p_roster_fingerprint: params.rosterFingerprint.trim(),
      p_request_id: params.requestId,
      p_entries: params.entries as any,
      p_submit: Boolean(params.submit),
      p_reason: params.reason ? params.reason.trim() : undefined,
      p_teacher_user_id: params.teacherUserId || undefined,
    });

    if (error) {
      return { ok: false, ...classifyAttendanceError(error, lang) };
    }

    return parseAttendanceSaveReceipt(data, params.requestId);
  } catch (err) {
    return { ok: false, ...classifyAttendanceError(err, lang) };
  }
}

export async function fetchStudentAttendanceHistory(params: {
  studentId: string;
  startDate?: string;
  endDate?: string;
  language?: Language;
}): Promise<BackendOpResult<StudentAttendanceRecord[]>> {
  const lang = params.language ?? 'en';
  if (!isValidUuid(params.studentId)) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'invalid_attendance_input',
      errorMessage: 'Valid student reference is required.',
    };
  }
  if (params.startDate && !isValidIsoDate(params.startDate)) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'invalid_date_range',
      errorMessage: 'Start date format is invalid.',
    };
  }
  if (params.endDate && !isValidIsoDate(params.endDate)) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'invalid_date_range',
      errorMessage: 'End date format is invalid.',
    };
  }

  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      status: 'BLOCKED_BACKEND',
      errorCode: 'backend_unavailable',
      errorMessage: 'Attendance backend service is unavailable.',
    };
  }

  try {
    const { data, error } = await supabase.rpc('list_student_attendance', {
      p_student_id: params.studentId,
      p_from_date: params.startDate || '1970-01-01',
      p_to_date: params.endDate || '2999-12-31',
    });

    if (error) {
      return { ok: false, ...classifyAttendanceError(error, lang) };
    }

    return parseStudentAttendanceList(data);
  } catch (err) {
    return { ok: false, ...classifyAttendanceError(err, lang) };
  }
}

export async function fetchAttendanceAudit(params: {
  registerId: string;
  language?: Language;
}): Promise<BackendOpResult<AttendanceAuditEvent[]>> {
  const lang = params.language ?? 'en';
  if (!isValidUuid(params.registerId)) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'invalid_attendance_input',
      errorMessage: 'Valid register reference is required.',
    };
  }

  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      status: 'BLOCKED_BACKEND',
      errorCode: 'backend_unavailable',
      errorMessage: 'Attendance backend service is unavailable.',
    };
  }

  try {
    const { data, error } = await supabase.rpc('list_attendance_audit', {
      p_register_id: params.registerId,
    });

    if (error) {
      return { ok: false, ...classifyAttendanceError(error, lang) };
    }

    return parseAttendanceAuditList(data, params.registerId);
  } catch (err) {
    return { ok: false, ...classifyAttendanceError(err, lang) };
  }
}

export async function resolveStudentSelfRecord(params: {
  userId: string;
  language?: Language;
}): Promise<BackendOpResult<StudentSelfRecord | null>> {
  const lang = params.language ?? 'en';
  if (!isValidUuid(params.userId)) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'invalid_attendance_input',
      errorMessage: 'Valid user reference is required.',
    };
  }

  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      status: 'BLOCKED_BACKEND',
      errorCode: 'backend_unavailable',
      errorMessage: 'Attendance backend service is unavailable.',
    };
  }

  try {
    const { data, error } = await supabase
      .from('students')
      .select('id, student_code, full_name')
      .eq('linked_profile_id', params.userId)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (error) {
      return { ok: false, ...classifyAttendanceError(error, lang) };
    }

    if (!data) {
      return { ok: true, status: 'READY', data: null };
    }

    if (!isValidUuid(data.id) || !isNonEmptyString(data.full_name)) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'malformed_rpc_payload',
        errorMessage: 'Student self record payload is malformed.',
      };
    }

    return {
      ok: true,
      status: 'READY',
      data: {
        id: data.id,
        studentCode: typeof data.student_code === 'string' ? data.student_code : '',
        fullName: data.full_name,
      },
    };
  } catch (err) {
    return { ok: false, ...classifyAttendanceError(err, lang) };
  }
}
