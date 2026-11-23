import React from 'react';
import { History } from 'lucide-react';
import { pickText } from '../../../i18n/homepages';
import type { OfficeAttendanceContextResult } from '../../../lib/attendance/api';
import { formatAttendanceTimestamp } from '../../../lib/attendance/dateUtils';
import type { AttendanceRegisterData, Language, User } from '../../../types';
import { getAuditEventLabel } from './attendanceLabels';
import type { ScopedAuditState } from './useStaffAttendanceRegister';

export interface RegisterAuditTrailPanelProps {
  visibleRegister: AttendanceRegisterData;
  currentUser: User | null;
  officeSyncedData: OfficeAttendanceContextResult | null;
  language: Language;
  t: (key: any) => string;
  auditState: ScopedAuditState;
  isAuditScopeSynced: boolean;
  loadAuditHistory: (registerId: string) => Promise<void>;
}

export const RegisterAuditTrailPanel: React.FC<RegisterAuditTrailPanelProps> = ({
  visibleRegister,
  currentUser,
  officeSyncedData,
  language,
  t,
  auditState,
  isAuditScopeSynced,
  loadAuditHistory,
}) => {
  if (!visibleRegister.registerId) return null;

  return (
    <section
      data-testid="attendance-audit-panel"
      className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111111] p-5 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-zinc-200 flex items-center gap-2">
          <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>
            {pickText(
              {
                ar: 'سجل التدقيق غير القابل للتعديل',
                fr: 'Journal d’audit immuable',
                en: 'Immutable Attendance Audit Trail',
              },
              language,
            )}
          </span>
        </h3>
        <button
          type="button"
          onClick={() => visibleRegister.registerId && void loadAuditHistory(visibleRegister.registerId)}
          className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
        >
          {pickText({ ar: 'تحديث', fr: 'Actualiser', en: 'Refresh' }, language)}
        </button>
      </div>

      {!isAuditScopeSynced || auditState.status === 'LOADING' ? (
        <p data-testid="attendance-audit-loading" className="text-xs text-slate-500">
          {t('loading')}
        </p>
      ) : auditState.status !== 'READY' ? (
        <p data-testid="attendance-audit-error" className="text-xs font-semibold text-red-600 dark:text-red-400">
          {auditState.errorMessage || t('error')}
        </p>
      ) : (
        (() => {
          const scopedAuditItems = auditState.items.filter(
            (ev) => ev.registerId === visibleRegister.registerId,
          );
          if (scopedAuditItems.length === 0) {
            return (
              <p className="text-xs text-slate-500">
                {pickText(
                  {
                    ar: 'لا توجد أحداث مسجلة بعد.',
                    fr: 'Aucun événement enregistré.',
                    en: 'No audit events recorded yet.',
                  },
                  language,
                )}
              </p>
            );
          }
          return (
            <div className="divide-y divide-slate-100 dark:divide-zinc-800">
              {scopedAuditItems.map((ev) => {
                const actorName =
                  ev.actorUserId === currentUser?.id
                    ? currentUser.fullName
                    : officeSyncedData?.accountNamesById[ev.actorUserId] ||
                      `@${ev.actorUserId.slice(0, 8)}`;
                return (
                  <div key={ev.id} className="py-2.5 text-xs space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-slate-900 dark:text-white">
                          {getAuditEventLabel(ev.eventType, language)}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                          v{ev.registerVersion}
                        </span>
                        <span className="text-slate-600 dark:text-zinc-300">— {actorName}</span>
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-zinc-400">
                        {formatAttendanceTimestamp(ev.recordedAt, language)}
                      </span>
                    </div>
                    {ev.reason && (
                      <p className="text-slate-700 dark:text-zinc-300">
                        <span className="font-bold">
                          {pickText({ ar: 'السبب:', fr: 'Motif :', en: 'Reason:' }, language)}{' '}
                        </span>
                        {ev.reason}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()
      )}
    </section>
  );
};
