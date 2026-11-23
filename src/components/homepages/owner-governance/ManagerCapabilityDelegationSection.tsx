import React from 'react';
import { pickText } from '../../../i18n/homepages';
import {
  ALLOWED_MANAGER_CAPABILITIES,
  type GovernanceActorScope,
  type ManagerGrantRecord,
  type ManagerSummary,
} from '../../../lib/accountGovernance';
import type { Language } from '../../../types';
import { EmptyFeatureState } from '../shared/EmptyFeatureState';
import { ERROR_MESSAGES } from './governanceDisplayConfig';

export interface ManagerCapabilityDelegationSectionProps {
  language: Language;
  ordinaryReviewOnly: boolean;
  scope: GovernanceActorScope | null;
  delegationReason: string;
  setDelegationReason: React.Dispatch<React.SetStateAction<string>>;
  loadingDelegation: boolean;
  managersList: ManagerSummary[];
  managerGrants: ManagerGrantRecord[];
  submittingCapKey: string | null;
  handleToggleManagerCapability: (
    managerUserId: string,
    capability: string,
    nextActive: boolean,
  ) => Promise<void>;
}

export const ManagerCapabilityDelegationSection: React.FC<
  ManagerCapabilityDelegationSectionProps
> = ({
  language,
  ordinaryReviewOnly,
  scope,
  delegationReason,
  setDelegationReason,
  loadingDelegation,
  managersList,
  managerGrants,
  submittingCapKey,
  handleToggleManagerCapability,
}) => {
  return (
    <div className="mt-5 space-y-4" data-testid="gov-section-manager-delegation">
      {ordinaryReviewOnly || !scope?.canAppointPrivilegedRoles ? (
        <EmptyFeatureState
          state="UNAUTHORIZED"
          title={pickText(
            {
              ar: 'تفويض صلاحيات المدير المساعد مقتصر على مالك المدرسة (APP_ADMIN)',
              fr: 'Délégation Manager réservée à APP_ADMIN',
              en: 'Manager Capability Delegation is Restricted to School Owner (APP_ADMIN)',
            },
            language,
          )}
          description={pickText(ERROR_MESSAGES.owner_only_operation, language)}
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4 space-y-2">
            <h3 className="text-sm sm:text-base font-extrabold">
              🛡️{' '}
              {pickText(
                {
                  ar: 'منح وسحب صلاحيات المدير المساعد (MANAGER) عبر الخادم',
                  fr: 'Accorder et révoquer les capacités Manager côté serveur',
                  en: 'Owner-Only Server-Verified Manager Capability Delegation',
                },
                language,
              )}
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400">
              {pickText(
                {
                  ar: 'كل تغيير يُسجّل في سجل التدقيق الدائم. أدخل سبباً واضحاً (3–500 حرف) ثم فعّل أو اسحب أي صلاحية.',
                  fr: 'Chaque modification est enregistrée dans le journal d’audit. Saisissez un motif (3–500 car.) puis activez/révoquez une capacité.',
                  en: 'Every capability toggle writes an immutable audit trail entry. Enter an audit reason (3–500 chars), then toggle capabilities below.',
                },
                language,
              )}
            </p>
            <input
              type="text"
              value={delegationReason}
              onChange={(e) => setDelegationReason(e.target.value)}
              maxLength={500}
              placeholder={pickText(
                {
                  ar: 'سبب تفويض أو سحب الصلاحية (إلزامي 3–500 حرف)...',
                  fr: 'Motif d’audit obligatoire (3–500 caractères)...',
                  en: 'Mandatory audit reason for delegation change (3–500 chars)...',
                },
                language,
              )}
              className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-xs"
            />
          </div>

          {loadingDelegation ? (
            <div className="py-6 text-center text-xs font-bold text-slate-500">
              {pickText(
                {
                  ar: 'جاري تحميل قائمة المدراء المفوضين...',
                  fr: 'Chargement des Managers...',
                  en: 'Loading approved managers...',
                },
                language,
              )}
            </div>
          ) : managersList.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-zinc-800 p-6 text-center text-xs sm:text-sm text-slate-500">
              {pickText(
                {
                  ar: 'لا يوجد حسابات بدور MANAGER معتمد حالياً. يمكنك تعيين مدير مساعد من تبويب تعيين الأدوار القيادية.',
                  fr: 'Aucun compte MANAGER approuvé pour le moment. Nommez un Manager depuis l’onglet Gouvernance des rôles.',
                  en: 'No approved MANAGER accounts found yet. Appoint a Manager in Role Governance first.',
                },
                language,
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {managersList.map((mgr) => (
                <div
                  key={mgr.id}
                  data-testid={`manager-delegation-row-${mgr.id}`}
                  className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-extrabold text-sm">{mgr.fullName}</span>{' '}
                      <span className="text-xs font-mono text-slate-500">@{mgr.username}</span>
                      {mgr.email && (
                        <span className="ms-2 text-xs text-slate-500">• {mgr.email}</span>
                      )}
                    </div>
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                      {mgr.accountStatus} • v{mgr.governanceVersion}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {ALLOWED_MANAGER_CAPABILITIES.map((cap) => {
                      const isActive = managerGrants.some(
                        (g) => g.managerUserId === mgr.id && g.capability === cap && g.active,
                      );
                      const capKey = `${mgr.id}:${cap}`;
                      const busy = submittingCapKey === capKey;
                      return (
                        <button
                          key={cap}
                          type="button"
                          disabled={busy}
                          onClick={() => void handleToggleManagerCapability(mgr.id, cap, !isActive)}
                          className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs font-bold transition-colors disabled:opacity-50 ${
                            isActive
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                              : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <span className="truncate font-mono text-[11px]">{cap}</span>
                          <span>{isActive ? '✓ ON' : 'OFF'}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
