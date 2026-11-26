import { pickText } from '../../../i18n/homepages';
import type { AttendanceMark, AttendanceRegisterStatus, Language } from '../../../types';

export function getAttendanceMarkLabel(
  mark: AttendanceMark | null,
  language: Language,
): string {
  switch (mark) {
    case 'PRESENT':
      return pickText({ ar: 'حاضر', fr: 'Présent(e)', en: 'Present', es: 'Presente', de: 'Anwesend', pt: 'Presente' }, language);
    case 'ABSENT':
      return pickText({ ar: 'غائب', fr: 'Absent(e)', en: 'Absent', es: 'Ausente', de: 'Abwesend', pt: 'Ausente' }, language);
    case 'LATE':
      return pickText({ ar: 'متأخر', fr: 'En retard', en: 'Late', es: 'Tarde', de: 'Verspätet', pt: 'Atrasado' }, language);
    case 'EXCUSED':
      return pickText({ ar: 'غياب مبرر', fr: 'Justifié(e)', en: 'Excused', es: 'Justificado', de: 'Entschuldigt', pt: 'Justificado' }, language);
    default:
      return pickText({ ar: 'غير مسجل', fr: 'Non enregistré', en: 'Not Recorded', es: 'Sin registrar', de: 'Nicht erfasst', pt: 'Não registado' }, language);
  }
}

export function getAttendanceMarkBadgeClass(mark: AttendanceMark | null): string {
  switch (mark) {
    case 'PRESENT':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300';
    case 'ABSENT':
      return 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300';
    case 'LATE':
      return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300';
    case 'EXCUSED':
      return 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300';
    default:
      return 'border-slate-200 bg-slate-100 text-slate-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300';
  }
}

export function getAttendanceMarkActiveButtonClass(mark: AttendanceMark | null): string {
  switch (mark) {
    case 'PRESENT':
      return 'border-emerald-600 bg-emerald-600 text-white shadow-xs';
    case 'ABSENT':
      return 'border-red-600 bg-red-600 text-white shadow-xs';
    case 'LATE':
      return 'border-amber-600 bg-amber-600 text-white shadow-xs';
    case 'EXCUSED':
      return 'border-sky-600 bg-sky-600 text-white shadow-xs';
    default:
      return 'border-slate-600 bg-slate-700 text-white dark:border-zinc-500 dark:bg-zinc-600 shadow-xs';
  }
}

export function getRegisterStatusLabel(
  status: AttendanceRegisterStatus,
  version: number,
  language: Language,
): string {
  if (version === 0) {
    return pickText(
      { ar: 'مسودة غير محفوظة', fr: 'Non encore enregistré', en: 'Not saved yet', es: 'Aún no guardado', de: 'Noch nicht gespeichert', pt: 'Ainda não guardado' },
      language,
    );
  }
  if (status === 'SUBMITTED') {
    return pickText(
      { ar: `معتمد (نسخة ${version})`, fr: `Soumis (v${version})`, en: `Submitted (v${version})`, es: `Enviado (v${version})`, de: `Eingereicht (v${version})`, pt: `Submetido (v${version})` },
      language,
    );
  }
  return pickText(
    { ar: `مسودة (نسخة ${version})`, fr: `Brouillon (v${version})`, en: `Draft (v${version})`, es: `Borrador (v${version})`, de: `Entwurf (v${version})`, pt: `Rascunho (v${version})` },
    language,
  );
}

export function getAuditEventLabel(eventType: string, language: Language): string {
  switch (eventType) {
    case 'DRAFT_SAVED':
      return pickText({ ar: 'حفظ مسودة', fr: 'Brouillon enregistré', en: 'Draft saved', es: 'Borrador guardado', de: 'Entwurf gespeichert', pt: 'Rascunho guardado' }, language);
    case 'REGISTER_SUBMITTED':
      return pickText({ ar: 'اعتماد السجل', fr: 'Registre soumis', en: 'Register submitted', es: 'Registro enviado', de: 'Klassenbuch eingereicht', pt: 'Registo submetido' }, language);
    case 'SUBMITTED_CORRECTION':
      return pickText({ ar: 'تصحيح سجل معتمد', fr: 'Correction post-soumission', en: 'Submitted register corrected', es: 'Registro enviado corregido', de: 'Eingereichtes Klassenbuch korrigiert', pt: 'Registo submetido corrigido' }, language);
    case 'INELIGIBLE_DRAFT_ENTRIES_REMOVED':
      return pickText(
        { ar: 'تحديث قائمة التلاميذ المؤهلين', fr: 'Nettoyage des élèves inéligibles', en: 'Ineligible draft pupils removed', es: 'Alumnos no elegibles retirados del borrador', de: 'Nicht berechtigte Schüler aus Entwurf entfernt', pt: 'Alunos não elegíveis removidos do rascunho' },
        language,
      );
    default:
      return eventType;
  }
}
