import { supabase, classifySupabaseError } from '../supabase.ts';
import type {
  BackendOpResult,
  Child,
  ClassItem,
  ClassStudentRosterItem,
  OperationalCounts,
  SchoolLevelOption,
} from '../../types.ts';

export type { SchoolClassSummary } from '../../types.ts';

export const CANONICAL_SCHOOL_LEVELS: SchoolLevelOption[] = [
  { code: 'CP', labelAr: 'السنة الأولى (CP)', labelFr: '1ère année (CP)', labelEn: 'Year 1 (CP)', sortOrder: 1 },
  { code: 'CE1', labelAr: 'السنة الثانية (CE1)', labelFr: '2ème année (CE1)', labelEn: 'Year 2 (CE1)', sortOrder: 2 },
  { code: 'CE2', labelAr: 'السنة الثالثة (CE2)', labelFr: '3ème année (CE2)', labelEn: 'Year 3 (CE2)', sortOrder: 3 },
  { code: 'CM1', labelAr: 'السنة الرابعة (CM1)', labelFr: '4ème année (CM1)', labelEn: 'Year 4 (CM1)', sortOrder: 4 },
  { code: 'CM2', labelAr: 'السنة الخامسة (CM2)', labelFr: '5ème année (CM2)', labelEn: 'Year 5 (CM2)', sortOrder: 5 },
  { code: '6EME', labelAr: 'السنة السادسة (6ème)', labelFr: '6ème année', labelEn: 'Year 6', sortOrder: 6 },
];

export type SchoolClassWithRoster = import('../../types.ts').SchoolClassSummary & {
  roster: ClassStudentRosterItem[];
};

export interface MySchoolContextPayload {
  linkedChildrenIds: string[];
  assignedClassIds: string[];
  children: Child[];
  classes: ClassItem[];
  operationalCounts: OperationalCounts;
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

export interface AcademicYearItem {
  id: string;
  code: string;
  label?: string;
  name?: string;
  startsOn?: string;
  endsOn?: string;
  isActive?: boolean;
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
    const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
    const mapped: SchoolClassWithRoster[] = rows.map((row) => ({
      id: String(row.id || ''),
      name: String(row.name || ''),
      level: String(row.level || row.level_code || 'CP'),
      levelCode: String(row.level_code || row.level || 'CP'),
      academicYear: String(row.academic_year || row.academic_year_code || '2026-2027'),
      homeroomTeacherName: row.homeroom_teacher_name ? String(row.homeroom_teacher_name) : null,
      activeStudentCount: Number(row.active_student_count ?? row.studentCount ?? 0),
      capacity: row.capacity !== undefined ? Number(row.capacity) : 28,
      roomLabel: row.room_label ? String(row.room_label) : null,
      roster: Array.isArray(row.roster) ? (row.roster as ClassStudentRosterItem[]) : [],
    }));
    return {
      ok: true,
      status: 'READY',
      data: mapped,
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
