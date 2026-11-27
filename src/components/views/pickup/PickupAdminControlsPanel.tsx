import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, KeyRound, PlayCircle, ShieldOff } from 'lucide-react';
import type { AccountRole } from '../../../types.ts';
import type { TranslationKey } from '../../../i18n/translations.ts';
import type { PickupAdminNotice } from '../../../context/usePickupAdminActions.ts';
import type {
  PickupAvailabilityStatus,
  PickupProvisionResult,
  PickupReleaseAuthorityResult,
} from '../../../lib/domains/pickup.ts';
import { listAccountDirectory } from '../../../lib/governance/governanceQueries.ts';
import type { GovernanceAccountRecord } from '../../../lib/governance/governanceTypes.ts';
import { resolvePickupReasonText } from './pickupDisplayMessages.ts';

export interface PickupAdminControlsPanelProps {
  currentUserId?: string | null;
  currentRole: AccountRole;
  pickupAvailability: PickupAvailabilityStatus;
  t: (key: TranslationKey) => string;
  isProvisioningPickup?: boolean;
  isUpdatingReleaseAuthority?: boolean;
  pickupAdminNotice?: PickupAdminNotice | null;
  onProvisionCycles?: (schoolDate?: string | null) => Promise<PickupProvisionResult>;
  onRevokeReleaseAuthority?: (targetUserId: string, reason: string) => Promise<PickupReleaseAuthorityResult>;
  onReinstateReleaseAuthority?: (targetUserId: string, reason: string) => Promise<PickupReleaseAuthorityResult>;
}

const RELEASE_ELIGIBLE_ROLES = new Set<AccountRole>(['APP_ADMIN', 'MANAGER', 'ADMINISTRATIVE_PERSONNEL']);

export const PickupAdminControlsPanel: React.FC<PickupAdminControlsPanelProps> = ({
  currentUserId, currentRole, pickupAvailability, t,
  isProvisioningPickup = false, isUpdatingReleaseAuthority = false, pickupAdminNotice = null,
  onProvisionCycles, onRevokeReleaseAuthority, onReinstateReleaseAuthority,
}) => {
  const canProvision = RELEASE_ELIGIBLE_ROLES.has(currentRole) && Boolean(onProvisionCycles);
  const canManageAuthority = currentRole === 'APP_ADMIN' && Boolean(onRevokeReleaseAuthority || onReinstateReleaseAuthority);

  const [staffAccounts, setStaffAccounts] = useState<GovernanceAccountRecord[]>([]);
  const [targetUserId, setTargetUserId] = useState('');
  const [authorityReason, setAuthorityReason] = useState('');

  useEffect(() => {
    setTargetUserId('');
    setAuthorityReason('');
    setStaffAccounts([]);
  }, [currentUserId]);

  useEffect(() => {
    if (!canManageAuthority || pickupAvailability !== 'READY') return;
    let active = true;
    void listAccountDirectory({ status: 'APPROVED', limit: 100 }).then((res) => {
      if (!active || !res.ok || !res.data) return;
      const eligible = res.data.items.filter((acc) => acc.activeRoles.some((r: AccountRole) => RELEASE_ELIGIBLE_ROLES.has(r)));
      setStaffAccounts(eligible);
      setTargetUserId((prev) => prev || eligible[0]?.id || '');
    }).catch(() => {});
    return () => { active = false; };
  }, [canManageAuthority, pickupAvailability]);

  if ((!canProvision && !canManageAuthority) || pickupAvailability === 'UNAVAILABLE' || pickupAvailability === 'UNAUTHORIZED') {
    return null;
  }

  const cleanReason = authorityReason.trim();
  const canSubmitAuthority = Boolean(targetUserId.trim()) && cleanReason.length >= 3 && cleanReason.length <= 500 && !isUpdatingReleaseAuthority;

  return (
    <div className="space-y-3" data-testid="pickup-admin-controls-panel">
      {canProvision && onProvisionCycles && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111111] p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-gray-600 dark:text-gray-300">
            <span className="font-bold text-gray-900 dark:text-white">{t('pickupProvisionCyclesBtn')}</span>
          </div>
          <button
            type="button"
            data-testid="pickup-provision-cycles-btn"
            disabled={isProvisioningPickup}
            onClick={() => { void onProvisionCycles(); }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-3.5 py-2 text-xs font-bold text-white"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            <span>{isProvisioningPickup ? t('pickupProvisioning') : t('pickupProvisionCyclesBtn')}</span>
          </button>
        </div>
      )}

      {canManageAuthority && (
        <div data-testid="pickup-release-authority-panel"
          className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111111] p-4 space-y-3 text-xs">
          <div className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">
            <KeyRound className="w-4 h-4 text-emerald-600" />
            <span>{t('pickupReleaseAuthorityTitle')}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="space-y-1 block">
              <span className="font-semibold text-gray-700 dark:text-gray-300">{t('pickupTargetAccountLabel')}</span>
              {staffAccounts.length > 0 ? (
                <select
                  data-testid="pickup-authority-target-select"
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#161616] px-3 py-2 text-xs text-gray-900 dark:text-gray-100"
                >
                  {staffAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.fullName} ({acc.activeRoles.join(', ')})</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  data-testid="pickup-authority-target-id-input"
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  placeholder={t('pickupTargetUserIdPlaceholder')}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#161616] px-3 py-2 text-xs text-gray-900 dark:text-gray-100"
                />
              )}
            </label>
            <label className="space-y-1 block">
              <span className="font-semibold text-gray-700 dark:text-gray-300">{t('pickupAuthorityReasonLabel')}</span>
              <input
                type="text"
                data-testid="pickup-authority-reason-input"
                value={authorityReason}
                onChange={(e) => setAuthorityReason(e.target.value)}
                placeholder={t('pickupAuthorityReasonPlaceholder')}
                maxLength={500}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#161616] px-3 py-2 text-xs text-gray-900 dark:text-gray-100"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onRevokeReleaseAuthority && (
              <button
                type="button"
                data-testid="pickup-revoke-authority-btn"
                disabled={!canSubmitAuthority}
                onClick={() => { if (canSubmitAuthority) void onRevokeReleaseAuthority(targetUserId.trim(), cleanReason); }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-1.5 font-bold text-red-700 dark:text-red-300 disabled:opacity-50"
              >
                <ShieldOff className="w-3.5 h-3.5" />
                <span>{t('pickupRevokeReleaseBtn')}</span>
              </button>
            )}
            {onReinstateReleaseAuthority && (
              <button
                type="button"
                data-testid="pickup-reinstate-authority-btn"
                disabled={!canSubmitAuthority}
                onClick={() => { if (canSubmitAuthority) void onReinstateReleaseAuthority(targetUserId.trim(), cleanReason); }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 font-bold text-emerald-700 dark:text-emerald-300 disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{t('pickupReinstateReleaseBtn')}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {pickupAdminNotice && (
        <div data-testid="pickup-admin-notice"
          className={`rounded-2xl border p-3 text-xs flex items-center gap-2 ${
            pickupAdminNotice.ok
              ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
              : 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300'
          }`}>
          {pickupAdminNotice.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>
            {pickupAdminNotice.ok
              ? pickupAdminNotice.action === 'PROVISION'
                ? `${t('pickupProvisionSuccess')} (${t('pickupProvisionCreatedLabel')}: ${pickupAdminNotice.provisionedCount ?? 0}, ${t('pickupProvisionSkippedLabel')}: ${pickupAdminNotice.skippedCount ?? 0})`
                : t('pickupAuthorityUpdatedNotice')
              : resolvePickupReasonText(pickupAdminNotice.errorCode, t, pickupAdminNotice.message)}
          </span>
        </div>
      )}
    </div>
  );
};
