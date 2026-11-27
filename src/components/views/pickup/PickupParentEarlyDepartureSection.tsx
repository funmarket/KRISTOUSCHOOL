import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, RefreshCw, Send } from 'lucide-react';
import type { Child, Language } from '../../../types.ts';
import type { TranslationKey } from '../../../i18n/translations.ts';
import {
  buildTunisTimestampForTime,
  createPickupRequestId,
  fetchAuthorizedPickupCollectors,
  getTunisTodayIsoDate,
  hasOpenOrCompletedEarlyDepartureForStudent,
  type EarlyDepartureMutationEntry,
  type EarlyDepartureRequestRow,
  type PickupAuthorizedCollectorSummary,
  type PickupAvailabilityStatus,
  type PickupCycleRecord,
  type RequestEarlyDepartureInput,
} from '../../../lib/domains/pickup.ts';
import {
  formatTunisPickupTime,
  getEarlyDepartureBadgeMeta,
  resolvePickupReasonText,
} from './pickupDisplayMessages.ts';

export interface PickupParentEarlyDepartureSectionProps {
  currentUserId?: string | null;
  language: Language;
  t: (key: TranslationKey) => string;
  userChildren: Child[];
  pickupCycles: PickupCycleRecord[];
  earlyDepartures: EarlyDepartureRequestRow[];
  earlyDeparturesAvailability: PickupAvailabilityStatus;
  earlyDepartureMutationState: Record<string, EarlyDepartureMutationEntry>;
  isLoadingEarlyDepartures: boolean;
  onRefresh: () => void;
  onRequestEarlyDeparture: (input: RequestEarlyDepartureInput) => void;
  onVerifyReceipt?: (targetKey: string) => void;
}

export const PickupParentEarlyDepartureSection: React.FC<PickupParentEarlyDepartureSectionProps> = ({
  currentUserId,
  language,
  t,
  userChildren,
  pickupCycles,
  earlyDepartures,
  earlyDeparturesAvailability,
  earlyDepartureMutationState,
  isLoadingEarlyDepartures,
  onRefresh,
  onRequestEarlyDeparture,
  onVerifyReceipt,
}) => {
  const childOptions = useMemo(() => {
    const byId = new Map<string, { id: string; fullName: string; className: string; cycle: PickupCycleRecord | null }>();
    for (const c of userChildren) {
      const cycle = pickupCycles.find((p) => p.studentId === c.id) ?? null;
      byId.set(c.id, { id: c.id, fullName: cycle?.studentName || c.fullName, className: cycle?.className || c.className, cycle });
    }
    for (const cycle of pickupCycles) {
      if (!byId.has(cycle.studentId)) {
        byId.set(cycle.studentId, { id: cycle.studentId, fullName: cycle.studentName, className: cycle.className, cycle });
      }
    }
    for (const ed of earlyDepartures) {
      if (!byId.has(ed.studentId)) {
        byId.set(ed.studentId, { id: ed.studentId, fullName: ed.studentLabel, className: ed.classLabel, cycle: null });
      }
    }
    return [...byId.values()];
  }, [earlyDepartures, pickupCycles, userChildren]);

  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedCollectorId, setSelectedCollectorId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [requestedTime, setRequestedTime] = useState<string>('');
  const [fetchedCollectorsByStudent, setFetchedCollectorsByStudent] = useState<Record<string, PickupAuthorizedCollectorSummary[]>>({});

  useEffect(() => {
    setSelectedStudentId('');
    setSelectedCollectorId('');
    setReason('');
    setRequestedTime('');
    setFetchedCollectorsByStudent({});
  }, [currentUserId]);

  useEffect(() => {
    if (!selectedStudentId && childOptions.length > 0) {
      setSelectedStudentId(childOptions[0].id);
    }
  }, [childOptions, selectedStudentId]);

  const activeChild = childOptions.find((c) => c.id === selectedStudentId) ?? childOptions[0] ?? null;
  const activeStudentId = activeChild?.id ?? '';
  const cycleCollectors = activeChild?.cycle?.authorizedCollectors.filter((c) => c.status === 'ACTIVE') ?? [];

  useEffect(() => {
    if (!activeStudentId || earlyDeparturesAvailability !== 'READY') return;
    if (cycleCollectors.length > 0 || fetchedCollectorsByStudent[activeStudentId]) return;
    let active = true;
    void fetchAuthorizedPickupCollectors(activeStudentId, getTunisTodayIsoDate()).then((list) => {
      if (!active) return;
      setFetchedCollectorsByStudent((prev) => ({ ...prev, [activeStudentId]: list }));
    }).catch(() => {});
    return () => { active = false; };
  }, [activeStudentId, cycleCollectors.length, earlyDeparturesAvailability, fetchedCollectorsByStudent]);

  const availableCollectors = cycleCollectors.length > 0
    ? cycleCollectors
    : (activeStudentId ? (fetchedCollectorsByStudent[activeStudentId] ?? []) : []);

  const effectiveCollectorId = availableCollectors.some((c) => c.collectorId === selectedCollectorId)
    ? selectedCollectorId
    : (availableCollectors[0]?.collectorId ?? '');

  const mutation = activeStudentId ? earlyDepartureMutationState[activeStudentId] : undefined;
  const alreadyOpen = activeStudentId ? hasOpenOrCompletedEarlyDepartureForStudent(activeStudentId, earlyDepartures) : false;
  const isCycleIneligible = activeChild?.cycle?.attendanceEligibility === 'INELIGIBLE';
  const cleanReason = reason.trim();
  const canSubmit =
    earlyDeparturesAvailability === 'READY' &&
    Boolean(activeStudentId) &&
    Boolean(effectiveCollectorId) &&
    cleanReason.length >= 3 &&
    cleanReason.length <= 500 &&
    !alreadyOpen &&
    !isCycleIneligible &&
    mutation?.status !== 'SUBMITTING' &&
    mutation?.status !== 'UNKNOWN_OUTCOME';

  return (
    <div className="space-y-4" data-testid="pickup-parent-early-section">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-sm text-gray-900 dark:text-white">{t('pickupEarlySectionTitle')}</h3>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoadingEarlyDepartures}
          data-testid="early-departure-parent-refresh-btn"
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#141414] px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingEarlyDepartures ? 'animate-spin' : ''}`} />
          <span>{t('pickupRefreshFromServer')}</span>
        </button>
      </div>

      {childOptions.length > 0 && (
        <div className="bg-white dark:bg-[#111111] p-5 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3 text-xs">
          <p className="font-bold text-sm text-gray-900 dark:text-white">{t('pickupEarlyRequestFormTitle')}</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="space-y-1 block">
              <span className="font-semibold text-gray-700 dark:text-gray-300">{t('pickupEarlyStudentLabel')}</span>
              <select
                data-testid="early-departure-student-select"
                value={activeStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#161616] px-3 py-2 text-xs text-gray-900 dark:text-gray-100"
              >
                {childOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.fullName} ({c.className})</option>
                ))}
              </select>
            </label>

            <label className="space-y-1 block">
              <span className="font-semibold text-gray-700 dark:text-gray-300">{t('pickupEarlyCollectorLabel')}</span>
              <select
                data-testid="early-departure-collector-select"
                value={effectiveCollectorId}
                onChange={(e) => setSelectedCollectorId(e.target.value)}
                disabled={availableCollectors.length === 0}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#161616] px-3 py-2 text-xs text-gray-900 dark:text-gray-100 disabled:opacity-60"
              >
                {availableCollectors.length === 0 ? (
                  <option value="">{t('pickupEarlyNoCollectorsNotice')}</option>
                ) : (
                  availableCollectors.map((col) => (
                    <option key={col.collectorId} value={col.collectorId}>
                      {col.relationshipLabel ? `${col.fullName} (${col.relationshipLabel})` : col.fullName}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label className="space-y-1 block">
              <span className="font-semibold text-gray-700 dark:text-gray-300">{t('pickupEarlyRequestedTimeLabel')}</span>
              <input
                type="time"
                data-testid="early-departure-time-input"
                value={requestedTime}
                onChange={(e) => setRequestedTime(e.target.value)}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#161616] px-3 py-2 text-xs text-gray-900 dark:text-gray-100"
              />
            </label>
          </div>

          <label className="space-y-1 block">
            <span className="font-semibold text-gray-700 dark:text-gray-300">{t('pickupEarlyReasonLabel')}</span>
            <textarea
              rows={2}
              data-testid="early-departure-reason-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              placeholder={t('pickupEarlyReasonPlaceholder')}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#161616] px-3 py-2 text-xs text-gray-900 dark:text-gray-100"
            />
          </label>

          {alreadyOpen && (
            <div data-testid="early-departure-already-open-hint"
              className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-2.5 text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{t('pickupEarlyAlreadyOpenHint')}</span>
            </div>
          )}

          {isCycleIneligible && activeChild?.cycle && (
            <div className="rounded-xl bg-slate-100 dark:bg-slate-900/70 p-2.5 text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{resolvePickupReasonText(activeChild.cycle.attendanceReasonCode, t)}</span>
            </div>
          )}

          {mutation?.status === 'UNKNOWN_OUTCOME' && (
            <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-2.5 text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
              <span>{t('pickupUnknownOutcomeHint')}</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {onVerifyReceipt && (
                  <button type="button" data-testid="early-departure-parent-verify-btn"
                    onClick={() => onVerifyReceipt(activeStudentId)}
                    className="rounded-lg border border-amber-700 px-2.5 py-1 text-[11px] font-bold">
                    {t('pickupVerifyReceipt')}
                  </button>
                )}
                {mutation.operation === 'REQUEST' && mutation.payload && (
                  <button type="button" data-testid="early-departure-parent-retry-btn"
                    onClick={() => onRequestEarlyDeparture(mutation.payload as RequestEarlyDepartureInput)}
                    className="rounded-lg border border-amber-700 px-2.5 py-1 text-[11px] font-bold">
                    {t('pickupRetrySameRequest')}
                  </button>
                )}
              </div>
            </div>
          )}

          {(mutation?.status === 'CONFLICT' || mutation?.status === 'DENIED' || mutation?.status === 'UNAVAILABLE') && (
            <div data-testid="early-departure-parent-error"
              className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-2.5 text-red-800 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{resolvePickupReasonText(mutation.reasonCode, t, mutation.message)}</span>
            </div>
          )}

          <button
            type="button"
            data-testid="early-departure-submit-btn"
            disabled={!canSubmit}
            onClick={() => {
              if (!canSubmit) return;
              const requestedPickupAt = requestedTime
                ? buildTunisTimestampForTime(requestedTime, activeChild?.cycle?.schoolDate)
                : null;
              onRequestEarlyDeparture({
                studentId: activeStudentId,
                collectorId: effectiveCollectorId,
                reason: cleanReason,
                requestId: createPickupRequestId(),
                ...(requestedPickupAt ? { requestedPickupAt } : {}),
              });
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:dark:bg-gray-800 disabled:text-gray-500 px-4 py-2 font-bold text-white"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{mutation?.status === 'SUBMITTING' ? t('pickupEarlySubmitting') : t('pickupEarlySubmitBtn')}</span>
          </button>
        </div>
      )}

      {earlyDepartures.length === 0 ? (
        <div data-testid="early-departure-parent-empty"
          className="bg-white dark:bg-[#111111] p-5 rounded-3xl border border-gray-200 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-400">
          {t('pickupEarlyNoRequests')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {earlyDepartures.map((row) => {
            const badge = getEarlyDepartureBadgeMeta(row.status, t);
            return (
              <div key={row.id} data-testid={`early-departure-parent-card-${row.id}`}
                className="bg-white dark:bg-[#111111] p-5 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-2.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white">{row.studentLabel}</h4>
                    <p className="text-blue-600 dark:text-blue-400 font-medium">{row.classLabel}</p>
                  </div>
                  <span data-testid={`early-departure-parent-badge-${row.id}`}
                    className={`font-bold px-2.5 py-1 rounded-xl text-[11px] ${badge.toneClass}`}>
                    {badge.label}
                  </span>
                </div>
                <p className="text-gray-700 dark:text-gray-300">{row.reason}</p>
                <div className="text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-3 gap-y-1">
                  <span>{t('pickupCollectorLabel')}: {row.collectorLabel}</span>
                  {row.requestedPickupAt && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTunisPickupTime(row.requestedPickupAt, language)}
                    </span>
                  )}
                </div>
                {row.reviewReason && (
                  <div className="rounded-xl bg-slate-100 dark:bg-slate-900/70 p-2.5 text-slate-700 dark:text-slate-300">
                    {row.reviewReason}
                  </div>
                )}
                {row.status === 'COMPLETED' && row.completedAt && (
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-2.5 text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{formatTunisPickupTime(row.completedAt, language)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
