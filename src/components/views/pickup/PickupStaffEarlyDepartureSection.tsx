import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';
import type { AccountRole, Language } from '../../../types.ts';
import type { TranslationKey } from '../../../i18n/translations.ts';
import {
  createPickupRequestId,
  type CompleteEarlyDepartureInput,
  type EarlyDepartureMutationEntry,
  type EarlyDepartureRequestRow,
  type EarlyDepartureStatus,
  type PickupAvailabilityStatus,
  type ReviewEarlyDepartureInput,
} from '../../../lib/domains/pickup.ts';
import {
  formatTunisPickupTime,
  getEarlyDepartureBadgeMeta,
  resolvePickupReasonText,
} from './pickupDisplayMessages.ts';

export interface PickupStaffEarlyDepartureSectionProps {
  currentUserId?: string | null;
  currentRole: AccountRole;
  language: Language;
  t: (key: TranslationKey) => string;
  classesList?: { id: string; name: string }[];
  earlyDepartures: EarlyDepartureRequestRow[];
  earlyDeparturesAvailability: PickupAvailabilityStatus;
  earlyDepartureMutationState: Record<string, EarlyDepartureMutationEntry>;
  isLoadingEarlyDepartures: boolean;
  earlyDepartureRevoked?: boolean;
  onRefresh: (classId?: string | null) => void;
  onReviewEarlyDeparture: (input: ReviewEarlyDepartureInput) => void;
  onCompleteEarlyDeparture: (input: CompleteEarlyDepartureInput) => void;
  onVerifyReceipt?: (targetKey: string) => void;
}

export const PickupStaffEarlyDepartureSection: React.FC<PickupStaffEarlyDepartureSectionProps> = ({
  currentUserId,
  currentRole,
  language,
  t,
  classesList = [],
  earlyDepartures,
  earlyDeparturesAvailability,
  earlyDepartureMutationState,
  isLoadingEarlyDepartures,
  earlyDepartureRevoked = false,
  onRefresh,
  onReviewEarlyDeparture,
  onCompleteEarlyDeparture,
  onVerifyReceipt,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | EarlyDepartureStatus>('ALL');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [completionState, setCompletionState] = useState<Record<string, { verified: boolean; notes: string }>>({});

  useEffect(() => {
    setStatusFilter('ALL');
    setSelectedClassId('');
    setReviewNotes({});
    setCompletionState({});
  }, [currentUserId]);

  const classOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of classesList) {
      if (c.id && c.name) map.set(c.id, c.name);
    }
    for (const ed of earlyDepartures) {
      if (ed.classId && ed.classLabel) map.set(ed.classId, ed.classLabel);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [classesList, earlyDepartures]);

  const scopedRows = selectedClassId ? earlyDepartures.filter((e) => e.classId === selectedClassId) : earlyDepartures;
  const filteredRows = statusFilter === 'ALL' ? scopedRows : scopedRows.filter((e) => e.status === statusFilter);

  if (currentRole === 'SCHOOL_STAFF' || earlyDeparturesAvailability === 'UNAUTHORIZED') {
    return (
      <div data-testid="early-departure-staff-unauthorized"
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-4 py-3 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 shrink-0 text-slate-500" />
        <span>{t('pickupEarlyUnauthorizedNotice')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="pickup-staff-early-section">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-sm text-gray-900 dark:text-white">{t('pickupEarlySectionTitle')}</h3>
        <div className="flex flex-wrap items-center gap-2">
          {classOptions.length > 1 && earlyDeparturesAvailability === 'READY' && (
            <select
              aria-label={t('pickupAllClasses')}
              data-testid="early-departure-staff-class-filter"
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
            disabled={isLoadingEarlyDepartures}
            data-testid="early-departure-staff-refresh-btn"
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#141414] px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingEarlyDepartures ? 'animate-spin' : ''}`} />
            <span>{t('pickupRefreshFromServer')}</span>
          </button>
        </div>
      </div>

      {earlyDepartureRevoked && (
        <div data-testid="early-departure-revoked-banner"
          className="rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-3 text-xs text-red-800 dark:text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{t('pickupReleaseRevokedNotice')}</span>
        </div>
      )}

      {earlyDeparturesAvailability !== 'READY' ? (
        <div data-testid="early-departure-staff-unavailable"
          className="bg-white dark:bg-[#111111] p-5 rounded-3xl border border-gray-200 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-400">
          {t('pickupStateUnavailable')}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(['ALL', 'PENDING', 'APPROVED', 'COMPLETED', 'REJECTED'] as const).map((st) => {
              const count = st === 'ALL' ? scopedRows.length : scopedRows.filter((r) => r.status === st).length;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                    statusFilter === st
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-white dark:bg-[#111111] border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {st === 'ALL' ? t('seeAll') : getEarlyDepartureBadgeMeta(st, t).label} ({count})
                </button>
              );
            })}
          </div>

          {filteredRows.length === 0 ? (
            <div data-testid="early-departure-staff-empty"
              className="bg-white dark:bg-[#111111] p-5 rounded-3xl border border-gray-200 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-400">
              {t('pickupEarlyNoRequests')}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRows.map((row) => {
                const badge = getEarlyDepartureBadgeMeta(row.status, t);
                const mutation = earlyDepartureMutationState[row.id];
                const noteVal = reviewNotes[row.id] ?? '';
                const cleanNote = noteVal.trim();
                const comp = completionState[row.id] ?? { verified: false, notes: '' };
                const isBusy = mutation?.status === 'SUBMITTING' || mutation?.status === 'UNKNOWN_OUTCOME';
                const canReviewRow = row.status === 'PENDING' && row.canReview && !earlyDepartureRevoked && !isBusy;
                const canCompleteRow = row.status === 'APPROVED' && row.canComplete && !earlyDepartureRevoked && !isBusy;

                return (
                  <div key={row.id} data-testid={`early-departure-staff-card-${row.id}`}
                    className="bg-white dark:bg-[#111111] p-5 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-gray-900 dark:text-white">{row.studentLabel}</h4>
                        <p className="text-blue-600 dark:text-blue-400 font-medium">{row.classLabel}</p>
                      </div>
                      <span data-testid={`early-departure-staff-badge-${row.id}`}
                        className={`font-bold px-2.5 py-1 rounded-xl text-[11px] ${badge.toneClass}`}>
                        {badge.label}
                      </span>
                    </div>

                    <p className="text-gray-700 dark:text-gray-300">{row.reason}</p>
                    <div className="text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-3 gap-y-1">
                      <span>{t('pickupCollectorLabel')}: {row.collectorLabel}</span>
                      {row.requestedByLabel && <span>({row.requestedByLabel})</span>}
                      {row.requestedPickupAt && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTunisPickupTime(row.requestedPickupAt, language)}
                        </span>
                      )}
                    </div>

                    {row.reviewReason && (
                      <div className="rounded-xl bg-slate-100 dark:bg-slate-900/70 p-2.5 text-slate-700 dark:text-slate-300">
                        {row.reviewedByLabel ? `${row.reviewedByLabel}: ` : ''}{row.reviewReason}
                      </div>
                    )}

                    {row.status === 'COMPLETED' && (
                      <div data-testid={`early-departure-completed-receipt-${row.id}`}
                        className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-2.5 text-emerald-800 dark:text-emerald-300 space-y-1">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{t('pickupReleasedReceiptLabel')}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-2 text-[11px]">
                          {row.completedAt && <span>{formatTunisPickupTime(row.completedAt, language)}</span>}
                          {row.collectorLabel && <span>• {row.collectorLabel}</span>}
                          {row.releasedByLabel && <span>• {row.releasedByLabel}</span>}
                        </div>
                        {row.handoffNotes && <p className="text-[11px] opacity-90">{row.handoffNotes}</p>}
                      </div>
                    )}

                    {(mutation?.status === 'CONFLICT' || mutation?.status === 'DENIED' || mutation?.status === 'UNAVAILABLE') && (
                      <div data-testid={`early-departure-staff-error-${row.id}`}
                        className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-2.5 text-red-800 dark:text-red-300 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{resolvePickupReasonText(mutation.reasonCode, t, mutation.message)}</span>
                      </div>
                    )}

                    {mutation?.status === 'UNKNOWN_OUTCOME' && (
                      <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-2.5 text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
                        <span>{t('pickupUnknownOutcomeHint')}</span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {onVerifyReceipt && (
                            <button type="button" data-testid={`early-departure-verify-receipt-${row.id}`}
                              onClick={() => onVerifyReceipt(row.id)}
                              className="rounded-lg border border-amber-700 px-2 py-1 text-[11px] font-bold">
                              {t('pickupVerifyReceipt')}
                            </button>
                          )}
                          {mutation.operation === 'REVIEW' && mutation.payload && (
                            <button type="button" data-testid={`early-departure-retry-review-${row.id}`}
                              onClick={() => onReviewEarlyDeparture(mutation.payload as ReviewEarlyDepartureInput)}
                              className="rounded-lg border border-amber-700 px-2 py-1 text-[11px] font-bold">
                              {t('pickupRetrySameRequest')}
                            </button>
                          )}
                          {mutation.operation === 'COMPLETE' && mutation.payload && (
                            <button type="button" data-testid={`early-departure-retry-complete-${row.id}`}
                              onClick={() => onCompleteEarlyDeparture(mutation.payload as CompleteEarlyDepartureInput)}
                              className="rounded-lg border border-amber-700 px-2 py-1 text-[11px] font-bold">
                              {t('pickupRetrySameRequest')}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {canReviewRow && (
                      <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                        <input
                          type="text"
                          data-testid={`early-departure-review-note-${row.id}`}
                          value={noteVal}
                          onChange={(e) => setReviewNotes((prev) => ({ ...prev, [row.id]: e.target.value }))}
                          placeholder={t('pickupEarlyReviewNotePlaceholder')}
                          maxLength={500}
                          className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#161616] px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100"
                        />
                        {cleanNote.length > 0 && cleanNote.length < 3 && (
                          <p className="text-[11px] text-amber-700 dark:text-amber-400">{t('pickupEarlyRejectReasonRequired')}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            data-testid={`early-departure-approve-btn-${row.id}`}
                            disabled={cleanNote.length > 500}
                            onClick={() => {
                              onReviewEarlyDeparture({
                                earlyDepartureId: row.id,
                                decision: 'APPROVED',
                                requestId: createPickupRequestId(),
                                expectedVersion: row.version,
                                ...(cleanNote ? { reviewReason: cleanNote } : {}),
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-3 py-1.5 font-bold text-white"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{t('pickupEarlyApproveBtn')}</span>
                          </button>
                          <button
                            type="button"
                            data-testid={`early-departure-reject-btn-${row.id}`}
                            disabled={cleanNote.length < 3 || cleanNote.length > 500}
                            onClick={() => {
                              if (cleanNote.length < 3 || cleanNote.length > 500) return;
                              onReviewEarlyDeparture({
                                earlyDepartureId: row.id,
                                decision: 'REJECTED',
                                requestId: createPickupRequestId(),
                                expectedVersion: row.version,
                                reviewReason: cleanNote,
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 disabled:opacity-50 px-3 py-1.5 font-bold text-red-700 dark:text-red-300"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>{t('pickupEarlyRejectBtn')}</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {canCompleteRow && (
                      <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                        <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                          <input
                            type="checkbox"
                            data-testid={`early-departure-verify-checkbox-${row.id}`}
                            checked={comp.verified}
                            onChange={(e) => setCompletionState((prev) => ({
                              ...prev,
                              [row.id]: { verified: e.target.checked, notes: comp.notes },
                            }))}
                          />
                          <span>{t('pickupEarlyVerifyInPersonLabel')}</span>
                        </label>
                        <input
                          type="text"
                          data-testid={`early-departure-handoff-notes-${row.id}`}
                          value={comp.notes}
                          onChange={(e) => setCompletionState((prev) => ({
                            ...prev,
                            [row.id]: { verified: comp.verified, notes: e.target.value },
                          }))}
                          placeholder={t('pickupHandoffNotesPlaceholder')}
                          maxLength={500}
                          className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#161616] px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100"
                        />
                        <button
                          type="button"
                          data-testid={`early-departure-complete-btn-${row.id}`}
                          disabled={!comp.verified}
                          onClick={() => {
                            if (!comp.verified) return;
                            const cleanNotes = comp.notes.trim();
                            onCompleteEarlyDeparture({
                              earlyDepartureId: row.id,
                              collectorId: row.collectorId,
                              requestId: createPickupRequestId(),
                              expectedVersion: row.version,
                              inPersonVerified: true,
                              ...(cleanNotes ? { handoffNotes: cleanNotes } : {}),
                            });
                          }}
                          className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:dark:bg-gray-800 disabled:text-gray-500 text-white font-bold"
                        >
                          {t('pickupEarlyCompleteBtn')}
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
