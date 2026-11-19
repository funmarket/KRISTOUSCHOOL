import { supabase, classifySupabaseError } from '../supabase.ts';
import type { BackendOpResult } from '../../types.ts';

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

function unavailableResult<T>(): BackendOpResult<T> {
  return {
    ok: false,
    status: 'BLOCKED_BACKEND',
    errorCode: 'backend_unavailable',
    errorMessage: 'This workflow is awaiting verified Supabase backend deployment.',
  };
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
