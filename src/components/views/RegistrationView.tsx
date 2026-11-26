import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { EnrollmentApplicationStatus } from '../../types';
import { canReviewEnrollmentsUi } from '../homepages/homepageAccess';
import { getCurrentNotificationTarget, getNotificationActorKey, resolveNotificationTarget, type NotificationTargetIntent } from '../../lib/notificationTargetNavigation';
import { pickText } from '../../i18n/homepages';
import {
  CANONICAL_SCHOOL_LEVELS,
  reviewEnrollmentApplication,
  submitEnrollmentApplication,
  type SubmitEnrollmentReceipt,
} from '../../lib/schoolOperations';
import { EnrollmentApplicationsQueueSection } from './registration/EnrollmentApplicationsQueueSection';
import { CheckCircle2, Send, AlertCircle } from 'lucide-react';

export const RegistrationView: React.FC<{ notificationTarget?: NotificationTargetIntent | null }> = ({ notificationTarget = null }) => {
  const {
    currentUser,
    enrollmentApplications,
    enrollmentsStatus,
    enrollmentsError,
    isHydratingSchoolData,
    language,
    refreshSchoolData,
    t,
  } = useApp();

  const [submitted, setSubmitted] = useState(false);
  const [receipt, setReceipt] = useState<SubmitEnrollmentReceipt | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [formData, setFormData] = useState({
    childName: '',
    birthDate: '',
    level: 'CP',
    parentName: '',
    phone: '',
    email: '',
    notes: '',
  });

  const [reviewDecisionMap, setReviewDecisionMap] = useState<
    Record<string, Exclude<EnrollmentApplicationStatus, 'DRAFT' | 'SUBMITTED'>>
  >({});
  const [reviewNoteMap, setReviewNoteMap] = useState<Record<string, string>>({});
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const canReview = canReviewEnrollmentsUi(currentUser);
  const showApplicationsSection = currentUser?.accountStatus === 'APPROVED';
  const notificationIntent = getCurrentNotificationTarget(notificationTarget, getNotificationActorKey(currentUser), 'registration');
  const notificationResolution = resolveNotificationTarget(notificationIntent, getNotificationActorKey(currentUser), enrollmentsStatus, isHydratingSchoolData, enrollmentApplications);

  useEffect(() => {
    if (notificationIntent && notificationResolution.state === 'found') {
      document.getElementById(`notification-enrollment-${notificationResolution.record.id}`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [notificationIntent?.requestId, notificationResolution.state, notificationResolution.record?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg('');
    setSubmitted(false);
    setReceipt(null);
    setSubmitting(true);

    try {
      const res = await submitEnrollmentApplication({
        studentFullName: formData.childName,
        birthDate: formData.birthDate,
        desiredLevelCode: formData.level,
        parentFullName: formData.parentName,
        phone: formData.phone,
        email: formData.email,
        notes: formData.notes,
      });

      if (!res.ok || !res.data) {
        setErrorMsg(
          res.status === 'BLOCKED_BACKEND'
            ? pickText(
                {
                  ar: 'بوابة التسجيل بانتظار تفعيل جدول طلبات الالتحاق في Supabase. لم يتم تسجيل أي طلب وهمي.',
                  fr: 'Le service d’inscription en ligne attend le déploiement du contrat Supabase. Aucune demande fictive enregistrée.',
                  en: 'Enrollment submission is awaiting verified Supabase backend deployment. No fake request was stored.',
                  es: 'El envío de matrículas espera el despliegue verificado en Supabase. No se guardó ninguna solicitud ficticia.',
                  de: 'Die Einschreibungsübermittlung wartet auf die bestätigte Supabase-Bereitstellung. Es wurde kein Scheinantrag gespeichert.',
                  pt: 'A submissão de inscrições aguarda a implantação verificada no Supabase. Não foi guardado qualquer pedido fictício.',
                },
                language,
              )
            : res.errorMessage || res.errorCode || t('error'),
        );
        return;
      }

      setReceipt(res.data);
      setSubmitted(true);
      setFormData({
        childName: '',
        birthDate: '',
        level: 'CP',
        parentName: '',
        phone: '',
        email: '',
        notes: '',
      });
      await refreshSchoolData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewSave = async (appId: string, currentStatus: EnrollmentApplicationStatus, expectedVersion: number) => {
    if (reviewingId || enrollmentsStatus === 'UNAUTHORIZED') return;
    setReviewFeedback(null);
    setReviewingId(appId);
    const fallbackDecision: Exclude<EnrollmentApplicationStatus, 'DRAFT' | 'SUBMITTED'> =
      currentStatus !== 'DRAFT' && currentStatus !== 'SUBMITTED' ? currentStatus : 'UNDER_REVIEW';
    const decision = reviewDecisionMap[appId] ?? fallbackDecision;
    const reviewNote = reviewNoteMap[appId] ?? '';

    try {
      const res = await reviewEnrollmentApplication({
        applicationId: appId,
        decision,
        reviewNote,
        expectedVersion,
      });

      if (!res.ok) {
        setReviewFeedback({
          type: 'error',
          text: res.errorMessage || res.errorCode || t('error'),
        });
        return;
      }

      setReviewFeedback({
        type: 'success',
        text: pickText(
          {
            ar: 'تم تحديث حالة ملف التسجيل بنجاح.',
            fr: 'Dossier mis à jour.',
            en: 'Enrollment application updated.',
            es: 'Solicitud de matrícula actualizada.',
            de: 'Einschreibungsantrag aktualisiert.',
            pt: 'Pedido de inscrição atualizado.',
          },
          language,
        ),
      });
      await refreshSchoolData();
    } catch (err) {
      setReviewFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : t('error'),
      });
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12" data-testid="registration-view">
      {/* Header */}
      <div className="bg-white dark:bg-[#111111] p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm text-center">
        <img
          src="/assets/kristou-logo.png"
          alt="KRISTOU SCHOOL"
          className="w-14 h-14 rounded-2xl object-contain bg-white dark:bg-gray-800 p-1 mx-auto mb-3 shadow-md border border-gray-200 dark:border-gray-700"
        />
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">
          {t('registrationTitle')}
        </h1>
        <p className="text-xs text-gray-500 max-w-lg mx-auto">
          {t('registrationDescription')}
        </p>
      </div>

      {submitted && receipt ? (
        <div
          data-testid="registration-success-receipt"
          className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-8 rounded-3xl text-center space-y-3"
        >
          <CheckCircle2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400 mx-auto" />
          <h3 className="font-bold text-lg text-emerald-900 dark:text-emerald-300">{t('registrationSaved')}</h3>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-emerald-300 dark:border-emerald-800 text-xs font-mono font-extrabold text-emerald-800 dark:text-emerald-300">
            <span>{receipt.referenceCode}</span>
            <span>•</span>
            <span>{receipt.status}</span>
          </div>
          <p className="text-xs text-emerald-700 dark:text-emerald-400 max-w-md mx-auto">
            {t('registrationSavedBody')}
          </p>
          <button
            type="button"
            onClick={() => {
              setSubmitted(false);
              setReceipt(null);
            }}
            className="px-6 py-2.5 bg-emerald-600 text-white font-semibold text-xs rounded-xl shadow-md hover:bg-emerald-700 transition-all mt-4"
          >
            {t('newRequest')}
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#111111] p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm">
          {errorMsg && (
            <div
              data-testid="registration-error-banner"
              role="alert"
              className="mb-4 p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs font-semibold flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('studentName')}</label>
                <input
                  type="text"
                  required
                  value={formData.childName}
                  onChange={(e) => setFormData({ ...formData, childName: e.target.value })}
                  placeholder="Yasmine Ben Salah"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('birthDate')}</label>
                <input
                  type="date"
                  required
                  value={formData.birthDate}
                  onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('desiredLevel')}</label>
                <select
                  value={formData.level}
                  onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs text-gray-900 dark:text-white"
                >
                  {CANONICAL_SCHOOL_LEVELS.map((lvl) => (
                    <option key={lvl.code} value={lvl.code}>
                      {language === 'ar' ? lvl.labelAr : language === 'fr' ? lvl.labelFr : lvl.labelEn}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('parentName')}</label>
                <input
                  type="text"
                  required
                  value={formData.parentName}
                  onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                  placeholder="Karim Ben Salah"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('phone')}</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+216 98 000 000"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('optionalEmail')}</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="parent@example.com"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                {pickText({ ar: 'ملاحظات إضافية (اختياري)', fr: 'Remarques complémentaires (optionnel)', en: 'Additional Notes (optional)', es: 'Notas adicionales (opcional)', de: 'Zusätzliche Hinweise (optional)', pt: 'Notas adicionais (opcional)' }, language)}
              </label>
              <textarea
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs text-gray-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-k-brand hover:bg-k-brand-strong text-white font-bold text-sm rounded-xl shadow-lg shadow-k-brand/25 transition-all flex items-center justify-center space-x-2 rtl:space-x-reverse mt-4 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? t('loading') : t('submitRegistration')}</span>
            </button>
          </form>
        </div>
      )}

      {showApplicationsSection && (
        <EnrollmentApplicationsQueueSection
          language={language}
          canReview={canReview}
          enrollmentApplications={enrollmentApplications}
          enrollmentsStatus={enrollmentsStatus}
          enrollmentsError={enrollmentsError}
          isHydratingSchoolData={isHydratingSchoolData}
          notificationIntent={notificationIntent}
          notificationUnavailable={Boolean(notificationIntent && notificationResolution.state === 'unavailable')}
          reviewFeedback={reviewFeedback}
          reviewDecisionMap={reviewDecisionMap}
          setReviewDecisionMap={setReviewDecisionMap}
          reviewNoteMap={reviewNoteMap}
          setReviewNoteMap={setReviewNoteMap}
          reviewingId={reviewingId}
          onReviewSave={(id, status, ver) => void handleReviewSave(id, status, ver)}
          onRefresh={() => void refreshSchoolData()}
          t={t}
        />
      )}
    </div>
  );
};
