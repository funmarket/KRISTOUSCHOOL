import React from 'react';
import { useApp } from '../../context/AppContext';
import { ShieldCheck, Lock, AlertTriangle } from 'lucide-react';
import { HOMEPAGE_COMMON_TEXT, pickText } from '../../i18n/homepages';

export function attemptPickupOperation(
  operation: 'ARRIVAL' | 'RELEASE',
  targetId: string,
): { allowed: false; status: 'BLOCKED_BACKEND'; operation: 'ARRIVAL' | 'RELEASE'; targetId: string; reason: string } {
  return {
    allowed: false,
    status: 'BLOCKED_BACKEND',
    operation,
    targetId,
    reason: 'pickup_backend_unavailable',
  };
}

export const PickupBoardView: React.FC = () => {
  const { currentUser, currentRole, childrenList, pickupRecords, language, t } = useApp();

  const userChildren =
    currentUser?.linkedChildrenIds && currentUser.linkedChildrenIds.length > 0
      ? childrenList.filter((c) => currentUser.linkedChildrenIds?.includes(c.id))
      : [];

  const pendingBackendLabel = pickText(HOMEPAGE_COMMON_TEXT.backendBlockedBadge, language);

  return (
    <div className="space-y-6 pb-12" data-testid="pickup-board-view">
      {/* Header */}
      <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{t('pickupSecurity')}</span>
          </div>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">
            {t('pickup')}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {t('pickupRule')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            data-testid="pickup-backend-status-badge"
            className="inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-3.5 py-1.5 rounded-2xl text-xs font-bold"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{pendingBackendLabel}</span>
          </span>
          <div className="bg-gray-100 dark:bg-gray-900 px-4 py-2 rounded-2xl text-xs font-semibold text-gray-700 dark:text-gray-300">
            {t('timezone')}
          </div>
        </div>
      </div>

      {/* Mandatory Safety & Backend Persistence Banner */}
      <div
        data-testid="pickup-safety-lock-banner"
        className="bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/70 p-5 rounded-3xl flex items-start gap-3.5"
      >
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1.5 text-xs">
          <h2 className="font-extrabold text-amber-900 dark:text-amber-200 text-sm">
            {pickText(
              {
                ar: 'حماية سلامة التلاميذ: إشعار الوصول وتسليم التلميذ متوقفان بانتظار ربط الخادم (Pending Backend)',
                fr: 'Sécurité des élèves : signalement d’arrivée et confirmation de remise en attente du contrat serveur (Pending Backend)',
                en: 'Student Safety Lock: Pickup arrival and physical release confirmation are Pending Backend',
              },
              language,
            )}
          </h2>
          <p className="text-amber-800 dark:text-amber-300/90 leading-relaxed">
            {pickText(
              {
                ar: 'إعلان وصول الولي (PARENT_ARRIVED) وتأكيد تسليم التلميذ الفعلي (RELEASED) عمليتان منفصلتان تماماً. لمنع أي إشعار محلي مضلل، تم تعطيل أزرار الإرسال والتسليم في المتصفح إلى حين تفعيل جدول الاستلام والدوال الذرية في قاعدة بيانات Supabase.',
                fr: 'L’annonce d’arrivée du parent (PARENT_ARRIVED) et la remise physique de l’enfant par le personnel autorisé (RELEASED) sont strictement distinctes. Aucune mutation locale fictive n’est exécutée tant que la table et les RPC Supabase ne sont pas déployées.',
                en: 'Parent arrival announcement (PARENT_ARRIVED) and staff physical child release (RELEASED) are strictly distinct safety transitions. Browser-only state mutations are disabled so no parent or staff member receives a false operational confirmation before the Supabase pickup contract is deployed.',
              },
              language,
            )}
          </p>
        </div>
      </div>

      {/* Parent Perspective */}
      {currentRole === 'PARENT' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">{t('announceArrival')}</h3>
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
              {pendingBackendLabel}
            </span>
          </div>

          {userChildren.length === 0 ? (
            <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm text-xs text-gray-600 dark:text-gray-400">
              {pickText(
                {
                  ar: 'لا يوجد أطفال مرتبطون بحسابك حالياً لعرض بطاقة الاستلام المدرسي.',
                  fr: 'Aucun enfant lié à votre compte pour le moment. Le suivi de sortie s’affichera après liaison serveur du dossier élève.',
                  en: 'No linked children are assigned to your parent account yet. Pickup cards will appear once child records are linked on the server.',
                },
                language,
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {userChildren.map((child) => {
                const record = pickupRecords.find((p) => p.childId === child.id);
                const state = record?.state || 'WAITING';

                return (
                  <div
                    key={child.id}
                    className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4"
                  >
                    <div className="flex items-center gap-4">
                      <img
                        src={child.photoUrl}
                        alt={child.fullName}
                        className="w-14 h-14 rounded-2xl object-cover border shrink-0"
                      />
                      <div className="min-w-0">
                        <h4 className="font-bold text-base text-gray-900 dark:text-white">
                          {child.fullName}
                        </h4>
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                          {child.className}
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-900 flex items-center justify-between text-xs">
                      <span className="text-gray-500">{t('currentStatus')} :</span>
                      <span className="font-bold px-3 py-1 rounded-xl uppercase text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                        {state} • {pendingBackendLabel}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      className="w-full py-3 bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-bold text-xs rounded-xl cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>
                        {t('arrived')} ({pendingBackendLabel})
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Teacher / Manager / Admin / Staff Perspective: Pickup Queue */}
      {(currentRole === 'TEACHER' ||
        currentRole === 'MANAGER' ||
        currentRole === 'APP_ADMIN' ||
        currentRole === 'SCHOOL_STAFF' ||
        currentRole === 'ADMINISTRATIVE_PERSONNEL') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">{t('pickupBoard')}</h3>
            <span className="text-xs text-amber-700 dark:text-amber-400 font-bold">
              {pendingBackendLabel}
            </span>
          </div>

          <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
            <p className="text-xs text-gray-700 dark:text-gray-300 font-semibold">
              {pickText(
                {
                  ar: 'لوحة الاستلام الفوري في انتظار تفعيل خدمة الخادم (Supabase Pickup Queue).',
                  fr: 'File d’attente de sortie en attente d’activation du service serveur (Supabase Pickup Queue).',
                  en: 'Real-time pickup queue is awaiting the server-verified Supabase pickup contract.',
                },
                language,
              )}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              {pickText(
                {
                  ar: 'لا يتم عرض أي سجلات تلاميذ تجريبية أو أزرار تسليم غير متصلة بالخادم. عند تفعيل العقد الخلفي، سيظهر هنا فقط التلاميذ الفعليون مع التحقق الإلزامي من هوية المستلم المخول وصلاحية الموظف قبل الانتقال الذري إلى حالة RELEASED.',
                  fr: 'Aucun élève fictif ni bouton de remise non connecté au serveur n’est affiché. Dès le déploiement backend, seuls les élèves réels et les personnes autorisées vérifiées apparaîtront ici.',
                  en: 'No mock student records or unverified release buttons are displayed in authenticated mode. Once the backend contract is deployed, only verified student pickup events and atomic staff release transitions will appear here.',
                },
                language,
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
