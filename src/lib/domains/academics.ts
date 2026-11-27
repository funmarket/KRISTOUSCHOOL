import { supabase, classifySupabaseError } from '../supabase.ts';
import { invokeTelegramPrivateOperation } from '../telegramPrivateOperations.ts';
import type {
  BackendOpResult,
  Child,
  ClassItem,
  OperationalCounts,
} from '../../types.ts';

export interface TeacherSubjectComponentSummary {
  id: string;
  code: string;
  labelAr: string;
  labelFr: string;
  labelEn: string;
  sortOrder: number;
}

export interface TeacherAllocatedSubjectItem {
  allocationId: string;
  assignmentId: string;
  teacherUserId: string;
  classId: string;
  className: string;
  levelCode: string;
  academicYear: string;
  isHomeroom: boolean;
  subjectId: string;
  subjectCode: string;
  domainCode: string;
  labelAr: string;
  labelFr: string;
  labelEn: string;
  offeringId: string;
  active: boolean;
  allocatedAt: string;
  version: number;
  components: TeacherSubjectComponentSummary[];
}

export interface SchoolClassSummary {
  id: string;
  name: string;
  level: string;
  levelCode?: string;
  academicYear: string;
  homeroomTeacherId?: string | null;
  homeroomTeacherName: string | null;
  activeStudentCount: number;
  capacity?: number | null;
  roomLabel?: string | null;
}

export interface ClassStudentRosterItem {
  studentId: string;
  studentCode: string;
  fullName: string;
  enrollmentStatus: 'ACTIVE' | 'TRANSFERRED' | 'WITHDRAWN' | 'COMPLETED';
  enrolledAt: string;
  primaryGuardianName?: string | null;
}

export interface SchoolLevelOption {
  code: string;
  labelAr: string;
  labelFr: string;
  labelEn: string;
  sortOrder: number;
}

export const CANONICAL_SCHOOL_LEVELS: SchoolLevelOption[] = [
  { code: 'CP', labelAr: 'السنة الأولى (CP)', labelFr: '1ère année (CP)', labelEn: 'Year 1 (CP)', sortOrder: 1 },
  { code: 'CE1', labelAr: 'السنة الثانية (CE1)', labelFr: '2ème année (CE1)', labelEn: 'Year 2 (CE1)', sortOrder: 2 },
  { code: 'CE2', labelAr: 'السنة الثالثة (CE2)', labelFr: '3ème année (CE2)', labelEn: 'Year 3 (CE2)', sortOrder: 3 },
  { code: 'CM1', labelAr: 'السنة الرابعة (CM1)', labelFr: '4ème année (CM1)', labelEn: 'Year 4 (CM1)', sortOrder: 4 },
  { code: 'CM2', labelAr: 'السنة الخامسة (CM2)', labelFr: '5ème année (CM2)', labelEn: 'Year 5 (CM2)', sortOrder: 5 },
  { code: '6EME', labelAr: 'السنة السادسة (6ème)', labelFr: '6ème année', labelEn: 'Year 6', sortOrder: 6 },
];

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
    const tg = await invokeTelegramPrivateOperation('school.context', {}, client);
    const { data, error } = tg.handled ? { data: tg.data, error: null } : await client.rpc('get_my_school_context');
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
    const tg = await invokeTelegramPrivateOperation('academics.classes', {}, client);
    const { data, error } = tg.handled ? { data: tg.data, error: null } : await client.rpc('list_school_classes_with_rosters');
    if (error) {
      return { ok: false, ...classifySupabaseError(error) };
    }
    const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
    const mapped: SchoolClassWithRoster[] = [];
    for (const row of rows) {
      const id = typeof row.id === 'string' ? row.id.trim() : '';
      const name = typeof row.name === 'string' ? row.name.trim() : '';
      const rawLevelCode = row.levelCode ?? row.level_code;
      const levelCode = typeof rawLevelCode === 'string' && rawLevelCode.trim() ? rawLevelCode.trim() : undefined;
      const rawLevel = row.level ?? levelCode;
      const level = typeof rawLevel === 'string' ? rawLevel.trim() : '';
      const rawYear = row.academicYear ?? row.academic_year ?? row.academic_year_code;
      const academicYear = typeof rawYear === 'string' ? rawYear.trim() : '';
      const rawCount = row.activeStudentCount ?? row.active_student_count ?? row.studentCount;
      const activeStudentCount =
        typeof rawCount === 'number' && Number.isFinite(rawCount)
          ? rawCount
          : typeof rawCount === 'string' && rawCount.trim() !== '' && Number.isFinite(Number(rawCount))
          ? Number(rawCount)
          : null;

      if (!id || !name || !level || !academicYear || activeStudentCount === null) {
        return {
          ok: false,
          status: 'ERROR',
          errorCode: 'invalid_class_roster_payload',
          errorMessage: 'Class roster payload is missing required fields.',
        };
      }

      const rawTeacherId = row.homeroomTeacherId ?? row.homeroom_teacher_id;
      const rawTeacherName = row.homeroomTeacherName ?? row.homeroom_teacher_name;
      const rawRoomLabel = row.roomLabel ?? row.room_label;
      const rawCapacity = row.capacity;
      const capacity =
        rawCapacity === null || rawCapacity === undefined
          ? null
          : Number.isFinite(Number(rawCapacity))
          ? Number(rawCapacity)
          : null;

      mapped.push({
        id,
        name,
        level,
        levelCode,
        academicYear,
        homeroomTeacherId: typeof rawTeacherId === 'string' && rawTeacherId.trim() ? rawTeacherId.trim() : null,
        homeroomTeacherName: typeof rawTeacherName === 'string' && rawTeacherName.trim() ? rawTeacherName.trim() : null,
        activeStudentCount,
        capacity,
        roomLabel: typeof rawRoomLabel === 'string' && rawRoomLabel.trim() ? rawRoomLabel.trim() : null,
        roster: Array.isArray(row.roster) ? (row.roster as ClassStudentRosterItem[]) : [],
      });
    }
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
    const tg = await invokeTelegramPrivateOperation('academics.years', {}, client);
    const { data, error } = tg.handled ? { data: tg.data, error: null } : await client.rpc('list_academic_years');
    if (error) {
      return { ok: false, ...classifySupabaseError(error) };
    }
    const items = Array.isArray(data) ? (data as AcademicYearItem[]) : [];
    return { ok: true, status: 'READY', data: items };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export interface StudentPlacementReceipt { studentId: string; classId: string; membershipId: string; replayed: boolean }
export async function assignExistingStudentToClass(
  input: { studentId: string; classId: string; expectedMembershipId: string | null },
  client: typeof supabase = supabase,
): Promise<BackendOpResult<StudentPlacementReceipt>> {
  if (!client) return unavailableResult();
  try {
    const tg = await invokeTelegramPrivateOperation<StudentPlacementReceipt>('academics.placeStudent', input, client);
    const {data,error} = tg.handled ? {data:tg.data,error:null} : await client.rpc('assign_existing_student_to_class', {
      p_student_id:input.studentId,p_class_id:input.classId,p_expected_membership_id:input.expectedMembershipId,
    });
    if (error) return {ok:false,...classifySupabaseError(error)};
    const row = data as unknown as StudentPlacementReceipt;
    if (!row || row.studentId!==input.studentId || row.classId!==input.classId || typeof row.membershipId!=='string') throw new Error('invalid_placement_receipt');
    return {ok:true,status:'READY',data:row};
  } catch(error) { return {ok:false,...classifySupabaseError(error)}; }
}
