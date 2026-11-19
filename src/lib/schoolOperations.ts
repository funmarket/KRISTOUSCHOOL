import { supabase, classifySupabaseError } from './supabase.ts';
import type {
  BackendOpResult,
  Child,
  ClassItem,
  ClassStudentRosterItem,
  EnrollmentApplication,
  EnrollmentApplicationStatus,
  OperationalCounts,
  PublicInquiryItem,
  SchoolClassSummary,
  SchoolLevelOption,
} from '../types.ts';

export type SchoolClassWithRoster = SchoolClassSummary & {
  roster: ClassStudentRosterItem[];
};

export interface MySchoolContextPayload {
  linkedChildrenIds: string[];
  assignedClassIds: string[];
  children: Child[];
  classes: ClassItem[];
  operationalCounts: OperationalCounts;
}

export interface SubmitEnrollmentInput {
  studentFullName: string;
  birthDate: string;
  desiredLevelCode: string;
  parentFullName: string;
  phone: string;
  email?: string;
  notes?: string;
}

export interface SubmitEnrollmentReceipt {
  id: string;
  referenceCode: string;
  status: EnrollmentApplicationStatus;
  createdAt: string;
}

export interface ReviewEnrollmentInput {
  applicationId: string;
  decision: Exclude<EnrollmentApplicationStatus, 'DRAFT' | 'SUBMITTED'>;
  reviewNote?: string;
  expectedVersion: number;
}

export interface CreateSchoolClassInput {
  academicYearCode: string;
  levelCode: string;
  name: string;
  capacity?: number;
  roomLabel?: string;
}

export interface CreateAndEnrollStudentInput {
  studentCode: string;
  fullName: string;
  birthDate: string;
  classId: string;
  parentUserId?: string | null;
  relationshipLabel?: string;
  linkedProfileId?: string | null;
}

export interface AssignTeacherInput {
  teacherUserId: string;
  classId: string;
  isHomeroom?: boolean;
  active?: boolean;
}

export interface SubmitPublicInquiryInput {
  senderName: string;
  phone?: string;
  email?: string;
  subject: string;
  message: string;
}

export const CANONICAL_SCHOOL_LEVELS: SchoolLevelOption[] = [
  { code: 'CP', labelAr: 'السنة الأولى (CP)', labelFr: '1ère année (CP)', labelEn: 'Year 1 (CP)', sortOrder: 1 },
  { code: 'CE1', labelAr: 'السنة الثانية (CE1)', labelFr: '2ème année (CE1)', labelEn: 'Year 2 (CE1)', sortOrder: 2 },
  { code: 'CE2', labelAr: 'السنة الثالثة (CE2)', labelFr: '3ème année (CE2)', labelEn: 'Year 3 (CE2)', sortOrder: 3 },
  { code: 'CM1', labelAr: 'السنة الرابعة (CM1)', labelFr: '4ème année (CM1)', labelEn: 'Year 4 (CM1)', sortOrder: 4 },
  { code: 'CM2', labelAr: 'السنة الخامسة (CM2)', labelFr: '5ème année (CM2)', labelEn: 'Year 5 (CM2)', sortOrder: 5 },
  { code: '6EME', labelAr: 'السنة السادسة (6ème)', labelFr: '6ème année', labelEn: 'Year 6', sortOrder: 6 },
];

export function validateEnrollmentInput(
  input: SubmitEnrollmentInput,
): { valid: true } | { valid: false; errorCode: string } {
  if (!input.studentFullName || input.studentFullName.trim().length < 2) {
    return { valid: false, errorCode: 'invalid_student_name' };
  }
  if (!input.birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.birthDate.trim())) {
    return { valid: false, errorCode: 'invalid_birth_date' };
  }
  const today = new Date().toISOString().slice(0, 10);
  if (input.birthDate.trim() > today) {
    return { valid: false, errorCode: 'invalid_birth_date' };
  }
  const level = (input.desiredLevelCode || '').trim().toUpperCase();
  if (!CANONICAL_SCHOOL_LEVELS.some((l) => l.code === level)) {
    return { valid: false, errorCode: 'invalid_level' };
  }
  if (!input.parentFullName || input.parentFullName.trim().length < 2) {
    return { valid: false, errorCode: 'invalid_parent_name' };
  }
  if (!input.phone || input.phone.trim().length < 6) {
    return { valid: false, errorCode: 'invalid_phone' };
  }
  return { valid: true };
}

function unavailableResult<T>(): BackendOpResult<T> {
  return {
    ok: false,
    status: 'BLOCKED_BACKEND',
    errorCode: 'backend_unavailable',
    errorMessage: 'This workflow is awaiting verified Supabase backend deployment.',
  };
}

export async function fetchMySchoolContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<MySchoolContextPayload>> {
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('get_my_school_context');
    if (error) {
      return { ok: false, ...classifySupabaseError(error) };
    }
    const payload = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
    return {
      ok: true,
      status: 'READY',
      data: {
        linkedChildrenIds: Array.isArray(payload.linkedChildrenIds)
          ? (payload.linkedChildrenIds as string[])
          : [],
        assignedClassIds: Array.isArray(payload.assignedClassIds)
          ? (payload.assignedClassIds as string[])
          : [],
        children: Array.isArray(payload.children) ? (payload.children as Child[]) : [],
        classes: Array.isArray(payload.classes) ? (payload.classes as ClassItem[]) : [],
        operationalCounts:
          payload.operationalCounts && typeof payload.operationalCounts === 'object'
            ? (payload.operationalCounts as OperationalCounts)
            : {},
      },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function fetchSchoolClassesWithRosters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<SchoolClassWithRoster[]>> {
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('list_school_classes_with_rosters');
    if (error) {
      return { ok: false, ...classifySupabaseError(error) };
    }
    const rows = Array.isArray(data) ? (data as SchoolClassWithRoster[]) : [];
    return {
      ok: true,
      status: 'READY',
      data: rows.map((row) => ({
        ...row,
        roster: Array.isArray(row.roster) ? row.roster : [],
      })),
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function createSchoolClass(
  input: CreateSchoolClassInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<{ id: string; name: string; levelCode: string }>> {
  if (!input.name || input.name.trim().length < 2) {
    return { ok: false, status: 'ERROR', errorCode: 'invalid_class_name', errorMessage: 'Class name is required.' };
  }
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('create_school_class', {
      p_academic_year_code: input.academicYearCode.trim() || '2026-2027',
      p_level_code: input.levelCode.trim().toUpperCase(),
      p_name: input.name.trim(),
      p_capacity: input.capacity ?? 28,
      p_room_label: input.roomLabel?.trim() || null,
    });
    if (error) {
      return { ok: false, ...classifySupabaseError(error) };
    }
    return {
      ok: true,
      status: 'READY',
      data: data as { id: string; name: string; levelCode: string },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function createAndEnrollStudent(
  input: CreateAndEnrollStudentInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<{ studentId: string; studentCode: string; classId: string }>> {
  if (!input.studentCode.trim() || input.fullName.trim().length < 2 || !input.birthDate || !input.classId) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'invalid_student_input',
      errorMessage: 'Student code, full name, birth date, and class are required.',
    };
  }
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('create_and_enroll_student', {
      p_student_code: input.studentCode.trim().toUpperCase(),
      p_full_name: input.fullName.trim(),
      p_birth_date: input.birthDate.trim(),
      p_class_id: input.classId,
      p_parent_user_id: input.parentUserId || null,
      p_relationship_label: input.relationshipLabel?.trim() || 'Parent',
      p_linked_profile_id: input.linkedProfileId || null,
    });
    if (error) {
      return { ok: false, ...classifySupabaseError(error) };
    }
    return {
      ok: true,
      status: 'READY',
      data: data as { studentId: string; studentCode: string; classId: string },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function assignTeacherToClass(
  input: AssignTeacherInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<{ teacherUserId: string; classId: string; active: boolean }>> {
  if (!input.teacherUserId || !input.classId) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'invalid_assignment',
      errorMessage: 'Teacher and class are required.',
    };
  }
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('assign_teacher_to_class', {
      p_teacher_user_id: input.teacherUserId,
      p_class_id: input.classId,
      p_is_homeroom: input.isHomeroom ?? true,
      p_active: input.active ?? true,
    });
    if (error) {
      return { ok: false, ...classifySupabaseError(error) };
    }
    return {
      ok: true,
      status: 'READY',
      data: data as { teacherUserId: string; classId: string; active: boolean },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function submitEnrollmentApplication(
  input: SubmitEnrollmentInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<SubmitEnrollmentReceipt>> {
  const check = validateEnrollmentInput(input);
  if (check.valid === false) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: check.errorCode,
      errorMessage: 'Please complete all required admission fields.',
    };
  }
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('submit_enrollment_application', {
      p_student_full_name: input.studentFullName.trim(),
      p_birth_date: input.birthDate.trim(),
      p_desired_level_code: input.desiredLevelCode.trim().toUpperCase(),
      p_parent_full_name: input.parentFullName.trim(),
      p_phone: input.phone.trim(),
      p_email: input.email?.trim() || null,
      p_notes: input.notes?.trim() || null,
    });
    if (error) {
      return { ok: false, ...classifySupabaseError(error) };
    }
    return {
      ok: true,
      status: 'READY',
      data: data as SubmitEnrollmentReceipt,
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function listEnrollmentApplications(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<EnrollmentApplication[]>> {
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client
      .from('enrollment_applications')
      .select(
        'id, reference_code, student_full_name, birth_date, desired_level_code, parent_full_name, phone, email, notes, submitted_by_user_id, status, review_note, reviewed_at, version, created_at',
      )
      .order('created_at', { ascending: false });
    if (error) {
      return { ok: false, ...classifySupabaseError(error) };
    }
    const mapped: EnrollmentApplication[] = Array.isArray(data)
      ? data.map((row: Record<string, unknown>) => ({
          id: String(row.id),
          referenceCode: String(row.reference_code),
          studentFullName: String(row.student_full_name),
          birthDate: String(row.birth_date),
          desiredLevelCode: String(row.desired_level_code),
          parentFullName: String(row.parent_full_name),
          phone: String(row.phone),
          email: row.email ? String(row.email) : null,
          notes: row.notes ? String(row.notes) : null,
          submittedByUserId: row.submitted_by_user_id ? String(row.submitted_by_user_id) : null,
          status: String(row.status) as EnrollmentApplicationStatus,
          reviewNote: row.review_note ? String(row.review_note) : null,
          reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
          version: Number(row.version ?? 1),
          createdAt: String(row.created_at),
        }))
      : [];
    return { ok: true, status: 'READY', data: mapped };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function reviewEnrollmentApplication(
  input: ReviewEnrollmentInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<
  BackendOpResult<{
    id: string;
    referenceCode: string;
    status: EnrollmentApplicationStatus;
    version: number;
    reviewedAt: string;
  }>
> {
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('review_enrollment_application', {
      p_application_id: input.applicationId,
      p_decision: input.decision,
      p_review_note: input.reviewNote?.trim() || null,
      p_expected_version: input.expectedVersion,
    });
    if (error) {
      return { ok: false, ...classifySupabaseError(error) };
    }
    return {
      ok: true,
      status: 'READY',
      data: data as {
        id: string;
        referenceCode: string;
        status: EnrollmentApplicationStatus;
        version: number;
        reviewedAt: string;
      },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function submitPublicInquiry(
  input: SubmitPublicInquiryInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<{ id: string; status: string; createdAt: string }>> {
  if (
    input.senderName.trim().length < 2 ||
    input.subject.trim().length < 2 ||
    input.message.trim().length < 5
  ) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'invalid_inquiry_input',
      errorMessage: 'Please enter your name, subject, and message (at least 5 characters).',
    };
  }
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('submit_public_inquiry', {
      p_sender_name: input.senderName.trim(),
      p_phone: input.phone?.trim() || null,
      p_email: input.email?.trim() || null,
      p_subject: input.subject.trim(),
      p_message: input.message.trim(),
    });
    if (error) {
      return { ok: false, ...classifySupabaseError(error) };
    }
    return {
      ok: true,
      status: 'READY',
      data: data as { id: string; status: string; createdAt: string },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function listPublicInquiries(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<PublicInquiryItem[]>> {
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client
      .from('public_school_inquiries')
      .select(
        'id, sender_name, phone, email, subject, message, status, staff_response, responded_at, created_at',
      )
      .order('created_at', { ascending: false });
    if (error) {
      return { ok: false, ...classifySupabaseError(error) };
    }
    const mapped: PublicInquiryItem[] = Array.isArray(data)
      ? data.map((row: Record<string, unknown>) => ({
          id: String(row.id),
          senderName: String(row.sender_name),
          phone: row.phone ? String(row.phone) : null,
          email: row.email ? String(row.email) : null,
          subject: String(row.subject),
          message: String(row.message),
          status: (String(row.status) as PublicInquiryItem['status']) || 'NEW',
          staffResponse: row.staff_response ? String(row.staff_response) : null,
          respondedAt: row.responded_at ? String(row.responded_at) : null,
          createdAt: String(row.created_at),
        }))
      : [];
    return { ok: true, status: 'READY', data: mapped };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function respondPublicInquiry(
  inquiryId: string,
  status: 'NEW' | 'IN_PROGRESS' | 'RESOLVED',
  staffResponse: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<{ id: string; status: string; respondedAt: string }>> {
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('respond_public_inquiry', {
      p_inquiry_id: inquiryId,
      p_status: status,
      p_staff_response: staffResponse.trim(),
    });
    if (error) {
      return { ok: false, ...classifySupabaseError(error) };
    }
    return {
      ok: true,
      status: 'READY',
      data: data as { id: string; status: string; respondedAt: string },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export interface AcademicYearItem {
  id: string;
  code: string;
  label?: string;
  name?: string;
  startsOn?: string;
  endsOn?: string;
  isActive?: boolean;
}

export interface SchoolStudentSummary {
  studentId: string;
  studentCode: string;
  fullName: string;
  status: string;
  classes: Array<{
    classId: string;
    className: string;
    levelCode: string;
    academicYearId: string;
    academicYearCode: string;
    membershipId: string;
    enrollmentStatus: string;
  }>;
}

export interface ListSchoolStudentsResponse {
  items: SchoolStudentSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface SchoolStudentIdentityDetail {
  studentId: string;
  studentCode: string;
  fullName: string;
  birthDate: string;
  status: string;
  hasLinkedStudentAccount: boolean;
  memberships: Array<{
    membershipId: string;
    classId: string;
    className: string;
    levelCode: string;
    academicYearId: string;
    academicYearCode: string;
    enrollmentStatus: string;
    startedAt: string;
    endedAt: string | null;
    classArchived: boolean;
  }>;
}

export async function listAcademicYears(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<AcademicYearItem[]>> {
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('list_academic_years');
    if (error) {
      return { ok: false, ...classifySupabaseError(error) };
    }
    const items = Array.isArray(data) ? (data as AcademicYearItem[]) : [];
    return { ok: true, status: 'READY', data: items };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function listSchoolStudents(
  input: {
    p_search?: string | null;
    p_academic_year_id?: string | null;
    p_class_id?: string | null;
    p_status?: 'ACTIVE' | 'ARCHIVED' | 'ALL';
    p_limit?: number;
    p_offset?: number;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<ListSchoolStudentsResponse>> {
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('list_school_students', {
      p_search: input.p_search?.trim() || null,
      p_academic_year_id: input.p_academic_year_id || null,
      p_class_id: input.p_class_id || null,
      p_status: input.p_status || 'ALL',
      p_limit: input.p_limit ?? 25,
      p_offset: input.p_offset ?? 0,
    });
    if (error) {
      return { ok: false, ...classifySupabaseError(error) };
    }
    const resultObj = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
    const items = Array.isArray(resultObj.items) ? (resultObj.items as SchoolStudentSummary[]) : [];
    const total = typeof resultObj.total === 'number' ? resultObj.total : items.length;
    const limit = typeof resultObj.limit === 'number' ? resultObj.limit : (input.p_limit ?? 25);
    const offset = typeof resultObj.offset === 'number' ? resultObj.offset : (input.p_offset ?? 0);

    return {
      ok: true,
      status: 'READY',
      data: { items, total, limit, offset },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function getSchoolStudentIdentity(
  p_student_id: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<SchoolStudentIdentityDetail>> {
  if (!p_student_id) {
    return { ok: false, status: 'ERROR', errorCode: 'invalid_student_id', errorMessage: 'Student ID is required.' };
  }
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('get_school_student_identity', {
      p_student_id,
    });
    if (error) {
      return { ok: false, ...classifySupabaseError(error) };
    }
    const detail = (data && typeof data === 'object' ? data : null) as SchoolStudentIdentityDetail | null;
    if (!detail || !detail.studentId) {
      return { ok: false, status: 'ERROR', errorCode: 'invalid_identity_response', errorMessage: 'Invalid student identity response from server.' };
    }
    return {
      ok: true,
      status: 'READY',
      data: detail,
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}
