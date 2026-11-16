import type { AccountRole, BackendOpStatus } from '../../types.ts';

export type CalendarAudienceMode =
  | 'WHOLE_SCHOOL'
  | 'SINGLE_CLASS'
  | 'TEACHER_CLASSES'
  | 'ALL_MY_CLASSES';

export interface CalendarClassOption {
  id: string;
  name: string;
  level?: string;
}

export interface CalendarAudienceOptionDescriptor {
  mode: CalendarAudienceMode;
  supportedByBackend: boolean;
  contractPendingReason?: 'multi_class_contract_pending';
}

export interface CalendarAudiencePlan {
  options: CalendarAudienceOptionDescriptor[];
  defaultMode: CalendarAudienceMode;
  defaultClassId: string;
  selectableClasses: CalendarClassOption[];
  canSetPublic: boolean;
  isTeacherWithoutAssignments: boolean;
}

export function resolveCalendarAudiencePlan(input: {
  actorRole: AccountRole | null | undefined;
  canManageCalendar: boolean;
  contextClassId?: string | null;
  assignedClasses?: readonly CalendarClassOption[];
  allClasses?: readonly CalendarClassOption[];
}): CalendarAudiencePlan {
  const assigned = [...(input.assignedClasses ?? [])];
  const all = [...(input.allClasses ?? [])];

  if (input.canManageCalendar) {
    const selectableClasses: CalendarClassOption[] =
      all.length > 0
        ? all
        : input.contextClassId
        ? [{ id: input.contextClassId, name: input.contextClassId }]
        : [];
    const matchedContextClass = input.contextClassId
      ? selectableClasses.find((c) => c.id === input.contextClassId)?.id
      : undefined;

    return {
      options: [
        { mode: 'WHOLE_SCHOOL', supportedByBackend: true },
        { mode: 'SINGLE_CLASS', supportedByBackend: true },
        {
          mode: 'TEACHER_CLASSES',
          supportedByBackend: false,
          contractPendingReason: 'multi_class_contract_pending',
        },
      ],
      defaultMode: matchedContextClass ? 'SINGLE_CLASS' : 'WHOLE_SCHOOL',
      defaultClassId: matchedContextClass || selectableClasses[0]?.id || '',
      selectableClasses,
      canSetPublic: true,
      isTeacherWithoutAssignments: false,
    };
  }

  if (input.actorRole === 'TEACHER') {
    const matchedAssignedClass = input.contextClassId
      ? assigned.find((c) => c.id === input.contextClassId)?.id
      : undefined;

    return {
      options: [
        { mode: 'SINGLE_CLASS', supportedByBackend: assigned.length > 0 },
        {
          mode: 'ALL_MY_CLASSES',
          supportedByBackend: false,
          contractPendingReason: 'multi_class_contract_pending',
        },
      ],
      defaultMode: 'SINGLE_CLASS',
      defaultClassId: matchedAssignedClass || assigned[0]?.id || '',
      selectableClasses: assigned,
      canSetPublic: false,
      isTeacherWithoutAssignments: assigned.length === 0,
    };
  }

  return {
    options: [],
    defaultMode: 'WHOLE_SCHOOL',
    defaultClassId: '',
    selectableClasses: [],
    canSetPublic: false,
    isTeacherWithoutAssignments: false,
  };
}

export type CalendarCreateValidationResult =
  | {
      valid: true;
      audienceMode: CalendarAudienceMode;
      classId: string | null;
      isPublic: boolean;
      endDate: string;
    }
  | {
      valid: false;
      status: BackendOpStatus;
      errorCode: string;
      errorMessage: string;
    };

export function validateCalendarCreateInput(input: {
  title: string;
  startDate: string;
  endDate?: string;
  audienceMode?: CalendarAudienceMode;
  classId?: string | null;
  isPublic?: boolean;
  actorRole?: AccountRole | null;
  canManageCalendar?: boolean;
  allowedClassIds?: readonly string[];
}): CalendarCreateValidationResult {
  if (input.title.trim().length < 2 || !input.startDate) {
    return {
      valid: false,
      status: 'ERROR',
      errorCode: 'invalid_event_input',
      errorMessage: 'Title and start date are required.',
    };
  }
  const endDate =
    input.endDate && input.endDate.trim() ? input.endDate.trim() : input.startDate;
  if (endDate < input.startDate) {
    return {
      valid: false,
      status: 'ERROR',
      errorCode: 'invalid_date_range',
      errorMessage: 'End date must be on or after start date.',
    };
  }

  const rawClassId = input.classId ? input.classId.trim() : '';
  const audienceMode: CalendarAudienceMode =
    input.audienceMode ?? (rawClassId ? 'SINGLE_CLASS' : 'WHOLE_SCHOOL');

  if (audienceMode === 'TEACHER_CLASSES' || audienceMode === 'ALL_MY_CLASSES') {
    return {
      valid: false,
      status: 'BLOCKED_BACKEND',
      errorCode: 'multi_class_contract_pending',
      errorMessage:
        'Multi-class and teacher-targeted calendar events are not yet available. Select a single class or whole school.',
    };
  }

  const isManager =
    input.canManageCalendar === true ||
    input.actorRole === 'APP_ADMIN' ||
    input.actorRole === 'ADMINISTRATIVE_PERSONNEL';
  const isTeacherActor = input.actorRole === 'TEACHER' && input.canManageCalendar !== true;

  if (audienceMode === 'WHOLE_SCHOOL') {
    if (isTeacherActor || input.canManageCalendar === false) {
      return {
        valid: false,
        status: 'UNAUTHORIZED',
        errorCode: 'teacher_cannot_create_school_wide',
        errorMessage: 'Teachers cannot create school-wide or public calendar events.',
      };
    }
    return {
      valid: true,
      audienceMode,
      classId: null,
      isPublic: Boolean(input.isPublic),
      endDate,
    };
  }

  // SINGLE_CLASS
  if (!rawClassId) {
    return {
      valid: false,
      status: 'ERROR',
      errorCode: 'calendar_class_required',
      errorMessage: 'Select a target class before saving a class calendar event.',
    };
  }

  if (Boolean(input.isPublic)) {
    return {
      valid: false,
      status: isTeacherActor ? 'UNAUTHORIZED' : 'ERROR',
      errorCode: isTeacherActor ? 'teacher_cannot_publish_public' : 'class_event_cannot_be_public',
      errorMessage: 'Class calendar events cannot be marked public on the school homepage.',
    };
  }

  if (isTeacherActor) {
    const allowed = input.allowedClassIds ?? [];
    if (!isManager && !allowed.includes(rawClassId)) {
      return {
        valid: false,
        status: 'UNAUTHORIZED',
        errorCode: 'teacher_class_not_assigned',
        errorMessage: 'Teachers can only create events for their actively assigned classes.',
      };
    }
  }

  return {
    valid: true,
    audienceMode: 'SINGLE_CLASS',
    classId: rawClassId,
    isPublic: false,
    endDate,
  };
}
