import { supabase, classifySupabaseError } from './supabase.ts';
import type {
  BackendOpResult,
  Language,
  TeacherAllocatedSubjectItem,
} from '../types.ts';
import { parseTeacherSubjectAllocationsResponse } from './performance/performanceAllocationsParser.ts';

export type {
  TeacherPerformanceScope,
  ParentPerformanceScope,
  TeacherAllocationsFetchPlan,
  TeacherAllocationsState,
  VisibleTeacherAllocations,
  PerformanceActorSnapshot,
  PostRefreshAction,
} from './performance/performanceTypes.ts';

export {
  buildPerformanceActorScopeKey,
  resolveTeacherPerformanceScope,
  resolveParentPerformanceScope,
  reconcileSelectedSubjectId,
  resolveTeacherAllocationsFetchPlan,
  resolveVisibleTeacherAllocations,
  isAllocationResultApplicable,
  resolvePostRefreshAction,
} from './performance/performanceScope.ts';

export { parseTeacherSubjectAllocationsResponse } from './performance/performanceAllocationsParser.ts';

/**
 * Reads the authenticated Teacher's active subject allocations via the installed
 * T4A RPC `list_my_teacher_subject_allocations(p_class_id)`.
 */
export async function fetchMyTeacherSubjectAllocations(
  classId: string,
  expectedTeacherUserId?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<TeacherAllocatedSubjectItem[]>> {
  if (!classId) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'class_id_required',
      errorMessage: 'Class selection is required.',
    };
  }
  if (!client) {
    return {
      ok: false,
      status: 'BLOCKED_BACKEND',
      errorCode: 'backend_unavailable',
      errorMessage: 'Subject allocation service is unavailable.',
    };
  }
  try {
    const { data, error } = await client.rpc('list_my_teacher_subject_allocations', {
      p_class_id: classId,
    });
    if (error) {
      return { ok: false, ...classifySupabaseError(error) };
    }
    return parseTeacherSubjectAllocationsResponse(data, classId, expectedTeacherUserId);
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export function getLocalizedSubjectLabel(
  item: { labelAr: string; labelFr: string; labelEn: string },
  language: Language,
): string {
  if (language === 'ar') return item.labelAr || item.labelFr || item.labelEn;
  if (language === 'fr') return item.labelFr || item.labelEn || item.labelAr;
  return item.labelEn || item.labelFr || item.labelAr;
}
