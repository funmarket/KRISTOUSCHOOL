import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type { AccountRole, Child, Language } from '../../../types.ts';
import type { TranslationKey } from '../../../i18n/translations.ts';
import {
  canActorTriggerArrivalUi,
  canActorTriggerReleaseUi,
  createPickupRequestId,
  deriveNotificationDeliveryStatus,
  derivePickupPresentationState,
  type AnnounceArrivalInput,
  type ConfirmReleaseInput,
  type PickupAvailabilityStatus,
  type PickupCycleRecord,
  type PickupMutationEntry,
  type PickupNotificationDeliveryStatus,
  type PickupPresentationState,
} from '../../../lib/domains/pickup.ts';
import { HOMEPAGE_COMMON_TEXT, pickText } from '../../../i18n/homepages.ts';
import { PickupChildAvatar } from './PickupChildAvatar.tsx';

function getBadgeMeta(state: PickupPresentationState, t: (key: TranslationKey) => string) {
  const map: Record<PickupPresentationState, { key: TranslationKey; cls: string }> = {
    WAITING: { key: 'waiting', cls: 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' },
    PARENT_ARRIVED: { key: 'parentArrived', cls: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300' },
    RELEASED: { key: 'released', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' },
    PENDING_RETRY: { key: 'pickupStatePendingRetry', cls: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300' },
    CONFLICT: { key: 'pickupStateConflict', cls: 'bg-orange-100 text-orange-900 dark:bg-orange-950/60 dark:text-orange-300' },
    DENIED: { key: 'pickupStateDenied', cls: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300' },
    INELIGIBLE: { key: 'pickupStateIneligible', cls: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300' },
    CLOSED_WINDOW: { key: 'pickupStateClosedWindow', cls: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300' },
    UNKNOWN: { key: 'pickupStateUnknown', cls: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300' },
    UNAVAILABLE: { key: 'pickupStateUnavailable', cls: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300' },
  };
  const m = map[state] ?? map.UNAVAILABLE;
  return { label: t(m.key), toneClass: m.cls };
}

function getDeliveryBadgeMeta(status: PickupNotificationDeliveryStatus, t: (key: TranslationKey) => string) {
  if (status === 'QUEUED') {
    return { label: t('pickupDeliveryQueued'), cls: 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300' };
  }
  if (status === 'RETRYING') {
    return { label: t('pickupDeliveryRetrying'), cls: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950/70 dark:text-indigo-200' };
  }
  if (status === 'DELIVERED') {
    return { label: t('pickupDeliveryDelivered'), cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' };
  }
  if (status === 'UNAVAILABLE') {
    return { label: t('pickupDeliveryUnavailable'), cls: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300' };
  }
  return null;
}

function RefreshActionButton({ isLoading, onClick, label, testId }: {
  isLoading: boolean; onClick: () => void; label: string; testId: string;
}) {
  return (
    <button type="button" onClick={onClick} disabled={isLoading} data-testid={testId}
      className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#141414] px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50">
      <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
      <span>{label}</span>
    </button>
  );
}

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
}

export const PickupParentSection: React.FC<PickupParentSectionProps> = ({
  currentUserId, language, t, userChildren, pickupCycles, pickupAvailability,
  pickupMutationState, isLoadingPickup, onRefresh, onAnnounceArrival,
}) => {
  const [selectedCollectors, setSelectedCollectors] = useState<Record<string, string>>({});
  useEffect(() => {
    setSelectedCollectors({});
  }, [currentUserId]);

  const pendingBackendLabel = pickText(HOMEPAGE_COMMON_TEXT.backendBlockedBadge, language);

  return (
    <div className="space-y-4" data-testid="pickup-parent-section">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-sm text-gray-900 dark:text-white">{t('announceArrival')}</h3>
        <div className="flex items-center gap-2">
          {pickupAvailability !== 'READY' && (
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">{pendingBackendLabel}</span>
          )}
          <RefreshActionButton isLoading={isLoadingPickup} onClick={onRefresh}
            label={t('pickupRefreshFromServer')} testId="pickup-parent-refresh-btn" />
        </div>
      </div>

      {userChildren.length === 0 ? (
        <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm text-xs text-gray-600 dark:text-gray-400">
          {pickText({
            ar: 'لا يوجد أطفال مرتبطون بحسابك حالياً لعرض بطاقة الاستلام المدرسي.',
            fr: 'Aucun enfant lié à votre compte pour le moment. Le suivi de sortie s’affichera après liaison serveur du dossier élève.',
            en: 'No linked children are assigned to your parent account yet. Pickup cards will appear once child records are linked on the server.',
          }, language)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {userChildren.map((child) => {
            const cycle = pickupCycles.find((p) => p.studentId === child.id) ?? null;
            const mutation = cycle ? pickupMutationState[cycle.cycleId] : undefined;
            const presentation = derivePickupPresentationState(cycle, { readAvailability: pickupAvailability, mutation });
            const badge = getBadgeMeta(presentation, t);
            const deliveryMeta = getDeliveryBadgeMeta(deriveNotificationDeliveryStatus(cycle, mutation), t);
            const activeCollectors = cycle ? cycle.authorizedCollectors.filter((c) => c.status === 'ACTIVE') : [];
            const chosenCollectorId =
              (cycle && selectedCollectors[cycle.cycleId]) || cycle?.intendedCollectorId || activeCollectors[0]?.collectorId || '';
            const canAnnounce = canActorTriggerArrivalUi(cycle, pickupAvailability, mutation);

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

                {cycle && (
                  <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
                    {cycle.windowLabel && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>{cycle.windowLabel} ({cycle.windowStatus})</span>
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
                    {cycle.state === 'RELEASED' && cycle.releasedToCollectorName && (
                      <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-3 text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{cycle.releasedToCollectorName}{cycle.releasedByName ? ` • ${cycle.releasedByName}` : ''}</span>
                      </div>
                    )}
                  </div>
                )}

                {mutation?.status === 'UNKNOWN_OUTCOME' && (
                  <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
                    <span>{t('pickupUnknownOutcomeHint')}</span>
                    <div className="flex items-center gap-1.5">
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

                {(mutation?.status === 'CONFLICT' || mutation?.status === 'DENIED') && mutation.message && (
                  <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-800 dark:text-red-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{mutation.message}</span>
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

export interface PickupStaffQueueSectionProps {
  currentUserId?: string | null;
  language: Language;
  t: (key: TranslationKey) => string;
  currentRole: AccountRole;
  pickupCycles: PickupCycleRecord[];
  pickupAvailability: PickupAvailabilityStatus;
  pickupMutationState: Record<string, PickupMutationEntry>;
  isLoadingPickup: boolean;
  onRefresh: () => void;
  onConfirmRelease: (input: ConfirmReleaseInput) => void;
}

export const PickupStaffQueueSection: React.FC<PickupStaffQueueSectionProps> = ({
  currentUserId, language, t, currentRole, pickupCycles, pickupAvailability,
  pickupMutationState, isLoadingPickup, onRefresh, onConfirmRelease,
}) => {
  const [stateFilter, setStateFilter] = useState<'ALL' | PickupCycleRecord['state']>('ALL');
  const [attestations, setAttestations] = useState<
    Record<string, { verified: boolean; handoff: boolean; collectorId?: string }>
  >({});

  useEffect(() => {
    setStateFilter('ALL');
    setAttestations({});
  }, [currentUserId]);

  const pendingBackendLabel = pickText(HOMEPAGE_COMMON_TEXT.backendBlockedBadge, language);
  const filteredCycles =
    stateFilter === 'ALL' ? pickupCycles : pickupCycles.filter((c) => c.state === stateFilter);
  const isStaffWithoutDefaultRelease = currentRole === 'SCHOOL_STAFF' || currentRole === 'TEACHER';

  return (
    <div className="space-y-4" data-testid="pickup-staff-section">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-sm text-gray-900 dark:text-white">{t('pickupBoard')}</h3>
        <div className="flex items-center gap-2">
          {pickupAvailability !== 'READY' && (
            <span className="text-xs text-amber-700 dark:text-amber-400 font-bold">{pendingBackendLabel}</span>
          )}
          <RefreshActionButton isLoading={isLoadingPickup} onClick={onRefresh}
            label={t('pickupRefreshFromServer')} testId="pickup-retry-refresh-btn" />
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
            {pickText({
              ar: 'لوحة الاستلام الفوري في انتظار تفعيل خدمة الخادم (Supabase Pickup Queue).',
              fr: 'File d’attente de sortie en attente d’activation du service serveur (Supabase Pickup Queue).',
              en: 'Real-time pickup queue is awaiting the server-verified Supabase pickup contract.',
            }, language)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            {pickText({
              ar: 'لا يتم عرض أي سجلات تلاميذ تجريبية أو أزرار تسليم غير متصلة بالخادم. عند تفعيل العقد الخلفي، سيظهر هنا فقط التلاميذ الفعليون مع التحقق الإلزامي من هوية المستلم المخول وصلاحية الموظف قبل الانتقال الذري إلى حالة RELEASED.',
              fr: 'Aucun élève fictif ni bouton de remise non connecté au serveur n’est affiché. Dès le déploiement backend, seuls les élèves réels et les personnes autorisées vérifiées apparaîtront ici.',
              en: 'No mock student records or unverified release buttons are displayed in authenticated mode. Once the backend contract is deployed, only verified student pickup events and atomic staff release transitions will appear here.',
            }, language)}
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
                {filterVal === 'ALL' ? t('seeAll') : getBadgeMeta(filterVal, t).label}
              </button>
            ))}
          </div>

          {filteredCycles.length === 0 ? (
            <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 text-xs text-gray-500">
              {t('noItems')}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCycles.map((cycle) => {
                const mutation = pickupMutationState[cycle.cycleId];
                const presentation = derivePickupPresentationState(cycle, { readAvailability: pickupAvailability, mutation });
                const badge = getBadgeMeta(presentation, t);
                const deliveryMeta = getDeliveryBadgeMeta(deriveNotificationDeliveryStatus(cycle, mutation), t);
                const canRelease = canActorTriggerReleaseUi(cycle, pickupAvailability, mutation);
                const att = attestations[cycle.cycleId] ?? { verified: false, handoff: false };
                const activeCollectors = cycle.authorizedCollectors.filter((c) => c.status === 'ACTIVE');
                const chosenCollectorId =
                  att.collectorId || cycle.intendedCollectorId || activeCollectors[0]?.collectorId || '';

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

                    {cycle.revocationStatus === 'REVOKED' && (
                      <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-2.5 text-xs text-red-800 dark:text-red-300 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{t('pickupReleaseRevokedNotice')}</span>
                      </div>
                    )}

                    {mutation?.status === 'UNKNOWN_OUTCOME' && (
                      <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-2.5 text-xs text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
                        <span>{t('pickupUnknownOutcomeHint')}</span>
                        <div className="flex items-center gap-1.5">
                          {mutation.operation === 'RELEASE' && mutation.payload && (
                            <button type="button" data-testid={`pickup-retry-release-btn-${cycle.cycleId}`}
                              onClick={() => onConfirmRelease(mutation.payload as ConfirmReleaseInput)}
                              className="rounded-lg border border-amber-700 px-2 py-1 text-[11px] font-bold">
                              {t('pickupRetrySameRequest')}
                            </button>
                          )}
                          <button type="button" onClick={onRefresh}
                            className="rounded-lg bg-amber-700 px-2 py-1 text-[11px] font-bold text-white">
                            {t('pickupRefreshFromServer')}
                          </button>
                        </div>
                      </div>
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
