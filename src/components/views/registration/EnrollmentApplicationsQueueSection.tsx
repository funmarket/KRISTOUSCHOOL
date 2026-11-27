import React, {useEffect, useState} from 'react';
import {getEnrollmentQueue,getEnrollmentReviewDecisions,getEnrollmentReviewAccess,type EnrollmentQueue} from '../../../lib/domains/enrollment';
import {CompleteAdmissionForm} from './CompleteAdmissionForm';
import { pickText } from '../../../i18n/homepages';
import type { NotificationTargetIntent } from '../../../lib/notificationTargetNavigation';
import type { EnrollmentApplication, EnrollmentApplicationStatus, Language } from '../../../types';
import { EmptyFeatureState } from '../../homepages/shared/EmptyFeatureState';
import { AlertCircle, CheckCircle2, FileText, Lock } from 'lucide-react';

interface EnrollmentApplicationsQueueSectionProps {
  language: Language;
  canReview: boolean;
  enrollmentApplications: EnrollmentApplication[];
  enrollmentsStatus: string;
  enrollmentsError: string | null;
  isHydratingSchoolData: boolean;
  notificationIntent: NotificationTargetIntent | null;
  notificationUnavailable: boolean;
  reviewFeedback: { type: 'error' | 'success'; text: string } | null;
  reviewDecisionMap: Record<string, Exclude<EnrollmentApplicationStatus, 'DRAFT' | 'SUBMITTED'>>;
  setReviewDecisionMap: React.Dispatch<
    React.SetStateAction<Record<string, Exclude<EnrollmentApplicationStatus, 'DRAFT' | 'SUBMITTED'>>>
  >;
  reviewNoteMap: Record<string, string>;
  setReviewNoteMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  reviewingId: string | null;
  onReviewSave: (appId: string, currentStatus: EnrollmentApplicationStatus, expectedVersion: number) => void;
  onRefresh: () => void;
  t: (key: 'loading' | 'save') => string;
}

export const EnrollmentApplicationsQueueSection: React.FC<EnrollmentApplicationsQueueSectionProps> = ({
  language,
  canReview: canReviewHint,
  enrollmentApplications,
  enrollmentsStatus,
  enrollmentsError,
  isHydratingSchoolData,
  notificationIntent,
  notificationUnavailable,
  reviewFeedback,
  reviewDecisionMap,
  setReviewDecisionMap,
  reviewNoteMap,
  setReviewNoteMap,
  reviewingId,
  onReviewSave,
  onRefresh,
  t,
}) => {
  const [queue,setQueue] = useState<EnrollmentQueue>('pending');
  const [serverReviewAccess,setServerReviewAccess] = useState(false);
  useEffect(() => {
    let active=true;
    void getEnrollmentReviewAccess().then(result => { if(active) setServerReviewAccess(result.ok && result.data===true); });
    return () => {active=false;};
  },[]);
  const canReview=canReviewHint || serverReviewAccess;
  useEffect(() => {
    const target=enrollmentApplications.find(app => app.id===notificationIntent?.refId);
    if(target) setQueue(getEnrollmentQueue(target));
  },[notificationIntent?.requestId,enrollmentApplications]);
  const visibleApplications=canReview ? enrollmentApplications.filter(app=>getEnrollmentQueue(app)===queue) : enrollmentApplications;
  useEffect(() => {
    if(notificationIntent?.refId) document.getElementById(`notification-enrollment-${notificationIntent.refId}`)?.scrollIntoView?.({block:'nearest'});
  },[queue,notificationIntent?.requestId]);
  return (
  <div
    data-testid="enrollment-applications-section"
    className="bg-white dark:bg-[#111111] p-6 sm:p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4"
  >
    {notificationUnavailable && (
      <p role="status" data-testid="notification-target-unavailable" className="rounded-xl border border-amber-200 dark:border-amber-900 px-4 py-3 text-xs font-semibold text-amber-900 dark:text-amber-200">
        {pickText({ ar: 'العنصر المطلوب غير متاح أو ليس لديك إذن بالوصول إليه.', fr: 'Cet élément est indisponible ou vous n’avez pas le droit d’y accéder.', en: 'Requested item is unavailable or you do not have access.', es: 'El elemento solicitado no está disponible o no tiene acceso.', de: 'Das angeforderte Element ist nicht verfügbar oder Sie haben keinen Zugriff.', pt: 'O item solicitado está indisponível ou não tem permissão de acesso.' }, language)}
      </p>
    )}
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <h2 className="font-extrabold text-base text-gray-900 dark:text-white">
          {canReview
            ? pickText(
                { ar: 'ملفات طلبات التسجيل للمراجعة', fr: 'Dossiers d’inscription à traiter', en: 'Enrollment Applications Review Queue', es: 'Cola de revisión de solicitudes de matrícula', de: 'Prüfliste der Einschreibungsanträge', pt: 'Fila de revisão dos pedidos de inscrição' },
                language,
              )
            : pickText(
                { ar: 'طلبات التسجيل المقدمة من حسابك', fr: 'Vos demandes d’inscription', en: 'Your Submitted Enrollment Applications', es: 'Sus solicitudes de matrícula enviadas', de: 'Ihre eingereichten Einschreibungsanträge', pt: 'Os seus pedidos de inscrição enviados' },
                language,
              )}
        </h2>
      </div>
      <span className="text-xs font-bold text-gray-500">
        {enrollmentsStatus === 'UNAUTHORIZED' ? 0 : enrollmentApplications.length}
      </span>
    </div>

    {canReview && <div role="tablist" aria-label="Admission queues" className="flex flex-wrap gap-2">
      {(['pending','completion','history'] as const).map(value => <button key={value} type="button" role="tab" aria-selected={queue===value} onClick={()=>setQueue(value)} className={`px-3 py-2 rounded-xl text-xs font-bold ${queue===value?'bg-k-brand text-white':'bg-gray-100 dark:bg-zinc-800'}`}>
        {pickText(value==='pending'?{ar:'بانتظار المراجعة',fr:'À examiner',en:'Pending Review',es:'Pendientes',de:'Ausstehende Prüfung',pt:'Revisão pendente'}:value==='completion'?{ar:'مقبول — إتمام القبول مطلوب',fr:'Acceptées — à finaliser',en:'Accepted — Completion Needed',es:'Aceptadas — por completar',de:'Angenommen — Abschluss erforderlich',pt:'Aceites — por concluir'}:{ar:'المكتمل / السجل',fr:'Terminées / Historique',en:'Completed / History',es:'Completadas / Historial',de:'Abgeschlossen / Verlauf',pt:'Concluídas / Histórico'},language)} ({enrollmentApplications.filter(app=>getEnrollmentQueue(app)===value).length})
      </button>)}
    </div>}
    {reviewFeedback && (
      <div
        role={reviewFeedback.type === 'error' ? 'alert' : 'status'}
        className={`p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
          reviewFeedback.type === 'error'
            ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900'
            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
        }`}
      >
        {reviewFeedback.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
        <span>{reviewFeedback.text}</span>
      </div>
    )}

    {enrollmentsStatus === 'UNAUTHORIZED' && (
      <div
        data-testid="enrollments-unauthorized-state"
        role="alert"
        className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-6 rounded-3xl flex flex-wrap items-center justify-between gap-4 text-xs text-amber-900 dark:text-amber-200"
      >
        <div className="flex items-center gap-2 font-semibold">
          <Lock className="w-4 h-4 shrink-0" />
          <span>
            {enrollmentsError ||
              pickText(
                { ar: 'غير مصرح بالوصول إلى ملفات طلبات التسجيل.', fr: 'Accès non autorisé aux dossiers d’inscription.', en: 'Not authorized to access enrollment applications.', es: 'No autorizado para acceder a las solicitudes de matrícula.', de: 'Nicht berechtigt, auf Einschreibungsanträge zuzugreifen.', pt: 'Sem autorização para aceder aos pedidos de inscrição.' },
                language,
              )}
          </span>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs"
        >
          {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry', es: 'Reintentar', de: 'Erneut versuchen', pt: 'Tentar novamente' }, language)}
        </button>
      </div>
    )}

    {enrollmentsStatus === 'ERROR' && (
      <div
        data-testid="enrollments-error-state"
        role="alert"
        className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-6 rounded-3xl flex flex-wrap items-center justify-between gap-4 text-xs text-red-800 dark:text-red-300"
      >
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            {enrollmentsError ||
              pickText(
                { ar: 'تعذر تحميل ملفات التسجيل من الخادم.', fr: 'Impossible de charger les dossiers d’inscription.', en: 'Failed to load enrollment applications from server.', es: 'No se pudieron cargar las solicitudes de matrícula desde el servidor.', de: 'Einschreibungsanträge konnten nicht vom Server geladen werden.', pt: 'Falha ao carregar os pedidos de inscrição do servidor.' },
                language,
              )}
          </span>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs"
        >
          {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry', es: 'Reintentar', de: 'Erneut versuchen', pt: 'Tentar novamente' }, language)}
        </button>
      </div>
    )}

    {enrollmentsStatus !== 'UNAUTHORIZED' && (
      <>
        {isHydratingSchoolData && enrollmentApplications.length === 0 ? (
          <div data-testid="enrollments-loading-state" className="text-xs font-bold text-gray-500 py-6 text-center">
            {t('loading')}
          </div>
        ) : enrollmentsStatus === 'BLOCKED_BACKEND' && enrollmentApplications.length === 0 ? (
          <EmptyFeatureState
            state="BLOCKED_BACKEND"
            title={pickText(
              { ar: 'سجل طلبات التسجيل بانتظار التفعيل في الخادم', fr: 'Suivi des inscriptions en attente du serveur', en: 'Enrollment Queue Pending Backend Deployment', es: 'Cola de matrícula pendiente de despliegue en servidor', de: 'Einschreibewarteschlange wartet auf Server-Bereitstellung', pt: 'Fila de inscrição pendente da implantação no servidor' },
              language,
            )}
            description={pickText(
              { ar: 'الجدول enrollment_applications غير منشور بعد في Supabase.', fr: 'La table enrollment_applications n’est pas encore déployée sur Supabase.', en: 'public.enrollment_applications is awaiting deployment on Supabase.', es: 'public.enrollment_applications está pendiente de despliegue en Supabase.', de: 'public.enrollment_applications wartet auf die Bereitstellung in Supabase.', pt: 'public.enrollment_applications aguarda implantação no Supabase.' },
              language,
            )}
          />
        ) : visibleApplications.length === 0 && enrollmentsStatus === 'READY' ? (
          <p data-testid="enrollments-empty-state" className="text-xs text-gray-500 py-4 text-center">
            {pickText(
              { ar: 'لا توجد طلبات تسجيل مسجلة حالياً.', fr: 'Aucune demande d’inscription enregistrée.', en: 'No enrollment applications found.', es: 'No se encontraron solicitudes de matrícula.', de: 'Keine Einschreibungsanträge gefunden.', pt: 'Não foram encontrados pedidos de inscrição.' },
              language,
            )}
          </p>
        ) : visibleApplications.length > 0 ? (
          <div className="space-y-3">
            {visibleApplications.map((app) => {
              const decisions=getEnrollmentReviewDecisions(app.status);
              const selected=reviewDecisionMap[app.id];
              const defaultDecision=selected && decisions.includes(selected) ? selected : decisions[0];
              return (
                <div
                  key={app.id}
                  id={`notification-enrollment-${app.id}`}
                  className={`p-4 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-gray-50/70 dark:bg-zinc-900/50 space-y-3 ${notificationIntent?.refId === app.id ? 'ring-2 ring-blue-500' : ''}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400">
                        {app.referenceCode}
                      </span>
                      <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                        {app.studentFullName} • {app.desiredLevelCode}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {app.parentFullName} • {app.phone} {app.email ? `• ${app.email}` : ''} • {app.birthDate}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-xl text-[10px] font-extrabold uppercase bg-slate-200 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200">
                      {app.status}
                    </span>
                  </div>

                  {canReview && getEnrollmentQueue(app)==='completion' && <CompleteAdmissionForm application={app} language={language} onCompleted={onRefresh} />}
                  {canReview && app.status==='ENROLLED' && !app.studentId && <p role="status" className="text-amber-800 text-xs">{pickText({ar:'يلزم تصحيح القبول قبل التسكين.',fr:'Rapprochement nécessaire avant affectation.',en:'Admission reconciliation required before placement.',es:'Se requiere conciliar la admisión.',de:'Zulassung muss abgeglichen werden.',pt:'É necessário reconciliar a admissão.'},language)}</p>}
                  {app.notes && <p className="text-xs text-gray-600 dark:text-gray-400">{app.notes}</p>}
                  {app.reviewNote && (
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                      {pickText({ ar: 'ملاحظة الإدارة:', fr: 'Note administrative :', en: 'Review note:', es: 'Nota de revisión:', de: 'Prüfvermerk:', pt: 'Nota de revisão:' }, language)} {app.reviewNote}
                    </p>
                  )}

                  {getEnrollmentQueue(app)==='history' && <p className="text-xs text-gray-500 break-all">
                    {pickText({ar:'سجل القرار',fr:'Historique de décision',en:'Decision history',es:'Historial de decisiones',de:'Entscheidungsverlauf',pt:'Histórico de decisões'},language)}
                    {` · v${app.version}${app.reviewedAt ? ` · ${app.reviewedAt}` : ''}${app.studentId ? ` · ${app.studentId}` : ''}`}
                  </p>}

                  {canReview && decisions.length > 0 && (
                    <div className="pt-2 border-t border-gray-200 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                      <select
                        value={defaultDecision}
                        onChange={(e) =>
                          setReviewDecisionMap((prev) => ({
                            ...prev,
                            [app.id]: e.target.value as Exclude<EnrollmentApplicationStatus, 'DRAFT' | 'SUBMITTED'>,
                          }))
                        }
                        className="p-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold"
                      >
                        {decisions.map((dec) => (
                          <option key={dec} value={dec}>{dec}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={reviewNoteMap[app.id] ?? app.reviewNote ?? ''}
                        onChange={(e) =>
                          setReviewNoteMap((prev) => ({ ...prev, [app.id]: e.target.value }))
                        }
                        placeholder={pickText({ ar: 'ملاحظة المراجعة...', fr: 'Note de décision...', en: 'Decision note...', es: 'Nota de decisión...', de: 'Entscheidungsnotiz...', pt: 'Nota de decisão...' }, language)}
                        className="p-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                      />
                      <button
                        type="button"
                        disabled={Boolean(reviewingId)}
                        onClick={() => onReviewSave(app.id, app.status, app.version)}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50"
                      >
                        {reviewingId === app.id ? t('loading') : t('save')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </>
    )}
  </div>
);
};
