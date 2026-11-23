import { pickText } from '../../../i18n/homepages';
import type { CalendarAudienceMode } from '../../../lib/calendar/calendarAudience';
import type { CalendarEventCategory, Language } from '../../../types';

export const CATEGORIES: readonly CalendarEventCategory[] = [
  'EVENT',
  'EXAM',
  'TEST',
  'MEETING',
  'HOLIDAY',
  'CLOSURE',
  'ACTIVITY',
  'TRIP',
  'OTHER',
];

export const AGENDA_PAGE_SIZE = 10;

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function getCategoryStyle(category: CalendarEventCategory, cancelled?: boolean): string {
  if (cancelled) {
    return 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 line-through';
  }
  switch (category) {
    case 'EXAM':
    case 'TEST':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
    case 'HOLIDAY':
    case 'CLOSURE':
      return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300';
    case 'MEETING':
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300';
    default:
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:bg-blue-300';
  }
}

export function formatAudienceOptionLabel(
  mode: CalendarAudienceMode,
  isSchoolCalendarManager: boolean,
  language: Language,
): string {
  switch (mode) {
    case 'WHOLE_SCHOOL':
      return pickText({ ar: 'كامل المدرسة', fr: 'Toute l’école', en: 'Whole school' }, language);
    case 'SINGLE_CLASS':
      return isSchoolCalendarManager
        ? pickText(
            { ar: 'قسم واحد محدد', fr: 'Une classe sélectionnée', en: 'One selected class' },
            language,
          )
        : pickText(
            {
              ar: 'أحد أقسامي المسندة',
              fr: 'Une de mes classes attribuées',
              en: 'One of my assigned classes',
            },
            language,
          );
    case 'TEACHER_CLASSES':
      return pickText(
        {
          ar: 'أقسام أستاذ محدد',
          fr: 'Classes d’un enseignant sélectionné',
          en: 'One selected teacher’s assigned classes',
        },
        language,
      );
    case 'ALL_MY_CLASSES':
      return pickText(
        {
          ar: 'جميع أقسامي المسندة',
          fr: 'Toutes mes classes attribuées',
          en: 'All of my assigned classes',
        },
        language,
      );
  }
}

export function formatRsvpLabel(
  resp: 'ATTENDING' | 'ACKNOWLEDGED' | 'DECLINED',
  language: Language,
): string {
  if (resp === 'ATTENDING') {
    return pickText({ ar: 'سأحضر', fr: 'Participer', en: 'Attending' }, language);
  }
  if (resp === 'ACKNOWLEDGED') {
    return pickText({ ar: 'تم الاطلاع', fr: 'Vu', en: 'Acknowledged' }, language);
  }
  return pickText({ ar: 'معتذر', fr: 'Absent', en: 'Declined' }, language);
}
