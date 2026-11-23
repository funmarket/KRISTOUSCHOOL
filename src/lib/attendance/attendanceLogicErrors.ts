import type { BackendOpStatus, Language } from '../../types.ts';

export function extractSupabaseErrorParts(error: unknown): {
  code: string;
  message: string;
} {
  if (!error || typeof error !== 'object') {
    return {
      code: '',
      message: typeof error === 'string' ? error : 'Unknown error',
    };
  }

  const errObj = error as Record<string, unknown>;
  const code =
    typeof errObj.code === 'string'
      ? errObj.code
      : typeof errObj.status === 'number'
      ? String(errObj.status)
      : '';
  const message =
    typeof errObj.message === 'string'
      ? errObj.message
      : typeof errObj.details === 'string'
      ? errObj.details
      : typeof errObj.hint === 'string'
      ? errObj.hint
      : 'Database operation failed';

  return { code, message };
}

export function classifyAttendanceError(
  error: unknown,
  language: Language = 'en',
): {
  status: BackendOpStatus;
  errorCode: string;
  errorMessage: string;
} {
  const { code, message } = extractSupabaseErrorParts(error);
  const lowerMsg = message.toLowerCase();

  if (
    code === '42P01' ||
    code === '42883' ||
    code === 'PGRST202' ||
    lowerMsg.includes('does not exist') ||
    lowerMsg.includes('could not find the function') ||
    lowerMsg.includes('relation "')
  ) {
    return {
      status: 'BLOCKED_BACKEND',
      errorCode: 'backend_unavailable',
      errorMessage:
        language === 'ar'
          ? 'خدمة الحضور غير متوفرة حالياً (جداول Supabase غير مطبقة بعد).'
          : language === 'fr'
          ? 'Service de présence indisponible (tables Supabase non déployées).'
          : 'Attendance backend tables / RPC functions are not deployed yet.',
    };
  }

  if (
    code === 'ATT_FORBIDDEN' ||
    code === '42501' ||
    code === 'PGRST301' ||
    lowerMsg.includes('permission') ||
    lowerMsg.includes('policy') ||
    lowerMsg.includes('denied') ||
    lowerMsg.includes('unauthorized') ||
    lowerMsg.includes('forbidden') ||
    lowerMsg.includes('teacher_assignment_required') ||
    lowerMsg.includes('not_assigned') ||
    lowerMsg.includes('actor_unauthenticated') ||
    lowerMsg.includes('actor_not_approved') ||
    lowerMsg.includes('jwt expired')
  ) {
    return {
      status: 'UNAUTHORIZED',
      errorCode: 'unauthorized',
      errorMessage:
        language === 'ar'
          ? 'ليس لديك صلاحية لتنفيذ هذه العملية.'
          : language === 'fr'
          ? 'Accès non autorisé.'
          : 'Unauthorized attendance operation.',
    };
  }

  if (lowerMsg.includes('roster_conflict')) {
    return {
      status: 'ERROR',
      errorCode: 'roster_conflict',
      errorMessage:
        language === 'ar'
          ? 'تغيّرت قائمة تلاميذ القسم. يرجى إعادة تحميل السجل.'
          : language === 'fr'
          ? 'La liste des élèves a changé. Veuillez recharger le registre.'
          : 'Class roster changed. Please refresh and review.',
    };
  }

  if (code === 'ATT_CONFLICT' || lowerMsg.includes('version_conflict') || lowerMsg.includes('conflict')) {
    return {
      status: 'ERROR',
      errorCode: 'version_conflict',
      errorMessage:
        language === 'ar'
          ? 'تعارض في الإصدار أو السجل. يرجى إعادة تحميل الحضور.'
          : language === 'fr'
          ? 'Conflit de version ou de registre. Veuillez recharger.'
          : 'Attendance register version conflict. Please refresh and review.',
    };
  }

  return {
    status: 'ERROR',
    errorCode: lowerMsg.includes('attendance_correction_window_closed')
      ? 'attendance_correction_window_closed'
      : code || 'attendance_error',
    errorMessage: message,
  };
}
