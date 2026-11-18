import { supabase, isSupabaseConfigured } from '../supabase.ts';
import { listAccountDirectory, type GovernanceAccountRecord } from '../accountGovernance.ts';
import { isValidIsoDate, isWithinAttendanceHistoryRange } from './dateUtils.ts';
import {
  classifyAttendanceError,
  MAX_ATTENDANCE_PATCH_ITEMS,
  MAX_ATTENDANCE_TEXT_LENGTH,
} from './logic.ts';
import type {
  AttendanceAuditEvent,
  AttendanceMark,
  AttendanceRegisterData,
  AttendanceRegisterEntry,
  AttendanceRegisterStatus,
  AttendanceSaveEntryPatch,
  AttendanceSaveReceipt,
  BackendOpResult,
  Language,
  OfficeAttendanceClassOption,
  OfficeAttendanceContext,
  OfficeAttendanceRegisterSummary,
  OfficeAttendanceTeacherOption,
  StudentAttendanceRecord,
  StudentSelfRecord,
} from '../../types.ts';

export interface OfficeAttendanceContextResult extends OfficeAttendanceContext {
  totalSavedRegistersCount: number | null;
  hasMoreSavedRegisters: boolean;
}

export interface OfficeSavedRegistersPage {
  items: OfficeAttendanceRegisterSummary[];
  totalCount: number | null;
  hasMore: boolean;
  offset: number;
  limit: number;
}

export const OFFICE_REGISTER_PAGE_SIZE = 200;
export const OFFICE_CONTEXT_MAX_REGISTERS = 2000;
export const OFFICE_SAVED_REGISTERS_DEFAULT_LIMIT = 12;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_MARKS = new Set<AttendanceMark>(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseOptionalMark(value: unknown): { ok: true; value: AttendanceMark | null } | { ok: false } {
  if (value === null) return { ok: true, value: null };
  if (typeof value === 'string' && VALID_MARKS.has(value as AttendanceMark)) {
    return { ok: true, value: value as AttendanceMark };
  }
  return { ok: false };
}

function parseRegisterEntry(raw: unknown): AttendanceRegisterEntry | null {
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
      errorMessage: 'Attendance register payload format is invalid.',
    };
  }

  if (data.registerId !== null && !isValidUuid(data.registerId)) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'malformed_rpc_payload',
      errorMessage: 'Attendance register identifier is invalid.',
    };
  }

  if (
    !isValidUuid(data.academicYearId) ||
    !isValidUuid(data.classId) ||
    !isValidUuid(data.teacherUserId) ||
    !isValidIsoDate(data.schoolDate)
  ) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'malformed_rpc_payload',
      errorMessage: 'Attendance register context fields are invalid.',
    };
  }

  if (data.status !== 'DRAFT' && data.status !== 'SUBMITTED') {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'malformed_rpc_payload',
      errorMessage: 'Attendance register status is invalid.',
    };
  }

  if (typeof data.version !== 'number' || !Number.isInteger(data.version) || data.version < 0) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'malformed_rpc_payload',
      errorMessage: 'Attendance register version is invalid.',
    };
  }

  if (!isNonEmptyString(data.rosterFingerprint)) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'malformed_rpc_payload',
      errorMessage: 'Attendance roster fingerprint is missing.',
    };
  }

  if (data.submittedAt !== null && typeof data.submittedAt !== 'string') {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'malformed_rpc_payload',
      errorMessage: 'Attendance submitted timestamp is invalid.',
    };
  }

  if (!Array.isArray(data.entries)) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'malformed_rpc_payload',
      errorMessage: 'Attendance entries list is invalid.',
    };
  }

  const entries: AttendanceRegisterEntry[] = [];
  const seenStudents = new Set<string>();
  for (const rawEntry of data.entries) {
    const parsedEntry = parseRegisterEntry(rawEntry);
    if (!parsedEntry || seenStudents.has(parsedEntry.studentId)) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'malformed_rpc_payload',
        errorMessage: 'Attendance register pupil entry is malformed.',
      };
    }
    seenStudents.add(parsedEntry.studentId);
    entries.push(parsedEntry);
  }

  if (data.classId !== expected.classId || data.schoolDate !== expected.schoolDate) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'mismatched_register_scope',
      errorMessage: 'Returned register does not match requested class or date.',
    };
  }

  if (expected.teacherUserId && data.teacherUserId !== expected.teacherUserId) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'mismatched_teacher_scope',
      errorMessage: 'Returned register does not match the requested responsible teacher.',
    };
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
 * Strictly validates the JSON receipt returned by `save_attendance_register`.
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
    !isValidUuid(params.requestId) ||
    !isNonEmptyString(params.rosterFingerprint) ||
    !Number.isInteger(params.expectedVersion) ||
    params.expectedVersion < 0
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
      errorCode: 'invalid_attendance_input',
      errorMessage: `Too many patch entries (max ${MAX_ATTENDANCE_PATCH_ITEMS}).`,
    };
  }
  const normalizedReason = params.reason?.trim() || null;
  if (normalizedReason && normalizedReason.length > MAX_ATTENDANCE_TEXT_LENGTH) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'invalid_attendance_input',
      errorMessage: `Reason exceeds ${MAX_ATTENDANCE_TEXT_LENGTH} characters.`,
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
    const serializedEntries = params.entries.map((entry) =>
      entry.internalComment !== undefined
        ? {
            studentId: entry.studentId,
            mark: entry.mark,
            internalComment: entry.internalComment,
          }
        : {
            studentId: entry.studentId,
            mark: entry.mark,
          },
    );

    const args: {
      p_class_id: string;
      p_school_date: string;
      p_expected_version: number;
      p_roster_fingerprint: string;
      p_request_id: string;
      p_entries: typeof serializedEntries;
      p_submit?: boolean;
      p_reason?: string;
      p_teacher_user_id?: string;
    } = {
      p_class_id: params.classId,
      p_school_date: params.schoolDate,
      p_expected_version: params.expectedVersion,
      p_roster_fingerprint: params.rosterFingerprint,
      p_request_id: params.requestId,
      p_entries: serializedEntries,
      p_submit: params.submit,
    };
    if (normalizedReason) {
      args.p_reason = normalizedReason;
    }
    if (params.teacherUserId) {
      args.p_teacher_user_id = params.teacherUserId;
    }

    const { data, error } = await supabase.rpc('save_attendance_register', args);
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
  fromDate: string;
  toDate: string;
  language?: Language;
}): Promise<BackendOpResult<StudentAttendanceRecord[]>> {
  const lang = params.language ?? 'en';
  if (!isValidUuid(params.studentId) || !isWithinAttendanceHistoryRange(params.fromDate, params.toDate)) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'invalid_attendance_date',
      errorMessage: 'Select a valid date range (maximum 366 days).',
    };
  }
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      status: 'BLOCKED_BACKEND',
      errorCode: 'backend_unavailable',
      errorMessage: 'Attendance history service is unavailable.',
    };
  }

  try {
    const { data, error } = await supabase.rpc('list_student_attendance', {
      p_student_id: params.studentId,
      p_from_date: params.fromDate,
      p_to_date: params.toDate,
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
      errorMessage: 'Valid saved register identifier is required.',
    };
  }
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      status: 'BLOCKED_BACKEND',
      errorCode: 'backend_unavailable',
      errorMessage: 'Attendance audit service is unavailable.',
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

/**
 * Resolves the canonical student record linked to a signed-in STUDENT account
 * via RLS-protected `public.students` (never inventing student IDs).
 */
export async function resolveStudentSelfRecord(
  userId: string,
  language: Language = 'en',
): Promise<BackendOpResult<StudentSelfRecord | null>> {
  if (!isValidUuid(userId)) {
    return {
      ok: false,
      status: 'UNAUTHORIZED',
      errorCode: 'actor_unauthenticated',
      errorMessage: 'Authenticated user identifier is invalid.',
    };
  }
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      status: 'BLOCKED_BACKEND',
      errorCode: 'backend_unavailable',
      errorMessage: 'Student identity service is unavailable.',
    };
  }

  try {
    const { data, error } = await supabase
      .from('students')
      .select('id, student_code, full_name')
      .eq('linked_profile_id', userId)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (error) {
      return { ok: false, ...classifyAttendanceError(error, language) };
    }
    if (!data) {
      return { ok: true, status: 'READY', data: null };
    }
    if (!isValidUuid(data.id) || !isNonEmptyString(data.full_name)) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'malformed_student_record',
        errorMessage: 'Linked student profile record is malformed.',
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
    return { ok: false, ...classifyAttendanceError(err, language) };
  }
}

async function fetchAllGovernanceAccounts(): Promise<GovernanceAccountRecord[]> {
  const first = await listAccountDirectory({ limit: 100, offset: 0 });
  if (!first.ok || !first.data) {
    return [];
  }
  const items = [...first.data.items];
  const total = first.data.totalCount;
  let offset = items.length;
  // Bounded governance directory scan (stops cleanly at totalCount).
  while (offset < total && offset < OFFICE_CONTEXT_MAX_REGISTERS) {
    const page = await listAccountDirectory({ limit: 100, offset });
    if (!page.ok || !page.data || page.data.items.length === 0) break;
    items.push(...page.data.items);
    offset += page.data.items.length;
  }
  return items;
}

function parseOfficeRegisterSummaryRows(rawRows: unknown): OfficeAttendanceRegisterSummary[] {
  const parsed: OfficeAttendanceRegisterSummary[] = [];
  for (const row of Array.isArray(rawRows) ? rawRows : []) {
    if (
      !row ||
      !isPlainObject(row) ||
      !isValidUuid(row.id) ||
      !isValidUuid(row.class_id) ||
      !isValidUuid(row.teacher_user_id) ||
      !isValidIsoDate(row.school_date)
    ) {
      continue;
    }
    parsed.push({
      registerId: row.id,
      classId: row.class_id,
      teacherUserId: row.teacher_user_id,
      schoolDate: row.school_date,
      status: row.status === 'SUBMITTED' ? 'SUBMITTED' : 'DRAFT',
      version: typeof row.version === 'number' ? row.version : 1,
      submittedAt: typeof row.submitted_at === 'string' ? row.submitted_at : null,
    });
  }
  return parsed;
}

/**
 * Server-side filtered, deterministically paginated query over `public.attendance_registers`
 * so Office / Owner users can browse all historical registers (including >200 records
 * and revoked/historical teachers) without client-side truncation.
 */
export async function fetchOfficeSavedRegisters(params: {
  classId?: string | null;
  teacherUserId?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  limit?: number;
  offset?: number;
  language?: Language;
}): Promise<BackendOpResult<OfficeSavedRegistersPage>> {
  const lang = params.language ?? 'en';
  const classId = params.classId?.trim() || null;
  const teacherUserId = params.teacherUserId?.trim() || null;
  const fromDate = params.fromDate?.trim() || null;
  const toDate = params.toDate?.trim() || null;

  if (classId && !isValidUuid(classId)) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'invalid_attendance_input',
      errorMessage: 'Class filter reference is invalid.',
    };
  }
  if (teacherUserId && !isValidUuid(teacherUserId)) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'invalid_attendance_input',
      errorMessage: 'Teacher filter reference is invalid.',
    };
  }
  if ((fromDate && !isValidIsoDate(fromDate)) || (toDate && !isValidIsoDate(toDate))) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'invalid_attendance_date',
      errorMessage: 'Historical register date filter is invalid.',
    };
  }
  if (fromDate && toDate && fromDate > toDate) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'invalid_attendance_date',
      errorMessage: 'Start date cannot be after end date.',
    };
  }

  const limit = Math.min(
    Math.max(1, Math.trunc(params.limit ?? OFFICE_SAVED_REGISTERS_DEFAULT_LIMIT)),
    OFFICE_REGISTER_PAGE_SIZE,
  );
  const offset = Math.max(0, Math.trunc(params.offset ?? 0));

  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      status: 'BLOCKED_BACKEND',
      errorCode: 'backend_unavailable',
      errorMessage: 'Office historical attendance service is unavailable.',
    };
  }

  try {
    let query = supabase
      .from('attendance_registers')
      .select('id, class_id, teacher_user_id, school_date, status, version, submitted_at', {
        count: 'exact',
      });

    if (classId) {
      query = query.eq('class_id', classId);
    }
    if (teacherUserId) {
      query = query.eq('teacher_user_id', teacherUserId);
    }
    if (fromDate) {
      query = query.gte('school_date', fromDate);
    }
    if (toDate) {
      query = query.lte('school_date', toDate);
    }

    const { data, error, count } = await query
      .order('school_date', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit);

    if (error) {
      return { ok: false, ...classifyAttendanceError(error, lang) };
    }

    const parsed = parseOfficeRegisterSummaryRows(data);
    const hasExtraRow = parsed.length > limit;
    const items = hasExtraRow ? parsed.slice(0, limit) : parsed;
    const totalCount = typeof count === 'number' && Number.isFinite(count) ? count : null;
    const hasMore =
      hasExtraRow || (totalCount !== null && offset + items.length < totalCount);

    return {
      ok: true,
      status: 'READY',
      data: {
        items,
        totalCount,
        hasMore,
        offset,
        limit,
      },
    };
  } catch (err) {
    return { ok: false, ...classifyAttendanceError(err, lang) };
  }
}

/**
 * Loads Owner/Office oversight metadata from existing authorized tables and directory RPC:
 * - Active & archived `school_classes` (with academic year & level)
 * - Active & historical `teacher_class_assignments`
 * - Existing saved `attendance_registers` metadata via bounded pagination (no 200-row silent truncation)
 * - Account names & lifecycle statuses from `governance_list_account_directory`
 */
export async function fetchOfficeAttendanceContext(
  language: Language = 'en',
  options?: {
    pageSize?: number;
    maxRegisters?: number;
  },
): Promise<BackendOpResult<OfficeAttendanceContextResult>> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      status: 'BLOCKED_BACKEND',
      errorCode: 'backend_unavailable',
      errorMessage: 'Office attendance metadata service is unavailable.',
    };
  }

  const sb = supabase;
  const pageSize = Math.min(
    Math.max(1, Math.trunc(options?.pageSize ?? OFFICE_REGISTER_PAGE_SIZE)),
    OFFICE_REGISTER_PAGE_SIZE,
  );
  const maxRegisters = Math.max(
    pageSize,
    Math.trunc(options?.maxRegisters ?? OFFICE_CONTEXT_MAX_REGISTERS),
  );

  try {
    const fetchPaginatedSavedRegisters = async (): Promise<{
      error: unknown | null;
      registers: OfficeAttendanceRegisterSummary[];
      totalCount: number | null;
      hasMore: boolean;
    }> => {
      const collected: OfficeAttendanceRegisterSummary[] = [];
      const seenIds = new Set<string>();
      let offset = 0;
      let totalCount: number | null = null;
      let hasMore = false;

      while (collected.length < maxRegisters) {
        const remaining = maxRegisters - collected.length;
        const batchSize = Math.min(pageSize, remaining);
        const { data, error, count } = await sb
          .from('attendance_registers')
          .select('id, class_id, teacher_user_id, school_date, status, version, submitted_at', {
            count: 'exact',
          })
          .order('school_date', { ascending: false })
          .order('id', { ascending: false })
          .range(offset, offset + batchSize - 1);

        if (error) {
          return { error, registers: [], totalCount: null, hasMore: false };
        }
        if (typeof count === 'number' && Number.isFinite(count)) {
          totalCount = count;
        }

        const rawList = Array.isArray(data) ? data : [];
        const parsedBatch = parseOfficeRegisterSummaryRows(rawList);
        for (const item of parsedBatch) {
          if (!seenIds.has(item.registerId)) {
            seenIds.add(item.registerId);
            collected.push(item);
          }
        }

        if (rawList.length < batchSize) {
          hasMore = false;
          break;
        }

        offset += rawList.length;

        if (totalCount !== null && offset >= totalCount) {
          hasMore = false;
          break;
        }

        if (collected.length >= maxRegisters) {
          if (totalCount !== null) {
            hasMore = collected.length < totalCount;
          } else {
            // Probe 1 row beyond the cap so truncation is never silent even when exact count is omitted.
            const { data: probeData, error: probeError } = await sb
              .from('attendance_registers')
              .select('id')
              .order('school_date', { ascending: false })
              .order('id', { ascending: false })
              .range(offset, offset);
            if (!probeError && Array.isArray(probeData) && probeData.length > 0) {
              hasMore = true;
            }
          }
          break;
        }
      }

      return {
        error: null,
        registers: collected,
        totalCount,
        hasMore,
      };
    };

    const [classesRes, assignmentsRes, registersPaged, accounts] = await Promise.all([
      sb
        .from('school_classes')
        .select('id, name, level_code, is_archived, academic_years(code), school_levels(label_ar, label_fr, label_en)')
        .order('is_archived', { ascending: true })
        .order('name', { ascending: true }),
      sb
        .from('teacher_class_assignments')
        .select('class_id, teacher_user_id, is_homeroom, active'),
      fetchPaginatedSavedRegisters(),
      fetchAllGovernanceAccounts(),
    ]);

    if (classesRes.error) {
      return { ok: false, ...classifyAttendanceError(classesRes.error, language) };
    }
    if (assignmentsRes.error) {
      return { ok: false, ...classifyAttendanceError(assignmentsRes.error, language) };
    }
    if (registersPaged.error) {
      return { ok: false, ...classifyAttendanceError(registersPaged.error, language) };
    }

    const accountById = new Map<string, GovernanceAccountRecord>();
    for (const acc of accounts) {
      accountById.set(acc.id, acc);
    }

    const classes: OfficeAttendanceClassOption[] = [];
    for (const row of Array.isArray(classesRes.data) ? classesRes.data : []) {
      if (!row || !isValidUuid(row.id) || !isNonEmptyString(row.name)) continue;
      const yearObj = isPlainObject(row.academic_years) ? row.academic_years : null;
      const levelObj = isPlainObject(row.school_levels) ? row.school_levels : null;
      const levelLabel = levelObj
        ? language === 'ar'
          ? String(levelObj.label_ar ?? row.level_code ?? '')
          : language === 'fr'
          ? String(levelObj.label_fr ?? row.level_code ?? '')
          : String(levelObj.label_en ?? row.level_code ?? '')
        : String(row.level_code ?? '');

      classes.push({
        id: row.id,
        name: row.name,
        levelLabel,
        academicYear: yearObj && typeof yearObj.code === 'string' ? yearObj.code : '',
        isArchived: Boolean(row.is_archived),
      });
    }

    const savedRegisters = registersPaged.registers;

    // Index teachers referenced via assignments, saved registers, or Teacher directory accounts.
    const teacherMap = new Map<string, OfficeAttendanceTeacherOption>();

    const ensureTeacherOption = (userId: string): OfficeAttendanceTeacherOption => {
      const existing = teacherMap.get(userId);
      if (existing) return existing;
      const acc = accountById.get(userId);
      const created: OfficeAttendanceTeacherOption = {
        userId,
        fullName: acc?.fullName || `@${userId.slice(0, 8)}`,
        username: acc?.username || '',
        accountStatus: acc?.accountStatus ?? null,
        hasActiveAssignmentInClass: {},
        hasSavedRegisterInClass: {},
        isHomeroomInClass: {},
      };
      teacherMap.set(userId, created);
      return created;
    };

    for (const acc of accounts) {
      if (acc.activeRoles.includes('TEACHER') || acc.requestedRole === 'TEACHER') {
        ensureTeacherOption(acc.id);
      }
    }

    for (const row of Array.isArray(assignmentsRes.data) ? assignmentsRes.data : []) {
      if (!row || !isValidUuid(row.class_id) || !isValidUuid(row.teacher_user_id)) continue;
      const opt = ensureTeacherOption(row.teacher_user_id);
      if (row.active === true) {
        opt.hasActiveAssignmentInClass[row.class_id] = true;
      }
      if (row.is_homeroom === true && row.active === true) {
        opt.isHomeroomInClass[row.class_id] = true;
      }
    }

    for (const reg of savedRegisters) {
      const opt = ensureTeacherOption(reg.teacherUserId);
      opt.hasSavedRegisterInClass[reg.classId] = true;
    }

    return {
      ok: true,
      status: 'READY',
      data: {
        classes,
        teachers: Array.from(teacherMap.values()),
        savedRegisters,
        totalSavedRegistersCount: registersPaged.totalCount,
        hasMoreSavedRegisters: registersPaged.hasMore,
        accountNamesById: Object.fromEntries(
          accounts.map((a) => [a.id, a.fullName]),
        ),
      },
    };
  } catch (err) {
    return { ok: false, ...classifyAttendanceError(err, language) };
  }
}
