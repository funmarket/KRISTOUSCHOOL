import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { respondPublicInquiry } from '../../lib/schoolOperations';
import { HomePageHeader } from './shared/HomePageHeader';
import { HomeShortcutCard } from './shared/HomeShortcutCard';
import { HomeCardGrid } from './shared/HomeCardGrid';
import { EmptyFeatureState } from './shared/EmptyFeatureState';
import { HOMEPAGE_BADGE_LABELS, HOMEPAGE_COMMON_TEXT, pickText } from '../../i18n/homepages';

export interface AdministrativePersonnelHomePageProps {
  setActiveTab: (tab: string) => void;
  onNavigateToSubTab?: (tab: 'community' | 'directory', subTab: string) => void;
}

export const AdministrativePersonnelHomePage: React.FC<
  AdministrativePersonnelHomePageProps
> = ({ setActiveTab, onNavigateToSubTab }) => {
  const {
    language,
    currentUser,
    operationalCounts,
    publicInquiries,
    inquiriesStatus,
    refreshSchoolData,
  } = useApp();

  const [selectedOfficeFeature, setSelectedOfficeFeature] = useState<{
    title: string;
    description: string;
  } | null>(null);
  const [showOfficeDesk, setShowOfficeDesk] = useState(false);
  const [replyByInquiry, setReplyByInquiry] = useState<Record<string, string>>({});
  const [statusByInquiry, setStatusByInquiry] = useState<Record<string, 'NEW' | 'IN_PROGRESS' | 'RESOLVED'>>({});
  const [deskFeedback, setDeskFeedback] = useState<string>('');
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const capabilities = Array.isArray(currentUser?.capabilities) ? currentUser.capabilities : [];
  const hasPickupAssist =
    capabilities.includes('PICKUP_RELEASE') || capabilities.includes('PICKUP_DESK');

  const openCommunitySubTab = (subTab: string) => {
    if (onNavigateToSubTab) {
      onNavigateToSubTab('community', subTab);
    } else {
      setActiveTab('community');
    }
  };

  const handleInquiryResponse = async (inquiryId: string, currentStatus: 'NEW' | 'IN_PROGRESS' | 'RESOLVED') => {
    setDeskFeedback('');
    setSubmittingId(inquiryId);
    const nextStatus = statusByInquiry[inquiryId] ?? (currentStatus === 'NEW' ? 'IN_PROGRESS' : 'RESOLVED');
    const staffResponse = replyByInquiry[inquiryId] ?? '';
    const res = await respondPublicInquiry(inquiryId, nextStatus, staffResponse);
    setSubmittingId(null);
    if (!res.ok) {
      setDeskFeedback(
        res.errorMessage ||
          pickText(
            {
              ar: 'تعذر حفظ الرد عبر الخادم.',
              fr: 'Impossible d’enregistrer la réponse côté serveur.',
              en: 'Unable to save inquiry response on the server.',
            },
            language,
          ),
      );
      return;
    }
    setDeskFeedback(
      pickText(
        {
          ar: 'تم تحديث حالة الاستفسار وحفظ الرد بنجاح.',
          fr: 'Demande mise à jour et réponse enregistrée.',
          en: 'Inquiry updated and response saved.',
        },
        language,
      ),
    );
    await refreshSchoolData();
  };

  const openActionLabel = pickText(HOMEPAGE_COMMON_TEXT.openAction, language);
  const comingSoonLabel = pickText(HOMEPAGE_COMMON_TEXT.comingSoonBadge, language);

  return (
    <div className="kh-role-page" data-testid="homepage-ADMINISTRATIVE_PERSONNEL_HOME">
      <HomePageHeader
        badgeText={pickText(HOMEPAGE_BADGE_LABELS.ADMINISTRATIVE_PERSONNEL_HOME, language)}
        title={pickText(HOMEPAGE_COMMON_TEXT.mainHeadline, language)}
        subtitle={pickText(
          {
            ar: 'مكتب الإدارة المدرسية لمتابعة ملفات التسجيل، استفسارات العائلات، الوثائق، والروزنامة الإدارية.',
            fr: 'Espace secrétariat et administration : dossiers d’admission, demandes des familles, documents et calendrier.',
            en: 'School office administration workspace for admissions intake, family inquiries, documents, and notices.',
          },
          language,
        )}
      />

      {selectedOfficeFeature && (
        <EmptyFeatureState
          state="COMING_SOON"
          title={selectedOfficeFeature.title}
          description={selectedOfficeFeature.description}
          onClose={() => setSelectedOfficeFeature(null)}
        />
      )}

      {showOfficeDesk && (
        <section
          data-testid="admin-personnel-office-desk-panel"
          className="kh-info-panel mb-6 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="kh-info-panel-title">
              {pickText(
                { ar: 'مكتب الاستقبال والاستفسارات العامة', fr: 'Bureau d’accueil & Demandes publiques', en: 'Office Desk & Public Inquiries' },
                language,
              )}
            </h2>
            <button
              type="button"
              onClick={() => setShowOfficeDesk(false)}
              className="rounded-xl border border-slate-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-bold"
            >
              {pickText({ ar: 'إغلاق', fr: 'Fermer', en: 'Close' }, language)}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-3">
              <span className="text-slate-500 font-bold">{pickText({ ar: 'الأقسام النشطة', fr: 'Classes actives', en: 'Active Classes' }, language)}</span>
              <div className="text-lg font-black mt-0.5">{operationalCounts.activeClasses ?? 0}</div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-3">
              <span className="text-slate-500 font-bold">{pickText({ ar: 'التلاميذ المسجلون', fr: 'Élèves inscrits', en: 'Active Students' }, language)}</span>
              <div className="text-lg font-black mt-0.5">{operationalCounts.activeStudents ?? 0}</div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-3">
              <span className="text-slate-500 font-bold">{pickText({ ar: 'ملفات التسجيل المعلقة', fr: 'Admissions en attente', en: 'Pending Admissions' }, language)}</span>
              <div className="text-lg font-black mt-0.5">{operationalCounts.pendingAdmissions ?? 0}</div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-3">
              <span className="text-slate-500 font-bold">{pickText({ ar: 'استفسارات مفتوحة', fr: 'Demandes ouvertes', en: 'Open Inquiries' }, language)}</span>
              <div className="text-lg font-black mt-0.5">{operationalCounts.openInquiries ?? 0}</div>
            </div>
          </div>

          {deskFeedback && (
            <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-xs font-bold">
              {deskFeedback}
            </div>
          )}

          {inquiriesStatus !== 'READY' ? (
            <EmptyFeatureState
              state="BLOCKED_BACKEND"
              title={pickText(
                { ar: 'صندوق الاستفسارات بانتظار الخادم', fr: 'Demandes en attente du serveur', en: 'Public Inquiries Awaiting Backend' },
                language,
              )}
              description={pickText(
                { ar: 'يتطلب عرض وتحديث استفسارات الموقع العام نشر جداول public_school_inquiries في Supabase.', fr: 'La table Supabase public_school_inquiries doit être déployée.', en: 'Requires deployed public.public_school_inquiries table and RPCs.' },
                language,
              )}
            />
          ) : publicInquiries.length === 0 ? (
            <p className="text-xs text-slate-500">
              {pickText(
                { ar: 'لا توجد استفسارات واردة حالياً.', fr: 'Aucune demande reçue pour le moment.', en: 'No public inquiries submitted yet.' },
                language,
              )}
            </p>
          ) : (
            <div className="space-y-3">
              {publicInquiries.map((inq) => (
                <div
                  key={inq.id}
                  className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-3.5 space-y-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-extrabold">{inq.subject}</span>
                      <span className="ms-2 text-slate-500">
                        — {inq.senderName} {inq.phone ? `(${inq.phone})` : ''} {inq.email ? `• ${inq.email}` : ''}
                      </span>
                    </div>
                    <span className="kh-info-chip">{inq.status}</span>
                  </div>
                  <p className="text-slate-600 dark:text-zinc-300">{inq.message}</p>
                  {inq.staffResponse && (
                    <p className="text-emerald-700 dark:text-emerald-300 font-semibold">
                      {pickText({ ar: 'الرد المسجل:', fr: 'Réponse enregistrée :', en: 'Recorded reply:' }, language)} {inq.staffResponse}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <select
                      value={statusByInquiry[inq.id] ?? inq.status}
                      onChange={(e) =>
                        setStatusByInquiry((prev) => ({
                          ...prev,
                          [inq.id]: e.target.value as 'NEW' | 'IN_PROGRESS' | 'RESOLVED',
                        }))
                      }
                      className="rounded-xl border border-slate-300 dark:border-zinc-700 bg-transparent px-2.5 py-1.5 text-xs font-bold"
                    >
                      <option value="NEW">NEW</option>
                      <option value="IN_PROGRESS">IN_PROGRESS</option>
                      <option value="RESOLVED">RESOLVED</option>
                    </select>
                    <input
                      type="text"
                      value={replyByInquiry[inq.id] ?? inq.staffResponse ?? ''}
                      onChange={(e) =>
                        setReplyByInquiry((prev) => ({ ...prev, [inq.id]: e.target.value }))
                      }
                      placeholder={pickText({ ar: 'ملاحظة أو رد الإدارة...', fr: 'Réponse du secrétariat...', en: 'Office response note...' }, language)}
                      className="flex-1 min-w-[180px] rounded-xl border border-slate-300 dark:border-zinc-700 bg-transparent px-3 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      disabled={submittingId === inq.id}
                      onClick={() => void handleInquiryResponse(inq.id, inq.status)}
                      className="rounded-xl bg-[#0D8AE8] px-3 py-1.5 text-xs font-extrabold text-white disabled:opacity-50"
                    >
                      {pickText({ ar: 'حفظ', fr: 'Enregistrer', en: 'Save' }, language)}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Administrative Office Cards (Section 10.2) — strictly separated from Owner/Manager governance */}
      <HomeCardGrid ariaLabel="Administrative personnel cards">
        <HomeShortcutCard
          id="admin-personnel-office-desk"
          title={pickText(
            { ar: 'مكتب الاستقبال والإدارة', fr: 'Bureau d’accueil', en: 'Office Desk' },
            language,
          )}
          actionLabel={openActionLabel}
          icon="🗂️"
          tone="slate"
          onClick={() => setShowOfficeDesk((prev) => !prev)}
        />

        <HomeShortcutCard
          id="admin-personnel-admission-files"
          title={pickText(
            { ar: 'ملفات القبول والتسجيل', fr: 'Dossiers d’admission', en: 'Admission Files' },
            language,
          )}
          actionLabel={openActionLabel}
          icon="📋"
          tone="orange"
          onClick={() => setActiveTab('registration')}
        />

        <HomeShortcutCard
          id="admin-personnel-family-inquiries"
          title={pickText(
            { ar: 'استفسارات العائلات', fr: 'Demandes des familles', en: 'Family Inquiries' },
            language,
          )}
          actionLabel={openActionLabel}
          icon="✉️"
          tone="purple"
          onClick={() => setActiveTab('messages')}
        />

        <HomeShortcutCard
          id="admin-personnel-attendance"
          title={pickText(
            { ar: 'متابعة الحضور', fr: 'Suivi des présences', en: 'Attendance' },
            language,
          )}
          actionLabel={comingSoonLabel}
          statusBadge={comingSoonLabel}
          state="COMING_SOON"
          icon="📅"
          tone="green"
          onClick={() =>
            setSelectedOfficeFeature({
              title: pickText(
                { ar: 'سجل الحضور الإداري', fr: 'Registre administratif des présences', en: 'Administrative Attendance Log' },
                language,
              ),
              description: pickText(
                {
                  ar: 'وحدة المتابعة الإدارية للغيابات والتأخير ستتوفر عند ربط جدول الحضور في الخادم.',
                  fr: 'Le suivi administratif des absences sera activé avec le contrat serveur correspondant.',
                  en: 'Administrative attendance tracking is marked Coming Soon pending backend attendance persistence.',
                },
                language,
              ),
            })
          }
        />

        <HomeShortcutCard
          id="admin-personnel-forms-documents"
          title={pickText(
            { ar: 'الاستمارات والوثائق', fr: 'Formulaires & Documents', en: 'Forms & Documents' },
            language,
          )}
          actionLabel={openActionLabel}
          icon="📄"
          tone="blue"
          onClick={() => openCommunitySubTab('documents')}
        />

        <HomeShortcutCard
          id="admin-personnel-school-calendar"
          title={pickText(
            { ar: 'الروزنامة المدرسية', fr: 'Calendrier scolaire', en: 'School Calendar' },
            language,
          )}
          actionLabel={openActionLabel}
          icon="🗓️"
          tone="yellow"
          onClick={() => setActiveTab('announcements')}
        />

        <HomeShortcutCard
          id="admin-personnel-notices"
          title={pickText(
            { ar: 'المذكرات والإعلانات', fr: 'Notes & Annonces', en: 'Notices' },
            language,
          )}
          actionLabel={openActionLabel}
          icon="📢"
          tone="red"
          onClick={() => setActiveTab('announcements')}
        />

        <HomeShortcutCard
          id="admin-personnel-work-queue"
          title={pickText(
            { ar: 'قائمة عملي اليومية', fr: 'Ma file de traitement', en: 'My Work Queue' },
            language,
          )}
          actionLabel={comingSoonLabel}
          statusBadge={comingSoonLabel}
          state="COMING_SOON"
          icon="📌"
          tone="teal"
          onClick={() =>
            setSelectedOfficeFeature({
              title: pickText(
                { ar: 'قائمة المعاملات الإدارية', fr: 'Ma file de traitement administratif', en: 'My Administrative Work Queue' },
                language,
              ),
              description: pickText(
                {
                  ar: 'قائمة المعاملات الإدارية المخصصة قيد الربط بالخادم دون أي تعديل محلي وهمي.',
                  fr: 'La file de traitement administratif sera connectée au contrat serveur Supabase.',
                  en: 'Administrative work queue persistence is marked Coming Soon until the backend contract is deployed.',
                },
                language,
              ),
            })
          }
        />

        {hasPickupAssist && (
          <HomeShortcutCard
            id="admin-personnel-pickup-assist"
            title={pickText(
              { ar: 'مساندة الاستلام المدرسي', fr: 'Assistance Sortie', en: 'Pickup Assistance' },
              language,
            )}
            actionLabel={openActionLabel}
            icon="🚸"
            tone="green"
            onClick={() => setActiveTab('pickup')}
          />
        )}
      </HomeCardGrid>
    </div>
  );
};
