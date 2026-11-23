import React from 'react';
import { pickText } from '../../../i18n/homepages';
import {
  CANONICAL_ROLES,
  type GovernanceAccountRecord,
  type GovernanceLifecycleDecision,
} from '../../../lib/accountGovernance';
import type { AccountRole, Language } from '../../../types';
import {
  ROLE_LABELS,
  STATUS_BADGE_STYLES,
  STATUS_LABELS,
} from './governanceDisplayConfig';

export interface PendingAccountApprovalsSectionProps {
  language: Language;
  pendingItems: GovernanceAccountRecord[];
  pendingTotal: number;
  pendingSearch: string;
  setPendingSearch: (val: string) => void;
  pendingRoleFilter: AccountRole | 'ALL';
  setPendingRoleFilter: (val: AccountRole | 'ALL') => void;
  pendingPage: number;
  setPendingPage: React.Dispatch<React.SetStateAction<number>>;
  loadingPending: boolean;
  assignableRoles: readonly AccountRole[];
  selectedRolesByTarget: Record<string, AccountRole>;
  setSelectedRolesByTarget: React.Dispatch<React.SetStateAction<Record<string, AccountRole>>>;
  reasonsByTarget: Record<string, string>;
  setReasonsByTarget: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  submittingTargetId: string | null;
  handleInspectAccountDetail: (userId: string) => Promise<void>;
  handleReviewDecision: (
    account: GovernanceAccountRecord,
    decision: GovernanceLifecycleDecision,
  ) => Promise<void>;
}

export const PendingAccountApprovalsSection: React.FC<PendingAccountApprovalsSectionProps> = ({
  language,
  pendingItems,
  pendingTotal,
  pendingSearch,
  setPendingSearch,
  pendingRoleFilter,
  setPendingRoleFilter,
  pendingPage,
  setPendingPage,
  loadingPending,
  assignableRoles,
  selectedRolesByTarget,
  setSelectedRolesByTarget,
  reasonsByTarget,
  setReasonsByTarget,
  submittingTargetId,
  handleInspectAccountDetail,
  handleReviewDecision,
}) => {
  return (
    <div className="mt-5 space-y-4" data-testid="gov-section-pending-approvals">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={pendingSearch}
          onChange={(e) => {
            setPendingSearch(e.target.value);
            setPendingPage(1);
          }}
          placeholder={pickText(
            {
              ar: 'بحث بالاسم، اسم المستخدم، أو البريد...',
              fr: 'Rechercher par nom, identifiant ou e-mail...',
              en: 'Search by name, username, or email...',
            },
            language,
          )}
          className="flex-1 min-w-[220px] rounded-xl border border-slate-300 dark:border-zinc-700 bg-transparent px-3.5 py-2 text-xs sm:text-sm"
        />
        <select
          value={pendingRoleFilter}
          onChange={(e) => {
            setPendingRoleFilter(e.target.value as AccountRole | 'ALL');
            setPendingPage(1);
          }}
          aria-label="Filter pending accounts by requested role"
          className="rounded-xl border border-slate-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-xs sm:text-sm font-bold"
        >
          <option value="ALL">
            {pickText({ ar: 'جميع الأدوار المطلوبة', fr: 'Tous les rôles demandés', en: 'All requested roles' }, language)}
          </option>
          {CANONICAL_ROLES.map((r: AccountRole) => (
            <option key={r} value={r}>
              {pickText(ROLE_LABELS[r], language)} ({r})
            </option>
          ))}
        </select>
      </div>

      {loadingPending ? (
        <div className="py-6 text-center text-xs font-bold text-slate-500">
          {pickText({ ar: 'جاري تحميل الطلبات المعلقة...', fr: 'Chargement des demandes...', en: 'Loading pending accounts...' }, language)}
        </div>
      ) : pendingItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-zinc-800 p-6 text-center text-xs sm:text-sm text-slate-500">
          {pickText(
            {
              ar: 'لا توجد طلبات حسابات معلقة تطابق معايير البحث حالياً.',
              fr: 'Aucune demande de compte en attente pour ces critères.',
              en: 'No pending account applications match the current filters.',
            },
            language,
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {pendingItems.map((item) => {
            const contactConfirmed = item.emailConfirmed || item.phoneConfirmed;
            const selectedRole = selectedRolesByTarget[item.id] || item.requestedRole;
            const reasonVal = reasonsByTarget[item.id] || '';
            const isBusy = submittingTargetId === item.id;

            return (
              <div
                key={item.id}
                data-testid={`pending-account-row-${item.id}`}
                className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-sm sm:text-base">{item.fullName}</span>
                      <span className="text-xs font-mono text-slate-500">@{item.username}</span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${STATUS_BADGE_STYLES[item.accountStatus]}`}
                      >
                        {pickText(STATUS_LABELS[item.accountStatus], language)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-600 dark:text-zinc-400 space-x-3 rtl:space-x-reverse">
                      <span>{item.email || '—'}</span>
                      {item.phone && <span>• {item.phone}</span>}
                      {item.staffId && <span>• Staff ID: {item.staffId}</span>}
                      {item.admissionId && <span>• Admission ID: {item.admissionId}</span>}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        contactConfirmed
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                      }`}
                    >
                      {contactConfirmed
                        ? pickText(
                            { ar: '✓ تم تأكيد البريد/الهاتف', fr: '✓ Contact confirmé', en: '✓ Contact confirmed' },
                            language,
                          )
                        : pickText(
                            { ar: '⚠ بانتظار تأكيد البريد/الهاتف', fr: '⚠ Contact non confirmé', en: '⚠ Unconfirmed contact' },
                            language,
                          )}
                    </span>
                    <span className="rounded-full bg-slate-100 dark:bg-zinc-800 px-2.5 py-0.5 text-[11px] font-bold">
                      {pickText({ ar: 'الدور المطلوب:', fr: 'Rôle demandé :', en: 'Requested:' }, language)}{' '}
                      {pickText(ROLE_LABELS[item.requestedRole], language)} ({item.requestedRole})
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800/80">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      {pickText({ ar: 'الدور المعتمد عند الموافقة', fr: 'Rôle à attribuer', en: 'Role to assign on approval' }, language)}
                    </label>
                    <select
                      value={selectedRole}
                      onChange={(e) =>
                        setSelectedRolesByTarget((prev) => ({
                          ...prev,
                          [item.id]: e.target.value as AccountRole,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-transparent px-2.5 py-1.5 text-xs font-bold"
                    >
                      {assignableRoles.map((r: AccountRole) => (
                        <option key={r} value={r}>
                          {pickText(ROLE_LABELS[r], language)} ({r})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      {pickText(
                        { ar: 'سبب القرار (إلزامي لسجل التدقيق)', fr: 'Motif de la décision (obligatoire pour l’audit)', en: 'Audit reason (required, 3–500 chars)' },
                        language,
                      )}
                    </label>
                    <input
                      type="text"
                      value={reasonVal}
                      onChange={(e) =>
                        setReasonsByTarget((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                      placeholder={pickText(
                        {
                          ar: 'مثال: تم التحقق من ملف التسجيل / عقد العمل...',
                          fr: 'Ex: Dossier d’inscription ou contrat vérifié...',
                          en: 'e.g., Verified parent enrollment record or staff contract...',
                        },
                        language,
                      )}
                      className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-transparent px-3 py-1.5 text-xs"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleInspectAccountDetail(item.id)}
                    className="rounded-xl border border-slate-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-bold hover:bg-slate-100 dark:hover:bg-zinc-900"
                  >
                    {pickText({ ar: 'سجل التدقيق', fr: 'Journal d’audit', en: 'Audit Log' }, language)}
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleReviewDecision(item, 'REJECT')}
                    className="rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-extrabold text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    {pickText({ ar: 'رفض الطلب (REJECT)', fr: 'Refuser (REJECT)', en: 'Reject' }, language)}
                  </button>
                  <button
                    type="button"
                    disabled={isBusy || !contactConfirmed}
                    onClick={() => void handleReviewDecision(item, 'APPROVE')}
                    className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {pickText({ ar: 'اعتماد الحساب (APPROVE)', fr: 'Approuver (APPROVE)', en: 'Approve Account' }, language)}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
        <span>
          {pickText({ ar: 'إجمالي الطلبات:', fr: 'Total en attente :', en: 'Total pending:' }, language)} {pendingTotal}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pendingPage <= 1}
            onClick={() => setPendingPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border px-2.5 py-1 disabled:opacity-40"
          >
            ←
          </button>
          <span>Page {pendingPage}</span>
          <button
            type="button"
            disabled={pendingPage * 10 >= pendingTotal}
            onClick={() => setPendingPage((p) => p + 1)}
            className="rounded-lg border px-2.5 py-1 disabled:opacity-40"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
};
