import React from 'react';
import { pickText } from '../../../i18n/homepages';
import {
  PRIVILEGED_ROLES,
  type GovernanceAccountRecord,
  type GovernanceActorScope,
  type PrivilegedRole,
} from '../../../lib/accountGovernance';
import type { Language } from '../../../types';
import { EmptyFeatureState } from '../shared/EmptyFeatureState';
import { ERROR_MESSAGES, ROLE_LABELS } from './governanceDisplayConfig';

export interface PrivilegedRoleGovernanceSectionProps {
  language: Language;
  ordinaryReviewOnly: boolean;
  scope: GovernanceActorScope | null;
  directoryItems: GovernanceAccountRecord[];
  appointTargetId: string;
  setAppointTargetId: React.Dispatch<React.SetStateAction<string>>;
  appointExpectedVersion: number;
  setAppointExpectedVersion: React.Dispatch<React.SetStateAction<number>>;
  appointRole: PrivilegedRole;
  setAppointRole: React.Dispatch<React.SetStateAction<PrivilegedRole>>;
  appointAction: 'GRANT' | 'REVOKE';
  setAppointAction: React.Dispatch<React.SetStateAction<'GRANT' | 'REVOKE'>>;
  appointReason: string;
  setAppointReason: React.Dispatch<React.SetStateAction<string>>;
  appointConfirmed: boolean;
  setAppointConfirmed: React.Dispatch<React.SetStateAction<boolean>>;
  submittingAppoint: boolean;
  handlePrivilegedAppointmentSubmit: (e: React.FormEvent) => Promise<void>;
}

export const PrivilegedRoleGovernanceSection: React.FC<PrivilegedRoleGovernanceSectionProps> = ({
  language,
  ordinaryReviewOnly,
  scope,
  directoryItems,
  appointTargetId,
  setAppointTargetId,
  appointExpectedVersion,
  setAppointExpectedVersion,
  appointRole,
  setAppointRole,
  appointAction,
  setAppointAction,
  appointReason,
  setAppointReason,
  appointConfirmed,
  setAppointConfirmed,
  submittingAppoint,
  handlePrivilegedAppointmentSubmit,
}) => {
  return (
    <div className="mt-5 space-y-4" data-testid="gov-section-role-governance">
      {ordinaryReviewOnly || !scope?.canAppointPrivilegedRoles ? (
        <EmptyFeatureState
          state="UNAUTHORIZED"
          title={pickText(
            {
              ar: 'تعيين الأدوار القيادية مقتصر على مالك المدرسة (APP_ADMIN)',
              fr: 'Nomination des rôles privilégiés réservée à APP_ADMIN',
              en: 'Privileged Role Appointment is Restricted to School Owner (APP_ADMIN)',
            },
            language,
          )}
          description={pickText(ERROR_MESSAGES.owner_only_operation, language)}
        />
      ) : (
        <form
          onSubmit={(e) => void handlePrivilegedAppointmentSubmit(e)}
          className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5 space-y-4"
        >
          <div>
            <h3 className="text-sm sm:text-base font-extrabold">
              👑{' '}
              {pickText(
                {
                  ar: 'تعيين أو سحب دور قيادي (MANAGER / APP_ADMIN) — صلاحية مالك المدرسة حصرياً',
                  fr: 'Nomination ou révocation d’un rôle privilégié (MANAGER / APP_ADMIN)',
                  en: 'Owner-Only Privileged Role Appointment & Removal (MANAGER / APP_ADMIN)',
                },
                language,
              )}
            </h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">
              {pickText(
                {
                  ar: 'لا يُسمح بالتسجيل الذاتي لأدوار MANAGER و APP_ADMIN. يجب أن يمتلك المستخدم حساباً مؤكداً بالبريد أو الهاتف قبل ترقيته من طرف مالك المدرسة. يمنع الخادم تلقائياً إزالة آخر مالك مدرسة نشط.',
                  fr: 'L’auto-inscription aux rôles MANAGER et APP_ADMIN est interdite. Le compte cible doit avoir un contact vérifié. Le serveur bloque la suppression du dernier Propriétaire actif.',
                  en: 'Self-registration never grants MANAGER or APP_ADMIN. The target account must have a confirmed email or phone. The server enforces last-Owner protection.',
                },
                language,
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold mb-1">
                {pickText(
                  {
                    ar: 'اختر حساباً من الدليل أو أدخل معرف UUID',
                    fr: 'Compte cible (UUID)',
                    en: 'Target Account (Select or enter UUID)',
                  },
                  language,
                )}
              </label>
              <select
                value={appointTargetId}
                onChange={(e) => {
                  const id = e.target.value;
                  setAppointTargetId(id);
                  const found = directoryItems.find((item) => item.id === id);
                  if (found) {
                    setAppointExpectedVersion(found.governanceVersion);
                  }
                }}
                className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-xs font-bold mb-2"
              >
                <option value="">
                  {pickText(
                    {
                      ar: '— اختر من الحسابات المحملة —',
                      fr: '— Choisir un compte —',
                      en: '— Select from loaded directory —',
                    },
                    language,
                  )}
                </option>
                {directoryItems.map((acct) => (
                  <option key={acct.id} value={acct.id}>
                    {acct.fullName} (@{acct.username}) — {acct.accountStatus} [v
                    {acct.governanceVersion}]
                  </option>
                ))}
              </select>
              <input
                type="text"
                required
                value={appointTargetId}
                onChange={(e) => setAppointTargetId(e.target.value)}
                placeholder="00000000-0000-4000-8000-000000000000"
                className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-transparent px-3 py-1.5 text-xs font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold mb-1">
                  {pickText(
                    { ar: 'الدور القيادي', fr: 'Rôle privilégié', en: 'Privileged Role' },
                    language,
                  )}
                </label>
                <select
                  value={appointRole}
                  onChange={(e) => setAppointRole(e.target.value as PrivilegedRole)}
                  className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-xs font-bold"
                >
                  {PRIVILEGED_ROLES.map((r: PrivilegedRole) => (
                    <option key={r} value={r}>
                      {pickText(ROLE_LABELS[r], language)} ({r})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">
                  {pickText({ ar: 'الإجراء', fr: 'Action', en: 'Action' }, language)}
                </label>
                <select
                  value={appointAction}
                  onChange={(e) => setAppointAction(e.target.value as 'GRANT' | 'REVOKE')}
                  className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-xs font-bold"
                >
                  <option value="GRANT">
                    {pickText(
                      {
                        ar: 'تعيين / منح (GRANT)',
                        fr: 'Attribuer (GRANT)',
                        en: 'Appoint / Grant (GRANT)',
                      },
                      language,
                    )}
                  </option>
                  <option value="REVOKE">
                    {pickText(
                      {
                        ar: 'سحب الدور (REVOKE)',
                        fr: 'Retirer (REVOKE)',
                        en: 'Remove Role (REVOKE)',
                      },
                      language,
                    )}
                  </option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-bold mb-1">
                  {pickText(
                    {
                      ar: 'رقم نسخة الحوكمة المتوقع (expectedVersion)',
                      fr: 'Version attendue',
                      en: 'Expected Governance Version',
                    },
                    language,
                  )}
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={appointExpectedVersion}
                  onChange={(e) =>
                    setAppointExpectedVersion(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-transparent px-3 py-1.5 text-xs font-bold"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">
              {pickText(
                {
                  ar: 'سبب قرار التعيين / السحب (إلزامي لسجل التدقيق)',
                  fr: 'Motif d’audit obligatoire (3–500 caractères)',
                  en: 'Mandatory Audit Reason (3–500 chars)',
                },
                language,
              )}
            </label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={500}
              value={appointReason}
              onChange={(e) => setAppointReason(e.target.value)}
              placeholder={pickText(
                {
                  ar: 'مثال: تعيين مدير مساعد للمدرسة بعد التحقق من الهوية...',
                  fr: 'Ex: Nomination officielle au poste de Manager après vérification...',
                  en: 'e.g., Official School Owner appointment after identity verification...',
                },
                language,
              )}
              className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-xs"
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={appointConfirmed}
              onChange={(e) => setAppointConfirmed(e.target.checked)}
              className="rounded"
            />
            <span>
              {pickText(
                {
                  ar: 'أؤكد بصفتي مالك المدرسة (APP_ADMIN) تنفيذ هذا التغيير في الصلاحيات القيادية وتوثيقه في سجل التدقيق.',
                  fr: 'Je confirme en tant que Propriétaire (APP_ADMIN) cette modification de rôle privilégié.',
                  en: 'I explicitly confirm as School Owner (APP_ADMIN) this privileged role mutation and audit entry.',
                },
                language,
              )}
            </span>
          </label>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submittingAppoint || !appointConfirmed}
              className="rounded-xl bg-[#0D8AE8] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#0B76C7] disabled:opacity-50"
            >
              {pickText(
                {
                  ar: 'تنفيذ قرار الدور القيادي عبر الخادم',
                  fr: 'Exécuter la décision sur le serveur',
                  en: 'Commit Privileged Role Decision',
                },
                language,
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
