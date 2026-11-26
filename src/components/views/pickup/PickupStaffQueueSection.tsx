import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import type { AccountRole, Language } from '../../../types.ts';
import type { TranslationKey } from '../../../i18n/translations.ts';
import {
  canActorTriggerReleaseUi,
  createPickupRequestId,
  deriveNotificationDeliveryStatus,
  derivePickupPresentationState,
  type ConfirmReleaseInput,
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

export interface PickupStaffQueueSectionProps {
  currentUserId?: string | null;
  language: Language;
  t: (key: TranslationKey) => string;
  currentRole: AccountRole;
  pickupCycles: PickupCycleRecord[];
  classesList?: { id: string; name: string }[];
  pickupAvailability: PickupAvailabilityStatus;
  pickupMutationState: Record<string, PickupMutationEntry>;
  isLoadingPickup: boolean;
  onRefresh: (classId?: string | null) => void;
  onConfirmRelease: (input: ConfirmReleaseInput) => void;
  onVerifyReceipt?: (cycleId: string) => void;
}

export const PickupStaffQueueSection: React.FC<PickupStaffQueueSectionProps> = ({
  currentUserId, language, t, currentRole, pickupCycles, classesList = [], pickupAvailability,
  pickupMutationState, isLoadingPickup, onRefresh, onConfirmRelease, onVerifyReceipt,
}) => {
  const [stateFilter, setStateFilter] = useState<'ALL' | PickupCycleRecord['state']>('ALL');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [attestations, setAttestations] = useState<
    Record<string, { verified: boolean; handoff: boolean; collectorId?: string }>
  >({});

  useEffect(() => {
    setStateFilter('ALL');
    setSelectedClassId('');
    setAttestations({});
  }, [currentUserId]);

  const classOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of classesList) {
      if (c.id && c.name) map.set(c.id, c.name);
    }
    for (const cycle of pickupCycles) {
      if (cycle.classId && cycle.className) map.set(cycle.classId, cycle.className);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [classesList, pickupCycles]);

  const classScopedCycles = selectedClassId
    ? pickupCycles.filter((c) => c.classId === selectedClassId)
    : pickupCycles;

  const stateCounts = useMemo(() => ({
    ALL: classScopedCycles.length,
    WAITING: classScopedCycles.filter((c) => c.state === 'WAITING').length,
    PARENT_ARRIVED: classScopedCycles.filter((c) => c.state === 'PARENT_ARRIVED').length,
    RELEASED: classScopedCycles.filter((c) => c.state === 'RELEASED').length,
  }), [classScopedCycles]);

  const pendingBackendLabel = pickText(HOMEPAGE_COMMON_TEXT.backendBlockedBadge, language);
  const filteredCycles =
    stateFilter === 'ALL' ? classScopedCycles : classScopedCycles.filter((c) => c.state === stateFilter);
  const isStaffWithoutDefaultRelease = currentRole === 'SCHOOL_STAFF' || currentRole === 'TEACHER';

  return (
    <div className="space-y-4" data-testid="pickup-staff-section">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-sm text-gray-900 dark:text-white">{t('pickupBoard')}</h3>
        <div className="flex flex-wrap items-center gap-2">
          {pickupAvailability !== 'READY' && (
            <span className="text-xs text-amber-700 dark:text-amber-400 font-bold">{pendingBackendLabel}</span>
          )}
          {classOptions.length > 1 && pickupAvailability === 'READY' && (
            <select
              aria-label={t('pickupAllClasses')}
              data-testid="pickup-staff-class-filter"
              value={selectedClassId}
              onChange={(e) => {
                const next = e.target.value;
                setSelectedClassId(next);
                onRefresh(next || null);
              }}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#141414] px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200"
            >
              <option value="">{t('pickupAllClasses')}</option>
              {classOptions.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => onRefresh(selectedClassId || null)}
            disabled={isLoadingPickup}
            data-testid="pickup-retry-refresh-btn"
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#141414] px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPickup ? 'animate-spin' : ''}`} />
            <span>{t('pickupRefreshFromServer')}</span>
          </button>
        </div>
      </div>

      {isStaffWithoutDefaultRelease && (
        <div data-testid="pickup-no-default-release-notice"
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-4 py-3 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 text-slate-500" />
          <span>{t('pickupNoDefaultReleaseHint')}</span>
        </div>
      )}

      {pickupAvailability !== 'READY' ? (
        <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
          <p className="text-xs text-gray-700 dark:text-gray-300 font-semibold">
            {pickText({ ar: 'لوحة الاستلام الفوري في انتظار تفعيل خدمة الخادم (Supabase Pickup Queue).', fr: 'File d’attente de sortie en attente d’activation du service serveur (Supabase Pickup Queue).', en: 'Real-time pickup queue is awaiting the server-verified Supabase pickup contract.', es: 'La cola de recogida en tiempo real espera la activación del contrato de recogida verificado en Supabase.', de: 'Die Echtzeit-Abholwarteschlange wartet auf die Freischaltung des servergeprüften Supabase-Abholvertrags.', pt: 'A fila de recolha em tempo real aguarda a ativação do contrato de recolha verificado no Supabase.' }, language)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            {pickText({ ar: 'لا يتم عرض أي سجلات تلاميذ تجريبية أو أزرار تسليم غير متصلة بالخادم. عند تفعيل العقد الخلفي، سيظهر هنا فقط التلاميذ الفعليون مع التحقق الإلزامي من هوية المستلم المخول وصلاحية الموظف قبل الانتقال الذري إلى حالة RELEASED.', fr: 'Aucun élève fictif ni bouton de remise non connecté au serveur n’est affiché. Dès le déploiement backend, seuls les élèves réels et les personnes autorisées vérifiées apparaîtront ici.', en: 'No mock student records or unverified release buttons are displayed in authenticated mode. Once the backend contract is deployed, only verified student pickup events and atomic staff release transitions will appear here.', es: 'No se muestran alumnos ficticios ni botones de entrega sin conexión al servidor. Una vez desplegado el contrato backend, aquí solo aparecerán eventos de recogida verificados y entregas atómicas del personal.', de: 'Im authentifizierten Modus werden keine fiktiven Schülerdatensätze oder ungeprüften Freigabe-Schaltflächen angezeigt. Nach Bereitstellung des Backends erscheinen hier nur verifizierte Abholereignisse.', pt: 'Não são apresentados registos fictícios de alunos nem botões de entrega não verificados. Após a implantação no servidor, apenas surgirão aqui eventos de recolha verificados e entregas atómicas.' }, language)}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(['ALL', 'WAITING', 'PARENT_ARRIVED', 'RELEASED'] as const).map((filterVal) => (
              <button key={filterVal} type="button" onClick={() => setStateFilter(filterVal)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                  stateFilter === filterVal
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-white dark:bg-[#111111] border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300'
                }`}>
                {filterVal === 'ALL' ? t('seeAll') : getPickupBadgeMeta(filterVal, t).label} ({stateCounts[filterVal]})
              </button>
            ))}
          </div>

          {filteredCycles.length === 0 ? (
            <div data-testid="pickup-staff-empty-state"
              className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-400 space-y-1.5">
              <p className="font-bold text-gray-800 dark:text-gray-200">{t('pickupStateUnavailable')}</p>
              <p>{t('pickupNoCycleNotice')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCycles.map((cycle) => {
                const mutation = pickupMutationState[cycle.cycleId];
                const presentation = derivePickupPresentationState(cycle, { readAvailability: pickupAvailability, mutation });
                const badge = getPickupBadgeMeta(presentation, t);
                const deliveryMeta = getPickupDeliveryBadgeMeta(deriveNotificationDeliveryStatus(cycle, mutation), t);
                const canRelease = canActorTriggerReleaseUi(cycle, pickupAvailability, mutation);
                const att = attestations[cycle.cycleId] ?? { verified: false, handoff: false };
                const activeCollectors = cycle.authorizedCollectors.filter((c) => c.status === 'ACTIVE');
                const chosenCollectorId =
                  att.collectorId || cycle.intendedCollectorId || activeCollectors[0]?.collectorId || '';
                const windowStatusLabel = resolvePickupWindowStatusLabel(cycle.windowStatus, t);

                return (
                  <div key={cycle.cycleId} data-testid={`pickup-staff-card-${cycle.cycleId}`}
                    className="bg-white dark:bg-[#111111] p-5 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <PickupChildAvatar photoUrl={cycle.studentPhotoUrl} fullName={cycle.studentName} />
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate">{cycle.studentName}</h4>
                          <p className="text-xs text-blue-600 dark:text-blue-400">{cycle.className}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span data-testid={`pickup-staff-state-badge-${cycle.cycleId}`}
                          className={`font-bold px-2.5 py-1 rounded-xl text-[11px] ${badge.toneClass}`}>{badge.label}</span>
                        {deliveryMeta && (
                          <span data-testid={`pickup-staff-delivery-badge-${cycle.cycleId}`}
                            className={`font-semibold px-2 py-0.5 rounded-lg text-[10px] ${deliveryMeta.cls}`}>{deliveryMeta.label}</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>{cycle.windowLabel ? `${cycle.windowLabel} — ${windowStatusLabel}` : windowStatusLabel}</span>
                      </div>
                      {cycle.attendanceEligibility !== 'ELIGIBLE' && cycle.state === 'WAITING' && (
                        <div className="rounded-xl bg-slate-100 dark:bg-slate-900/70 px-3 py-2 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{resolvePickupReasonText(cycle.attendanceReasonCode, t)}</span>
                        </div>
                      )}
                      {(cycle.state === 'PARENT_ARRIVED' || cycle.state === 'RELEASED') && (
                        <div className="rounded-xl bg-amber-50/80 dark:bg-amber-950/30 px-3 py-2 text-amber-900 dark:text-amber-200 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{formatTunisPickupTime(cycle.parentArrivedAt, language)}</span>
                          {cycle.intendedCollectorName && <span>• {cycle.intendedCollectorName}</span>}
                          {cycle.arrivalActorLabel && <span>({cycle.arrivalActorLabel})</span>}
                        </div>
                      )}
                      {cycle.state === 'RELEASED' && cycle.releasedAt && (
                        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-emerald-800 dark:text-emerald-300 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{formatTunisPickupTime(cycle.releasedAt, language)}</span>
                          {cycle.releasedToCollectorName && <span>• {cycle.releasedToCollectorName}</span>}
                          {cycle.releasedByName && <span>• {cycle.releasedByName}</span>}
                        </div>
                      )}
                    </div>

                    {cycle.revocationStatus === 'REVOKED' && (
                      <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-2.5 text-xs text-red-800 dark:text-red-300 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{t('pickupReleaseRevokedNotice')}</span>
                      </div>
                    )}

                    {mutation?.status === 'UNKNOWN_OUTCOME' && (
                      <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-2.5 text-xs text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
                        <span>{t('pickupUnknownOutcomeHint')}</span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {onVerifyReceipt && (
                            <button type="button" data-testid={`pickup-verify-receipt-btn-${cycle.cycleId}`}
                              onClick={() => onVerifyReceipt(cycle.cycleId)}
                              className="rounded-lg border border-amber-700 px-2 py-1 text-[11px] font-bold">
                              {t('pickupVerifyReceipt')}
                            </button>
                          )}
                          {mutation.operation === 'RELEASE' && mutation.payload && (
                            <button type="button" data-testid={`pickup-retry-release-btn-${cycle.cycleId}`}
                              onClick={() => onConfirmRelease(mutation.payload as ConfirmReleaseInput)}
                              className="rounded-lg border border-amber-700 px-2 py-1 text-[11px] font-bold">
                              {t('pickupRetrySameRequest')}
                            </button>
                          )}
                          <button type="button" onClick={() => onRefresh(selectedClassId || null)}
                            className="rounded-lg bg-amber-700 px-2 py-1 text-[11px] font-bold text-white">
                            {t('pickupRefreshFromServer')}
                          </button>
                        </div>
                      </div>
                    )}

                    {cycle.state === 'PARENT_ARRIVED' && !canRelease && !isStaffWithoutDefaultRelease && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 pt-1 border-t border-gray-100 dark:border-gray-800">
                        {t('pickupReleasePendingG5')}
                      </p>
                    )}

                    {canRelease && (
                      <div className="space-y-2.5 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
                        <select value={chosenCollectorId}
                          onChange={(e) => setAttestations((prev) => ({ ...prev, [cycle.cycleId]: { ...att, collectorId: e.target.value } }))}
                          className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#161616] px-3 py-2 text-xs">
                          {activeCollectors.map((c) => (
                            <option key={c.collectorId} value={c.collectorId}>{c.fullName} ({c.relationshipLabel})</option>
                          ))}
                        </select>
                        <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                          <input type="checkbox" checked={att.verified}
                            onChange={(e) => setAttestations((prev) => ({ ...prev, [cycle.cycleId]: { ...att, verified: e.target.checked } }))} />
                          <span>{t('pickupVerifyCollectorCheckbox')}</span>
                        </label>
                        <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                          <input type="checkbox" checked={att.handoff}
                            onChange={(e) => setAttestations((prev) => ({ ...prev, [cycle.cycleId]: { ...att, handoff: e.target.checked } }))} />
                          <span>{t('pickupHandoffAttestedCheckbox')}</span>
                        </label>
                        <button type="button" disabled={!att.verified || !att.handoff || !chosenCollectorId}
                          onClick={() => {
                            if (!att.verified || !att.handoff || !chosenCollectorId) return;
                            onConfirmRelease({
                              cycleId: cycle.cycleId, collectorId: chosenCollectorId,
                              requestId: createPickupRequestId('release', cycle.cycleId),
                              expectedVersion: cycle.version, collectorVerifiedInPerson: true, physicalHandoffAttested: true,
                            });
                          }}
                          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:dark:bg-gray-800 disabled:text-gray-500 text-white font-bold text-xs">
                          {t('confirmRelease')}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
