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

  const blockedMessages: Record<Language, string> = {
    ar: 'خدمة الحضور غير متوفرة حالياً (جداول Supabase غير مطبقة بعد).',
    fr: 'Service de présence indisponible (tables Supabase non déployées).',
    en: 'Attendance backend tables / RPC functions are not deployed yet.',
    es: 'El servicio de asistencia no está disponible (tablas de Supabase sin desplegar).',
    de: 'Anwesenheitsdienst nicht verfügbar (Supabase-Tabellen noch nicht bereitgestellt).',
    pt: 'Serviço de presenças indisponível (tabelas Supabase ainda não implementadas).',
  };
  const unauthorizedMessages: Record<Language, string> = {
    ar: 'ليس لديك صلاحية لتنفيذ هذه العملية.',
    fr: 'Accès non autorisé.',
    en: 'Unauthorized attendance operation.',
    es: 'Operación de asistencia no autorizada.',
    de: 'Nicht autorisierter Anwesenheitsvorgang.',
    pt: 'Operação de presenças não autorizada.',
  };
  const rosterConflictMessages: Record<Language, string> = {
    ar: 'تغيّرت قائمة تلاميذ القسم. يرجى إعادة تحميل السجل.',
    fr: 'La liste des élèves a changé. Veuillez recharger le registre.',
    en: 'Class roster changed. Please refresh and review.',
    es: 'La lista de alumnos de la clase ha cambiado. Actualiza y revisa.',
    de: 'Die Klassenliste hat sich geändert. Bitte neu laden und prüfen.',
    pt: 'A lista de alunos da turma mudou. Atualize e reveja.',
  };
  const conflictMessages: Record<Language, string> = {
    ar: 'تعارض في الإصدار أو السجل. يرجى إعادة تحميل الحضور.',
    fr: 'Conflit de version ou de registre. Veuillez recharger.',
    en: 'Attendance register version conflict. Please refresh and review.',
    es: 'Conflicto de versión en el registro de asistencia. Actualiza y revisa.',
    de: 'Versionskonflikt im Anwesenheitsregister. Bitte neu laden.',
    pt: 'Conflito de versão no registo de presenças. Atualize e reveja.',
  };

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
      errorMessage: blockedMessages[language] ?? blockedMessages.en,
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
      errorMessage: unauthorizedMessages[language] ?? unauthorizedMessages.en,
    };
  }

  if (lowerMsg.includes('roster_conflict')) {
    return {
      status: 'ERROR',
      errorCode: 'roster_conflict',
      errorMessage: rosterConflictMessages[language] ?? rosterConflictMessages.en,
    };
  }

  if (code === 'ATT_CONFLICT' || lowerMsg.includes('version_conflict') || lowerMsg.includes('conflict')) {
    return {
      status: 'ERROR',
      errorCode: 'version_conflict',
      errorMessage: conflictMessages[language] ?? conflictMessages.en,
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
