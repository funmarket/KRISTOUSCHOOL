import type {
  AccountRole,
  BackendOpStatus,
  CalendarAudienceMode,
  CalendarEventCategory,
} from '../../types.ts';

export type { CalendarAudienceMode };

export interface CalendarClassOption {
  id: string;
  name: string;
  level?: string;
}

export interface CalendarTeacherOption {
  id: string;
  fullName: string;
  username?: string;
}

export type CalendarAudienceUnavailableReason =
  | 'no_assigned_classes'
  | 'teacher_picker_unavailable'
  | 'no_teachers_available';

export interface CalendarAudienceOptionDescriptor {
  mode: CalendarAudienceMode;
  supportedByBackend: boolean;
  unavailableReason?: CalendarAudienceUnavailableReason;
  contractPendingReason?: string;
}

export interface CalendarAudiencePlan {
  options: CalendarAudienceOptionDescriptor[];
  defaultMode: CalendarAudienceMode;
  defaultClassId: string;
  defaultTeacherUserId: string;
  selectableClasses: CalendarClassOption[];
  selectableTeachers: CalendarTeacherOption[];
  canSetPublic: boolean;
  isTeacherWithoutAssignments: boolean;
}

const VALID_CATEGORIES: ReadonlySet<CalendarEventCategory> = new Set([
  'EVENT',
  'EXAM',
  'TEST',
  'MEETING',
  'HOLIDAY',
  'CLOSURE',
  'ACTIVITY',
  'TRIP',
  'OTHER',
]);

export function resolveCalendarAudiencePlan(input: {
  actorRole: AccountRole | null | undefined;
  canManageCalendar: boolean;
  contextClassId?: string | null;
  assignedClasses?: readonly CalendarClassOption[];
  allClasses?: readonly CalendarClassOption[];
  teacherOptions?: readonly CalendarTeacherOption[];
  teacherPickerBlocked?: boolean;
}): CalendarAudiencePlan {
  const assigned = [...(input.assignedClasses ?? [])];
  const all = [...(input.allClasses ?? [])];
  const selectableTeachers = input.teacherPickerBlocked ? [] : [...(input.teacherOptions ?? [])];

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
          ...(input.teacherPickerBlocked ? { unavailableReason: 'teacher_picker_unavailable' as const } : {}),
        },
      ],
      defaultMode: matchedContextClass ? 'SINGLE_CLASS' : 'WHOLE_SCHOOL',
      defaultClassId: matchedContextClass || selectableClasses[0]?.id || '',
      defaultTeacherUserId: selectableTeachers[0]?.id || '',
      selectableClasses,
      selectableTeachers,
      canSetPublic: true,
      isTeacherWithoutAssignments: false,
    };
  }

  if (input.actorRole === 'TEACHER') {
    const matchedAssignedClass = input.contextClassId
      ? assigned.find((c) => c.id === input.contextClassId)?.id
      : undefined;
    const hasAssignedClasses = assigned.length > 0;

    return {
      options: [
        {
          mode: 'SINGLE_CLASS',
          supportedByBackend: hasAssignedClasses,
          ...(hasAssignedClasses ? {} : { unavailableReason: 'no_assigned_classes' as const }),
        },
        {
          mode: 'ALL_MY_CLASSES',
          supportedByBackend: false,
          contractPendingReason: 'multi_class_contract_pending',
        },
      ],
      defaultMode: 'SINGLE_CLASS',
      defaultClassId: matchedAssignedClass || assigned[0]?.id || '',
      defaultTeacherUserId: '',
      selectableClasses: assigned,
      selectableTeachers: [],
      canSetPublic: false,
      isTeacherWithoutAssignments: !hasAssignedClasses,
    };
  }

  return {
    options: [],
    defaultMode: 'WHOLE_SCHOOL',
    defaultClassId: '',
    defaultTeacherUserId: '',
    selectableClasses: [],
    selectableTeachers: [],
    canSetPublic: false,
    isTeacherWithoutAssignments: false,
  };
}

export type CalendarCreateValidationResult =
  | {
      valid: true;
      audienceMode: CalendarAudienceMode;
      classId: string | null;
      teacherUserId: string | null;
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
  category?: CalendarEventCategory;
  audienceMode?: CalendarAudienceMode;
  classId?: string | null;
  teacherUserId?: string | null;
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
  if (input.category !== undefined && !VALID_CATEGORIES.has(input.category)) {
    return {
      valid: false,
      status: 'ERROR',
      errorCode: 'invalid_category',
      errorMessage: 'Select a valid calendar event category.',
    };
  }

  const rawClassId = input.classId ? input.classId.trim() : '';
  const rawTeacherId = input.teacherUserId ? input.teacherUserId.trim() : '';
  const audienceMode: CalendarAudienceMode =
    input.audienceMode ??
    (rawTeacherId ? 'TEACHER_CLASSES' : rawClassId ? 'SINGLE_CLASS' : 'WHOLE_SCHOOL');

  if (audienceMode === 'TEACHER_CLASSES' || audienceMode === 'ALL_MY_CLASSES') {
    return {
      valid: false,
      status: 'BLOCKED_BACKEND',
      errorCode: 'multi_class_contract_pending',
      errorMessage: 'Multi-class calendar events are temporarily unavailable while backend support is prepared.',
    };
  }

  const isManager =
    input.canManageCalendar === true ||
    (input.canManageCalendar === undefined &&
      (input.actorRole === 'APP_ADMIN' || input.actorRole === 'ADMINISTRATIVE_PERSONNEL'));
  const isTeacherActor = input.actorRole === 'TEACHER' && input.canManageCalendar !== true;
  const hasKnownActorRestriction =
    input.canManageCalendar === false || input.actorRole !== undefined;

  if (audienceMode === 'WHOLE_SCHOOL') {
    if (hasKnownActorRestriction && !isManager) {
      return {
        valid: false,
        status: 'UNAUTHORIZED',
        errorCode: isTeacherActor
          ? 'teacher_cannot_create_school_wide'
          : 'insufficient_authority',
        errorMessage: isTeacherActor
          ? 'Teachers cannot create school-wide or public calendar events.'
          : 'You are not authorized to create school-wide calendar events.',
      };
    }
    return {
      valid: true,
      audienceMode,
      classId: null,
      teacherUserId: null,
      isPublic: Boolean(input.isPublic),
      endDate,
    };
  }



  // SINGLE_CLASS
  if (hasKnownActorRestriction && !isManager && input.actorRole !== 'TEACHER') {
    return {
      valid: false,
      status: 'UNAUTHORIZED',
      errorCode: 'insufficient_authority',
      errorMessage: 'You are not authorized to create class calendar events.',
    };
  }

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
    teacherUserId: null,
    isPublic: false,
    endDate,
  };
}
