import React from 'react';
import { BellRing, RefreshCw, RotateCcw } from 'lucide-react';
import type { TranslationKey } from '../../../i18n/translations.ts';
import type { PickupOutboxRetryResult, PickupOutboxSummary } from '../../../lib/domains/pickup.ts';

export interface PickupOutboxHealthCardProps {
  t: (key: TranslationKey) => string;
  summary?: PickupOutboxSummary | null;
  isLoading?: boolean;
  isRetrying?: boolean;
  onRefresh?: () => Promise<PickupOutboxSummary>;
  onRetryFailed?: () => Promise<PickupOutboxRetryResult>;
}

export const PickupOutboxHealthCard: React.FC<PickupOutboxHealthCardProps> = ({
  t,
  summary = null,
  isLoading = false,
  isRetrying = false,
  onRefresh,
  onRetryFailed,
}) => {
  const failedCount = summary?.failedCount ?? 0;

  return (
    <div
      data-testid="pickup-outbox-health-card"
      className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111111] p-4 space-y-3 text-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">
          <BellRing className="w-4 h-4 text-emerald-600" />
          <span>{t('pickupOutboxHealthTitle')}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              data-testid="pickup-outbox-refresh-btn"
              disabled={isLoading}
              onClick={() => {
                void onRefresh();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-semibold text-gray-700 dark:text-gray-200 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{t('pickupOutboxRefreshBtn')}</span>
            </button>
          )}
          {onRetryFailed && (
            <button
              type="button"
              data-testid="pickup-outbox-retry-btn"
              disabled={isRetrying || failedCount === 0}
              onClick={() => {
                void onRetryFailed();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 px-3 py-1.5 font-bold text-white"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>{isRetrying ? t('pickupOutboxRetrying') : t('pickupOutboxRetryFailedBtn')}</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div className="rounded-xl bg-gray-50 dark:bg-gray-900/70 px-3 py-2">
          <p className="text-[11px] text-gray-500">{t('pickupOutboxPendingLabel')}</p>
          <p className="font-extrabold text-sm text-gray-900 dark:text-white" data-testid="pickup-outbox-pending-count">
            {summary?.pendingCount ?? 0}
          </p>
        </div>
        <div className="rounded-xl bg-amber-50/70 dark:bg-amber-950/30 px-3 py-2">
          <p className="text-[11px] text-amber-800 dark:text-amber-300">{t('pickupOutboxRetryingLabel')}</p>
          <p className="font-extrabold text-sm text-amber-900 dark:text-amber-200" data-testid="pickup-outbox-retry-count">
            {summary?.retryCount ?? 0}
          </p>
        </div>
        <div className="rounded-xl bg-sky-50/70 dark:bg-sky-950/30 px-3 py-2">
          <p className="text-[11px] text-sky-800 dark:text-sky-300">{t('pickupOutboxProcessingLabel')}</p>
          <p className="font-extrabold text-sm text-sky-900 dark:text-sky-200" data-testid="pickup-outbox-processing-count">
            {summary?.processingCount ?? 0}
          </p>
        </div>
        <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 px-3 py-2">
          <p className="text-[11px] text-emerald-800 dark:text-emerald-300">{t('pickupOutboxSentLabel')}</p>
          <p className="font-extrabold text-sm text-emerald-900 dark:text-emerald-200" data-testid="pickup-outbox-sent-count">
            {summary?.sentCount ?? 0}
          </p>
        </div>
        <div className="rounded-xl bg-red-50/70 dark:bg-red-950/30 px-3 py-2">
          <p className="text-[11px] text-red-800 dark:text-red-300">{t('pickupOutboxFailedLabel')}</p>
          <p className="font-extrabold text-sm text-red-900 dark:text-red-200" data-testid="pickup-outbox-failed-count">
            {failedCount}
          </p>
        </div>
      </div>

      {summary && summary.recentFailures.length > 0 ? (
        <div className="space-y-1.5 pt-1 border-t border-gray-100 dark:border-gray-800">
          <p className="font-semibold text-gray-700 dark:text-gray-300">{t('pickupOutboxRecentFailuresLabel')}</p>
          <div className="space-y-1">
            {summary.recentFailures.slice(0, 5).map((item) => (
              <div
                key={item.id}
                data-testid={`pickup-outbox-failure-${item.id}`}
                className="rounded-xl bg-red-50/60 dark:bg-red-950/20 px-3 py-1.5 text-[11px] text-red-800 dark:text-red-300 flex flex-wrap items-center justify-between gap-2"
              >
                <span className="font-semibold">
                  {item.eventType} ({item.attemptCount})
                </span>
                <span className="truncate max-w-xs">{item.lastError || '-'}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-gray-500 dark:text-gray-400" data-testid="pickup-outbox-no-failures">
          {t('pickupOutboxNoFailures')}
        </p>
      )}
    </div>
  );
};
