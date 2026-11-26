import React, { useRef, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { pickText } from '../../../i18n/homepages';
import { isSafeExternalOrAssetUrl } from '../../../lib/schoolContent';
import { submitPublicInquiry } from '../../../lib/schoolOperations';
import { canAccessAppTab, canManagePublicContentUi } from '../homepageAccess';

export const ASSET = '/assets/kristou-home/';

export const PUBLIC_CAMPUS_PHOTOS = [
  `${ASSET}school-building.png`,
  `${ASSET}hero-schoolchildren.png`,
  `${ASSET}enrollment-children.png`,
  `${ASSET}canteen-meal.png`,
  `${ASSET}announcement-school.png`,
  `${ASSET}announcement-bardo.png`,
].filter((url) => isSafeExternalOrAssetUrl(url));

export interface PublicInquiryFormState {
  senderName: string;
  phone: string;
  email: string;
  subject: string;
  message: string;
}

export interface UsePublicHomePageParams {
  setActiveTab: (tab: string) => void;
  onOpenAuth: (mode?: 'signin' | 'register') => void;
  onNavigateToSubTab?: (tab: 'community' | 'directory', subTab: string) => void;
}

export function usePublicHomePage({
  setActiveTab,
  onOpenAuth,
  onNavigateToSubTab,
}: UsePublicHomePageParams) {
  const {
    language,
    t,
    announcements,
    broadcastsStatus,
    broadcastsError,
    foodMenu,
    foodMenuStatus,
    foodMenuError,
    publicContent,
    publicContentStatus,
    publicContentError,
    currentUser,
    refreshSchoolData,
  } = useApp();

  const exploreSectionRef = useRef<HTMLDivElement | null>(null);
  const levelsSectionRef = useRef<HTMLDivElement | null>(null);
  const activitiesSectionRef = useRef<HTMLDivElement | null>(null);
  const gallerySectionRef = useRef<HTMLDivElement | null>(null);
  const announcementsSectionRef = useRef<HTMLDivElement | null>(null);
  const contactSectionRef = useRef<HTMLDivElement | null>(null);

  const [inquiryForm, setInquiryForm] = useState<PublicInquiryFormState>({
    senderName: '',
    phone: '',
    email: '',
    subject: '',
    message: '',
  });
  const [inquirySubmitting, setInquirySubmitting] = useState(false);
  const [inquiryFeedback, setInquiryFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const broadcastsHasError = broadcastsStatus === 'ERROR' || broadcastsStatus === 'UNAUTHORIZED';
  const foodMenuHasError = foodMenuStatus === 'ERROR' || foodMenuStatus === 'UNAUTHORIZED';
  const publicContentHasError =
    publicContentStatus === 'ERROR' || publicContentStatus === 'UNAUTHORIZED';
  const canManagePublicContent = canManagePublicContentUi(currentUser);
  const publishedCmsSlugs = Object.keys(publicContent ?? {}).filter(
    (slug) => publicContent?.[slug]?.isPublished,
  );

  const publicAnnouncements = broadcastsHasError
    ? []
    : announcements.filter(
        (a) =>
          !a.classId &&
          (a.isDemoPreview === true ||
            (a.isPublic === true &&
              a.audienceScope === 'PUBLIC_SITE' &&
              'status' in a &&
              a.status === 'PUBLISHED')),
      );

  const isAnnouncementsDemo =
    !broadcastsHasError &&
    (broadcastsStatus === 'BLOCKED_BACKEND' ||
      publicAnnouncements.some((a) => a.isDemoPreview === true));
  const isMenuDemo =
    !foodMenuHasError &&
    (foodMenu.isDemoPreview === true || foodMenuStatus === 'BLOCKED_BACKEND');

  const pickPublicEntry = (slug: string, field: 'title' | 'body'): string | null => {
    if (publicContentHasError) return null;
    const entry = publicContent?.[slug];
    if (!entry || !entry.isPublished) return null;
    const raw =
      field === 'title'
        ? language === 'ar'
          ? entry.titleAr
          : language === 'fr'
          ? entry.titleFr
          : entry.titleEn
        : language === 'ar'
        ? entry.bodyAr
        : language === 'fr'
        ? entry.bodyFr
        : entry.bodyEn;
    return raw && raw.trim() ? raw.trim() : null;
  };

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInquiryFeedback(null);
    setInquirySubmitting(true);
    const res = await submitPublicInquiry(inquiryForm);
    setInquirySubmitting(false);
    if (!res.ok) {
      setInquiryFeedback({
        type: 'error',
        message:
          res.status === 'BLOCKED_BACKEND'
            ? pickText(
                {
                  ar: 'بوابة استفسارات الموقع العام بانتظار نشر جدول الخادم (Supabase). لا يتم حفظ استفسارات وهمية.',
                  fr: 'Le formulaire de contact public attend le déploiement de la table Supabase.',
                  en: 'Public inquiry persistence is awaiting Supabase backend deployment. No fake local submission saved.',
                  es: 'El formulario de contacto público espera el despliegue de la tabla en Supabase. No se guardó ningún envío ficticio.',
                  de: 'Das öffentliche Anfrageformular wartet auf die Supabase-Bereitstellung. Keine lokale Scheinspeicherung.',
                  pt: 'O formulário de contacto público aguarda a tabela no Supabase. Nenhum envio fictício foi guardado.',
                },
                language,
              )
            : res.errorMessage || t('error'),
      });
      return;
    }
    setInquiryFeedback({
      type: 'success',
      message: pickText(
        {
          ar: 'تم استلام استفساركم بنجاح وحفظه لدى إدارة المدرسة.',
          fr: 'Votre demande a été enregistrée auprès du secrétariat de l’école.',
          en: 'Your public school inquiry was saved with school administration.',
          es: 'Tu consulta se guardó correctamente en la administración escolar.',
          de: 'Ihre Anfrage wurde erfolgreich bei der Schulverwaltung gespeichert.',
          pt: 'O seu pedido foi guardado com sucesso na administração escolar.',
        },
        language,
      ),
    });
    setInquiryForm({ senderName: '', phone: '', email: '', subject: '', message: '' });
  };

  const scrollToRef = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openTeachers = () => {
    if (onNavigateToSubTab) {
      onNavigateToSubTab('directory', 'teachers');
    } else {
      setActiveTab('directory');
    }
  };

  const openAdministration = () => {
    if (onNavigateToSubTab) {
      onNavigateToSubTab('directory', 'admin');
    } else {
      setActiveTab('directory');
    }
  };

  const openPrivateCommunityShortcut = (subTab: 'homework' | 'announcements') => {
    if (canAccessAppTab(currentUser, 'community')) {
      if (onNavigateToSubTab) {
        onNavigateToSubTab('community', subTab);
      } else {
        setActiveTab('community');
      }
    } else {
      onOpenAuth('signin');
    }
  };

  return {
    language,
    t,
    currentUser,
    refreshSchoolData,
    broadcastsStatus,
    broadcastsError,
    broadcastsHasError,
    publicAnnouncements,
    isAnnouncementsDemo,
    foodMenu,
    foodMenuError,
    foodMenuHasError,
    isMenuDemo,
    publicContentStatus,
    publicContentError,
    publicContentHasError,
    canManagePublicContent,
    publishedCmsSlugs,
    pickPublicEntry,
    inquiryForm,
    setInquiryForm,
    inquirySubmitting,
    inquiryFeedback,
    handleInquirySubmit,
    exploreSectionRef,
    levelsSectionRef,
    activitiesSectionRef,
    gallerySectionRef,
    announcementsSectionRef,
    contactSectionRef,
    scrollToRef,
    openTeachers,
    openAdministration,
    openPrivateCommunityShortcut,
  };
}
