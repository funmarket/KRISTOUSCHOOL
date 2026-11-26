import { supabase, isSupabaseConfigured } from '../supabase.ts';
import { listAccountDirectory, type GovernanceAccountRecord } from '../accountGovernance.ts';
import { isValidIsoDate } from './dateUtils.ts';
import { classifyAttendanceError } from './logic.ts';
import { isValidUuid, isNonEmptyString, isPlainObject } from './attendanceParsers.ts';
import type {
  AttendanceRegisterStatus,
  BackendOpResult,
  Language,
  OfficeAttendanceClassOption,
  OfficeAttendanceContext,
  OfficeAttendanceRegisterSummary,
  OfficeAttendanceTeacherOption,
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

export async function fetchOfficeSavedRegisters(params: {
  limit?: number;
  offset?: number;
  classId?: string | null;
  teacherUserId?: string | null;
  status?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  language?: Language;
} = {}): Promise<BackendOpResult<OfficeSavedRegistersPage>> {
  const lang = params.language ?? 'en';
  const fromDate = params.fromDate ?? params.startDate ?? null;
  const toDate = params.toDate ?? params.endDate ?? null;

  if (fromDate && !isValidIsoDate(fromDate)) {
    return { ok: false, status: 'ERROR', errorCode: 'invalid_attendance_date', errorMessage: 'Invalid start date filter.' };
  }
  if (toDate && !isValidIsoDate(toDate)) {
    return { ok: false, status: 'ERROR', errorCode: 'invalid_attendance_date', errorMessage: 'Invalid end date filter.' };
  }
  if (fromDate && toDate && fromDate > toDate) {
    return { ok: false, status: 'ERROR', errorCode: 'invalid_attendance_date', errorMessage: 'Start date must be on or before end date.' };
  }

  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, status: 'BLOCKED_BACKEND', errorCode: 'backend_unavailable', errorMessage: 'Attendance backend service is unavailable.' };
  }

  try {
    const limit = Math.min(500, Math.max(1, params.limit ?? OFFICE_SAVED_REGISTERS_DEFAULT_LIMIT));
    const offset = Math.max(0, params.offset ?? 0);

    let query = supabase
      .from('attendance_registers')
      .select('id, class_id, teacher_user_id, school_date, status, version, submitted_at', { count: 'exact' });

    if (params.classId && isValidUuid(params.classId)) query = query.eq('class_id', params.classId);
    if (params.teacherUserId && isValidUuid(params.teacherUserId)) query = query.eq('teacher_user_id', params.teacherUserId);
    if (params.status && params.status.trim()) query = query.eq('status', params.status.trim().toUpperCase());
    if (fromDate) query = query.gte('school_date', fromDate);
    if (toDate) query = query.lte('school_date', toDate);

    const { data, error, count } = await query
      .order('school_date', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return { ok: false, ...classifyAttendanceError(error, lang) };
    }
    if (!Array.isArray(data)) {
      return { ok: false, status: 'ERROR', errorCode: 'invalid_rpc_payload', errorMessage: 'Office saved registers payload is invalid.' };
    }

    const items: OfficeAttendanceRegisterSummary[] = [];
    for (const raw of data as any[]) {
      if (!isPlainObject(raw)) continue;
      if (!isValidUuid(raw.id) || !isValidUuid(raw.class_id) || !isValidUuid(raw.teacher_user_id) || !isValidIsoDate(raw.school_date)) {
        continue;
      }
      const statusVal = raw.status === 'SUBMITTED' ? 'SUBMITTED' : 'DRAFT';
      items.push({
        registerId: raw.id,
        classId: raw.class_id,
        teacherUserId: raw.teacher_user_id,
        schoolDate: raw.school_date,
        status: statusVal as AttendanceRegisterStatus,
        version: typeof raw.version === 'number' ? raw.version : 1,
        submittedAt: typeof raw.submitted_at === 'string' ? raw.submitted_at : null,
      });
    }

    const totalCount = typeof count === 'number' ? count : null;
    const hasMore = totalCount !== null ? offset + items.length < totalCount : items.length >= limit;

    return { ok: true, status: 'READY', data: { items, totalCount, hasMore, offset, limit } };
  } catch (err) {
    return { ok: false, ...classifyAttendanceError(err, lang) };
  }
}

export async function fetchOfficeAttendanceContext(
  langOrParams?: Language | { language?: Language; pageSize?: number; maxRegisters?: number },
  maybeOptions?: { pageSize?: number; maxRegisters?: number },
): Promise<BackendOpResult<OfficeAttendanceContextResult>> {
  const lang: Language = typeof langOrParams === 'string' ? langOrParams : langOrParams?.language ?? 'en';
  const rawOpts = typeof langOrParams === 'object' && langOrParams !== null ? langOrParams : maybeOptions;
  const pageSize = Math.min(500, Math.max(1, rawOpts?.pageSize ?? OFFICE_REGISTER_PAGE_SIZE));
  const maxRegisters = Math.max(1, rawOpts?.maxRegisters ?? OFFICE_CONTEXT_MAX_REGISTERS);

  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, status: 'BLOCKED_BACKEND', errorCode: 'backend_unavailable', errorMessage: 'Attendance backend service is unavailable.' };
  }

  try {
    const [classesRes, assignmentsRes, accountsRes] = await Promise.all([
      supabase
        .from('school_classes')
        .select('id, name, level_code, is_archived, academic_years(code), school_levels(label_ar, label_fr, label_en)')
        .order('name', { ascending: true }),
      supabase
        .from('teacher_class_assignments')
        .select('class_id, teacher_user_id, active, is_homeroom'),
      listAccountDirectory({ limit: 1000 }),
    ]);

    if (classesRes.error) return { ok: false, ...classifyAttendanceError(classesRes.error, lang) };
    if (assignmentsRes.error) return { ok: false, ...classifyAttendanceError(assignmentsRes.error, lang) };

    const savedRegisters: OfficeAttendanceRegisterSummary[] = [];
    const seenIds = new Set<string>();
    let offset = 0;
    let totalSavedRegistersCount: number | null = null;
    let hasMoreSavedRegisters = false;

    while (savedRegisters.length < maxRegisters) {
      const remaining = maxRegisters - savedRegisters.length;
      const pageRes = await fetchOfficeSavedRegisters({
        limit: Math.min(pageSize, remaining),
        offset,
        language: lang,
      });
      if (!pageRes.ok || !pageRes.data) {
        return {
          ok: false,
          status: pageRes.status === 'READY' ? 'ERROR' : pageRes.status,
          errorCode: pageRes.errorCode,
          errorMessage: pageRes.errorMessage,
        };
      }
      if (pageRes.data.totalCount !== null) totalSavedRegistersCount = pageRes.data.totalCount;
      for (const item of pageRes.data.items) {
        if (!seenIds.has(item.registerId)) {
          seenIds.add(item.registerId);
          savedRegisters.push(item);
        }
      }
      hasMoreSavedRegisters = pageRes.data.hasMore;
      if (!pageRes.data.hasMore || pageRes.data.items.length === 0) break;
      offset += pageRes.data.items.length;
    }

    if (totalSavedRegistersCount !== null) {
      hasMoreSavedRegisters = savedRegisters.length < totalSavedRegistersCount;
    }

    const classes: OfficeAttendanceClassOption[] = [];
    for (const c of Array.isArray(classesRes.data) ? (classesRes.data as any[]) : []) {
      if (!c || !isValidUuid(c.id) || !isNonEmptyString(c.name)) continue;
      const lvlObj = isPlainObject(c.school_levels) ? c.school_levels : null;
      const lvlField =
        lang === 'ar'
          ? lvlObj?.label_ar
          : lang === 'fr'
          ? lvlObj?.label_fr
          : lvlObj?.label_en || lvlObj?.label_fr || lvlObj?.label_ar;
      const yrObj = isPlainObject(c.academic_years) ? c.academic_years : null;
      classes.push({
        id: c.id,
        name: c.name,
        levelLabel: typeof lvlField === 'string' && lvlField ? lvlField : typeof c.level_code === 'string' ? c.level_code : '',
        academicYear: typeof yrObj?.code === 'string' ? yrObj.code : '',
        isArchived: Boolean(c.is_archived),
      });
    }

    const accounts: GovernanceAccountRecord[] =
      accountsRes.ok && accountsRes.data && Array.isArray(accountsRes.data.items) ? accountsRes.data.items : [];
    const accountById = new Map<string, GovernanceAccountRecord>(accounts.map((a) => [a.id, a]));
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

    for (const row of Array.isArray(assignmentsRes.data) ? (assignmentsRes.data as any[]) : []) {
      if (!row || !isValidUuid(row.class_id) || !isValidUuid(row.teacher_user_id)) continue;
      const opt = ensureTeacherOption(row.teacher_user_id);
      if (row.active === true) opt.hasActiveAssignmentInClass[row.class_id] = true;
      if (row.is_homeroom === true && row.active === true) opt.isHomeroomInClass[row.class_id] = true;
    }

    for (const reg of savedRegisters) {
      ensureTeacherOption(reg.teacherUserId).hasSavedRegisterInClass[reg.classId] = true;
    }

    return {
      ok: true,
      status: 'READY',
      data: {
        classes,
        teachers: Array.from(teacherMap.values()),
        savedRegisters,
        totalSavedRegistersCount,
        hasMoreSavedRegisters,
        accountNamesById: Object.fromEntries(accounts.map((a) => [a.id, a.fullName])),
      },
    };
  } catch (err) {
    return { ok: false, ...classifyAttendanceError(err, lang) };
  }
}
