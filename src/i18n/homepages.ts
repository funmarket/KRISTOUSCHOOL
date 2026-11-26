import { HomePageKey, Language } from '../types';

export interface LocalizedText {
  ar: string;
  fr: string;
  en: string;
  es: string;
  de: string;
  pt: string;
}

export function pickText(text: LocalizedText, language: Language): string {
  return text[language] || text.en;
}

export const HOMEPAGE_BADGE_LABELS: Record<HomePageKey, LocalizedText> = {
  PUBLIC_HOME: {
    ar: 'الموقع العام للمدرسة',
    fr: 'SITE PUBLIC DE L’ÉCOLE',
    en: 'PUBLIC SCHOOL SITE',
    es: 'SITIO PÚBLICO DE LA ESCUELA',
    de: 'ÖFFENTLICHE SCHULSEITE',
    pt: 'SITE PÚBLICO DA ESCOLA',
  },
  PARENT_HOME: {
    ar: 'فضاء الأولياء',
    fr: 'ESPACE PARENTS',
    en: 'PARENT HOME',
    es: 'ESPACIO DE PADRES',
    de: 'ELTERNBEREICH',
    pt: 'ESPAÇO DOS PAIS',
  },
  STUDENT_HOME: {
    ar: 'فضاء التلميذ',
    fr: 'ESPACE ÉLÈVE',
    en: 'STUDENT HOME',
    es: 'ESPACIO DEL ALUMNO',
    de: 'SCHÜLERBEREICH',
    pt: 'ESPAÇO DO ALUNO',
  },
  TEACHER_HOME: {
    ar: 'فضاء المربي',
    fr: 'ESPACE ENSEIGNANT',
    en: 'TEACHER HOME',
    es: 'ESPACIO DOCENTE',
    de: 'LEHRKRÄFTEBEREICH',
    pt: 'ESPAÇO DOCENTE',
  },
  SCHOOL_STAFF_HOME: {
    ar: 'فضاء أعوان المدرسة',
    fr: 'ESPACE PERSONNEL SCOLAIRE',
    en: 'SCHOOL STAFF HOME',
    es: 'ESPACIO DEL PERSONAL ESCOLAR',
    de: 'SCHULPERSONALBEREICH',
    pt: 'ESPAÇO DO PESSOAL ESCOLAR',
  },
  ADMINISTRATIVE_PERSONNEL_HOME: {
    ar: 'فضاء الإدارة المدرسية',
    fr: 'ESPACE ADMINISTRATION',
    en: 'ADMINISTRATION HOME',
    es: 'ESPACIO DE ADMINISTRACIÓN',
    de: 'VERWALTUNGSBEREICH',
    pt: 'ESPAÇO DA ADMINISTRAÇÃO',
  },
  MANAGER_HOME: {
    ar: 'فضاء المدير المساعد / المسير',
    fr: 'ESPACE DIRECTION / MANAGER',
    en: 'MANAGER HOME',
    es: 'ESPACIO DE DIRECCIÓN / GESTIÓN',
    de: 'LEITUNGS- / MANAGERBEREICH',
    pt: 'ESPAÇO DE DIREÇÃO / GESTÃO',
  },
  OWNER_HOME: {
    ar: 'فضاء مالك المدرسة / المدير العام',
    fr: 'ESPACE FONDATEUR / DIRECTEUR',
    en: 'SCHOOL OWNER HOME',
    es: 'ESPACIO DEL PROPIETARIO / DIRECTOR',
    de: 'SCHULLEITUNGS- / INHABERBEREICH',
    pt: 'ESPAÇO DO PROPRIETÁRIO / DIRETOR',
  },
  APPLICATION_STATUS: {
    ar: 'حالة طلب الحساب',
    fr: 'STATUT DE LA DEMANDE',
    en: 'APPLICATION STATUS',
    es: 'ESTADO DE LA SOLICITUD',
    de: 'ANTRAGSSTATUS',
    pt: 'ESTADO DO PEDIDO',
  },
};

export const HOMEPAGE_COMMON_TEXT = {
  mainHeadline: {
    ar: 'كل ما يهمك، بوضوح ودون تعقيد.',
    fr: 'Tout l’essentiel, sans encombrement.',
    en: 'Everything important, without the clutter.',
    es: 'Todo lo importante, con claridad y sin complicaciones.',
    de: 'Alles Wichtige klar und ohne Unübersichtlichkeit.',
    pt: 'Tudo o que importa, com clareza e sem complicações.',
  },
  publicHeadline: {
    ar: 'الحياة المدرسية في لمحة',
    fr: 'La vie scolaire en un coup d’œil',
    en: 'School life at a glance',
    es: 'La vida escolar de un vistazo',
    de: 'Schulleben auf einen Blick',
    pt: 'A vida escolar num relance',
  },
  publicSubtitle: {
    ar: 'معلومات المدرسة العامة دون كشف بيانات التلاميذ أو الأقسام الخاصة.',
    fr: 'Informations publiques de l’école sans exposer les données privées des élèves ou des classes.',
    en: 'Public school information without exposing student/private class data.',
    es: 'Información pública de la escuela sin exponer datos privados de alumnos o clases.',
    de: 'Öffentliche Schulinformationen ohne Offenlegung privater Schüler- oder Klassendaten.',
    pt: 'Informações públicas da escola sem expor dados privados de alunos ou turmas.',
  },
  openAction: {
    ar: 'فتح',
    fr: 'Ouvrir',
    en: 'Open',
    es: 'Abrir',
    de: 'Öffnen',
    pt: 'Abrir',
  },
  readOnlyAction: {
    ar: 'عرض فقط',
    fr: 'Consulter',
    en: 'View',
    es: 'Ver',
    de: 'Ansehen',
    pt: 'Ver',
  },
  comingSoonBadge: {
    ar: 'قريباً',
    fr: 'Bientôt',
    en: 'Coming soon',
    es: 'Próximamente',
    de: 'Demnächst',
    pt: 'Em breve',
  },
  backendBlockedBadge: {
    ar: 'بانتظار الخادم',
    fr: 'Serveur requis',
    en: 'Pending backend',
    es: 'Pendiente del servidor',
    de: 'Server erforderlich',
    pt: 'A aguardar servidor',
  },
  readOnlyBadge: {
    ar: 'قراءة فقط',
    fr: 'Lecture seule',
    en: 'Read-only',
    es: 'Solo lectura',
    de: 'Nur lesen',
    pt: 'Só de leitura',
  },
  publicSiteNav: {
    ar: 'الموقع العام',
    fr: 'Site public',
    en: 'Public Site',
    es: 'Sitio público',
    de: 'Öffentliche Seite',
    pt: 'Site público',
  },
  classesNav: {
    ar: 'الأقسام والتلاميذ',
    fr: 'Classes',
    en: 'Classes',
    es: 'Clases',
    de: 'Klassen',
    pt: 'Turmas',
  },
  oversightBannerPrefix: {
    ar: 'معاينة فضاء الدور بصلاحية إشرافية دون انتحال هوية:',
    fr: 'Inspection de l’espace de rôle sans usurpation d’identité :',
    en: 'Viewing role workspace in non-impersonating oversight mode:',
    es: 'Vista de supervisión del espacio de rol sin suplantación de identidad:',
    de: 'Ansicht des Rollenbereichs im Aufsichtsmodus ohne Identitätswechsel:',
    pt: 'Visualização do espaço da função em modo de supervisão sem usurpação:',
  },
  returnToMyHome: {
    ar: 'العودة إلى صفحتي الرئيسية',
    fr: 'Retour à mon accueil',
    en: 'Return to My Home',
    es: 'Volver a mi inicio',
    de: 'Zurück zu meiner Startseite',
    pt: 'Voltar ao meu início',
  },
};
