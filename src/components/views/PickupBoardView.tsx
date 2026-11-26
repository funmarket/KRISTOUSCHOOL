import React, { useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { ShieldCheck, Lock, AlertTriangle, AlertCircle } from 'lucide-react';
import { HOMEPAGE_COMMON_TEXT, pickText } from '../../i18n/homepages';
import {
  PickupParentSection,
  PickupStaffQueueSection,
} from './pickup/PickupBoardSections';

const PICKUP_FAIL_CLOSED_REASON = 'pickup_backend_unavailable';

export const PickupBoardView: React.FC = () => {
  const {
    currentUser,
    currentRole,
    childrenList,
    classesList,
    pickupCycles,
    pickupAvailability,
    pickupError,
    pickupErrorCode,
    pickupLastSyncedAt,
    pickupMutationState,
    isLoadingPickup,
    refreshPickupBoard,
    verifyPickupOperationReceipt,
    markPickupArrived,
    confirmPickupRelease,
    language,
    t,
  } = useApp();

  useEffect(() => {
    if (
      currentUser?.id &&
      currentUser.accountStatus === 'APPROVED' &&
      currentRole &&
      currentRole !== 'STUDENT' &&
      currentRole !== 'SCHOOL_STAFF'
    ) {
      void refreshPickupBoard();
    }
  }, [currentUser?.id, currentUser?.accountStatus, currentRole, refreshPickupBoard]);

  const userChildren =
    currentUser?.linkedChildrenIds && currentUser.linkedChildrenIds.length > 0
      ? childrenList.filter((c) => currentUser.linkedChildrenIds?.includes(c.id))
      : [];

  const pendingBackendLabel = pickText(HOMEPAGE_COMMON_TEXT.backendBlockedBadge, language);
  const isBackendUnavailable =
    pickupAvailability === 'UNAVAILABLE' || pickupErrorCode === PICKUP_FAIL_CLOSED_REASON;
  const isBoardReadFailure =
    !isBackendUnavailable &&
    (pickupAvailability === 'ERROR' || pickupAvailability === 'UNAUTHORIZED');

  return (
    <div className="space-y-6 pb-12" data-testid="pickup-board-view">
      {/* Header */}
      <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{t('pickupSecurity')}</span>
          </div>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">{t('pickup')}</h1>
          <p className="text-xs text-gray-500 mt-1">{t('pickupRule')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            data-testid="pickup-backend-status-badge"
            className={`inline-flex items-center gap-1.5 border px-3.5 py-1.5 rounded-2xl text-xs font-bold ${
              pickupAvailability === 'READY'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>
              {pickupAvailability === 'READY'
                ? t('pickupServerSyncedBadge')
                : pendingBackendLabel}
            </span>
          </span>
          <div className="bg-gray-100 dark:bg-gray-900 px-4 py-2 rounded-2xl text-xs font-semibold text-gray-700 dark:text-gray-300">
            {t('timezone')}
          </div>
          {pickupLastSyncedAt && (
            <div className="bg-gray-100 dark:bg-gray-900 px-3 py-2 rounded-2xl text-[11px] font-medium text-gray-600 dark:text-gray-400">
              {pickupLastSyncedAt}
            </div>
          )}
        </div>
      </div>

      {/* Mandatory Safety & Backend Persistence Banner */}
      {isBackendUnavailable && (
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
                  es: 'Bloqueo de seguridad escolar: la llegada y la confirmación de entrega están pendientes del servidor',
                  de: 'Schülersicherheitssperre: Ankunftsmeldung und Abholbestätigung warten auf das Server-Backend',
                  pt: 'Bloqueio de segurança escolar: o aviso de chegada e a confirmação de entrega aguardam o servidor',
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
                  es: 'El aviso de llegada del padre/tutor (PARENT_ARRIVED) y la entrega física por el personal autorizado (RELEASED) son transiciones de seguridad estrictamente distintas. Se desactivan los cambios locales sin servidor hasta desplegar el contrato de recogida en Supabase.',
                  de: 'Die Ankunftsmeldung der Eltern (PARENT_ARRIVED) und die physische Übergabe durch autorisiertes Personal (RELEASED) sind strikt getrennte Sicherheitsübergänge. Lokale Änderungen im Browser sind deaktiviert, bis der Supabase-Abholvertrag bereitgestellt ist.',
                  pt: 'O aviso de chegada do encarregado (PARENT_ARRIVED) e a entrega física pela equipa autorizada (RELEASED) são transições de segurança estritamente distintas. As alterações apenas no navegador estão desativadas até à implantação do contrato de recolha no Supabase.',
                },
                language,
              )}
            </p>
          </div>
        </div>
      )}

      {/* Read Failure / Unauthorized Banner */}
      {isBoardReadFailure && (
        <div
          data-testid="pickup-error-banner"
          className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-4 rounded-3xl flex items-start gap-3 text-xs text-red-800 dark:text-red-300"
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">
              {pickupAvailability === 'UNAUTHORIZED' ? t('pickupStateDenied') : t('pickupStateUnknown')}
            </p>
            {pickupError && <p>{pickupError}</p>}
          </div>
        </div>
      )}

      {/* Parent Perspective */}
      {currentRole === 'PARENT' && (
        <PickupParentSection
          key={currentUser?.id ?? 'anon'}
          currentUserId={currentUser?.id ?? null}
          language={language}
          t={t}
          userChildren={userChildren}
          pickupCycles={pickupCycles}
          pickupAvailability={pickupAvailability}
          pickupMutationState={pickupMutationState}
          isLoadingPickup={isLoadingPickup}
          onRefresh={() => {
            void refreshPickupBoard();
          }}
          onAnnounceArrival={(input) => {
            void markPickupArrived(input);
          }}
          onVerifyReceipt={
            verifyPickupOperationReceipt
              ? (cycleId) => {
                  void verifyPickupOperationReceipt(cycleId);
                }
              : undefined
          }
        />
      )}

      {/* Teacher / Manager / Admin / Staff Perspective: Pickup Queue */}
      {(currentRole === 'TEACHER' ||
        currentRole === 'MANAGER' ||
        currentRole === 'APP_ADMIN' ||
        currentRole === 'SCHOOL_STAFF' ||
        currentRole === 'ADMINISTRATIVE_PERSONNEL') && (
        <PickupStaffQueueSection
          key={currentUser?.id ?? 'anon'}
          currentUserId={currentUser?.id ?? null}
          language={language}
          t={t}
          currentRole={currentRole}
          pickupCycles={pickupCycles}
          classesList={classesList}
          pickupAvailability={pickupAvailability}
          pickupMutationState={pickupMutationState}
          isLoadingPickup={isLoadingPickup}
          onRefresh={(classId) => {
            void refreshPickupBoard(classId);
          }}
          onConfirmRelease={(input) => {
            void confirmPickupRelease(input);
          }}
          onVerifyReceipt={
            verifyPickupOperationReceipt
              ? (cycleId) => {
                  void verifyPickupOperationReceipt(cycleId);
                }
              : undefined
          }
        />
      )}
    </div>
  );
};
