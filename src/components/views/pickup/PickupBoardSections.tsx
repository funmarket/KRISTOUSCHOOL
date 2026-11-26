import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Lock,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import type { Child, Language } from '../../../types.ts';
import type { TranslationKey } from '../../../i18n/translations.ts';
import {
  canActorTriggerArrivalUi,
  createPickupRequestId,
  deriveNotificationDeliveryStatus,
  derivePickupPresentationState,
  type AnnounceArrivalInput,
  type PickupAvailabilityStatus,
  type PickupCycleRecord,
  type PickupMutationEntry,
} from '../../../lib/domains/pickup.ts';
import { HOMEPAGE_COMMON_TEXT, pickText } from '../../../i18n/homepages.ts';
import { PickupChildAvatar } from './PickupChildAvatar.tsx';
import {
  formatTunisPickupTime,
  getPickupBadgeMeta,
  getPickupDeliveryBadgeMeta,
  resolvePickupReasonText,
  resolvePickupWindowStatusLabel,
} from './pickupDisplayMessages.ts';
export { PickupStaffQueueSection } from './PickupStaffQueueSection.tsx';
export type { PickupStaffQueueSectionProps } from './PickupStaffQueueSection.tsx';

export interface PickupParentSectionProps {
  currentUserId?: string | null;
  language: Language;
  t: (key: TranslationKey) => string;
  userChildren: Child[];
  pickupCycles: PickupCycleRecord[];
  pickupAvailability: PickupAvailabilityStatus;
  pickupMutationState: Record<string, PickupMutationEntry>;
  isLoadingPickup: boolean;
  onRefresh: () => void;
  onAnnounceArrival: (input: AnnounceArrivalInput) => void;
  onVerifyReceipt?: (cycleId: string) => void;
}

interface ParentDisplayChild {
  id: string;
  fullName: string;
  className: string;
  photoUrl: string;
  cycle: PickupCycleRecord | null;
}

export const PickupParentSection: React.FC<PickupParentSectionProps> = ({
  currentUserId, language, t, userChildren, pickupCycles, pickupAvailability,
  pickupMutationState, isLoadingPickup, onRefresh, onAnnounceArrival, onVerifyReceipt,
}) => {
  const [selectedCollectors, setSelectedCollectors] = useState<Record<string, string>>({});
  useEffect(() => {
    setSelectedCollectors({});
  }, [currentUserId]);

  const displayChildren: ParentDisplayChild[] = useMemo(() => {
    const byStudent = new Map<string, ParentDisplayChild>();
    for (const child of userChildren) {
      const matched = pickupCycles.find((p) => p.studentId === child.id) ?? null;
      byStudent.set(child.id, {
        id: child.id,
        fullName: matched?.studentName || child.fullName,
        className: matched?.className || child.className,
        photoUrl: child.photoUrl || matched?.studentPhotoUrl || '',
        cycle: matched,
      });
    }
    for (const cycle of pickupCycles) {
      if (!byStudent.has(cycle.studentId)) {
        byStudent.set(cycle.studentId, {
          id: cycle.studentId,
          fullName: cycle.studentName,
          className: cycle.className,
          photoUrl: cycle.studentPhotoUrl || '',
          cycle,
        });
      }
    }
    return [...byStudent.values()];
  }, [pickupCycles, userChildren]);

  const pendingBackendLabel = pickText(HOMEPAGE_COMMON_TEXT.backendBlockedBadge, language);

  return (
    <div className="space-y-4" data-testid="pickup-parent-section">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-sm text-gray-900 dark:text-white">{t('announceArrival')}</h3>
        <div className="flex items-center gap-2">
          {pickupAvailability !== 'READY' && (
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">{pendingBackendLabel}</span>
          )}
          <button type="button" onClick={onRefresh} disabled={isLoadingPickup} data-testid="pickup-parent-refresh-btn"
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#141414] px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPickup ? 'animate-spin' : ''}`} />
            <span>{t('pickupRefreshFromServer')}</span>
          </button>
        </div>
      </div>

      {displayChildren.length === 0 ? (
        <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm text-xs text-gray-600 dark:text-gray-400">
          {pickText({ ar: 'لا يوجد أطفال مرتبطون بحسابك حالياً لعرض بطاقة الاستلام المدرسي.', fr: 'Aucun enfant lié à votre compte pour le moment. Le suivi de sortie s’affichera après liaison serveur du dossier élève.', en: 'No linked children are assigned to your parent account yet. Pickup cards will appear once child records are linked on the server.', es: 'Aún no hay hijos vinculados a su cuenta. Las tarjetas de recogida aparecerán cuando los registros se vinculen en el servidor.', de: 'Ihrem Elternkonto sind noch keine Kinder zugeordnet. Abholkarten erscheinen, sobald die Datensätze auf dem Server verknüpft sind.', pt: 'Ainda não existem crianças associadas à sua conta. Os cartões de recolha aparecerão quando os registos forem associados no servidor.' }, language)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayChildren.map((child) => {
            const cycle = child.cycle;
            const mutation = cycle ? pickupMutationState[cycle.cycleId] : undefined;
            const presentation = derivePickupPresentationState(cycle, { readAvailability: pickupAvailability, mutation });
            const badge = getPickupBadgeMeta(presentation, t);
            const deliveryMeta = getPickupDeliveryBadgeMeta(deriveNotificationDeliveryStatus(cycle, mutation), t);
            const activeCollectors = cycle ? cycle.authorizedCollectors.filter((c) => c.status === 'ACTIVE') : [];
            const chosenCollectorId =
              (cycle && selectedCollectors[cycle.cycleId]) || cycle?.intendedCollectorId || activeCollectors[0]?.collectorId || '';
            const canAnnounce = canActorTriggerArrivalUi(cycle, pickupAvailability, mutation);
            const windowStatusLabel = cycle ? resolvePickupWindowStatusLabel(cycle.windowStatus, t) : null;

            return (
              <div key={child.id} data-testid={`pickup-parent-card-${child.id}`}
                className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
                <div className="flex items-center gap-4">
                  <PickupChildAvatar photoUrl={child.photoUrl} fullName={child.fullName} />
                  <div className="min-w-0">
                    <h4 className="font-bold text-base text-gray-900 dark:text-white truncate">{child.fullName}</h4>
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">{child.className}</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-900 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-gray-500">{t('currentStatus')} :</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span data-testid={`pickup-child-state-badge-${child.id}`}
                      className={`font-bold px-3 py-1 rounded-xl text-[11px] ${badge.toneClass}`}>
                      {badge.label}
                    </span>
                    {deliveryMeta && (
                      <span data-testid={`pickup-delivery-status-badge-${child.id}`}
                        className={`font-semibold px-2.5 py-1 rounded-xl text-[11px] ${deliveryMeta.cls}`}>
                        {deliveryMeta.label}
                      </span>
                    )}
                  </div>
                </div>

                {!cycle && pickupAvailability === 'READY' && (
                  <div data-testid={`pickup-no-cycle-notice-${child.id}`}
                    className="rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-xs text-amber-900 dark:text-amber-200">
                    {t('pickupNoCycleNotice')}
                  </div>
                )}

                {cycle && (
                  <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
                    {windowStatusLabel && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>{cycle.windowLabel ? `${cycle.windowLabel} — ${windowStatusLabel}` : windowStatusLabel}</span>
                      </div>
                    )}
                    {cycle.attendanceEligibility !== 'ELIGIBLE' && cycle.state === 'WAITING' && (
                      <div className="rounded-xl bg-slate-100 dark:bg-slate-900/70 p-3 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{resolvePickupReasonText(cycle.attendanceReasonCode, t)}</span>
                      </div>
                    )}
                    {activeCollectors.length > 0 && cycle.state === 'WAITING' && (
                      <label className="block space-y-1">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">{t('pickupCollectorLabel')}</span>
                        <select value={chosenCollectorId}
                          onChange={(e) => setSelectedCollectors((prev) => ({ ...prev, [cycle.cycleId]: e.target.value }))}
                          className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#161616] px-3 py-2 text-xs text-gray-900 dark:text-gray-100">
                          {activeCollectors.map((c) => (
                            <option key={c.collectorId} value={c.collectorId}>{c.fullName} ({c.relationshipLabel})</option>
                          ))}
                        </select>
                      </label>
                    )}
                    {cycle.state === 'PARENT_ARRIVED' && (
                      <div data-testid={`pickup-parent-arrived-receipt-${child.id}`}
                        className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 text-amber-900 dark:text-amber-200 space-y-1">
                        <div className="flex items-center gap-2 font-semibold">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>{t('arrivalSent')}</span>
                        </div>
                        <div className="text-[11px] opacity-90 flex flex-wrap gap-x-2">
                          <span>{formatTunisPickupTime(cycle.parentArrivedAt, language)}</span>
                          {cycle.intendedCollectorName && <span>• {cycle.intendedCollectorName}</span>}
                        </div>
                      </div>
                    )}
                    {cycle.state === 'RELEASED' && (
                      <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-3 text-emerald-800 dark:text-emerald-300 flex flex-wrap items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{formatTunisPickupTime(cycle.releasedAt, language)}</span>
                        {cycle.releasedToCollectorName && <span>• {cycle.releasedToCollectorName}</span>}
                        {cycle.releasedByName && <span>• {cycle.releasedByName}</span>}
                      </div>
                    )}
                  </div>
                )}

                {mutation?.status === 'UNKNOWN_OUTCOME' && cycle && (
                  <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
                    <span>{t('pickupUnknownOutcomeHint')}</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {onVerifyReceipt && (
                        <button type="button" data-testid={`pickup-verify-receipt-btn-${child.id}`}
                          onClick={() => onVerifyReceipt(cycle.cycleId)}
                          className="shrink-0 rounded-lg border border-amber-700 px-2.5 py-1 text-[11px] font-bold text-amber-900 dark:text-amber-100">
                          {t('pickupVerifyReceipt')}
                        </button>
                      )}
                      {mutation.operation === 'ARRIVAL' && mutation.payload && (
                        <button type="button" data-testid={`pickup-retry-arrival-btn-${child.id}`}
                          onClick={() => onAnnounceArrival(mutation.payload as AnnounceArrivalInput)}
                          className="shrink-0 rounded-lg border border-amber-700 px-2.5 py-1 text-[11px] font-bold text-amber-900 dark:text-amber-100">
                          {t('pickupRetrySameRequest')}
                        </button>
                      )}
                      <button type="button" onClick={onRefresh}
                        className="shrink-0 rounded-lg bg-amber-700 px-2.5 py-1 text-[11px] font-bold text-white">
                        {t('pickupRefreshFromServer')}
                      </button>
                    </div>
                  </div>
                )}

                {(mutation?.status === 'CONFLICT' || mutation?.status === 'DENIED' || mutation?.status === 'UNAVAILABLE') && (
                  <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-800 dark:text-red-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{resolvePickupReasonText(mutation.reasonCode, t, mutation.message)}</span>
                  </div>
                )}

                <button type="button" disabled={!canAnnounce || !chosenCollectorId} aria-disabled={!canAnnounce || !chosenCollectorId}
                  onClick={() => {
                    if (!cycle || !canAnnounce || !chosenCollectorId) return;
                    onAnnounceArrival({
                      cycleId: cycle.cycleId, studentId: cycle.studentId, collectorId: chosenCollectorId,
                      requestId: createPickupRequestId('arrival', cycle.cycleId), expectedVersion: cycle.version,
                    });
                  }}
                  className={`w-full py-3 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors ${
                    canAnnounce && chosenCollectorId
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                      : 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  }`}>
                  {canAnnounce ? <ShieldCheck className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>
                    {canAnnounce ? t('arrived') : pickupAvailability === 'READY' ? badge.label : `${t('arrived')} (${pendingBackendLabel})`}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
