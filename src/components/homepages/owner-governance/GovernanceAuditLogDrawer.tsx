import React from 'react';
import { pickText } from '../../../i18n/homepages';
import type { GovernanceAccountDetail, GovernanceAuditLogEntry } from '../../../lib/accountGovernance';
import type { Language } from '../../../types';

export interface GovernanceAuditLogDrawerProps {
  language: Language;
  selectedDetail: GovernanceAccountDetail | null;
  onClose: () => void;
}

export const GovernanceAuditLogDrawer: React.FC<GovernanceAuditLogDrawerProps> = ({
  language,
  selectedDetail,
  onClose,
}) => {
  if (!selectedDetail) return null;

  return (
    <div
      data-testid="governance-account-detail-drawer"
      className="mt-5 rounded-2xl border border-slate-300 dark:border-zinc-700 p-4 space-y-3 bg-slate-50/70 dark:bg-zinc-900/60"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-extrabold">
          📋{' '}
          {pickText(
            {
              ar: `سجل التدقيق غير القابل للتعديل: ${selectedDetail.account.fullName} (@${selectedDetail.account.username})`,
              fr: `Journal d’audit immuable : ${selectedDetail.account.fullName} (@${selectedDetail.account.username})`,
              en: `Immutable Governance Audit Log: ${selectedDetail.account.fullName} (@${selectedDetail.account.username})`,
            },
            language,
          )}
        </h4>
        <button type="button" onClick={onClose} className="text-xs font-bold underline">
          {pickText({ ar: 'إخفاء السجل', fr: 'Masquer', en: 'Hide Log' }, language)}
        </button>
      </div>

      {selectedDetail.auditTrail.length === 0 ? (
        <p className="text-xs text-slate-500">
          {pickText(
            {
              ar: 'لا توجد عمليات مسجلة بعد لهذا الحساب.',
              fr: 'Aucune entrée d’audit pour ce compte.',
              en: 'No governance audit entries recorded for this account yet.',
            },
            language,
          )}
        </p>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {selectedDetail.auditTrail.map((log: GovernanceAuditLogEntry) => (
            <div
              key={log.id}
              className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
                <span>
                  {log.action}
                  {log.capability ? ` (${log.capability})` : ''}: {log.previousStatus} →{' '}
                  {log.resultingStatus} ({log.resultingRoles.join(', ') || 'none'})
                </span>
                <span className="text-[11px] text-slate-500">{log.createdAt}</span>
              </div>
              <div className="mt-1 text-slate-600 dark:text-zinc-400">
                Actor: <code className="font-mono">{log.actorUserId}</code> ({log.actorRole}) •
                Reason: “{log.reason}”
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
