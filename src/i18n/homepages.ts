import { HomePageKey, Language } from '../types';

export interface LocalizedText {
  ar: string;
  fr: string;
  en: string;
}

export function pickText(text: LocalizedText, language: Language): string {
  return text[language] || text.en;
}

export const HOMEPAGE_BADGE_LABELS: Record<HomePageKey, LocalizedText> = {
  PUBLIC_HOME: {
    ar: 'الموقع العام للمدرسة',
    fr: 'SITE PUBLIC DE L’ÉCOLE',
    en: 'PUBLIC SCHOOL SITE',
  },
  PARENT_HOME: {
    ar: 'فضاء الأولياء',
    fr: 'ESPACE PARENTS',
    en: 'PARENT HOME',
  },
  STUDENT_HOME: {
    ar: 'فضاء التلميذ',
    fr: 'ESPACE ÉLÈVE',
    en: 'STUDENT HOME',
  },
  TEACHER_HOME: {
    ar: 'فضاء المربي',
    fr: 'ESPACE ENSEIGNANT',
    en: 'TEACHER HOME',
  },
  SCHOOL_STAFF_HOME: {
    ar: 'فضاء أعوان المدرسة',
    fr: 'ESPACE PERSONNEL SCOLAIRE',
    en: 'SCHOOL STAFF HOME',
  },
  ADMINISTRATIVE_PERSONNEL_HOME: {
    ar: 'فضاء الإدارة المدرسية',
    fr: 'ESPACE ADMINISTRATION',
    en: 'ADMINISTRATION HOME',
  },
  MANAGER_HOME: {
    ar: 'فضاء المدير المساعد / المسير',
    fr: 'ESPACE DIRECTION / MANAGER',
    en: 'MANAGER HOME',
  },
  OWNER_HOME: {
    ar: 'فضاء مالك المدرسة / المدير العام',
    fr: 'ESPACE FONDATEUR / DIRECTEUR',
    en: 'SCHOOL OWNER HOME',
  },
  APPLICATION_STATUS: {
    ar: 'حالة طلب الحساب',
    fr: 'STATUT DE LA DEMANDE',
    en: 'APPLICATION STATUS',
  },
};

export const HOMEPAGE_COMMON_TEXT = {
  mainHeadline: {
    ar: 'كل ما يهمك، بوضوح ودون تعقيد.',
    fr: 'Tout l’essentiel, sans encombrement.',
    en: 'Everything important, without the clutter.',
  },
  publicHeadline: {
    ar: 'الحياة المدرسية في لمحة',
    fr: 'La vie scolaire en un coup d’œil',
    en: 'School life at a glance',
  },
  publicSubtitle: {
    ar: 'معلومات المدرسة العامة دون كشف بيانات التلاميذ أو الأقسام الخاصة.',
    fr: 'Informations publiques de l’école sans exposer les données privées des élèves ou des classes.',
    en: 'Public school information without exposing student/private class data.',
  },
  openAction: {
    ar: 'فتح',
    fr: 'Ouvrir',
    en: 'Open',
  },
  readOnlyAction: {
    ar: 'عرض فقط',
    fr: 'Consulter',
    en: 'View',
  },
  comingSoonBadge: {
    ar: 'قريباً',
    fr: 'Bientôt',
    en: 'Coming soon',
  },
  backendBlockedBadge: {
    ar: 'بانتظار الخادم',
    fr: 'Serveur requis',
    en: 'Pending backend',
  },
  readOnlyBadge: {
    ar: 'قراءة فقط',
    fr: 'Lecture seule',
    en: 'Read-only',
  },
  publicSiteNav: {
    ar: 'الموقع العام',
    fr: 'Site public',
    en: 'Public Site',
  },
  classesNav: {
    ar: 'الأقسام والتلاميذ',
    fr: 'Classes',
    en: 'Classes',
  },
  oversightBannerPrefix: {
    ar: 'معاينة فضاء الدور بصلاحية إشرافية دون انتحال هوية:',
    fr: 'Inspection de l’espace de rôle sans usurpation d’identité :',
    en: 'Viewing role workspace in non-impersonating oversight mode:',
  },
  returnToMyHome: {
    ar: 'العودة إلى صفحتي الرئيسية',
    fr: 'Retour à mon accueil',
    en: 'Return to My Home',
  },
};
