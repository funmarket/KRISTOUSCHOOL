import type {
  BackendOpResult,
  TeacherAllocatedSubjectItem,
  TeacherSubjectComponentSummary,
} from '../../types.ts';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateComponent(raw: unknown): TeacherSubjectComponentSummary | null {
  if (!isPlainObject(raw)) return null;
  if (!isNonEmptyString(raw.id) || !isNonEmptyString(raw.code)) return null;
  if (
    typeof raw.labelAr !== 'string' ||
    typeof raw.labelFr !== 'string' ||
    typeof raw.labelEn !== 'string'
  ) {
    return null;
  }
  if (!raw.labelAr.trim() && !raw.labelFr.trim() && !raw.labelEn.trim()) {
    return null;
  }
  if (typeof raw.sortOrder !== 'number' || !Number.isFinite(raw.sortOrder)) {
    return null;
  }

  return {
    id: raw.id,
    code: raw.code,
    labelAr: raw.labelAr,
    labelFr: raw.labelFr,
    labelEn: raw.labelEn,
    sortOrder: raw.sortOrder,
  };
}

/**
 * Strictly validates the JSON array payload returned by
 * `public.list_my_teacher_subject_allocations(p_class_id uuid)` against the
 * installed T4A schema contract. Rejects non-array payloads, missing/non-boolean
 * `active` flags, inactive rows, malformed fields, or scope mismatches rather than
 * coercing values or silently dropping invalid records.
 */
export function parseTeacherSubjectAllocationsResponse(
  data: unknown,
  expectedClassId: string,
  expectedTeacherUserId?: string,
): BackendOpResult<TeacherAllocatedSubjectItem[]> {
  if (!Array.isArray(data)) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'invalid_rpc_payload',
      errorMessage: 'Subject allocation response format is invalid.',
    };
  }

  const parsed: TeacherAllocatedSubjectItem[] = [];

  for (const raw of data) {
    if (!isPlainObject(raw)) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'malformed_rpc_payload',
        errorMessage: 'Subject allocation record is malformed.',
      };
    }

    if (
      !isNonEmptyString(raw.allocationId) ||
      !isNonEmptyString(raw.assignmentId) ||
      !isNonEmptyString(raw.teacherUserId) ||
      !isNonEmptyString(raw.classId) ||
      !isNonEmptyString(raw.className) ||
      !isNonEmptyString(raw.levelCode) ||
      !isNonEmptyString(raw.academicYear) ||
      !isNonEmptyString(raw.subjectId) ||
      !isNonEmptyString(raw.subjectCode) ||
      !isNonEmptyString(raw.domainCode) ||
      !isNonEmptyString(raw.offeringId) ||
      !isNonEmptyString(raw.allocatedAt)
    ) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'malformed_rpc_payload',
        errorMessage: 'Subject allocation record is missing required identifiers.',
      };
    }

    if (typeof raw.isHomeroom !== 'boolean' || typeof raw.active !== 'boolean') {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'malformed_rpc_payload',
        errorMessage: 'Subject allocation status flags are invalid.',
      };
    }

    if (raw.active !== true) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'invalid_allocation_state',
        errorMessage: 'Inactive subject allocation returned unexpectedly.',
      };
    }

    if (
      typeof raw.labelAr !== 'string' ||
      typeof raw.labelFr !== 'string' ||
      typeof raw.labelEn !== 'string' ||
      (!raw.labelAr.trim() && !raw.labelFr.trim() && !raw.labelEn.trim())
    ) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'malformed_rpc_payload',
        errorMessage: 'Subject allocation labels are invalid.',
      };
    }

    if (typeof raw.version !== 'number' || !Number.isInteger(raw.version) || raw.version < 1) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'malformed_rpc_payload',
        errorMessage: 'Subject allocation version is invalid.',
      };
    }

    if (!Array.isArray(raw.components)) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'malformed_rpc_payload',
        errorMessage: 'Subject components payload is invalid.',
      };
    }

    const components: TeacherSubjectComponentSummary[] = [];
    for (const rawComp of raw.components) {
      const validated = validateComponent(rawComp);
      if (!validated) {
        return {
          ok: false,
          status: 'ERROR',
          errorCode: 'malformed_rpc_payload',
          errorMessage: 'Subject component entry is malformed.',
        };
      }
      components.push(validated);
    }

    if (expectedClassId && raw.classId !== expectedClassId) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'mismatched_class_scope',
        errorMessage: 'Subject allocation class does not match the selected class.',
      };
    }

    if (expectedTeacherUserId && raw.teacherUserId !== expectedTeacherUserId) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'mismatched_teacher_scope',
        errorMessage: 'Subject allocation teacher does not match the active account.',
      };
    }

    parsed.push({
      allocationId: raw.allocationId,
      assignmentId: raw.assignmentId,
      teacherUserId: raw.teacherUserId,
      classId: raw.classId,
      className: raw.className,
      levelCode: raw.levelCode,
      academicYear: raw.academicYear,
      isHomeroom: raw.isHomeroom,
      subjectId: raw.subjectId,
      subjectCode: raw.subjectCode,
      domainCode: raw.domainCode,
      labelAr: raw.labelAr,
      labelFr: raw.labelFr,
      labelEn: raw.labelEn,
      offeringId: raw.offeringId,
      active: true,
      allocatedAt: raw.allocatedAt,
      version: raw.version,
      components,
    });
  }

  return { ok: true, status: 'READY', data: parsed };
}
